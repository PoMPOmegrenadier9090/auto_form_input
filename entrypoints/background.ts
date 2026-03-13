import type { Message, LLMAnalysisResult } from '@/types';
import { loadSettings } from '@/lib/storage';
import { createProvider } from '@/lib/llm/provider';
import { buildPrompt } from '@/lib/llm/prompt-builder';
import { debugGroup, debugLog } from '@/lib/debug';

export default defineBackground(() => {
  // Context menu
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus?.create({
      id: 'auto-form-fill',
      title: 'フォームを自動入力',
      contexts: ['page', 'editable'],
    });
  });

  browser.contextMenus?.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'auto-form-fill' && tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: 'START_DETECT' } satisfies Message);
    }
  });

  // Message handler
  browser.runtime.onMessage.addListener(
    (message: Message, _sender, sendResponse) => {
      // LLMによりフォーム解析を実行
      if (message.type === 'ANALYZE_FORM') {
        handleAnalyzeForm(message)
          .then((result) => sendResponse({ type: 'MAPPING_RESULT', result } satisfies Message))
          .catch((err) => sendResponse({ error: String(err) }));
        return true; // async response
      }

      if (message.type === 'GET_SETTINGS') {
        loadSettings()
          .then((settings) => sendResponse(settings))
          .catch((err) => sendResponse({ error: String(err) }));
        return true;
      }
    },
  );
});

async function handleAnalyzeForm(
  message: Extract<Message, { type: 'ANALYZE_FORM' }>,
): Promise<LLMAnalysisResult> {
  const settings = await loadSettings();
  if (!settings?.llmProvider?.apiKey) {
    throw new Error('LLM APIキーが設定されていません。オプションページで設定してください。');
  }

  const { systemPrompt, userPrompt } = buildPrompt(
    message.html,
    message.fields,
  );

  debugGroup('[AutoFill][LLM] analyze request', () => {
    debugLog('formElements:', message.formElements.length);
    debugLog('fields:', message.fields.map((f) => ({ key: f.key, isPublic: f.isPublic, hasValue: !!f.value })));
    debugLog('systemPrompt:', systemPrompt);
    debugLog('userPrompt:', userPrompt);
  });

  const provider = createProvider(settings.llmProvider);
  const result = await provider.analyze(userPrompt, systemPrompt);

  debugGroup('[AutoFill][LLM] analyze response', () => {
    debugLog('steps:', result.steps ?? []);
    debugLog('unmapped:', result.unmapped ?? []);
  });

  return result;
}
