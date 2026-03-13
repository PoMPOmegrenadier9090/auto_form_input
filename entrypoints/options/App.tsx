import { useState, useEffect, useCallback } from 'react';
import type { UserProfile, ProfileField, AppSettings } from '@/types';
import {
  createDefaultProfile,
  createDefaultSettings,
  loadProfile,
  loadSettings,
  saveProfile,
  saveSettings,
} from '@/lib/storage';

type Tab = 'profile' | 'settings';

function App() {
  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<UserProfile>(createDefaultProfile());
  const [settings, setSettings] = useState<AppSettings>(createDefaultSettings());
  const [saveStatus, setSaveStatus] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedProfile, storedSettings] = await Promise.all([
        loadProfile(),
        loadSettings(),
      ]);
      if (storedProfile) setProfile(storedProfile);
      if (storedSettings) setSettings(storedSettings);
      setLoaded(true);
    })();
  }, []);

  // 保存時のメッセージ表示
  const showSaved = useCallback(() => {
    setSaveStatus('保存しました');
    setTimeout(() => setSaveStatus(''), 2000);
  }, []);

  // profileをstorageに保存する関数
  const onSaveProfile = async () => {
    await saveProfile(profile);
    showSaved();
  };

  // app_settingsをstorageに保存する関数
  const onSaveSettings = async () => {
    await saveSettings(settings);
    showSaved();
  };

  const updateField = (index: number, updates: Partial<ProfileField>) => {
    setProfile(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === index ? { ...f, ...updates } : f)),
    }));
  };

  /**
   * 新しいフィールドを追加する関数
   */
  const addField = () => {
    // TODO: フィールドの追加場所をどうにかするか，スクロールが欲しいかも
    setProfile(prev => ({
      ...prev,
      fields: [
        ...prev.fields,
        { key: `custom_${Date.now()}`, label: '', value: '', category: '氏名', isPublic: false },
      ],
    }));
  };

  /**
   * ラベル定義のフィールドを削除する関数
   * @param index 削除するフィールドのインデックス
   */
  const removeField = (index: number) => {
    setProfile(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index),
    }));
  };

  if (!loaded) {
    return <div className="p-8 text-center text-gray-400">読み込み中...</div>;
  }

  const grouped = profile.categories.map(cat => ({
    category: cat,
    fields: profile.fields
      .map((f, i) => ({ ...f, _index: i }))
      .filter(f => f.category === cat),
  }));

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">AI フォーム自動入力 設定</h1>

      {/* Tab navigation */}
      <div className="flex border-b mb-6">
        {([['profile', 'プロフィール'], ['settings', 'LLM設定']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {saveStatus && (
        <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          {saveStatus}
        </div>
      )}

      {/* Profile tab */}
      {tab === 'profile' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            <span className="text-orange-500 font-medium">公開</span>フィールドはラベルと値がLLMに送信されます。
            <span className="text-blue-500 font-medium">非公開</span>フィールドはラベルのみ送信されます。
          </p>

          {grouped.map(({ category, fields }) => (
            <div key={category} className="mb-6">
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2 border-b pb-1">
                {category}
              </h2>
              <div className="space-y-2">
                {fields.map(field => (
                  <div key={field._index} className="flex items-center gap-2">
                    {/* ラベル */}
                    <input
                      type="text"
                      value={field.label}
                      onChange={e => updateField(field._index, { label: e.target.value })}
                      placeholder="ラベル"
                      className="w-28 px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    {/* バリュー */}
                    <input
                      type="text"
                      value={field.value}
                      onChange={e => updateField(field._index, { value: e.target.value })}
                      placeholder="値"
                      className="flex-1 px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    {/* 公開/非公開切り替え */}
                    <button
                      onClick={() => updateField(field._index, { isPublic: !field.isPublic })}
                      title={field.isPublic ? '公開（LLMに値を送信）' : '非公開（ラベルのみ送信）'}
                      className={`px-2 py-1 text-xs rounded ${
                        field.isPublic
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {field.isPublic ? '公開' : '非公開'}
                    </button>
                    {/* カテゴリの切り替え */}
                    <select
                      value={field.category}
                      onChange={e => updateField(field._index, { category: e.target.value })}
                      className="px-1 py-1 text-xs border rounded"
                    >
                      {profile.categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeField(field._index)}
                      className="text-red-400 hover:text-red-600 text-sm"
                      title="削除"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-3 mt-4">
            <button
              onClick={addField}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              + フィールド追加
            </button>
            <button
              onClick={onSaveProfile}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              プロフィールを保存
            </button>
          </div>
        </div>
      )}

      {/* Settings tab */}
      {tab === 'settings' && (
        <div className="space-y-6">
          {/* LLM Provider */}
          <section>
            <h2 className="text-sm font-semibold text-gray-600 mb-3">LLMプロバイダー</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">APIキー</label>
                <input
                  type="password"
                  value={settings.llmProvider.apiKey}
                  onChange={e =>
                    setSettings(s => ({
                      ...s,
                      llmProvider: { ...s.llmProvider, apiKey: e.target.value },
                    }))
                  }
                  placeholder="sk-..."
                  className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">モデル</label>
                  <input
                    type="text"
                    value={settings.llmProvider.model}
                    onChange={e =>
                      setSettings(s => ({
                        ...s,
                        llmProvider: { ...s.llmProvider, model: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">ベースURL</label>
                  <input
                    type="text"
                    value={settings.llmProvider.baseUrl}
                    onChange={e =>
                      setSettings(s => ({
                        ...s,
                        llmProvider: { ...s.llmProvider, baseUrl: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          <button
            onClick={onSaveSettings}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            設定を保存
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
