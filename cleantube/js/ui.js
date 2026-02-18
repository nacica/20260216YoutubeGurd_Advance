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
    var hiddenList = Storage.getHiddenVideos();
    videos.forEach(function(video) {
      var videoId = video.id.videoId || video.id;
      if (hiddenList.indexOf(videoId) !== -1) return;
      grid.appendChild(createVideoCard(video, true));
    });
    showScreen('home-screen');
    animateCards(grid);
    initFeedPreview(grid);
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
    if (!append) {
      animateCards(grid);
      initFeedPreview(grid);
    } else {
      observeNewFeedCards(grid);
    }
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
    if (!append) {
      animateCards(grid);
      initFeedPreview(grid);
    } else {
      observeNewFeedCards(grid);
    }
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

  // --- 再生履歴画面 ---
  function renderHistory() {
    var grid = document.getElementById('history-grid');
    grid.innerHTML = '';
    var videos = Storage.getHistory();
    if (!videos || !videos.length) {
      grid.innerHTML = '<p class="no-results">再生履歴はありません</p>';
      showScreen('history-screen');
      return;
    }
    videos.forEach(function(video) {
      var card = createVideoCard(video);
      // 視聴日時を表示
      if (video._watchedAt) {
        var meta = card.querySelector('.card-meta');
        if (meta) {
          meta.textContent = Utils.formatDate(video._watchedAt) + ' に視聴';
        }
      }
      grid.appendChild(card);
    });
    showScreen('history-screen');
    animateCards(grid);
  }

  // --- 後で見る画面 ---
  function renderWatchLater() {
    var grid = document.getElementById('watchlater-grid');
    grid.innerHTML = '';
    var videos = Storage.getWatchLater();
    if (!videos || !videos.length) {
      grid.innerHTML = '<p class="no-results">後で見るリストは空です</p>';
      showScreen('watchlater-screen');
      return;
    }
    videos.forEach(function(video) {
      var videoId = video.id.videoId || video.id;
      var card = createVideoCard(video);
      // 削除ボタンを追加
      var removeBtn = document.createElement('button');
      removeBtn.className = 'card-hide-btn';
      removeBtn.style.display = 'block';
      removeBtn.textContent = '\u2715 リストから削除';
      removeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        Storage.removeWatchLater(videoId);
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.8)';
        setTimeout(function() {
          card.remove();
          // 空になったらメッセージ表示
          if (grid.querySelectorAll('.video-card').length === 0) {
            grid.innerHTML = '<p class="no-results">後で見るリストは空です</p>';
          }
        }, 300);
      });
      card.querySelector('.card-info').appendChild(removeBtn);
      grid.appendChild(card);
    });
    showScreen('watchlater-screen');
    animateCards(grid);
  }

  // --- 登録チャンネル一覧画面 ---
  function renderSubscriptions(channels) {
    var list = document.getElementById('subs-list');
    list.innerHTML = '';
    if (!channels || !channels.length) {
      list.innerHTML = '<p class="no-results">登録チャンネルがありません</p>';
      showScreen('subscriptions-screen');
      return;
    }
    channels.forEach(function(ch) {
      var item = document.createElement('div');
      item.className = 'subs-item';
      item.innerHTML =
        '<img class="subs-avatar" src="' + Utils.escapeHtml(ch.thumbnail) + '" alt="" loading="lazy">' +
        '<div class="subs-info">' +
          '<div class="subs-name">' + Utils.escapeHtml(ch.title) + '</div>' +
          '<div class="subs-desc">' + Utils.escapeHtml(ch.description) + '</div>' +
        '</div>' +
        '<span class="subs-arrow">&#8250;</span>';
      item.addEventListener('click', function() {
        App.showChannel(ch.channelId);
      });
      list.appendChild(item);
    });
    showScreen('subscriptions-screen');
    animateCards(list);
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

    // 非表示動画数
    var hiddenCountEl = document.getElementById('hidden-video-count');
    if (hiddenCountEl) hiddenCountEl.textContent = Storage.getHiddenVideos().length + '件';

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
        var savedClientId = Storage.getGoogleClientId();
        profileArea.innerHTML =
          '<p class="settings-login-hint">Googleアカウントでログインしていません</p>' +
          '<div class="settings-client-id-group">' +
            '<label for="settings-google-client-id">Google OAuth クライアントID</label>' +
            '<input type="text" id="settings-google-client-id" class="settings-input" placeholder="xxxxx.apps.googleusercontent.com" value="' + Utils.escapeHtml(savedClientId || '') + '">' +
            '<p class="settings-origin-hint">承認済みJavaScriptオリジン: <code>' + Utils.escapeHtml(window.location.origin) + '</code></p>' +
          '</div>' +
          '<div id="settings-google-login-btn" class="settings-google-login-btn"></div>';
        // クライアントID入力イベント
        var clientIdInput = document.getElementById('settings-google-client-id');
        if (clientIdInput) {
          clientIdInput.addEventListener('input', Utils.debounce(function() {
            var clientId = this.value.trim();
            if (clientId && clientId.includes('.apps.googleusercontent.com')) {
              Storage.setGoogleClientId(clientId);
              App.renderGoogleLoginButtonInSettings(clientId);
            }
          }, 500));
          // 既にクライアントIDがあればボタン表示
          if (savedClientId) {
            App.renderGoogleLoginButtonInSettings(savedClientId);
          }
        }
      }
    }

    showScreen('settings-screen');
  }

  // --- 共通UI部品 ---

  // 動画カード（グリッド表示用）
  function createVideoCard(video, showHideBtn) {
    var card = document.createElement('div');
    card.className = 'video-card';

    var videoId = video.id.videoId || video.id;
    card.setAttribute('data-video-id', videoId);
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
        (showHideBtn ? '<div class="card-actions"><button class="card-watchlater-btn" title="後で見る">&#128337; 後で見る</button><button class="card-hide-btn" title="この動画を非表示">✕ 非表示</button></div>' : '') +
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

    // 後で見るボタン
    var watchLaterBtn = card.querySelector('.card-watchlater-btn');
    if (watchLaterBtn) {
      watchLaterBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        Storage.addWatchLater(video);
        this.textContent = '\u2713 追加済み';
        this.disabled = true;
        this.classList.add('added');
      });
    }

    // 非表示ボタン
    var hideBtn = card.querySelector('.card-hide-btn');
    if (hideBtn) {
      hideBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        Storage.addHiddenVideo(videoId);
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.8)';
        setTimeout(function() {
          card.remove();
        }, 300);
      });
    }

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

  // === フィードプレビュー ===
  var _previewObserver = null;
  var _previewCard = null;
  var _previewIframe = null;
  var _previewMuteBtn = null;
  var _previewMuted = true;
  var _previewDelayTimer = null;
  var _previewCardRatios = null;

  function _showFeedPreview(card) {
    if (_previewCard === card) return;
    _hideFeedPreview();

    var videoId = card.getAttribute('data-video-id');
    if (!videoId) return;

    _previewCard = card;
    _previewMuted = true;

    var thumbDiv = card.querySelector('.card-thumbnail');
    if (!thumbDiv) return;

    var overlay = document.createElement('div');
    overlay.className = 'preview-overlay';

    var origin = encodeURIComponent(window.location.origin);
    var iframe = document.createElement('iframe');
    iframe.className = 'preview-iframe';
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + videoId +
      '?autoplay=1&mute=1&playsinline=1&controls=0&rel=0&enablejsapi=1&origin=' + origin;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    _previewIframe = iframe;

    var muteBtn = document.createElement('button');
    muteBtn.className = 'preview-mute-btn';
    muteBtn.innerHTML = '&#128263;';
    muteBtn.setAttribute('aria-label', 'ミュート解除');
    muteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      _toggleFeedPreviewMute();
    });
    _previewMuteBtn = muteBtn;

    overlay.addEventListener('click', function() {
      App.showVideo(videoId);
    });

    overlay.appendChild(iframe);
    overlay.appendChild(muteBtn);
    thumbDiv.appendChild(overlay);
  }

  function _hideFeedPreview() {
    if (_previewDelayTimer) {
      clearTimeout(_previewDelayTimer);
      _previewDelayTimer = null;
    }
    if (_previewCard) {
      var thumbDiv = _previewCard.querySelector('.card-thumbnail');
      if (thumbDiv) {
        var overlay = thumbDiv.querySelector('.preview-overlay');
        if (overlay) overlay.remove();
      }
      _previewCard = null;
      _previewIframe = null;
      _previewMuteBtn = null;
    }
  }

  function _toggleFeedPreviewMute() {
    if (!_previewIframe) return;
    _previewMuted = !_previewMuted;
    var cmd = _previewMuted ? 'mute' : 'unMute';
    try {
      _previewIframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: cmd, args: [] }),
        'https://www.youtube-nocookie.com'
      );
    } catch (e) {}
    if (_previewMuteBtn) {
      _previewMuteBtn.innerHTML = _previewMuted ? '&#128263;' : '&#128266;';
      _previewMuteBtn.setAttribute('aria-label', _previewMuted ? 'ミュート解除' : 'ミュート');
    }
  }

  function _updateFeedPreview() {
    if (!_previewCardRatios) return;
    var bestCard = null;
    var bestRatio = 0.4;
    _previewCardRatios.forEach(function(ratio, card) {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestCard = card;
      }
    });
    if (bestCard && bestCard !== _previewCard) {
      if (_previewDelayTimer) clearTimeout(_previewDelayTimer);
      _previewDelayTimer = setTimeout(function() {
        _showFeedPreview(bestCard);
        _previewDelayTimer = null;
      }, 400);
    } else if (!bestCard) {
      if (_previewDelayTimer) {
        clearTimeout(_previewDelayTimer);
        _previewDelayTimer = null;
      }
      _hideFeedPreview();
    }
  }

  function initFeedPreview(grid) {
    if (!grid) return;
    if (_previewObserver) {
      _previewObserver.disconnect();
      _previewObserver = null;
    }
    _hideFeedPreview();
    _previewCardRatios = new Map();

    _previewObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        _previewCardRatios.set(entry.target, entry.intersectionRatio);
      });
      _updateFeedPreview();
    }, { threshold: [0, 0.25, 0.5, 0.75, 1.0] });

    grid.querySelectorAll('.video-card').forEach(function(card) {
      _previewObserver.observe(card);
      card.setAttribute('data-preview-observed', '1');
    });
  }

  function observeNewFeedCards(grid) {
    if (!_previewObserver || !grid || !_previewCardRatios) return;
    grid.querySelectorAll('.video-card:not([data-preview-observed])').forEach(function(card) {
      _previewObserver.observe(card);
      card.setAttribute('data-preview-observed', '1');
      _previewCardRatios.set(card, 0);
    });
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
    renderSubscriptions: renderSubscriptions,
    renderWatchLater: renderWatchLater,
    renderHistory: renderHistory,
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
    getCurrentScreen: getCurrentScreen,
    observeNewFeedCards: observeNewFeedCards
  };
})();
