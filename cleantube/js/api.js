// api.js - YouTube Data API v3 クライアント
var YouTubeAPI = (function() {
  var apiKey = '';
  var baseURL = 'https://www.googleapis.com/youtube/v3';
  var cache = {};

  function init(key) {
    apiKey = key;
  }

  // APIキーの有効性テスト
  function testApiKey(key) {
    var url = baseURL + '/videos?part=snippet&chart=mostPopular&regionCode=JP&maxResults=1&key=' + encodeURIComponent(key);
    return fetch(url).then(function(res) {
      if (res.ok) return { valid: true };
      return res.json().then(function(data) {
        return { valid: false, error: data.error ? data.error.message : 'APIキーが無効です' };
      });
    }).catch(function(e) {
      return { valid: false, error: 'ネットワークエラー: ' + e.message };
    });
  }

  // トレンド動画取得
  function getTrending(regionCode, maxResults) {
    regionCode = regionCode || Storage.getRegion();
    maxResults = maxResults || 25;
    var params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      chart: 'mostPopular',
      regionCode: regionCode,
      maxResults: maxResults,
      key: apiKey
    });
    Storage.addQuotaUsage(1);
    return apiFetch('/videos?' + params.toString()).then(function(data) {
      var items = data.items || [];
      if (Storage.getShortsFilter()) {
        items = items.filter(function(v) { return !Utils.isShorts(v); });
      }
      return { items: items };
    });
  }

  // 検索
  function search(query, pageToken, maxResults) {
    maxResults = maxResults || 20;
    var cacheKey = 'search:' + query + ':' + (pageToken || '');
    var cached = getCache(cacheKey);
    if (cached) return Promise.resolve(cached);

    var params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      videoDuration: 'medium',
      order: 'relevance',
      regionCode: Storage.getRegion(),
      maxResults: maxResults,
      key: apiKey
    });
    if (pageToken) params.set('pageToken', pageToken);

    Storage.addQuotaUsage(100);
    return apiFetch('/search?' + params.toString()).then(function(data) {
      var videoIds = (data.items || []).map(function(i) {
        return i.id.videoId;
      }).filter(Boolean).join(',');

      if (!videoIds) return { items: [], nextPageToken: data.nextPageToken };

      return getVideoDetails(videoIds).then(function(details) {
        var result = {
          items: mergeAndFilter(data.items, details),
          nextPageToken: data.nextPageToken
        };
        setCache(cacheKey, result, 5 * 60 * 1000);
        return result;
      });
    });
  }

  // 動画詳細取得（複数IDをまとめて）
  function getVideoDetails(videoIds) {
    var params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: videoIds,
      key: apiKey
    });
    Storage.addQuotaUsage(1);
    return apiFetch('/videos?' + params.toString()).then(function(data) {
      return data.items || [];
    });
  }

  // 単一動画の詳細取得
  function getVideoById(videoId) {
    return getVideoDetails(videoId).then(function(items) {
      return items[0] || null;
    });
  }

  // チャンネル情報取得
  function getChannelInfo(channelId) {
    var params = new URLSearchParams({
      part: 'snippet,statistics,brandingSettings',
      id: channelId,
      key: apiKey
    });
    Storage.addQuotaUsage(1);
    return apiFetch('/channels?' + params.toString()).then(function(data) {
      return (data.items || [])[0] || null;
    });
  }

  // チャンネルの動画一覧取得
  function getChannelVideos(channelId, pageToken, maxResults) {
    maxResults = maxResults || 20;
    var params = new URLSearchParams({
      part: 'snippet',
      channelId: channelId,
      type: 'video',
      videoDuration: 'medium',
      order: 'date',
      maxResults: maxResults,
      key: apiKey
    });
    if (pageToken) params.set('pageToken', pageToken);

    Storage.addQuotaUsage(100);
    return apiFetch('/search?' + params.toString()).then(function(data) {
      var videoIds = (data.items || []).map(function(i) {
        return i.id.videoId;
      }).filter(Boolean).join(',');

      if (!videoIds) return { items: [], nextPageToken: data.nextPageToken };

      return getVideoDetails(videoIds).then(function(details) {
        return {
          items: mergeAndFilter(data.items, details),
          nextPageToken: data.nextPageToken
        };
      });
    });
  }

  // 関連動画取得（同じチャンネルの動画で代替）
  function getRelatedVideos(video) {
    if (!video || !video.snippet) return Promise.resolve({ items: [] });
    // 動画タイトルのキーワードで検索して関連動画を取得
    var title = video.snippet.title || '';
    // タイトルから主要キーワードを抽出（最初の3単語程度）
    var keywords = title.replace(/[【】\[\]「」『』\(\)（）]/g, ' ')
                        .split(/\s+/)
                        .filter(function(w) { return w.length > 1; })
                        .slice(0, 3)
                        .join(' ');
    if (!keywords) keywords = title.slice(0, 20);
    return search(keywords).then(function(result) {
      // 現在の動画を除外
      var videoId = video.id.videoId || video.id;
      result.items = result.items.filter(function(v) {
        var vid = v.id.videoId || v.id;
        return vid !== videoId;
      }).slice(0, 10);
      return result;
    });
  }

  // --- 内部関数 ---

  function apiFetch(endpoint) {
    return fetch(baseURL + endpoint).then(function(res) {
      if (!res.ok) {
        return res.json().then(function(err) {
          var msg = (err.error && err.error.message) || 'APIエラーが発生しました';
          throw new Error(msg);
        });
      }
      return res.json();
    });
  }

  function mergeAndFilter(searchItems, detailItems) {
    var detailMap = {};
    detailItems.forEach(function(d) { detailMap[d.id] = d; });

    var result = [];
    searchItems.forEach(function(item) {
      var videoId = item.id.videoId || item.id;
      var detail = detailMap[videoId];
      if (detail) {
        var merged = Object.assign({}, item, detail, { id: videoId });
        if (!Storage.getShortsFilter() || !Utils.isShorts(merged)) {
          result.push(merged);
        }
      }
    });
    return result;
  }

  function getCache(key) {
    var entry = cache[key];
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      delete cache[key];
      return null;
    }
    return entry.data;
  }

  function setCache(key, data, ttl) {
    cache[key] = { data: data, expires: Date.now() + ttl };
  }

  return {
    init: init,
    testApiKey: testApiKey,
    getTrending: getTrending,
    search: search,
    getVideoDetails: getVideoDetails,
    getVideoById: getVideoById,
    getChannelInfo: getChannelInfo,
    getChannelVideos: getChannelVideos,
    getRelatedVideos: getRelatedVideos
  };
})();
