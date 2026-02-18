// app.js - メインアプリ（ルーティング・状態管理・イベントバインド）
var App = (function() {
  var history = []; // 画面履歴
  var tokenClient = null; // OAuth2トークンクライアント
  var pendingAction = null; // トークン取得後に実行するアクション
  var authRetryCount = 0; // 再認証試行回数（無限ループ防止）

  // JWTデコード（ペイロード部分のみ）
  function decodeJwtPayload(token) {
    try {
      var base64Url = token.split('.')[1];
      var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('JWTデコードエラー:', e);
      return null;
    }
  }

  // GISライブラリ読み込み待ち
  function waitForGIS(callback, maxWait) {
    maxWait = maxWait || 5000;
    var start = Date.now();
    function check() {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        callback();
      } else if (Date.now() - start < maxWait) {
        setTimeout(check, 200);
      } else {
        console.warn('GISライブラリの読み込みがタイムアウトしました');
      }
    }
    check();
  }

  // Google Identity Services 初期化
  function initGoogleAuth(clientId) {
    if (!clientId || typeof google === 'undefined' || !google.accounts) return;
    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCallback,
      auto_select: false // 自動ログインを無効化（繰り返しポップアップ防止）
    });
  }

  // OAuth2トークンクライアント初期化
  function initTokenClient(clientId) {
    if (!clientId || typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) return false;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      callback: handleTokenResponse
    });
    return true;
  }

  // アクセストークンリクエスト発行
  function requestAccessToken(action) {
    if (action) pendingAction = action;
    if (!tokenClient) {
      var clientId = Storage.getGoogleClientId();
      if (clientId) initTokenClient(clientId);
    }
    if (tokenClient) {
      var opts = { prompt: '' }; // 同意済みの場合はポップアップをスキップ
      // ログイン済みユーザーのemailをヒントに渡してアカウント選択画面をスキップ
      var profile = Storage.getUserProfile();
      if (profile && profile.email) {
        opts.login_hint = profile.email;
      }
      tokenClient.requestAccessToken(opts);
    }
  }

  // トークンレスポンスハンドラ
  function handleTokenResponse(response) {
    if (response.error) {
      console.error('OAuth トークンエラー:', response.error);
      // access_denied はユーザーがキャンセルした場合（エラー表示しない）
      if (response.error !== 'access_denied') {
        UI.showError('YouTube APIの認証に失敗しました: ' + (response.error_description || response.error));
      }
      pendingAction = null;
      return;
    }
    if (response.access_token) {
      Storage.setAccessToken(response.access_token);
      YouTubeAPI.setAccessToken(response.access_token);
      authRetryCount = 0;
      showSubsButton(true);
      UI.showError('YouTube APIの認証に成功しました');

      // 保留中のアクションがあれば実行
      if (pendingAction) {
        var action = pendingAction;
        pendingAction = null;
        if (action === 'showSubscriptions') {
          showSubscriptions();
        } else if (action === 'showHome') {
          showHome();
        }
      } else {
        // ホーム画面にいる場合は再取得
        if (UI.getCurrentScreen() === 'home-screen') {
          showHome();
        }
      }
    }
  }

  // 登録チャンネルボタンの表示切替
  function showSubsButton(show) {
    var btn = document.getElementById('subs-btn');
    if (btn) btn.style.display = show ? 'flex' : 'none';
  }

  // セットアップ画面でGoogleログインボタンをレンダリング
  function renderGoogleLoginButton(clientId) {
    if (!clientId || typeof google === 'undefined' || !google.accounts) return;
    initGoogleAuth(clientId);
    var container = document.getElementById('google-login-btn-container');
    if (container) {
      container.innerHTML = '';
      google.accounts.id.renderButton(container, {
        theme: 'filled_black',
        size: 'large',
        width: '100%',
        text: 'signin_with'
      });
    }
  }

  // Googleログインコールバック
  function handleGoogleCallback(response) {
    if (!response || !response.credential) return;
    var payload = decodeJwtPayload(response.credential);
    if (!payload) {
      UI.showError('Googleログインに失敗しました');
      return;
    }
    var profile = {
      name: payload.name || '',
      email: payload.email || '',
      picture: payload.picture || ''
    };
    Storage.setUserProfile(profile);
    UI.displayUserProfile(profile);
    showSubsButton(true);
    // セットアップ画面のログイン状態更新
    var statusEl = document.getElementById('google-login-status');
    if (statusEl) {
      statusEl.innerHTML = '<span class="login-success">' + Utils.escapeHtml(profile.name) + ' でログイン中</span>';
    }
    UI.showError(profile.name + ' でログインしました');
    // 設定画面にいる場合は再描画
    if (UI.getCurrentScreen() === 'settings-screen') {
      UI.renderSettings();
    }
    // 既にアクセストークンがなければOAuthアクセストークンをリクエスト
    // localStorageにトークンがあればメモリに復元（ポップアップ不要）
    var savedToken = Storage.getAccessToken();
    if (savedToken) {
      YouTubeAPI.setAccessToken(savedToken);
    } else if (!YouTubeAPI.getAccessToken()) {
      requestAccessToken();
    }
  }

  // 設定画面でGoogleログインボタンをレンダリング
  function renderGoogleLoginButtonInSettings(clientId) {
    if (!clientId || typeof google === 'undefined' || !google.accounts) return;
    initGoogleAuth(clientId);
    var container = document.getElementById('settings-google-login-btn');
    if (container) {
      container.innerHTML = '';
      google.accounts.id.renderButton(container, {
        theme: 'filled_black',
        size: 'large',
        width: '100%',
        text: 'signin_with'
      });
    }
  }

  // ログアウト
  function logout() {
    // アクセストークンをrevoke・削除
    var token = Storage.getAccessToken();
    if (token && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      google.accounts.oauth2.revoke(token, function() {
        console.log('アクセストークンをrevokeしました');
      });
    }
    Storage.removeAccessToken();
    YouTubeAPI.setAccessToken('');
    showSubsButton(false);

    Storage.removeUserProfile();
    UI.hideUserProfile();
    var clientId = Storage.getGoogleClientId();
    if (clientId && typeof google !== 'undefined' && google.accounts) {
      google.accounts.id.disableAutoSelect();
    }
    UI.showError('ログアウトしました');
    // 設定画面にいる場合は再描画
    if (UI.getCurrentScreen() === 'settings-screen') {
      UI.renderSettings();
    }
  }

  // アプリ初期化
  function init() {
    // Service Worker 登録
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(function() {
        console.log('Service Worker 登録完了');
      }).catch(function(err) {
        console.error('Service Worker 登録失敗:', err);
      });
    }

    // イベントバインド
    bindEvents();

    // 保存済みプロフィールの復元
    var savedProfile = Storage.getUserProfile();
    if (savedProfile) {
      UI.displayUserProfile(savedProfile);
      // ログイン済みなら☰ボタンを表示
      showSubsButton(true);
    }

    // APIキーの有無で初期画面を決定
    var apiKey = Storage.getApiKey();
    var savedClientId = Storage.getGoogleClientId();

    if (apiKey) {
      YouTubeAPI.init(apiKey);

      // 保存済みアクセストークンの復元（ポップアップは出さない）
      var savedToken = Storage.getAccessToken();
      if (savedToken) {
        YouTubeAPI.setAccessToken(savedToken);
      }

      // GIS読み込み後にトークンクライアント初期化のみ（自動リクエストはしない）
      if (savedClientId) {
        waitForGIS(function() {
          initGoogleAuth(savedClientId);
          initTokenClient(savedClientId);
        });
      }

      showHome();
    } else {
      UI.renderSetup();
      // 現在のオリジンを表示
      var originEl = document.getElementById('current-origin');
      if (originEl) originEl.textContent = window.location.origin;
      // セットアップ画面で保存済みクライアントIDがあればボタン表示
      if (savedClientId) {
        waitForGIS(function() {
          initGoogleAuth(savedClientId);
          initTokenClient(savedClientId);
          var clientIdInput = document.getElementById('google-client-id-input');
          if (clientIdInput) clientIdInput.value = savedClientId;
          renderGoogleLoginButton(savedClientId);
          // 既にログイン済みならステータス表示
          if (savedProfile) {
            var statusEl = document.getElementById('google-login-status');
            if (statusEl) {
              statusEl.innerHTML = '<span class="login-success">' + Utils.escapeHtml(savedProfile.name) + ' でログイン中</span>';
            }
          }
        });
      }
    }
  }

  // イベントバインド
  function bindEvents() {
    // セットアップ: GoogleクライアントID入力
    document.getElementById('google-client-id-input').addEventListener('input', Utils.debounce(function() {
      var clientId = this.value.trim();
      if (clientId && clientId.includes('.apps.googleusercontent.com')) {
        Storage.setGoogleClientId(clientId);
        waitForGIS(function() {
          initTokenClient(clientId);
          renderGoogleLoginButton(clientId);
        });
      }
    }, 500));

    // セットアップ: APIキー保存
    document.getElementById('save-api-key').addEventListener('click', function() {
      saveApiKey();
    });
    document.getElementById('api-key-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') saveApiKey();
    });

    // 検索
    document.getElementById('search-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        var query = this.value.trim();
        if (query) doSearch(query);
      }
    });
    document.getElementById('search-btn').addEventListener('click', function() {
      var query = document.getElementById('search-input').value.trim();
      if (query) doSearch(query);
    });

    // 戻るボタン群
    document.querySelectorAll('.back-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        goBack();
      });
    });

    // 再生履歴ボタン
    document.getElementById('history-btn').addEventListener('click', function() {
      showHistory();
    });
    document.getElementById('history-clear-btn').addEventListener('click', function() {
      if (confirm('再生履歴をすべて削除しますか？')) {
        Storage.clearHistory();
        UI.renderHistory();
        UI.showError('再生履歴をクリアしました');
      }
    });

    // 後で見るボタン
    document.getElementById('watchlater-btn').addEventListener('click', function() {
      showWatchLater();
    });

    // 登録チャンネルボタン
    document.getElementById('subs-btn').addEventListener('click', function() {
      showSubscriptions();
    });

    // 設定ボタン
    document.getElementById('settings-btn').addEventListener('click', function() {
      showSettings();
    });

    // 設定画面のイベント
    document.getElementById('settings-save').addEventListener('click', function() {
      saveSettings();
    });
    document.getElementById('settings-clear-cache').addEventListener('click', function() {
      Storage.clearCache();
      UI.showError('キャッシュをクリアしました');
    });
    document.getElementById('settings-delete-key').addEventListener('click', function() {
      if (confirm('APIキーを削除してセットアップ画面に戻りますか？')) {
        Storage.removeApiKey();
        history = [];
        UI.renderSetup();
      }
    });
    document.getElementById('settings-clear-hidden').addEventListener('click', function() {
      Storage.clearHiddenVideos();
      var countEl = document.getElementById('hidden-video-count');
      if (countEl) countEl.textContent = '0件';
      UI.showError('非表示リストをクリアしました');
    });

    // もっと読み込むボタン
    document.getElementById('search-load-more').addEventListener('click', function() {
      loadMoreSearch();
    });
    document.getElementById('channel-load-more').addEventListener('click', function() {
      loadMoreChannelVideos();
    });

    // 無限スクロール
    window.addEventListener('scroll', Utils.debounce(function() {
      var scrollY = window.scrollY || window.pageYOffset;
      var windowHeight = window.innerHeight;
      var docHeight = document.documentElement.scrollHeight;

      if (scrollY + windowHeight >= docHeight - 300) {
        var screen = UI.getCurrentScreen();
        if (screen === 'search-screen' && UI.getSearchNextPageToken()) {
          loadMoreSearch();
        } else if (screen === 'channel-screen' && UI.getChannelNextPageToken()) {
          loadMoreChannelVideos();
        }
      }
    }, 300));

    // ブラウザバック対応
    window.addEventListener('popstate', function() {
      if (history.length > 1) {
        history.pop();
        var prev = history[history.length - 1];
        if (prev) {
          UI.showScreen(prev.screen);
        }
      }
    });
  }

  // --- APIキー保存 ---
  function saveApiKey() {
    var input = document.getElementById('api-key-input');
    var key = input.value.trim();
    if (!key) {
      UI.showError('APIキーを入力してください');
      return;
    }

    UI.showLoading();
    document.getElementById('api-key-status').textContent = 'APIキーを検証中...';

    YouTubeAPI.testApiKey(key).then(function(result) {
      UI.hideLoading();
      if (result.valid) {
        Storage.setApiKey(key);
        YouTubeAPI.init(key);
        document.getElementById('api-key-status').textContent = '';
        showHome();
      } else {
        document.getElementById('api-key-status').textContent = 'エラー: ' + result.error;
        document.getElementById('api-key-status').className = 'status-text error';
      }
    });
  }

  // --- ホーム画面 ---
  function showHome() {
    UI.showLoading();
    history = [{ screen: 'home-screen' }];

    var feedPromise;
    if (YouTubeAPI.getAccessToken()) {
      // パーソナライズドフィード（アクセストークンあり）
      feedPromise = YouTubeAPI.getPersonalizedFeed().then(function(result) {
        // パーソナライズドフィードが空の場合は公開フィードにフォールバック（トークンはクリアしない）
        if (!result.items || !result.items.length) {
          console.warn('パーソナライズドフィードが空、公開フィードにフォールバック');
          return YouTubeAPI.getHomeFeed();
        }
        return result;
      }).catch(function(err) {
        console.error('パーソナライズドフィード取得エラー、フォールバック:', err);
        // 認証エラー(401/403)の場合のみトークンをクリア
        var errMsg = err.message || '';
        if (errMsg.indexOf('401') !== -1 || errMsg.indexOf('403') !== -1) {
          Storage.removeAccessToken();
          YouTubeAPI.setAccessToken('');
        }
        return YouTubeAPI.getHomeFeed();
      });
    } else {
      // 既存フォールバック
      feedPromise = YouTubeAPI.getHomeFeed();
    }

    feedPromise.then(function(result) {
      UI.hideLoading();
      UI.renderHome(result.items);
    }).catch(function(err) {
      UI.hideLoading();
      UI.showError('動画の取得に失敗しました: ' + err.message);
      console.error('ホームフィード取得エラー:', err);
    });
  }

  // --- 検索 ---
  function doSearch(query) {
    UI.showLoading();
    pushHistory({ screen: 'search-screen', query: query });

    YouTubeAPI.search(query).then(function(result) {
      UI.hideLoading();
      UI.renderSearchResults(result, query, false);
    }).catch(function(err) {
      UI.hideLoading();
      UI.showError('検索に失敗しました: ' + err.message);
      console.error('検索エラー:', err);
    });
  }

  function loadMoreSearch() {
    var token = UI.getSearchNextPageToken();
    var query = UI.getCurrentSearchQuery();
    if (!token || !query || UI.getIsLoading()) return;

    UI.showLoading();
    YouTubeAPI.search(query, token).then(function(result) {
      UI.hideLoading();
      UI.renderSearchResults(result, query, true);
    }).catch(function(err) {
      UI.hideLoading();
      UI.showError('追加読み込みに失敗しました');
      console.error('追加読み込みエラー:', err);
    });
  }

  // --- 動画再生 ---
  function showVideo(videoId) {
    UI.showLoading();
    pushHistory({ screen: 'video-screen', videoId: videoId });

    YouTubeAPI.getVideoById(videoId).then(function(video) {
      UI.hideLoading();
      if (!video) {
        UI.showError('動画情報の取得に失敗しました');
        return;
      }
      UI.renderVideoPlayer(video, []);
      Storage.addHistory(video);

      // 関連動画を非同期で取得
      YouTubeAPI.getRelatedVideos(video).then(function(result) {
        UI.updateRelatedVideos(result.items);
      }).catch(function(err) {
        console.error('関連動画取得エラー:', err);
      });
    }).catch(function(err) {
      UI.hideLoading();
      UI.showError('動画情報の取得に失敗しました: ' + err.message);
      console.error('動画再生エラー:', err);
    });
  }

  // --- チャンネル画面 ---
  function showChannel(channelId) {
    UI.showLoading();
    pushHistory({ screen: 'channel-screen', channelId: channelId });

    Promise.all([
      YouTubeAPI.getChannelInfo(channelId),
      YouTubeAPI.getChannelVideos(channelId)
    ]).then(function(results) {
      UI.hideLoading();
      var channel = results[0];
      var videosResult = results[1];
      if (!channel) {
        UI.showError('チャンネル情報の取得に失敗しました');
        return;
      }
      UI.setChannelNextPageToken(videosResult.nextPageToken);
      UI.renderChannel(channel, videosResult.items, false);
    }).catch(function(err) {
      UI.hideLoading();
      UI.showError('チャンネル情報の取得に失敗しました: ' + err.message);
      console.error('チャンネル取得エラー:', err);
    });
  }

  function loadMoreChannelVideos() {
    var token = UI.getChannelNextPageToken();
    var channelId = UI.getCurrentChannelId();
    if (!token || !channelId || UI.getIsLoading()) return;

    UI.showLoading();
    YouTubeAPI.getChannelVideos(channelId, token).then(function(result) {
      UI.hideLoading();
      UI.setChannelNextPageToken(result.nextPageToken);
      UI.renderChannel(null, result.items, true);
    }).catch(function(err) {
      UI.hideLoading();
      UI.showError('追加読み込みに失敗しました');
      console.error('チャンネル追加読み込みエラー:', err);
    });
  }

  // --- 登録チャンネル一覧 ---
  function showSubscriptions() {
    // トークンがなければ認証フローを開始
    if (!YouTubeAPI.getAccessToken()) {
      if (Storage.getUserProfile() && Storage.getGoogleClientId()) {
        requestAccessToken('showSubscriptions');
        return;
      }
      UI.showError('登録チャンネルを表示するにはログインが必要です');
      return;
    }
    UI.showLoading();
    pushHistory({ screen: 'subscriptions-screen' });

    YouTubeAPI.getAllSubscriptions().then(function(channels) {
      UI.hideLoading();
      UI.renderSubscriptions(channels);
    }).catch(function(err) {
      UI.hideLoading();
      // 認証エラーなら再認証（1回まで）
      if (err.message && (err.message.indexOf('401') !== -1 || err.message.indexOf('403') !== -1) && authRetryCount < 1) {
        authRetryCount++;
        Storage.removeAccessToken();
        YouTubeAPI.setAccessToken('');
        requestAccessToken('showSubscriptions');
        return;
      }
      UI.showError('登録チャンネルの取得に失敗しました: ' + err.message);
      console.error('登録チャンネル取得エラー:', err);
    });
  }

  // --- 再生履歴 ---
  function showHistory() {
    pushHistory({ screen: 'history-screen' });
    UI.renderHistory();
  }

  // --- 後で見る ---
  function showWatchLater() {
    pushHistory({ screen: 'watchlater-screen' });
    UI.renderWatchLater();
  }

  // --- 設定 ---
  function showSettings() {
    pushHistory({ screen: 'settings-screen' });
    UI.renderSettings();
  }

  function saveSettings() {
    var region = document.getElementById('settings-region').value;
    var shortsFilter = document.getElementById('settings-shorts-filter').checked;

    Storage.setRegion(region);
    Storage.setShortsFilter(shortsFilter);
    UI.showError('設定を保存しました');
    goBack();
  }

  // --- ナビゲーション ---
  function pushHistory(entry) {
    history.push(entry);
    window.history.pushState(entry, '');
  }

  function goBack() {
    // プレーヤーを破棄
    Player.destroyPlayer();

    if (history.length > 1) {
      history.pop();
      var prev = history[history.length - 1];
      if (prev) {
        if (prev.screen === 'home-screen') {
          showHome();
        } else {
          UI.showScreen(prev.screen);
        }
      }
    } else {
      showHome();
    }
  }

  return {
    init: init,
    showHome: showHome,
    showVideo: showVideo,
    showChannel: showChannel,
    goBack: goBack,
    showWatchLater: showWatchLater,
    showHistory: showHistory,
    logout: logout,
    showSubscriptions: showSubscriptions,
    renderGoogleLoginButtonInSettings: renderGoogleLoginButtonInSettings
  };
})();

// DOMContentLoaded で初期化
document.addEventListener('DOMContentLoaded', function() {
  App.init();
});
