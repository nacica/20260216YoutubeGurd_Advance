// api.js - YouTube Data API v3 クライアント
var YouTubeAPI = (function() {
  var apiKey = '';
  var accessToken = '';
  var baseURL = 'https://www.googleapis.com/youtube/v3';
  var cache = {};

  function init(key) {
    apiKey = key;
  }

  function setAccessToken(token) {
    accessToken = token;
  }

  function getAccessToken() {
    return accessToken;
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

  // 人気動画取得（カテゴリ指定可能）
  function getPopularByCategory(regionCode, categoryId, maxResults) {
    var params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      chart: 'mostPopular',
      regionCode: regionCode,
      maxResults: maxResults,
      key: apiKey
    });
    if (categoryId) params.set('videoCategoryId', categoryId);
    Storage.addQuotaUsage(1);
    return apiFetch('/videos?' + params.toString()).then(function(data) {
      return data.items || [];
    });
  }

  // ホームフィード取得（複数カテゴリの人気動画をミックス）
  function getHomeFeed(regionCode) {
    regionCode = regionCode || Storage.getRegion();
    // カテゴリ: 総合(なし), 音楽(10), ゲーム(20), エンタメ(24), ニュース(25), スポーツ(17)
    var categories = [
      { id: null, count: 10 },
      { id: '10', count: 6 },
      { id: '20', count: 6 },
      { id: '24', count: 6 },
      { id: '25', count: 4 },
      { id: '17', count: 4 }
    ];

    var promises = categories.map(function(cat) {
      return getPopularByCategory(regionCode, cat.id, cat.count).catch(function() {
        return [];
      });
    });

    return Promise.all(promises).then(function(results) {
      var seen = {};
      var allItems = [];

      // 各カテゴリから交互に取り出して混ぜる
      var maxLen = 0;
      results.forEach(function(r) { if (r.length > maxLen) maxLen = r.length; });

      for (var i = 0; i < maxLen; i++) {
        for (var j = 0; j < results.length; j++) {
          if (i < results[j].length) {
            var item = results[j][i];
            var vid = item.id.videoId || item.id;
            if (!seen[vid]) {
              seen[vid] = true;
              allItems.push(item);
            }
          }
        }
      }

      if (Storage.getShortsFilter()) {
        allItems = allItems.filter(function(v) { return !Utils.isShorts(v); });
      }
      allItems = Utils.filterNGVideos(allItems);
      return { items: allItems };
    });
  }

  // トレンド動画取得（後方互換）
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
    return Utils.filterNGVideos(result);
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

  // --- OAuth認証付きAPI ---

  function authFetch(endpoint) {
    if (!accessToken) return Promise.reject(new Error('アクセストークンがありません'));
    var url = baseURL + endpoint;
    // endpointにkeyパラメータがなければ追加
    if (url.indexOf('key=') === -1) {
      url += (url.indexOf('?') === -1 ? '?' : '&') + 'key=' + encodeURIComponent(apiKey);
    }
    return fetch(url, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    }).then(function(res) {
      if (!res.ok) {
        return res.json().then(function(err) {
          var msg = (err.error && err.error.message) || 'APIエラーが発生しました';
          throw new Error(msg);
        });
      }
      return res.json();
    });
  }

  // 登録チャンネル一覧取得（ページネーション対応、チャンネル情報付き）
  function getSubscriptions(pageToken) {
    var cacheKey = 'subs:' + (pageToken || '');
    var cached = getCache(cacheKey);
    if (cached) return Promise.resolve(cached);

    var params = new URLSearchParams({
      part: 'snippet',
      mine: 'true',
      maxResults: '50',
      order: 'alphabetical'
    });
    if (pageToken) params.set('pageToken', pageToken);

    Storage.addQuotaUsage(1);
    return authFetch('/subscriptions?' + params.toString()).then(function(data) {
      var channels = (data.items || []).map(function(item) {
        var s = item.snippet;
        return {
          channelId: s.resourceId.channelId,
          title: s.title,
          description: s.description || '',
          thumbnail: (s.thumbnails && (s.thumbnails.medium || s.thumbnails.default || {}).url) || ''
        };
      });
      var result = {
        channels: channels,
        channelIds: channels.map(function(c) { return c.channelId; }),
        nextPageToken: data.nextPageToken || null
      };
      setCache(cacheKey, result, 5 * 60 * 1000);
      return result;
    });
  }

  // 全登録チャンネル取得（ページネーション全走査）
  function getAllSubscriptions() {
    var cacheKey = 'allSubs';
    var cached = getCache(cacheKey);
    if (cached) return Promise.resolve(cached);

    var allChannels = [];
    function fetchPage(pageToken) {
      return getSubscriptions(pageToken).then(function(result) {
        allChannels = allChannels.concat(result.channels);
        if (result.nextPageToken) {
          return fetchPage(result.nextPageToken);
        }
        setCache(cacheKey, allChannels, 5 * 60 * 1000);
        return allChannels;
      });
    }
    return fetchPage(null);
  }

  // 全登録チャンネルID取得
  function getAllSubscriptionChannelIds() {
    return getAllSubscriptions().then(function(channels) {
      return channels.map(function(c) { return c.channelId; });
    });
  }

  // チャンネルのアクティビティから最新動画IDを取得（1ユニット/チャンネル）
  function getChannelActivities(channelId, maxResults) {
    maxResults = maxResults || 5;
    var params = new URLSearchParams({
      part: 'snippet,contentDetails',
      channelId: channelId,
      maxResults: maxResults,
      key: apiKey
    });
    Storage.addQuotaUsage(1);
    return apiFetch('/activities?' + params.toString()).then(function(data) {
      var videoIds = [];
      (data.items || []).forEach(function(item) {
        if (item.snippet.type === 'upload' && item.contentDetails && item.contentDetails.upload) {
          videoIds.push(item.contentDetails.upload.videoId);
        }
      });
      return videoIds;
    }).catch(function() { return []; });
  }

  // 登録チャンネルの最新動画を取得（activities.list使用、1ユニット/ch）
  function getSubscriptionVideos(channelIds) {
    if (!channelIds || !channelIds.length) return Promise.resolve([]);

    var cacheKey = 'subVideos:' + channelIds.length + ':' + channelIds.slice(0, 3).join(',');
    var cached = getCache(cacheKey);
    if (cached) return Promise.resolve(cached);

    // 最大30チャンネルまで（クォータ節約）
    var targetIds = channelIds.slice(0, 30);

    // 各チャンネルのactivitiesから動画IDを取得（各1ユニット）
    var activityPromises = targetIds.map(function(chId) {
      return getChannelActivities(chId, 5);
    });

    return Promise.all(activityPromises).then(function(results) {
      // 全動画IDを集約（重複除去）
      var seen = {};
      var allVideoIds = [];
      results.forEach(function(ids) {
        ids.forEach(function(vid) {
          if (!seen[vid]) {
            seen[vid] = true;
            allVideoIds.push(vid);
          }
        });
      });

      if (!allVideoIds.length) return [];

      // 50件ずつ分割して動画詳細を取得（各1ユニット）
      var detailPromises = [];
      for (var i = 0; i < allVideoIds.length; i += 50) {
        detailPromises.push(getVideoDetails(allVideoIds.slice(i, i + 50).join(',')));
      }

      return Promise.all(detailPromises).then(function(detailResults) {
        var allDetails = [];
        detailResults.forEach(function(d) { allDetails = allDetails.concat(d); });

        // 公開日で降順ソート
        allDetails.sort(function(a, b) {
          var dateA = new Date(a.snippet.publishedAt);
          var dateB = new Date(b.snippet.publishedAt);
          return dateB - dateA;
        });

        // Shortsフィルタ
        if (Storage.getShortsFilter()) {
          allDetails = allDetails.filter(function(v) { return !Utils.isShorts(v); });
        }

        // NGワードフィルタ
        allDetails = Utils.filterNGVideos(allDetails);

        setCache(cacheKey, allDetails, 5 * 60 * 1000);
        return allDetails;
      });
    });
  }

  // 高評価動画取得
  function getLikedVideos(maxResults) {
    maxResults = maxResults || 5;
    var cacheKey = 'liked:' + maxResults;
    var cached = getCache(cacheKey);
    if (cached) return Promise.resolve(cached);

    var params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      myRating: 'like',
      maxResults: maxResults
    });
    Storage.addQuotaUsage(1);
    return authFetch('/videos?' + params.toString()).then(function(data) {
      var items = data.items || [];
      setCache(cacheKey, items, 5 * 60 * 1000);
      return items;
    });
  }

  // 高評価動画から関連動画を取得
  function getRecommendedFromLiked(likedVideos) {
    if (!likedVideos || !likedVideos.length) return Promise.resolve([]);

    var cacheKey = 'recFromLiked:' + likedVideos.map(function(v) { return v.id; }).join(',');
    var cached = getCache(cacheKey);
    if (cached) return Promise.resolve(cached);

    var promises = likedVideos.map(function(video) {
      var title = video.snippet.title || '';
      var keywords = title.replace(/[【】\[\]「」『』\(\)（）]/g, ' ')
                          .split(/\s+/)
                          .filter(function(w) { return w.length > 1; })
                          .slice(0, 3)
                          .join(' ');
      if (!keywords) keywords = title.slice(0, 20);

      var params = new URLSearchParams({
        part: 'snippet',
        q: keywords,
        type: 'video',
        videoDuration: 'medium',
        order: 'relevance',
        regionCode: Storage.getRegion(),
        maxResults: '5',
        key: apiKey
      });
      Storage.addQuotaUsage(100);
      return apiFetch('/search?' + params.toString()).then(function(data) {
        return data.items || [];
      }).catch(function() { return []; });
    });

    return Promise.all(promises).then(function(results) {
      var allItems = [];
      var seen = {};
      results.forEach(function(items) {
        items.forEach(function(item) {
          var vid = item.id.videoId;
          if (vid && !seen[vid]) {
            seen[vid] = true;
            allItems.push(item);
          }
        });
      });

      // 動画詳細を取得
      var videoIds = allItems.map(function(item) { return item.id.videoId; }).filter(Boolean);
      if (!videoIds.length) return [];

      return getVideoDetails(videoIds.join(',')).then(function(details) {
        var merged = mergeAndFilter(allItems, details);
        setCache(cacheKey, merged, 5 * 60 * 1000);
        return merged;
      });
    });
  }

  // パーソナライズドフィード
  function getPersonalizedFeed() {
    var cacheKey = 'personalizedFeed';
    var cached = getCache(cacheKey);
    if (cached) return Promise.resolve(cached);

    return Promise.all([
      getAllSubscriptionChannelIds().then(function(channelIds) {
        return getSubscriptionVideos(channelIds);
      }).catch(function(err) {
        console.error('登録チャンネル動画取得エラー:', err);
        return [];
      }),
      getLikedVideos(5).then(function(liked) {
        return getRecommendedFromLiked(liked);
      }).catch(function(err) {
        console.error('高評価関連動画取得エラー:', err);
        return [];
      })
    ]).then(function(results) {
      var subVideos = results[0];
      var recVideos = results[1];

      // インターリーブで混合（登録チャンネル3:推薦1の比率）
      var mixed = [];
      var seen = {};
      var si = 0, ri = 0;
      while (si < subVideos.length || ri < recVideos.length) {
        // 登録チャンネルから3つ
        for (var k = 0; k < 3 && si < subVideos.length; k++, si++) {
          var vid1 = subVideos[si].id.videoId || subVideos[si].id;
          if (!seen[vid1]) { seen[vid1] = true; mixed.push(subVideos[si]); }
        }
        // 推薦から1つ
        if (ri < recVideos.length) {
          var vid2 = recVideos[ri].id.videoId || recVideos[ri].id;
          if (!seen[vid2]) { seen[vid2] = true; mixed.push(recVideos[ri]); }
          ri++;
        }
      }

      // NGワードフィルタ適用
      mixed = Utils.filterNGVideos(mixed);

      // Shortsフィルタ適用
      if (Storage.getShortsFilter()) {
        mixed = mixed.filter(function(v) { return !Utils.isShorts(v); });
      }

      var result = { items: mixed };
      setCache(cacheKey, result, 5 * 60 * 1000);
      return result;
    });
  }

  return {
    init: init,
    setAccessToken: setAccessToken,
    getAccessToken: getAccessToken,
    testApiKey: testApiKey,
    getHomeFeed: getHomeFeed,
    getPersonalizedFeed: getPersonalizedFeed,
    getTrending: getTrending,
    search: search,
    getVideoDetails: getVideoDetails,
    getVideoById: getVideoById,
    getChannelInfo: getChannelInfo,
    getChannelVideos: getChannelVideos,
    getRelatedVideos: getRelatedVideos,
    getSubscriptions: getSubscriptions,
    getAllSubscriptions: getAllSubscriptions,
    getLikedVideos: getLikedVideos
  };
})();
