# Claude Code 設計指示書：YouTube クリーンビューアー PWA

## ■ プロジェクト概要

YouTube Data API v3 を使用し、**広告ゼロ・ショート動画ゼロ**の YouTube 閲覧用 PWA を作成する。
YouTube 公式サイトを一切使わず、API でデータ取得 → 自作 UI で表示 → youtube-nocookie.com embed で再生する。
iPhone のホーム画面に追加して使う。全て無料で運用する。

**アプリ名: CleanTube**

---

## ■ 技術スタック

| 項目 | 選定 | 理由 |
|------|------|------|
| フロントエンド | vanilla HTML/CSS/JavaScript | ビルド不要、GitHub Pages対応 |
| API | YouTube Data API v3 | 無料枠 10,000 units/日 |
| ホスティング | GitHub Pages | 無料 |
| PWA | Service Worker + Manifest | オフライン対応 |
| APIキー管理 | ユーザーが自分のキーを入力 | サーバー不要 |

---

## ■ ディレクトリ構成

```
cleantube/
├── index.html              # メインHTML（SPA）
├── manifest.json           # PWA マニフェスト
├── sw.js                   # Service Worker
├── css/
│   └── style.css           # UIスタイル
├── js/
│   ├── app.js              # メインアプリ（ルーティング・状態管理）
│   ├── api.js              # YouTube API通信
│   ├── ui.js               # DOM操作・レンダリング
│   ├── player.js           # 動画プレーヤー制御
│   ├── storage.js          # localStorage管理
│   └── utils.js            # ユーティリティ関数
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

---

## ■ 機能要件（MVP）

### 1. 初回セットアップ画面
- YouTube Data API v3 のAPIキーを入力させる
- APIキーの取得手順を日本語で丁寧に説明表示
- 入力されたキーは localStorage に暗号化せず保存（個人利用のため）
- キーの有効性をテストAPIコールで検証

```
APIキー取得手順の表示内容:
1. Google Cloud Console (console.cloud.google.com) にアクセス
2. プロジェクトを新規作成
3. 「APIとサービス」→「ライブラリ」→「YouTube Data API v3」を有効化
4. 「認証情報」→「認証情報を作成」→「APIキー」
5. 生成されたキーをコピーして下に貼り付け
※ 無料枠: 1日10,000ユニット（個人利用には十分です）
```

### 2. ホーム画面（トップページ）
- **トレンド動画**を表示（`videos.list` API、chart: mostPopular）
- 地域: JP（日本）
- Shorts を除外するフィルタ:
  - `duration` が60秒以下の動画を除外
  - タイトルに `#shorts` `#short` を含む動画を除外
  - `videos.list` で `contentDetails` パートを取得し、ISO 8601 duration をパース
- グリッド表示（2列）
- 各カードにサムネイル、タイトル、チャンネル名、再生回数、投稿日時

### 3. 検索機能
- 画面上部に検索バー
- `search.list` API を使用
- パラメータ:
  - `type: video`（チャンネル・プレイリストを除外）
  - `videoDuration: medium,long`（short を除外 = Shorts 排除）
  - `order: relevance`
  - `regionCode: JP`
  - `maxResults: 20`
- 検索結果もグリッド表示
- 無限スクロール（nextPageToken 使用）

### 4. 動画再生画面
- **youtube-nocookie.com の embed iframe** で再生（広告なし）
  ```html
  <iframe src="https://www.youtube-nocookie.com/embed/{VIDEO_ID}?rel=0&modestbranding=1&autoplay=1"
          frameborder="0"
          allow="autoplay; encrypted-media"
          allowfullscreen>
  </iframe>
  ```
- 動画タイトル、チャンネル名、説明文、再生回数、高評価数を表示
- 関連動画リスト（Shorts除外済み）を下部に表示
  - `search.list` で `relatedToVideoId` は廃止済みなので、同じチャンネルの動画 or 同キーワード検索で代替

### 5. チャンネル画面
- チャンネルバナー、アイコン、登録者数、動画数を表示
- チャンネルの動画一覧（`search.list` で `channelId` 指定）
- Shorts 除外フィルタ適用済み

### 6. Shorts 除外ロジック（重要）

```javascript
// Shorts判定関数
function isShorts(video) {
  // 1. duration が60秒以下
  const seconds = parseDuration(video.contentDetails.duration);
  if (seconds <= 60) return true;

  // 2. タイトルに #shorts を含む
  const title = video.snippet.title.toLowerCase();
  if (title.includes('#shorts') || title.includes('#short')) return true;

  // 3. アスペクト比が縦長（サムネイルから推定）
  // サムネイルがデフォルトの横長でない場合
  // ※ APIからは直接判定不可のため、1と2で十分

  return false;
}

// ISO 8601 duration パーサー
function parseDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || 0);
  const m = parseInt(match[2] || 0);
  const s = parseInt(match[3] || 0);
  return h * 3600 + m * 60 + s;
}
```

### 7. API クォータ節約設計

| API メソッド | コスト | 用途 |
|-------------|--------|------|
| `search.list` | 100 units | 検索・チャンネル動画取得 |
| `videos.list` | 1 unit | 動画詳細・トレンド取得 |
| `channels.list` | 1 unit | チャンネル情報取得 |

**節約戦略:**
- トレンドは `videos.list`（1 unit × 1回 = 1 unit）を優先使用
- 検索結果はlocalStorageにキャッシュ（同一クエリは5分間再利用）
- `videos.list` でまとめて取得（最大50件を1リクエスト）
- 1日の上限: 10,000 units → 検索約100回 or 動画情報10,000件

### 8. PWA機能
- Service Worker でアプリシェル（HTML/CSS/JS）をキャッシュ
- オフライン時は「ネットワーク接続が必要です」メッセージ表示
- manifest.json でスタンドアロンモード
- ホーム画面追加対応
- テーマカラー設定

### 9. 設定画面
- APIキーの変更・削除
- 地域設定（JP/US/その他）
- Shorts除外フィルタのON/OFF
- キャッシュクリア
- APIクォータ使用量の概算表示

---

## ■ UI設計

### 画面遷移

```
セットアップ → ホーム ←→ 検索結果
                 ↕            ↕
              動画再生 ←→ チャンネル
                 ↕
               設定
```

### ホーム画面

```
┌─────────────────────────────┐
│ 🔴 CleanTube        ⚙️     │ ← ヘッダー（設定アイコン）
├─────────────────────────────┤
│ 🔍 [動画を検索...]          │ ← 検索バー
├─────────────────────────────┤
│ 🔥 トレンド                 │
├──────────┬──────────────────┤
│ ┌──────┐ │ ┌──────┐        │
│ │ 🖼️   │ │ │ 🖼️   │        │ ← 2列グリッド
│ │thumb │ │ │thumb │        │
│ └──────┘ │ └──────┘        │
│ タイトル  │ タイトル        │
│ CH名     │ CH名            │
│ 10万回   │ 5万回           │
├──────────┼──────────────────┤
│ ┌──────┐ │ ┌──────┐        │
│ │ 🖼️   │ │ │ 🖼️   │        │
│ └──────┘ │ └──────┘        │
│ ...      │ ...             │
└──────────┴──────────────────┘
```

### 動画再生画面

```
┌─────────────────────────────┐
│ ← 戻る   CleanTube          │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │    youtube-nocookie     │ │ ← 16:9 embed player
│ │       embed player      │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ 動画タイトル                 │
│ チャンネル名 • 10万回再生    │
│ 2024/01/15                  │
│                             │
│ ▼ 説明を表示                │
├─────────────────────────────┤
│ 関連動画                    │
│ ┌─────┐ タイトル            │
│ │thumb│ CH名 • 5万回        │ ← リスト表示
│ └─────┘                     │
│ ┌─────┐ タイトル            │
│ │thumb│ CH名 • 3万回        │
│ └─────┘                     │
└─────────────────────────────┘
```

### デザイン方針
- **ダークモードベース**
  - 背景: `#0f0f0f`（YouTubeダークに近い色）
  - カード背景: `#1a1a1a`
  - テキスト: `#f1f1f1`
  - アクセント: `#ff4444`（CleanTubeレッド）
  - サブテキスト: `#aaaaaa`
- **フォント**: `"Noto Sans JP", system-ui, sans-serif`（Google Fonts CDNから読み込み）
- **角丸**: 12px（カード）、24px（検索バー）
- **グリッド**: CSS Grid、gap 12px
- **タッチ最適化**: ボタン最低 44px、カードタップ領域を広く
- **アニメーション**: カード表示時のフェードイン、画面遷移のスライド
- **レスポンシブ**: iPhone SE（375px）〜 iPhone 15 Pro Max（430px）

---

## ■ コア実装詳細

### api.js

```javascript
class YouTubeAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://www.googleapis.com/youtube/v3';
    this.cache = new Map();
  }

  async getTrending(regionCode = 'JP', maxResults = 20) {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      chart: 'mostPopular',
      regionCode,
      maxResults,
      key: this.apiKey,
    });
    const data = await this.fetch(`/videos?${params}`);
    return this.filterOutShorts(data.items);
  }

  async search(query, pageToken = '', maxResults = 20) {
    const cacheKey = `search:${query}:${pageToken}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      videoDuration: 'medium',  // Shorts除外（4分〜20分）
      order: 'relevance',
      regionCode: 'JP',
      maxResults,
      key: this.apiKey,
    });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await this.fetch(`/search?${params}`);

    // search.list はcontentDetailsを返さないので追加取得
    const videoIds = data.items.map(i => i.id.videoId).join(',');
    const details = await this.getVideoDetails(videoIds);

    const result = {
      items: this.mergeAndFilter(data.items, details),
      nextPageToken: data.nextPageToken,
    };
    this.setCache(cacheKey, result, 5 * 60 * 1000);
    return result;
  }

  async getVideoDetails(videoIds) {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: videoIds,
      key: this.apiKey,
    });
    const data = await this.fetch(`/videos?${params}`);
    return data.items;
  }

  async getChannelInfo(channelId) {
    const params = new URLSearchParams({
      part: 'snippet,statistics,brandingSettings',
      id: channelId,
      key: this.apiKey,
    });
    const data = await this.fetch(`/channels?${params}`);
    return data.items[0];
  }

  async getChannelVideos(channelId, pageToken = '', maxResults = 20) {
    const params = new URLSearchParams({
      part: 'snippet',
      channelId,
      type: 'video',
      videoDuration: 'medium',
      order: 'date',
      maxResults,
      key: this.apiKey,
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await this.fetch(`/search?${params}`);

    const videoIds = data.items.map(i => i.id.videoId).join(',');
    const details = await this.getVideoDetails(videoIds);

    return {
      items: this.mergeAndFilter(data.items, details),
      nextPageToken: data.nextPageToken,
    };
  }

  // --- 内部メソッド ---

  async fetch(endpoint) {
    const res = await window.fetch(`${this.baseURL}${endpoint}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'API Error');
    }
    return res.json();
  }

  filterOutShorts(videos) {
    return videos.filter(v => !this.isShorts(v));
  }

  isShorts(video) {
    const duration = video.contentDetails?.duration;
    if (duration) {
      const seconds = this.parseDuration(duration);
      if (seconds > 0 && seconds <= 60) return true;
    }
    const title = (video.snippet?.title || '').toLowerCase();
    return title.includes('#shorts') || title.includes('#short');
  }

  parseDuration(iso) {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1]||0)*3600) + (parseInt(m[2]||0)*60) + parseInt(m[3]||0);
  }

  mergeAndFilter(searchItems, detailItems) {
    const detailMap = new Map(detailItems.map(d => [d.id, d]));
    return searchItems
      .map(item => {
        const videoId = item.id.videoId || item.id;
        const detail = detailMap.get(videoId);
        return detail ? { ...item, ...detail, id: videoId } : null;
      })
      .filter(item => item && !this.isShorts(item));
  }

  getCache(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) { this.cache.delete(key); return null; }
    return entry.data;
  }

  setCache(key, data, ttl) {
    this.cache.set(key, { data, expires: Date.now() + ttl });
  }
}
```

### player.js 埋め込みプレーヤー

```javascript
function createPlayer(videoId) {
  return `
    <div class="player-wrapper">
      <iframe
        src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1&playsinline=1"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>
  `;
}
```

### manifest.json

```json
{
  "name": "CleanTube - 広告なしYouTubeビューアー",
  "short_name": "CleanTube",
  "description": "広告とショート動画のないYouTube視聴体験",
  "start_url": "/cleantube/",
  "scope": "/cleantube/",
  "display": "standalone",
  "background_color": "#0f0f0f",
  "theme_color": "#ff4444",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## ■ YouTube Data API v3 クォータ計算

| アクション | API コール | コスト |
|-----------|-----------|--------|
| アプリ起動（トレンド取得） | videos.list × 1 | 1 unit |
| 検索 | search.list × 1 + videos.list × 1 | 101 units |
| 動画再生（詳細取得） | videos.list × 1 | 1 unit |
| チャンネル表示 | channels.list × 1 + search.list × 1 + videos.list × 1 | 102 units |

**1日の想定利用:**
- 起動: 1 unit
- 検索10回: 1,010 units
- 動画再生30回: 30 units
- チャンネル表示5回: 510 units
- **合計: 約1,551 units / 日** → 10,000 units 上限の約15%

---

## ■ デプロイ手順（GitHub Pages）

```bash
# 1. プロジェクト作成
mkdir cleantube && cd cleantube
git init

# 2. 全ファイル作成（Claude Codeが自動実行）

# 3. GitHub リポジトリ作成 & プッシュ
gh repo create cleantube --public --source=. --push

# 4. GitHub Pages 有効化
# Settings → Pages → Source: "Deploy from a branch" → Branch: main → / (root) → Save

# 5. 数分後にアクセス可能:
# https://<username>.github.io/cleantube/
```

---

## ■ セキュリティ考慮

- APIキーはフロントエンドに保存されるが、YouTube Data API は読み取り専用なのでリスクは低い
- APIキーにはHTTPリファラー制限を設定するようユーザーに案内:
  - Google Cloud Console → 認証情報 → キー制限 → HTTPリファラー
  - 許可: `https://<username>.github.io/*`
- ユーザーデータは一切外部送信しない
- 全通信はHTTPS

---

## ■ Claude Code への実行指示

以下の順序で実装してください:

1. `mkdir -p cleantube/{css,js,icons}` でディレクトリ作成
2. `icons/` にSVGからPNGアイコンを生成（赤い再生ボタン風のシンプルアイコン、192px と 512px）
   - Pythonの `Pillow` ライブラリを使ってPNG生成
3. `manifest.json` を作成
4. `sw.js`（Service Worker）を作成
5. `js/storage.js` を実装（localStorage ラッパー）
6. `js/utils.js` を実装（日付フォーマット、再生回数フォーマット、duration パーサー）
7. `js/api.js` を実装（YouTube API クライアント、キャッシュ機構、Shorts フィルタ）
8. `js/player.js` を実装（youtube-nocookie embed 生成）
9. `js/ui.js` を実装（DOM 操作、カード生成、画面遷移、無限スクロール）
10. `js/app.js` を実装（アプリ初期化、ルーティング、イベントバインド）
11. `css/style.css` を実装（ダークモード、グリッド、アニメーション、レスポンシブ）
12. `index.html` を実装（SPA のシェル HTML）
13. `README.md` を作成（セットアップ手順、APIキー取得方法を日本語で記載）
14. ローカルサーバーで動作確認 `python3 -m http.server 8000`

**コーディング規約:**
- ES2020+、type="module" は使わない（GitHub Pages互換性のため script タグで順序読み込み）
- コメントは日本語
- 変数名・関数名は英語キャメルケース
- エラーは全てtry-catchしUI上にユーザーフレンドリーなメッセージ表示
- console.error でデバッグログ出力
- モバイルファースト、iPhone SE（375px幅）を最小対応

**テスト項目:**
- [ ] 初回起動でセットアップ画面が表示される
- [ ] APIキーを入力すると検証が実行される
- [ ] 有効なキーでホーム画面に遷移する
- [ ] トレンド動画がグリッド表示される
- [ ] Shorts（60秒以下）が除外されている
- [ ] 検索が動作し、結果が表示される
- [ ] 動画タップで再生画面に遷移する
- [ ] youtube-nocookie embed で広告なし再生される
- [ ] チャンネル名タップでチャンネル画面に遷移する
- [ ] 無限スクロールが動作する
- [ ] PWAとしてホーム画面に追加できる
- [ ] オフラインでアプリシェルが表示される
- [ ] 設定画面でAPIキーの変更・地域変更ができる
- [ ] iPhone SE〜iPhone 15 Pro Max で表示崩れがない
