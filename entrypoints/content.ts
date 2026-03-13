import type { Message, FormElement, ContainerInfo, SelectionState } from '@/types';
import { detectContainers } from '@/lib/container-detector';
import { buildLocatorMap } from '@/lib/element-locator';
import { extractSanitizedHtml } from '@/lib/dom-extractor';
import { fillForm } from '@/lib/form-filler';
import { loadProfile } from '@/lib/storage';
import { LocalEmbeddingEngine } from '@/lib/embedding/local-engine';
import { FORM_INPUT_SELECTOR } from '@/lib/selectors';
import { debugGroup, debugLog, debugTable } from '@/lib/debug';
import {
  highlightContainer,
  highlightInputs,
  removeContainerHighlight,
  removeAllHighlights,
  showToolbar,
  removeOverlay,
  startClickSelect,
  cancelClickSelect,
  type ToolbarAction,
} from '@/lib/overlay';

// ── State ──

let activeContainers: Element[] = [];
const embeddingEngine = new LocalEmbeddingEngine();

function getContainerInfos(): ContainerInfo[] {
  return activeContainers.map((el, i) => ({
    index: i,
    inputCount: el.querySelectorAll(FORM_INPUT_SELECTOR).length,
    tagName: el.tagName.toLowerCase(),
    preview: (el.textContent || '').trim().slice(0, 30),
  }));
}

function buildState(phase: SelectionState['phase'], message: string, extra?: Partial<SelectionState>): SelectionState {
  return { phase, containers: getContainerInfos(), message, ...extra };
}

function buildConfidenceBuckets(confidences: number[]) {
  const buckets = { low: 0, medium: 0, high: 0 };
  for (const c of confidences) {
    if (c < 0.4) buckets.low += 1;
    else if (c < 0.75) buckets.medium += 1;
    else buckets.high += 1;
  }
  return buckets;
}

/**
 * プロンプトのトークン数を推定するために、選択されたコンテナのHTMLをサニタイズして結合し、その文字数と単語数からトークン数を概算する。
 * @param containers 選択されたコンテナの配列
 * @returns トークン数の推定値と関連情報
 */
function estimatePromptStatsFromContainers(containers: Element[]): {
  htmlCharCount: number;
  htmlWordCount: number;
  estimatedTokenCount: number;
  tokenWarning: boolean;
} {
  if (containers.length === 0) {
    return {
      htmlCharCount: 0,
      htmlWordCount: 0,
      estimatedTokenCount: 0,
      tokenWarning: false,
    };
  }

  const html = containers.map((c) => extractSanitizedHtml(c)).join('\n<!-- next container -->\n');
  const htmlCharCount = html.length;
  const plainText = html.replace(/<[^>]+>/g, ' ');
  const htmlWordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
  // Rough approximation: 1 token ~= 4 chars (English-heavy). Japanese can vary.
  const estimatedTokenCount = Math.ceil(htmlCharCount / 4);
  const tokenWarning = estimatedTokenCount > 12000;

  return {
    htmlCharCount,
    htmlWordCount,
    estimatedTokenCount,
    tokenWarning,
  };
}

/**
 * コンテナ選択のUIを更新する。選択中のコンテナ情報も含めて状態を構築し、ツールバーとPopupに通知する。
 * @param phase 
 * @param message 
 * @param extra 
 */
function updateUI(phase: SelectionState['phase'], message: string, extra?: Partial<SelectionState>): void {
  const stats = estimatePromptStatsFromContainers(activeContainers);
  const state = buildState(phase, message, {
    ...stats,
    ...extra,
  });
  // ツールバーを更新する
  showToolbar(state, handleToolbarAction);
  // Popup にも状態を通知
  browser.runtime.sendMessage({ type: 'SELECTION_STATE', state } satisfies Message).catch(() => {});
}

// ── Highlighting ──

function refreshHighlights(): void {
  removeAllHighlights();
  activeContainers.forEach(el => {
    highlightContainer(el);
    highlightInputs(el);
  });
}

// ── Toolbar action handler ──

function handleToolbarAction(action: ToolbarAction, index?: number): void {
  switch (action) {
    case 'confirm':
      handleConfirmAndFill();
      break;
    case 'add':
      handleAddContainer();
      break;
    case 'remove':
      if (index !== undefined) handleRemoveContainer(index);
      break;
    case 'cancel':
      handleCancel();
      break;
  }
}

async function handleAddContainer(): Promise<void> {
  updateUI('adding', 'ページ上をクリックしてコンテナを選択...');
  const selected = await startClickSelect();
  // Check if valid (has inputs)
  const inputs = selected.querySelectorAll(FORM_INPUT_SELECTOR);
  if (inputs.length === 0) {
    updateUI('selecting', '選択した要素に入力フィールドがありません。別の要素を選んでください。');
    return;
  }
  // Avoid duplicates
  if (!activeContainers.includes(selected)) {
    activeContainers.push(selected);
  }
  refreshHighlights();
  updateUI('selecting', `${activeContainers.length}個のコンテナを選択中`);
}

function handleRemoveContainer(index: number): void {
  if (index >= 0 && index < activeContainers.length) {
    removeContainerHighlight(activeContainers[index]);
    activeContainers.splice(index, 1);
    refreshHighlights();
  }
  updateUI('selecting', activeContainers.length > 0
    ? `${activeContainers.length}個のコンテナを選択中`
    : 'コンテナが選択されていません。追加してください。');
}

function handleCancel(): void {
  cancelClickSelect();
  removeAllHighlights();
  removeOverlay();
  activeContainers = [];
}

// ── Main flows ──

/**
 * フォームコンテナの自動検出とユーザーの確認と編集を可能にするエントリポイント。
 * @returns 
 */
function handleStartDetect(): void {
  activeContainers = [];
  updateUI('detecting', 'フォームを検出中...');

  const candidates = detectContainers();
  if (candidates.length === 0) {
    updateUI('selecting', 'フォームが自動検出できませんでした。手動で追加してください。');
    return;
  }

  // Use all detected candidates
  activeContainers = candidates.map(c => c.element as Element);
  refreshHighlights();
  updateUI('selecting', `${activeContainers.length}個のフォーム領域を検出しました`);
}


async function handleConfirmAndFill(): Promise<void> {
  if (activeContainers.length === 0) return;

  // Merge all form elements from all containers
  const allFormElements: FormElement[] = [];
  const allHtmlParts: string[] = [];

  // 各コンテナからサニタイズされたHTMLとフォーム要素を抽出し、全体のリストに追加する
  activeContainers.forEach((container, index) => {
    const refPrefix = `c${index + 1}`;
    const elements = buildLocatorMap(container, { refPrefix });
    allFormElements.push(...elements);
    allHtmlParts.push(extractSanitizedHtml(container));
  });

  debugGroup('[AutoFill] Ref assignment check', () => {
    debugTable(allFormElements.map((fe) => ({ ref: fe.ref, tag: fe.tagName, type: fe.type ?? '' })));
  });

  if (allFormElements.length === 0) {
    updateUI('error', '入力要素が見つかりませんでした。');
    return;
  }

  // セパレータで結合されたHTMLをLLMに送るために準備する
  const combinedHtml = allHtmlParts.join('\n<!-- next container -->\n');

  // Load profile
  const profile = await loadProfile();
  if (!profile || profile.fields.length === 0) {
    updateUI('error', 'プロファイルが未設定です。オプションページで設定してください。');
    return;
  }

  // LLM analysis
  updateUI('analyzing', 'AIがフォームを解析中...');
  debugGroup('[AutoFill] LLM request payload', () => {
    debugLog('combinedHtml length:', combinedHtml.length);
    debugLog('formElements:', allFormElements);
    debugLog('profile fields:', profile.fields.map((f) => ({ key: f.key, isPublic: f.isPublic, hasValue: !!f.value })));
  });

  const response = await browser.runtime.sendMessage({
    type: 'ANALYZE_FORM',
    html: combinedHtml,
    fields: profile.fields,
    formElements: allFormElements,
  } satisfies Message);

  if ('error' in response) {
    updateUI('error', response.error);
    return;
  }

  const { result } = response as Extract<Message, { type: 'MAPPING_RESULT' }>;

  debugGroup('[AutoFill] LLM mapped result', () => {
    debugLog(result);
  });

  // Fill form
  updateUI('filling', 'フォームに入力中...');
  const confidences = (result.steps ?? []).map((s) => s.confidence ?? 1);
  const fillResult = await fillForm(
    result,
    allFormElements,
    profile.fields,
    embeddingEngine,
  );

  debugGroup('[AutoFill] Fill execution summary', () => {
    debugLog('filled:', fillResult.filled);
    debugLog('failed refs:', fillResult.failed);
    debugLog('confidence buckets:', buildConfidenceBuckets(confidences));
  });

  removeAllHighlights();
  updateUI('done', '自動入力が完了しました', {
    filledCount: fillResult.filled,
    totalCount: allFormElements.length,
    confidenceBuckets: buildConfidenceBuckets(confidences),
  });
  activeContainers = [];
}

// ── Entry point ──

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    browser.runtime.onMessage.addListener(
      (message: Message, _sender, sendResponse) => {
        switch (message.type) {
          case 'START_DETECT':
            handleStartDetect();
            sendResponse({ ok: true });
            return false;

          case 'ADD_CONTAINER':
            handleAddContainer().then(() => sendResponse({ ok: true }));
            return true;

          case 'REMOVE_CONTAINER':
            handleRemoveContainer(message.index);
            sendResponse({ ok: true });
            return false;

          case 'CONFIRM_AND_FILL':
            handleConfirmAndFill()
              .then(() => sendResponse({ ok: true }))
              .catch(err => sendResponse({ error: String(err) }));
            return true;

          case 'CANCEL_SELECTION':
            handleCancel();
            sendResponse({ ok: true });
            return false;
        }
      },
    );
  },
});
