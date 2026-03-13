import type { Message, LLMAnalysisResult } from '@/types';
import { loadProfile, loadSettings } from '@/lib/storage';
import { createProvider } from '@/lib/llm/provider';
import { buildPrompt } from '@/lib/llm/prompt-builder';

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
      browser.tabs.sendMessage(tab.id, { type: 'START_AUTOFILL' } satisfies Message);
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

  const provider = createProvider(settings.llmProvider);
  return provider.analyze(userPrompt, systemPrompt);
}
