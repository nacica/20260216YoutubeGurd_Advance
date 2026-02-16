// ui.js - DOM操作・レンダリング
var UI = (function() {
  var currentScreen = '';
  var searchNextPageToken = '';
  var channelNextPageToken = '';
  var currentSearchQuery = '';
  var currentChannelId = '';
  var isLoading = false;

  // 画面切り替え
  function showScreen(screenId) {
    var screens = document.querySelectorAll('.screen');
    screens.forEach(function(s) { s.classList.remove('active'); });
    var target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      currentScreen = screenId;
    }
    // スクロール位置リセット
    window.scrollTo(0, 0);
  }

  // --- セットアップ画面 ---
  function renderSetup() {
    showScreen('setup-screen');
  }

  // --- ホーム画面 ---
  function renderHome(videos) {
    var grid = document.getElementById('trending-grid');
    grid.innerHTML = '';
    videos.forEach(function(video) {
      grid.appendChild(createVideoCard(video));
    });
    showScreen('home-screen');
    animateCards(grid);
  }

  // --- 検索結果画面 ---
  function renderSearchResults(result, query, append) {
    currentSearchQuery = query;
    searchNextPageToken = result.nextPageToken || '';
    var grid = document.getElementById('search-grid');
    var title = document.getElementById('search-result-title');

    if (!append) {
      grid.innerHTML = '';
      title.textContent = '「' + query + '」の検索結果';
      showScreen('search-screen');
    }

    result.items.forEach(function(video) {
      grid.appendChild(createVideoCard(video));
    });

    toggleLoadMore('search-load-more', !!searchNextPageToken);
    if (!append) animateCards(grid);
  }

  // --- 動画再生画面 ---
  function renderVideoPlayer(video, relatedVideos) {
    var container = document.getElementById('video-screen');
    var playerArea = document.getElementById('player-area');
    var videoInfo = document.getElementById('video-info');
    var relatedList = document.getElementById('related-videos');

    var videoId = video.id.videoId || video.id;

    // プレーヤー
    playerArea.innerHTML = Player.createPlayer(videoId);

    // 動画情報
    var stats = video.statistics || {};
    var snippet = video.snippet || {};
    var duration = video.contentDetails ? Utils.formatDuration(Utils.parseDuration(video.contentDetails.duration)) : '';

    videoInfo.innerHTML =
      '<h2 class="video-title">' + Utils.escapeHtml(snippet.title) + '</h2>' +
      '<div class="video-meta">' +
        '<span class="channel-link" data-channel-id="' + Utils.escapeHtml(snippet.channelId) + '">' +
          Utils.escapeHtml(snippet.channelTitle) +
        '</span>' +
        '<span class="meta-separator">•</span>' +
        '<span>' + Utils.formatViewCount(stats.viewCount) + '</span>' +
        '<span class="meta-separator">•</span>' +
        '<span>' + Utils.formatDate(snippet.publishedAt) + '</span>' +
        (duration ? '<span class="meta-separator">•</span><span>' + duration + '</span>' : '') +
      '</div>' +
      (stats.likeCount ? '<div class="video-likes">👍 ' + parseInt(stats.likeCount).toLocaleString() + '</div>' : '') +
      '<div class="video-description-toggle" id="desc-toggle">▼ 説明を表示</div>' +
      '<div class="video-description" id="video-description">' +
        formatDescription(snippet.description) +
      '</div>';

    // 説明文トグル
    setTimeout(function() {
      var toggle = document.getElementById('desc-toggle');
      var desc = document.getElementById('video-description');
      if (toggle && desc) {
        toggle.addEventListener('click', function() {
          desc.classList.toggle('expanded');
          toggle.textContent = desc.classList.contains('expanded') ? '▲ 説明を隠す' : '▼ 説明を表示';
        });
      }
    }, 0);

    // チャンネルリンク
    setTimeout(function() {
      var links = videoInfo.querySelectorAll('.channel-link');
      links.forEach(function(link) {
        link.addEventListener('click', function() {
          var channelId = this.getAttribute('data-channel-id');
          if (channelId) App.showChannel(channelId);
        });
      });
    }, 0);

    // 関連動画
    relatedList.innerHTML = '<h3 class="section-title">関連動画</h3>';
    if (relatedVideos && relatedVideos.length > 0) {
      relatedVideos.forEach(function(v) {
        relatedList.appendChild(createVideoListItem(v));
      });
    } else {
      relatedList.innerHTML += '<p class="no-results">関連動画を読み込み中...</p>';
    }

    showScreen('video-screen');
  }

  // 関連動画を後から更新
  function updateRelatedVideos(videos) {
    var relatedList = document.getElementById('related-videos');
    if (!relatedList) return;
    relatedList.innerHTML = '<h3 class="section-title">関連動画</h3>';
    if (videos.length === 0) {
      relatedList.innerHTML += '<p class="no-results">関連動画が見つかりませんでした</p>';
      return;
    }
    videos.forEach(function(v) {
      relatedList.appendChild(createVideoListItem(v));
    });
  }

  // --- チャンネル画面 ---
  function renderChannel(channel, videos, append) {
    if (!append) {
      currentChannelId = channel.id;
      var header = document.getElementById('channel-header');
      var snippet = channel.snippet || {};
      var stats = channel.statistics || {};
      var branding = channel.brandingSettings || {};
      var bannerUrl = (branding.image && branding.image.bannerExternalUrl) || '';

      var headerHtml = '';
      if (bannerUrl) {
        headerHtml += '<div class="channel-banner" style="background-image:url(' + bannerUrl + ')"></div>';
      }
      headerHtml +=
        '<div class="channel-info">' +
          '<img class="channel-avatar" src="' + (snippet.thumbnails && snippet.thumbnails.default ? snippet.thumbnails.default.url : '') + '" alt="">' +
          '<div class="channel-details">' +
            '<h2 class="channel-name">' + Utils.escapeHtml(snippet.title) + '</h2>' +
            '<div class="channel-stats">' +
              Utils.formatSubscriberCount(stats.subscriberCount) + ' • 動画 ' + parseInt(stats.videoCount || 0).toLocaleString() + '本' +
            '</div>' +
          '</div>' +
        '</div>';
      header.innerHTML = headerHtml;
      document.getElementById('channel-grid').innerHTML = '';
      showScreen('channel-screen');
    }

    var grid = document.getElementById('channel-grid');
    videos.forEach(function(video) {
      grid.appendChild(createVideoCard(video));
    });

    toggleLoadMore('channel-load-more', !!channelNextPageToken);
    if (!append) animateCards(grid);
  }

  function setChannelNextPageToken(token) {
    channelNextPageToken = token || '';
  }

  // --- ユーザープロフィール表示 ---
  function displayUserProfile(profile) {
    if (!profile) return;
    // ヘッダーアバター
    var avatar = document.getElementById('header-avatar');
    if (avatar) {
      avatar.src = profile.picture || '';
      avatar.alt = profile.name || '';
      avatar.style.display = profile.picture ? 'block' : 'none';
    }
  }

  function hideUserProfile() {
    var avatar = document.getElementById('header-avatar');
    if (avatar) {
      avatar.src = '';
      avatar.style.display = 'none';
    }
  }

  // --- 設定画面 ---
  function renderSettings() {
    var apiKeyInput = document.getElementById('settings-api-key');
    var regionSelect = document.getElementById('settings-region');
    var shortsToggle = document.getElementById('settings-shorts-filter');
    var quotaDisplay = document.getElementById('quota-usage');

    if (apiKeyInput) apiKeyInput.value = Storage.getApiKey();
    if (regionSelect) regionSelect.value = Storage.getRegion();
    if (shortsToggle) shortsToggle.checked = Storage.getShortsFilter();
    if (quotaDisplay) quotaDisplay.textContent = Storage.getQuotaUsage().toLocaleString() + ' / 10,000 units';

    // プロフィール表示
    var profileArea = document.getElementById('settings-profile-area');
    if (profileArea) {
      var profile = Storage.getUserProfile();
      if (profile) {
        profileArea.innerHTML =
          '<div class="settings-profile-card">' +
            '<img class="settings-profile-avatar" src="' + Utils.escapeHtml(profile.picture || '') + '" alt="">' +
            '<div class="settings-profile-info">' +
              '<div class="settings-profile-name">' + Utils.escapeHtml(profile.name || '') + '</div>' +
              '<div class="settings-profile-email">' + Utils.escapeHtml(profile.email || '') + '</div>' +
            '</div>' +
          '</div>' +
          '<button id="logout-btn" class="btn-danger" style="margin-top:12px">ログアウト</button>';
        // ログアウトボタンのイベント
        var logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', function() {
            App.logout();
          });
        }
      } else {
        profileArea.innerHTML =
          '<p class="settings-login-hint">Googleアカウントでログインしていません</p>';
      }
    }

    showScreen('settings-screen');
  }

  // --- 共通UI部品 ---

  // 動画カード（グリッド表示用）
  function createVideoCard(video) {
    var card = document.createElement('div');
    card.className = 'video-card';

    var videoId = video.id.videoId || video.id;
    var snippet = video.snippet || {};
    var stats = video.statistics || {};
    var duration = video.contentDetails ? Utils.formatDuration(Utils.parseDuration(video.contentDetails.duration)) : '';
    var thumbnail = Utils.getThumbnail(snippet);

    card.innerHTML =
      '<div class="card-thumbnail">' +
        '<img src="' + thumbnail + '" alt="" loading="lazy">' +
        (duration ? '<span class="card-duration">' + duration + '</span>' : '') +
      '</div>' +
      '<div class="card-info">' +
        '<div class="card-title">' + Utils.escapeHtml(snippet.title) + '</div>' +
        '<div class="card-channel" data-channel-id="' + Utils.escapeHtml(snippet.channelId) + '">' +
          Utils.escapeHtml(snippet.channelTitle) +
        '</div>' +
        '<div class="card-meta">' +
          Utils.formatViewCount(stats.viewCount) +
          ' • ' +
          Utils.formatDate(snippet.publishedAt) +
        '</div>' +
      '</div>';

    // カードクリックで動画再生
    card.querySelector('.card-thumbnail').addEventListener('click', function() {
      App.showVideo(videoId);
    });
    card.querySelector('.card-title').addEventListener('click', function() {
      App.showVideo(videoId);
    });

    // チャンネル名クリックでチャンネル画面
    var channelEl = card.querySelector('.card-channel');
    channelEl.addEventListener('click', function(e) {
      e.stopPropagation();
      var channelId = this.getAttribute('data-channel-id');
      if (channelId) App.showChannel(channelId);
    });

    return card;
  }

  // 動画リストアイテム（関連動画用）
  function createVideoListItem(video) {
    var item = document.createElement('div');
    item.className = 'video-list-item';

    var videoId = video.id.videoId || video.id;
    var snippet = video.snippet || {};
    var stats = video.statistics || {};
    var duration = video.contentDetails ? Utils.formatDuration(Utils.parseDuration(video.contentDetails.duration)) : '';
    var thumbnail = Utils.getThumbnail(snippet);

    item.innerHTML =
      '<div class="list-thumbnail">' +
        '<img src="' + thumbnail + '" alt="" loading="lazy">' +
        (duration ? '<span class="card-duration">' + duration + '</span>' : '') +
      '</div>' +
      '<div class="list-info">' +
        '<div class="list-title">' + Utils.escapeHtml(snippet.title) + '</div>' +
        '<div class="list-meta">' +
          Utils.escapeHtml(snippet.channelTitle) + ' • ' +
          Utils.formatViewCount(stats.viewCount) +
        '</div>' +
      '</div>';

    item.addEventListener('click', function() {
      App.showVideo(videoId);
    });

    return item;
  }

  // 説明文のフォーマット（URLをリンクに変換、改行をbrに）
  function formatDescription(text) {
    if (!text) return '';
    var escaped = Utils.escapeHtml(text);
    // URLをリンクに変換
    escaped = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    // 改行をbrに
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
  }

  // ロードもっと見るボタンの表示切替
  function toggleLoadMore(id, show) {
    var btn = document.getElementById(id);
    if (btn) btn.style.display = show ? 'block' : 'none';
  }

  // カードのフェードインアニメーション
  function animateCards(container) {
    var cards = container.querySelectorAll('.video-card, .video-list-item');
    cards.forEach(function(card, i) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      setTimeout(function() {
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, i * 50);
    });
  }

  // ローディング表示
  function showLoading() {
    isLoading = true;
    document.getElementById('loading').style.display = 'flex';
  }

  function hideLoading() {
    isLoading = false;
    document.getElementById('loading').style.display = 'none';
  }

  function getIsLoading() {
    return isLoading;
  }

  // エラー表示
  function showError(message) {
    var toast = document.getElementById('error-toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(function() {
      toast.classList.remove('show');
    }, 4000);
  }

  // 無限スクロール用のゲッター
  function getSearchNextPageToken() { return searchNextPageToken; }
  function getCurrentSearchQuery() { return currentSearchQuery; }
  function getChannelNextPageToken() { return channelNextPageToken; }
  function getCurrentChannelId() { return currentChannelId; }
  function getCurrentScreen() { return currentScreen; }

  return {
    showScreen: showScreen,
    renderSetup: renderSetup,
    renderHome: renderHome,
    renderSearchResults: renderSearchResults,
    renderVideoPlayer: renderVideoPlayer,
    updateRelatedVideos: updateRelatedVideos,
    renderChannel: renderChannel,
    setChannelNextPageToken: setChannelNextPageToken,
    displayUserProfile: displayUserProfile,
    hideUserProfile: hideUserProfile,
    renderSettings: renderSettings,
    showLoading: showLoading,
    hideLoading: hideLoading,
    getIsLoading: getIsLoading,
    showError: showError,
    getSearchNextPageToken: getSearchNextPageToken,
    getCurrentSearchQuery: getCurrentSearchQuery,
    getChannelNextPageToken: getChannelNextPageToken,
    getCurrentChannelId: getCurrentChannelId,
    getCurrentScreen: getCurrentScreen
  };
})();
