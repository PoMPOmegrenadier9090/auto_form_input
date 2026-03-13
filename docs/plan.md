# Plan: セキュアAI自動フォーム入力Chrome拡張機能

## TL;DR

LLMにユーザー機密情報を直接送信せず、フォーム要素のセマンティクス特定のみをLLMに委ね、ローカルで値を注入するChrome拡張機能を開発する。WXT + React + TypeScript + Tailwind CSSで構築し、案2ベースのハイブリッドDOM抽出（自動検出 + ユーザー調整 + 確認UI）を採用する。

---

## アーキテクチャ概要

```
[Options Page]          [Popup]
    │                      │
    ▼                      ▼
[chrome.storage.local]  [Content Script] ←→ [Background SW]
  (暗号化プロファイル)      │                      │
                          │                      ▼
                    DOM解析・入力実行         LLM API呼び出し
                                          (OpenAI / 他プロバイダ)
```

### データフロー
1. ユーザーがOptions Pageで個人情報をキー・値ペアとして登録（暗号化保存）
2. ユーザーがPopupまたはコンテキストメニューからフォーム入力を開始
3. Content Scriptがフォームコンテナを自動検出 → ユーザーが確認/調整
4. 選択コンテナ内のHTMLを浄化・最小化してBackgroundへ送信
5. Background SWがLLM APIを呼び出し、各入力要素のセマンティクスを特定
6. LLMは各入力要素に対応するプロファイルキーを返却（値は送信しない）
7. Content Scriptがキーに基づき暗号化ストレージから値を取得し入力実行

---

## 技術スタック

| カテゴリ         | 選定                                                           |
| ---------------- | -------------------------------------------------------------- |
| フレームワーク   | WXT (Vite ベース)                                              |
| フロントエンド   | React 18 + TypeScript                                          |
| スタイリング     | Tailwind CSS                                                   |
| UIコンポーネント | shadcn/ui                                                      |
| 状態管理         | Zustand                                                        |
| 暗号化           | Web Crypto API (PBKDF2 + AES-GCM)                              |
| LLM              | OpenAI (GPT-4o-mini 推奨) + 複数プロバイダ対応                 |
| Embedding        | Transformers.js (ONNX Runtime) — ブラウザ内推論 / API fallback |
| テスト           | Vitest + Playwright                                            |

---

## プロジェクト構成

```
auto_form_input/
├── entrypoints/
│   ├── background.ts                # Service Worker - LLM API呼出し・オーケストレーション
│   ├── content.ts                   # Content Script - DOM解析・フォーム入力
│   ├── content/
│   │   └── overlay.tsx              # コンテナ選択オーバーレイUI (Shadow DOM)
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx                  # ポップアップUI
│   └── options/
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx                  # オプションページ（プロファイル管理）
├── components/
│   ├── ui/                          # shadcn/ui コンポーネント
│   ├── ProfileEditor.tsx            # プロファイル編集コンポーネント
│   ├── ProfileFieldRow.tsx          # 個別フィールド行
│   ├── ProviderSettings.tsx         # LLMプロバイダ設定
│   └── MappingPreview.tsx           # マッピング結果プレビュー
├── lib/
│   ├── crypto.ts                    # 暗号化/復号ユーティリティ
│   ├── storage.ts                   # 暗号化ストレージラッパー
│   ├── dom-extractor.ts             # DOM抽出・浄化ロジック
│   ├── element-locator.ts           # 堅牢な要素特定（id/CSS/XPath）
│   ├── form-filler.ts               # フォーム入力実行ロジック
│   ├── container-detector.ts        # フォームコンテナ自動検出
│   ├── embedding/
│   │   ├── matcher.ts               # Embedding類似度マッチング
│   │   ├── local-engine.ts          # Transformers.js ローカル推論
│   │   └── api-engine.ts            # API fallback (OpenAI Embeddings等)
│   └── llm/
│       ├── types.ts                 # プロバイダ共通型定義
│       ├── provider.ts              # プロバイダ抽象インターフェース
│       ├── openai.ts                # OpenAI実装
│       ├── prompt-builder.ts        # プロンプト構築
│       └── response-parser.ts       # レスポンスパーサー
├── types/
│   └── index.ts                     # 共有型定義
├── public/
│   └── icon/                        # 拡張機能アイコン (16/48/128px)
├── wxt.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

---

## Steps

### Phase 1: プロジェクト初期構築

1. **WXTプロジェクト生成**: `npm create wxt@latest -- --template react-ts` でプロジェクトを生成
2. **依存関係インストール**: Tailwind CSS, shadcn/ui, Zustand, `@xenova/transformers`（Embeddingローカル推論用）
3. **wxt.config.ts に権限設定**: `permissions: ["storage", "activeTab", "scripting", "offscreen"]`, `host_permissions: ["https://api.openai.com/*"]`（他プロバイダのURLも追加可能に）。`offscreen`権限はEmbeddingモデルのローカル推論に必要
4. **基本ディレクトリ構造作成**: 上記プロジェクト構成に従いフォルダを作成

### Phase 2: 暗号化ストレージ & プロファイル管理

5. **暗号化ユーティリティ実装** (`lib/crypto.ts`):
   - PBKDF2でユーザーパスワードから鍵導出
   - AES-GCMで暗号化/復号
   - Web Crypto APIを使用（ブラウザネイティブ、外部依存なし）
6. **ストレージラッパー実装** (`lib/storage.ts`):
   - `chrome.storage.local` をラップ
   - 保存時に自動暗号化、取得時に自動復号
   - パスワード未設定時は平文保存（オプション）
7. **型定義** (`types/index.ts`):
   - `ProfileField`: `{ key: string, label: string, value: string, category: string, isPublic: boolean }`
   - `UserProfile`: `{ fields: ProfileField[], categories: string[] }`
   - `ElementLocator`: `{ strategy: "id" | "css" | "xpath", value: string }`
   - `FormElement`: `{ ref: string, locator: ElementLocator, tagName: string, type?: string }`
   - `LLMMapping`: `{ ref: string, key: string, confidence: number }`
   - `LLMProvider`: `{ name: string, apiKey: string, model: string, baseUrl: string }`
8. **Options Page実装** (`entrypoints/options/`):
   - プロファイルフィールドの追加/編集/削除UI
   - カテゴリ別グループ表示（氏名、住所、連絡先、勤務先、etc.）
   - 各フィールドの公開/非公開トグル
   - パスワード設定UI
   - デフォルトプロファイルテンプレート（日本住所向けキー等の初期値）
   - LLMプロバイダ設定（APIキー入力、モデル選択）
9. **デフォルトプロファイルテンプレート設計**:
   - 日本向け標準キー: `lastName`, `firstName`, `lastNameKana`, `firstNameKana`, `email`, `phone`, `zipCodeUpper`, `zipCodeLower`, `prefecture`, `city`, `address1`, `address2`, `birthYear`, `birthMonth`, `birthDay`, `company`, `department` 等
   - ユーザーが自由にカスタムキーを追加可能

*依存関係: Step 5 → Step 6 → Step 7 → Step 8*

### Phase 3: DOM解析エンジン（コアロジック）

10. **コンテナ自動検出** (`lib/container-detector.ts`):
    - `<form>` 要素の検出を最優先
    - form未使用の場合：入力要素の共通祖先（LCA）を探索
    - スコアリング: 入力要素数、可視性、ネスト深度を考慮
    - 複数フォームがある場合はビューポート内のものを優先
11. **DOM浄化・抽出** (`lib/dom-extractor.ts`):
    - 除去対象: `<script>`, `<style>`, `<svg>`, `<img>`, `<video>`, `<audio>`, `<canvas>`, `<noscript>`, コメントノード
    - 保持対象: `<input>`, `<select>`, `<textarea>`, `<label>`, `<fieldset>`, `<legend>`, `<option>`, テキストを含む構造要素
    - 保持する属性: `type`, `name`, `id`, `placeholder`, `aria-label`, `aria-describedby`, `required`, `value`（selectの選択肢）, `for`
    - 除去する属性: `class`, `style`, inline event handlers, `data-*`（`data-testid`等のセマンティクス無関連）
    - 各入力要素に `data-ref="1"`, `data-ref="2"` ... と連番refを付与（LLMプロンプト用の識別子）
    - 空白・改行の圧縮でトークン数を最小化
11b. **要素ロケーター生成** (`lib/element-locator.ts`):
    - 各入力要素に対し、入力実行時に要素を再特定するためのロケーターを生成
    - 優先順位: `id` → `name+type` 属性ベースCSS selector → ユニークCSS selector → XPath
    - 生成ロジック:
      - `id` が存在 → `#elementId`
      - `name` + `type` で一意に特定可能 → `input[name="last_name"][type="text"]`
      - 上記で一意にならない → nth-child等を加えたCSS selector
      - CSS selectorで一意にならない → XPath（`/html/body/div[2]/form/input[3]`）
    - ロケーターマップ生成: `Map<ref, { strategy: "id"|"css"|"xpath", value: string }>`
    - 生成されたロケーターの一意性を検証（querySelector/XPath.evaluateで重複チェック）
12. **コンテナ選択オーバーレイUI** (`entrypoints/content/overlay.tsx`):
    - Shadow DOM内にReactをマウント（ページスタイルとの干渉を回避）
    - WXTの `createShadowRootUi` を活用
    - 機能:
      - 自動検出コンテナをダッシュ罫線でハイライト
      - 検出された入力要素に番号バッジを表示
      - フローティングツールバー: [確認] [範囲を広げる] [手動選択] [キャンセル]
      - 「範囲を広げる」: 親要素に遡り、再ハイライト
      - 「手動選択」: ホバーでコンテナ候補をハイライト、クリックで選定
    - LLMマッピング結果表示:
      - 各入力要素の横に対応キー名をツールチップ表示
      - マッピング成功: 緑色、未マッピング: オレンジ色
      - [入力実行] [修正] [キャンセル] ボタン

*依存関係: Step 10, 11 は並列可能。Step 12 は Step 10, 11 に依存*

### Phase 4: LLM連携

13. **プロバイダ抽象化** (`lib/llm/types.ts`, `lib/llm/provider.ts`):
    - `LLMProvider` インターフェース: `analyze(prompt: string): Promise<LLMResponse>`
    - プロバイダ切替を容易にする設計
14. **OpenAI実装** (`lib/llm/openai.ts`):
    - Chat Completions API呼び出し
    - JSON mode (`response_format: { type: "json_object" }`) を使用
    - モデル選択: GPT-4o-mini（コスト効率）/ GPT-4o（精度重視）
    - エラーハンドリング（レート制限、APIキー無効等）
15. **プロンプト構築** (`lib/llm/prompt-builder.ts`):
    - システムプロンプト: フォーム解析エキスパートとしてのロール設定
    - ユーザープロンプト:
      - 利用可能キーの一覧（公開キーは値も含む、非公開キーはキー名のみ）
      - 浄化済みHTML
      - 期待する出力形式（JSON）
    - 出力形式: `{ mappings: [{ ref: "1", key: "lastName" }, ...], unmapped: ["3", "5"] }`
16. **レスポンスパーサー** (`lib/llm/response-parser.ts`):
    - JSONレスポンスのバリデーション
    - ref番号の存在確認
    - キー名がプロファイルに存在するかの確認

*依存関係: Step 13 → Step 14。Step 15, 16 は Step 13 と並列可能*

### Phase 5: フォーム入力エンジン

17. **フォーム入力ロジック** (`lib/form-filler.ts`):
    - ロケーターマップを使ってDOM要素を再特定（id → CSS → XPath の順にfallback）
    - 入力タイプ別の処理:
      - `text`, `email`, `tel`, `url`: 値を設定 + `input`, `change` イベント発火
      - `select`: Embeddingマッチャーを使用して最適な選択肢を選択（Step 17b参照）
      - `radio`, `checkbox`: Embeddingマッチャーで選択肢を照合
      - `date`: 日付フォーマット変換
      - `textarea`: テキスト入力
    - React/Vue等のフレームワーク対応:
      - `nativeInputValueSetter` を使ってReactの内部stateを更新
      - `InputEvent`, `Event` を適切にdispatch
    - 入力後のバリデーション確認（required属性への対応）
17b. **Embedding類似度マッチング** (`lib/embedding/`):
    - `<select>` のoption群 / `<radio>` の選択肢群とプロファイル値の意味的類似度を計算
    - **ローカルエンジン** (`lib/embedding/local-engine.ts`):
      - Transformers.js (ONNX Runtime Web) を使用してブラウザ内で推論
      - モデル: `Xenova/multilingual-e5-small`（多言語対応、94MB）
      - 初回ロード時にモデルをダウンロード、IndexedDBにキャッシュ
      - Background Service Worker の Offscreen Document 内で実行（SW内ではDOM/WASM不可のため）
    - **API エンジン** (`lib/embedding/api-engine.ts`):
      - OpenAI Embeddings API（`text-embedding-3-small`）をfallback として利用
      - ユーザー設定でローカル/API を切替可能
    - **マッチャー** (`lib/embedding/matcher.ts`):
      - コサイン類似度で選択肢をランク付け
      - 閾値以上の最上位の選択肢を採用（閾値未満の場合はマッピング無しとして報告）
      - selectの場合: プロファイル値 vs 各option text/value のコサイン類似度
      - radio の場合: プロファイル値 vs 各ラベルテキストのコサイン類似度

*依存関係: Step 17 は Step 11b (ロケーターマップ) と Step 16 (マッピング結果) に依存。Step 17b は独立して実装可能だが統合は Step 17 と同時*

### Phase 6: メッセージングとオーケストレーション

18. **メッセージング定義**:
    - Content Script → Background: `{ type: "ANALYZE_FORM", html: string, keys: string[] }`
    - Background → Content Script: `{ type: "MAPPING_RESULT", mappings: LLMMapping[] }`
    - Popup → Content Script: `{ type: "START_FILL" }`, `{ type: "SELECT_CONTAINER" }`
    - Popup → Background: `{ type: "GET_SETTINGS" }`
    - 型安全なメッセージングパターン（TypeScript discriminated union）
19. **Background Service Worker** (`entrypoints/background.ts`):
    - LLM API呼び出しの統括（Content ScriptからはCORS制約のためAPI直接呼出し不可）
    - ストレージ操作の仲介
    - コンテキストメニュー登録（右クリック→「フォームを自動入力」）
20. **Content Script** (`entrypoints/content.ts`):
    - ページロード時は待機（パフォーマンス考慮）
    - Popupまたはコンテキストメニューからのトリガーで動作開始
    - フロー: コンテナ検出 → ユーザー確認 → DOM抽出 → Background送信 → マッピング受信 → 値入力

*依存関係: Step 18 → Step 19, 20。Phase 3, 4, 5 の完了後に統合*

### Phase 7: Popup UI

21. **Popup UI** (`entrypoints/popup/App.tsx`):
    - メインボタン: 「フォームを自動入力」
    - 状態表示: 未設定 / 準備完了 / 解析中 / 入力完了
    - クイック設定: LLMプロバイダ選択、プロファイル選択
    - Optionsページへのリンク
    - 直近の入力履歴（オプション）

*Phase 2の完了後に実装可能*

### Phase 8: テスト

22. **ユニットテスト** (Vitest):
    - `lib/crypto.ts`: 暗号化・復号の正確性
    - `lib/dom-extractor.ts`: 各種HTML構造からの正しい抽出
    - `lib/element-locator.ts`: id/CSS/XPathロケーター生成の正確性、一意性検証
    - `lib/container-detector.ts`: フォームコンテナ検出精度
    - `lib/form-filler.ts`: 各入力タイプへの正しい値設定
    - `lib/embedding/matcher.ts`: コサイン類似度計算、閾値判定
    - `lib/llm/prompt-builder.ts`: プロンプト生成の正確性
    - `lib/llm/response-parser.ts`: 各種レスポンスのパース
23. **E2Eテスト** (Playwright):
    - テスト用HTMLフォームを用意
    - フォーム自動検出 → コンテナ選択 → LLM解析（モック） → 入力実行の一連フロー
    - Options Pageでのプロファイル設定

*テストは各Phase完了時に随時追加*

---

## Relevant Files

全ファイルは新規作成。参照すべき既存パターン:
- `.github/skills/chrome-extension-dev/references/patterns.md` — メッセージングパターン、Shadow DOM UI、ref番号システム、bot detection evasion
- `.github/skills/chrome-extension-dev/references/chrome-api.md` — chrome.storage, chrome.scripting API リファレンス
- `.github/skills/chrome-extension-dev/references/testing.md` — Vitest + Playwright テスト構成

---

## Verification

1. **Phase 2 検証**: Options Pageでプロファイルを登録し、ページリロード後もデータが復元されることを確認（暗号化/復号の往復テスト）
2. **Phase 3 検証**: 複数の実際のWebフォーム（住所入力、会員登録、問い合わせ等）でコンテナ検出・DOM抽出が正しく動作することを手動テスト
3. **Phase 4 検証**: 浄化済みHTMLとキーリストをLLMに送信し、マッピング結果のJSON形式・内容が正しいことをVitestで検証
4. **Phase 5 検証**: テスト用HTMLフォームに対し、マッピング結果に基づく値入力が全入力タイプで正しく動作することを確認
5. **Phase 8 検証**: 全ユニットテストパス、E2Eテストパスを確認
6. **統合検証**: `npm run dev` でHMR付き開発サーバー起動、実際のWebサイトで一連のフロー（プロファイル設定 → フォーム選択 → 解析 → 入力）を通しで確認

---

## Decisions

- **DOM抽出方式**: 案2ベースのハイブリッド（自動検出 + ユーザー調整）を採用。案1の周辺要素収集は、ラベルと入力要素が離れているケースに弱いため、コンテナ単位での取得をベースとする
- **要素特定方式**: `data-ref` はLLMプロンプト用の識別子として使用。入力実行時の要素特定にはロケーターマップ（id → CSS selector → XPath のフォールバック）を使用。idが存在しない/一意でないケースにも対応
- **LLMには値を送信しない**: 非公開キーはキー名のみ、公開キーは値も送信。LLMの役割はセマンティクス特定のみ
- **select/radioマッチング**: 軽量Embeddingモデルによるコサイン類似度でマッチング。ローカル推論（Transformers.js）を優先し、API fallbackも提供
- **暗号化方式**: Web Crypto API (PBKDF2 + AES-GCM)。外部ライブラリ依存なし
- **推奨モデル**: GPT-4o-mini（コスト効率と精度のバランス）
- **初期スコープに含めない**: 複数プロファイル切替、入力履歴、iframeサポート、マルチステップウィザード対応

---

## Further Considerations

1. **Token最適化のための段階的抽出**: 初回は入力要素の属性のみ(name, id, placeholder等)でマッピングを試み、曖昧な要素のみ周辺HTMLを追加送信する2段階方式。初期実装ではシンプルな1パス方式を採用し、将来的に導入を検討
2. **LLMレスポンスのキャッシュ**: 同一ドメイン・同一フォーム構造に対するマッピング結果をキャッシュし、再訪問時のAPI呼び出しを省略する仕組み。コスト削減に大きく寄与する可能性がある
3. **Embeddingモデルのサイズ vs 精度トレードオフ**: `multilingual-e5-small`（94MB、多言語高精度）vs `all-MiniLM-L6-v2`（23MB、軽量だが英語メイン）。日本語フォームが主ターゲットなら前者を推奨。Options Pageでモデル選択可能にすることも検討
