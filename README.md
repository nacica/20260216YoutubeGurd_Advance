# CleanTube - 広告なし・ショートなし YouTube ビューアー PWA

広告とショート動画が一切表示されない、クリーンな YouTube 視聴アプリです。  
iPhone のホーム画面に追加して使えます。

## 特徴

- **広告ゼロ**: youtube-nocookie.com の埋め込みプレーヤーで広告なし再生
- **ショート動画ゼロ**: 60秒以下の動画を自動除外
- **PWA対応**: iPhone のホーム画面に追加してネイティブアプリ風に使用可能
- **完全無料**: GitHub Pages でホスティング、YouTube API 無料枠で運用
- **プライバシー重視**: データは端末のみに保存、外部送信なし

## セットアップ

### 1. YouTube Data API v3 の API キーを取得

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを新規作成（または既存のプロジェクトを選択）
3. 「APIとサービス」→「ライブラリ」→ **YouTube Data API v3** を検索して有効化
4. 「認証情報」→「認証情報を作成」→「APIキー」
5. 生成されたキーをコピー

**推奨**: キー制限を設定  
→ 認証情報 → キーをクリック → 「アプリケーションの制限」→「HTTP リファラー」  
→ `https://<あなたのユーザー名>.github.io/*` を追加

### 2. GitHub Pages にデプロイ

```bash
# リポジトリをクローン（またはフォーク）
git clone https://github.com/<username>/cleantube.git
cd cleantube

# GitHub Pages を有効化
# リポジトリの Settings → Pages → Source: Deploy from a branch → Branch: main → Save
```

数分後に `https://<username>.github.io/cleantube/` でアクセス可能になります。

### 3. iPhone でホーム画面に追加

1. Safari で上記 URL にアクセス
2. 共有ボタン（□↑）をタップ
3. 「ホーム画面に追加」をタップ
4. 「追加」をタップ

### 4. 初回起動

1. CleanTube を開く
2. 取得した API キーを入力
3. 「設定する」をタップ
4. トレンド動画が表示されれば完了！

## API クォータについて

YouTube Data API v3 の無料枠は **1日 10,000 ユニット** です。

| アクション | コスト | 1日の目安 |
|-----------|--------|----------|
| トレンド表示 | 1 unit | 何度でも |
| 動画検索 | ~101 units | 約99回 |
| 動画再生（詳細取得） | 1 unit | 何度でも |

通常の個人利用であれば十分な量です。設定画面で使用量を確認できます。

## 技術詳細

- フロントエンド: vanilla HTML/CSS/JavaScript（フレームワークなし）
- API: YouTube Data API v3
- ホスティング: GitHub Pages
- 動画再生: youtube-nocookie.com embed
- データ保存: localStorage（端末内のみ）

## ライセンス

MIT
