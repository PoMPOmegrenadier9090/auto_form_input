import { useState, useEffect } from 'react';
import type { Message } from '@/types';
import { loadSettings } from '@/lib/storage';

type Phase = 'idle' | 'active' | 'error';

function App() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [confidenceText, setConfidenceText] = useState('');
  const [promptSizeText, setPromptSizeText] = useState('');

  useEffect(() => {
    (async () => {
      const settings = await loadSettings();
      setHasApiKey(!!settings?.llmProvider?.apiKey);
    })();

    // Listen for state updates from content script
    const listener = (msg: Message) => {
      if (msg.type === 'SELECTION_STATE') {
        const s = msg.state;
        if (s.estimatedTokenCount !== undefined) {
          const warn = s.tokenWarning ? ' ⚠' : '';
          setPromptSizeText(`推定: ${s.htmlWordCount ?? 0} words / ${s.htmlCharCount ?? 0} chars / ~${s.estimatedTokenCount} tokens${warn}`);
        } else {
          setPromptSizeText('');
        }

        if (s.phase === 'error') {
          setPhase('error');
          setMessage(s.message);
        } else if (s.phase === 'done') {
          setPhase('idle');
          setMessage(s.filledCount !== undefined
            ? `完了: ${s.filledCount}/${s.totalCount} フィールド入力済み`
            : s.message);
          if (s.confidenceBuckets) {
            setConfidenceText(`信頼度 低:${s.confidenceBuckets.low} / 中:${s.confidenceBuckets.medium} / 高:${s.confidenceBuckets.high}`);
          } else {
            setConfidenceText('');
          }
        } else {
          setPhase('active');
          setMessage(s.message);
          setConfidenceText('');
        }
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  const handleDetect = async () => {
    setPhase('active');
    setMessage('フォーム検出中...');
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('アクティブなタブが見つかりません');

      await browser.tabs.sendMessage(tab.id, { type: 'START_DETECT' });
      // ツールバーが表示されるのでPopupは閉じる
      setTimeout(() => window.close(), 300);
    } catch (e) {
      setPhase('error');
      setMessage(e instanceof Error ? e.message : '不明なエラー');
    }
  };

  const openOptions = async () => {
    await browser.tabs.create({
      url: browser.runtime.getURL('/options.html'),
    });
    window.close();
  };

  return (
    <div className="w-74 p-4 bg-white">
      <h1 className="text-lg font-bold text-gray-800 mb-3">
        AI フォーム自動入力
      </h1>

      {!hasApiKey && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
          APIキーが未設定です。設定画面から設定してください。
        </div>
      )}

      <button
        onClick={handleDetect}
        disabled={phase === 'active' || !hasApiKey}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {phase === 'active' ? '検出中...' : 'フォームを検出して入力'}
      </button>

      <p className="mt-2 text-xs text-gray-400">
        クリックするとフォーム領域を自動検出します。手動でコンテナを追加・編集することもできます。
      </p>

      {message && (
        <p className={`mt-2 text-xs ${phase === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}

      {confidenceText && (
        <p className="mt-1 text-xs text-blue-700">
          {confidenceText}
        </p>
      )}

      {promptSizeText && (
        <p className="mt-1 text-xs text-slate-600">
          {promptSizeText}
        </p>
      )}

      <div className="mt-4 border-t pt-3">
        <button
          onClick={openOptions}
          className="w-full py-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors"
        >
          ⚙ 設定・プロフィール管理
        </button>
      </div>
    </div>
  );
}

export default App;
