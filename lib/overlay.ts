/**
 * Overlay UI for interactive container selection and form auto-fill.
 * Highlights containers and input elements using injected styles.
 */

import type { SelectionState, ContainerInfo } from '@/types';
import { FORM_INPUT_SELECTOR } from './selectors';

// ── Highlight styles ──

const CONTAINER_HIGHLIGHT_CLASS = 'ai-ff-container';
const INPUT_HIGHLIGHT_CLASS = 'ai-ff-input';
const STYLE_ID = 'ai-form-filler-styles';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${CONTAINER_HIGHLIGHT_CLASS} {
      outline: 3px solid #3b82f6 !important;
      outline-offset: 2px !important;
      position: relative;
    }
    .${INPUT_HIGHLIGHT_CLASS} {
      box-shadow: 0 0 0 2px #22c55e !important;
      border-radius: 2px;
    }
  `;
  document.head.appendChild(style);
}

export function highlightContainer(element: Element): void {
  ensureStyles();
  element.classList.add(CONTAINER_HIGHLIGHT_CLASS);
}

export function highlightInputs(container: Element): void {
  ensureStyles();
  const inputs = container.querySelectorAll(FORM_INPUT_SELECTOR);
  inputs.forEach(el => el.classList.add(INPUT_HIGHLIGHT_CLASS));
}

export function removeContainerHighlight(element: Element): void {
  element.classList.remove(CONTAINER_HIGHLIGHT_CLASS);
  // Also remove input highlights inside
  element.querySelectorAll(`.${INPUT_HIGHLIGHT_CLASS}`).forEach(el =>
    el.classList.remove(INPUT_HIGHLIGHT_CLASS),
  );
}

export function removeAllHighlights(): void {
  document.querySelectorAll(`.${CONTAINER_HIGHLIGHT_CLASS}`).forEach(el =>
    el.classList.remove(CONTAINER_HIGHLIGHT_CLASS),
  );
  document.querySelectorAll(`.${INPUT_HIGHLIGHT_CLASS}`).forEach(el =>
    el.classList.remove(INPUT_HIGHLIGHT_CLASS),
  );
}

// ── Floating toolbar (Shadow DOM) ──

const OVERLAY_ID = 'ai-form-filler-overlay';

export type ToolbarAction = 'confirm' | 'add' | 'cancel' | 'remove';
export type ToolbarCallback = (action: ToolbarAction, index?: number) => void;

let currentCallback: ToolbarCallback | null = null;

/**
 * DOMコンテナ選択のためのオーバーレイUIを表示する。
 * @param state 
 * @param onAction 
 * @returns 
 */
export function showToolbar(state: SelectionState, onAction: ToolbarCallback): void {
  currentCallback = onAction;
  let host = document.getElementById(OVERLAY_ID);

  if (!host) {
    host = document.createElement('div');
    host.id = OVERLAY_ID;
    host.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .panel {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.12); padding: 12px 16px;
        min-width: 260px; max-width: 320px; font-size: 13px; color: #1a202c;
      }
      .title { font-weight: 600; margin-bottom: 8px; display:flex; align-items:center; gap:6px; }
      .message { color: #4a5568; line-height: 1.5; margin-bottom: 8px; }
      .containers { margin-bottom: 8px; }
      .container-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 4px 8px; border-radius: 6px; background: #f1f5f9;
        margin-bottom: 4px; font-size: 12px;
      }
      .container-item .info { color: #334155; }
      .container-item .count { color: #3b82f6; font-weight: 600; }
      .remove-btn {
        background: none; border: none; cursor: pointer; color: #94a3b8;
        font-size: 14px; padding: 0 4px;
      }
      .remove-btn:hover { color: #ef4444; }
      .actions { display: flex; gap: 6px; flex-wrap: wrap; }
      .btn {
        padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;
        font-size: 12px; font-weight: 500; transition: background 0.15s;
      }
      .btn-primary { background: #3b82f6; color: #fff; }
      .btn-primary:hover { background: #2563eb; }
      .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      .btn-secondary { background: #f1f5f9; color: #334155; }
      .btn-secondary:hover { background: #e2e8f0; }
      .btn-danger { background: #fef2f2; color: #dc2626; }
      .btn-danger:hover { background: #fee2e2; }
      .spinner {
        display:inline-block; width:14px; height:14px; border:2px solid #e2e8f0;
        border-top-color:#3b82f6; border-radius:50%; animation:spin .6s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .success { color: #16a34a; }
      .error { color: #dc2626; }
      .hint { font-size: 11px; color: #94a3b8; margin-top: 4px; }
      .confidence-row { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
      .prompt-stats { margin-top: 6px; font-size: 11px; color: #475569; }
      .prompt-warn { margin-top: 4px; font-size: 11px; color: #b45309; }
      .chip {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 600;
      }
      .chip-low { background: #fef3c7; color: #92400e; }
      .chip-medium { background: #dbeafe; color: #1d4ed8; }
      .chip-high { background: #dcfce7; color: #166534; }
    `;
    shadow.appendChild(style);

    const panel = document.createElement('div');
    panel.className = 'panel';
    shadow.appendChild(panel);
    document.body.appendChild(host);
  }

  const shadow = host.shadowRoot;
  if (!shadow) return;
  const panel = shadow.querySelector('.panel') as HTMLElement;
  if (!panel) return;

  panel.innerHTML = renderToolbarContent(state);
  bindToolbarEvents(panel, state);
}

/**
 * ツールバーの内容を状態に応じてレンダリングする。コンテナリストや状態に応じたアクションボタンもここで生成する。
 * @param state 
 * @returns 
 */
function renderToolbarContent(state: SelectionState): string {
  const { phase, containers, message } = state;

  let icon = '';
  if (phase === 'detecting' || phase === 'analyzing' || phase === 'filling') {
    icon = '<span class="spinner"></span>';
  } else if (phase === 'done') {
    icon = '<span class="success">✓</span>';
  } else if (phase === 'error') {
    icon = '<span class="error">✕</span>';
  } else {
    icon = '📋';
  }

  let html = `<div class="title">${icon} AI フォーム自動入力</div>`;
  html += `<div class="message">${escapeHtml(message)}</div>`;

  // Container list
  if (containers.length > 0 && (phase === 'selecting' || phase === 'adding' || phase === 'editing')) {
    html += '<div class="containers">';
    for (const c of containers) {
      html += `<div class="container-item">
        <span class="info">&lt;${escapeHtml(c.tagName)}&gt; ${escapeHtml(c.preview)}</span>
        <span class="count">${c.inputCount}件</span>
        <button class="remove-btn" data-action="remove" data-index="${c.index}" title="削除">✕</button>
      </div>`;
    }
    html += '</div>';
  }

  // Status-specific views
  if (phase === 'done' && state.filledCount !== undefined) {
    html += `<div class="hint">${state.filledCount}/${state.totalCount} フィールド入力済み</div>`;
    if (state.confidenceBuckets) {
      html += `<div class="confidence-row">
        <span class="chip chip-low">低 ${state.confidenceBuckets.low}</span>
        <span class="chip chip-medium">中 ${state.confidenceBuckets.medium}</span>
        <span class="chip chip-high">高 ${state.confidenceBuckets.high}</span>
      </div>`;
    }
  }

  if ((phase === 'selecting' || phase === 'adding' || phase === 'analyzing') && state.estimatedTokenCount !== undefined) {
    html += `<div class="prompt-stats">推定サイズ: ${state.htmlWordCount ?? 0} words / ${state.htmlCharCount ?? 0} chars / ~${state.estimatedTokenCount} tokens</div>`;
    if (state.tokenWarning) {
      html += '<div class="prompt-warn">コンテキスト上限に近い可能性があります。コンテナを絞ってください。</div>';
    }
  }

  // Action buttons
  // メッセージはcontent.tsのhandleToolbarActionで定義される
  if (phase === 'selecting') {
    html += `<div class="actions">
      <button class="btn btn-primary" data-action="confirm" ${containers.length === 0 ? 'disabled' : ''}>確定して入力</button>
      <button class="btn btn-secondary" data-action="add">+ コンテナ追加</button>
      <button class="btn btn-danger" data-action="cancel">キャンセル</button>
    </div>`;
  } else if (phase === 'adding' || phase === 'editing') {
    html += `<div class="hint">ページ上の要素をクリックしてコンテナを選択してください</div>`;
    html += `<div class="actions" style="margin-top:8px;">
      <button class="btn btn-danger" data-action="cancel">キャンセル</button>
    </div>`;
  }

  return html;
}

/**
 * ツールバー上のボタンにイベントリスナーをバインドする．
 * @param panel 
 * @param state 
 */
function bindToolbarEvents(panel: HTMLElement, state: SelectionState): void {
  panel.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = (btn as HTMLElement).dataset.action as ToolbarAction;
      const index = (btn as HTMLElement).dataset.index ? Number((btn as HTMLElement).dataset.index) : undefined;
      currentCallback?.(action, index);
    });
  });

  // Auto-dismiss for done/error
  if (state.phase === 'done') {
    setTimeout(() => removeOverlay(), 5000);
  } else if (state.phase === 'error') {
    setTimeout(() => removeOverlay(), 8000);
  }
}

export function removeOverlay(): void {
  const host = document.getElementById(OVERLAY_ID);
  if (host) host.remove();
  currentCallback = null;
}

// ── Click-to-select container ──

let selectResolve: ((el: Element) => void) | null = null;
let selectCleanup: (() => void) | null = null;

/**
 * Enter click-to-select mode. Returns a Promise that resolves
 * with the clicked element (or its closest block-level parent).
 */
export function startClickSelect(): Promise<Element> {
  cancelClickSelect();

  return new Promise<Element>((resolve) => {
    selectResolve = resolve;
    let hovered: Element | null = null;

    const onMouseOver = (e: MouseEvent) => {
      if (hovered) (hovered as HTMLElement).style.outline = '';
      hovered = e.target as Element;
      (hovered as HTMLElement).style.outline = '2px dashed #f59e0b';
    };

    const onMouseOut = () => {
      if (hovered) (hovered as HTMLElement).style.outline = '';
      hovered = null;
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (hovered) (hovered as HTMLElement).style.outline = '';
      cleanup();
      // Pick the closest container-like parent if the target is an inline element
      const target = (e.target as Element).closest('form, div, section, fieldset, table, main, article') || e.target as Element;
      resolve(target);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (hovered) (hovered as HTMLElement).style.outline = '';
        cleanup();
        // resolve with a dummy so the flow can handle cancellation
        resolve(document.createElement('div'));
      }
    };

    const cleanup = () => {
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.cursor = '';
      selectResolve = null;
      selectCleanup = null;
    };

    selectCleanup = cleanup;
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  });
}

export function cancelClickSelect(): void {
  selectCleanup?.();
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
