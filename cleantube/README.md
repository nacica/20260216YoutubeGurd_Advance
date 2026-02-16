# CleanTube - 広告なしYouTubeビューアー PWA

広告ゼロ・ショート動画ゼロの YouTube 閲覧用 PWA です。

## 特徴

- **広告なし**: youtube-nocookie.com の embed プレーヤーを使用
- **Shorts除外**: 60秒以下の動画とShortsタグ付き動画を自動除外
- **PWA対応**: iPhone のホーム画面に追加してアプリとして使用可能
- **サーバー不要**: GitHub Pages で無料ホスティング
- **プライバシー**: ユーザーデータは一切外部送信しません

## セットアップ

### 1. YouTube Data API v3 キーの取得

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを新規作成
3. 「APIとサービス」→「ライブラリ」→「YouTube Data API v3」を有効化
4. 「認証情報」→「認証情報を作成」→「APIキー」
5. 生成されたキーをコピー

**推奨**: APIキーにHTTPリファラー制限を設定してください:
- Google Cloud Console → 認証情報 → キー制限 → HTTPリファラー
- 許可: `https://<username>.github.io/*`

### 2. デプロイ（GitHub Pages）

```bash
# リポジトリ作成 & プッシュ
gh repo create cleantube --public --source=. --push

# GitHub Pages を有効化
# Settings → Pages → Source: "Deploy from a branch" → Branch: main → / (root) → Save
```

数分後に `https://<username>.github.io/cleantube/` でアクセス可能になります。

### 3. ローカルで動作確認

```bash
cd cleantube
python3 -m http.server 8000
# http://localhost:8000 にアクセス
```

### 4. iPhoneに追加

1. Safari で上記URLにアクセス
2. 共有ボタン → 「ホーム画面に追加」
3. アプリとして起動し、APIキーを入力

## APIクォータについて

YouTube Data API v3 の無料枠は **1日10,000ユニット** です。

| アクション | コスト |
|-----------|--------|
| トレンド取得 | 1 unit |
| 検索 | 約101 units |
| 動画再生 | 1 unit |
| チャンネル表示 | 約102 units |

通常の個人利用では1日の上限に達することはありません。

## 技術スタック

- vanilla HTML/CSS/JavaScript（ビルド不要）
- YouTube Data API v3
- PWA (Service Worker + Manifest)
- GitHub Pages
