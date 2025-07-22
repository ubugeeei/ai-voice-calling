# WebRTC Voice Call Application

WebRTC音声通話アプリケーション（monorepo構成）

## 構成

```
.
├── app/
│   ├── client/    # Vite + TypeScript クライアント
│   └── server/    # Node.js + TypeScript シグナリングサーバー
└── pnpm-workspace.yaml
```

## セットアップ

### 前提条件

- Node.js 16以上
- pnpm 8以上

### インストール

```bash
pnpm install
```

## 開発

### 両方のアプリケーションを起動

```bash
pnpm dev:all
```

### 個別に起動

クライアント:
```bash
pnpm dev
```

シグナリングサーバー:
```bash
pnpm dev:server
```

## ビルド

全体:
```bash
pnpm build
```

個別:
```bash
pnpm build:client
pnpm build:server
```

## 使い方

1. 開発サーバーを起動後、ブラウザで `http://localhost:5173` を開く
2. 同じルームIDを2つの異なるブラウザタブ/ウィンドウで入力
3. "Start Call"ボタンをクリックして通話開始
4. マイクへのアクセス許可を与える
5. 通話終了時は"Hang Up"ボタンをクリック

## 技術スタック

- **Monorepo**: pnpm workspace
- **Client**: Vite, TypeScript, WebRTC API, Azure Speech SDK
- **Server**: Node.js, Express, WebSocket (ws), TypeScript
- **AI**: Azure Speech Service, OpenAI API (Azure OpenAIまたは標準OpenAI)

## 設定

### 環境変数

`.env.example`をコピーして`.env`を作成し、以下を設定：

1. **Azure Speech Service** (必須)
   - `AZURE_SPEECH_KEY`: Speech Serviceのキー
   - `AZURE_SPEECH_REGION`: リージョン（例: japaneast）

2. **AI Service** (どちらか一方を選択)
   
   **Option 1: Azure OpenAI**
   ```env
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_KEY=your_azure_openai_key
   AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
   ```

   **Option 2: 標準OpenAI**
   ```env
   AZURE_OPENAI_KEY=sk-your_openai_api_key
   ```