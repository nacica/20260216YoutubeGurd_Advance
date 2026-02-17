// storage.js - localStorage管理
var Storage = (function() {
  var PREFIX = 'cleantube_';

  function get(key, defaultValue) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return defaultValue !== undefined ? defaultValue : null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Storage読み取りエラー:', e);
      return defaultValue !== undefined ? defaultValue : null;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage書き込みエラー:', e);
    }
  }

  function remove(key) {
    localStorage.removeItem(PREFIX + key);
  }

  // APIキー
  function getApiKey() {
    return get('apiKey', '');
  }

  function setApiKey(key) {
    set('apiKey', key);
  }

  function removeApiKey() {
    remove('apiKey');
  }

  // 地域設定
  function getRegion() {
    return get('region', 'JP');
  }

  function setRegion(region) {
    set('region', region);
  }

  // Shortsフィルタ設定
  function getShortsFilter() {
    return get('shortsFilter', true);
  }

  function setShortsFilter(enabled) {
    set('shortsFilter', enabled);
  }

  // APIクォータ使用量追跡
  function addQuotaUsage(units) {
    var today = new Date().toISOString().slice(0, 10);
    var usage = get('quota', { date: today, used: 0 });
    if (usage.date !== today) {
      usage = { date: today, used: 0 };
    }
    usage.used += units;
    set('quota', usage);
  }

  function getQuotaUsage() {
    var today = new Date().toISOString().slice(0, 10);
    var usage = get('quota', { date: today, used: 0 });
    if (usage.date !== today) return 0;
    return usage.used;
  }

  // GoogleクライアントID
  function getGoogleClientId() {
    return get('googleClientId', '');
  }

  function setGoogleClientId(clientId) {
    set('googleClientId', clientId);
  }

  function removeGoogleClientId() {
    remove('googleClientId');
  }

  // ユーザープロフィール
  function getUserProfile() {
    return get('userProfile', null);
  }

  function setUserProfile(profile) {
    set('userProfile', profile);
  }

  function removeUserProfile() {
    remove('userProfile');
  }

  // アクセストークン
  function getAccessToken() {
    return get('accessToken', '');
  }

  function setAccessToken(token) {
    set('accessToken', token);
  }

  function removeAccessToken() {
    remove('accessToken');
  }

  // 非表示動画リスト
  function getHiddenVideos() {
    return get('hiddenVideos', []);
  }

  function addHiddenVideo(videoId) {
    var list = getHiddenVideos();
    if (list.indexOf(videoId) === -1) {
      list.push(videoId);
      set('hiddenVideos', list);
    }
  }

  function removeHiddenVideo(videoId) {
    var list = getHiddenVideos();
    var idx = list.indexOf(videoId);
    if (idx !== -1) {
      list.splice(idx, 1);
      set('hiddenVideos', list);
    }
  }

  function clearHiddenVideos() {
    set('hiddenVideos', []);
  }

  // 後で見るリスト
  function getWatchLater() {
    return get('watchLater', []);
  }

  function addWatchLater(video) {
    var list = getWatchLater();
    var videoId = video.id.videoId || video.id;
    for (var i = 0; i < list.length; i++) {
      var id = list[i].id.videoId || list[i].id;
      if (id === videoId) return;
    }
    list.unshift(video);
    set('watchLater', list);
  }

  function removeWatchLater(videoId) {
    var list = getWatchLater();
    var filtered = list.filter(function(v) {
      var id = v.id.videoId || v.id;
      return id !== videoId;
    });
    set('watchLater', filtered);
  }

  function clearWatchLater() {
    set('watchLater', []);
  }

  // 再生履歴
  function getHistory() {
    return get('history', []);
  }

  function addHistory(video) {
    var list = getHistory();
    var videoId = video.id.videoId || video.id;
    // 既存エントリを削除（重複防止・最新を先頭に）
    list = list.filter(function(v) {
      var id = v.id.videoId || v.id;
      return id !== videoId;
    });
    video._watchedAt = new Date().toISOString();
    list.unshift(video);
    // 最大200件に制限
    if (list.length > 200) list = list.slice(0, 200);
    set('history', list);
  }

  function clearHistory() {
    set('history', []);
  }

  // キャッシュクリア
  function clearCache() {
    var preserveKeys = [PREFIX + 'apiKey', PREFIX + 'region', PREFIX + 'shortsFilter', PREFIX + 'googleClientId', PREFIX + 'userProfile', PREFIX + 'accessToken'];
    var keys = Object.keys(localStorage);
    keys.forEach(function(key) {
      if (key.startsWith(PREFIX) && preserveKeys.indexOf(key) === -1) {
        localStorage.removeItem(key);
      }
    });
  }

  // 全データクリア
  function clearAll() {
    var keys = Object.keys(localStorage);
    keys.forEach(function(key) {
      if (key.startsWith(PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }

  return {
    get: get,
    set: set,
    remove: remove,
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    removeApiKey: removeApiKey,
    getRegion: getRegion,
    setRegion: setRegion,
    getShortsFilter: getShortsFilter,
    setShortsFilter: setShortsFilter,
    addQuotaUsage: addQuotaUsage,
    getQuotaUsage: getQuotaUsage,
    getGoogleClientId: getGoogleClientId,
    setGoogleClientId: setGoogleClientId,
    removeGoogleClientId: removeGoogleClientId,
    getUserProfile: getUserProfile,
    setUserProfile: setUserProfile,
    removeUserProfile: removeUserProfile,
    getAccessToken: getAccessToken,
    setAccessToken: setAccessToken,
    removeAccessToken: removeAccessToken,
    getHiddenVideos: getHiddenVideos,
    addHiddenVideo: addHiddenVideo,
    removeHiddenVideo: removeHiddenVideo,
    clearHiddenVideos: clearHiddenVideos,
    getWatchLater: getWatchLater,
    addWatchLater: addWatchLater,
    removeWatchLater: removeWatchLater,
    clearWatchLater: clearWatchLater,
    getHistory: getHistory,
    addHistory: addHistory,
    clearHistory: clearHistory,
    clearCache: clearCache,
    clearAll: clearAll
  };
})();
