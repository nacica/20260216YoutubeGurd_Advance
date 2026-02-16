// utils.js - ユーティリティ関数
var Utils = (function() {

  // ISO 8601 durationをパースして秒数を返す
  function parseDuration(iso) {
    if (!iso) return 0;
    var match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    var h = parseInt(match[1] || 0);
    var m = parseInt(match[2] || 0);
    var s = parseInt(match[3] || 0);
    return h * 3600 + m * 60 + s;
  }

  // 秒数をMM:SSまたはHH:MM:SS形式にフォーマット
  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    if (h > 0) {
      return h + ':' + padZero(m) + ':' + padZero(s);
    }
    return m + ':' + padZero(s);
  }

  function padZero(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  // 再生回数をフォーマット（例: 1,234,567 → 123万回）
  function formatViewCount(count) {
    if (!count) return '0回';
    var n = parseInt(count);
    if (n >= 100000000) {
      return Math.floor(n / 100000000) + '億回';
    }
    if (n >= 10000) {
      return Math.floor(n / 10000) + '万回';
    }
    if (n >= 1000) {
      return (n / 1000).toFixed(1).replace(/\.0$/, '') + '千回';
    }
    return n + '回';
  }

  // 登録者数フォーマット
  function formatSubscriberCount(count) {
    if (!count) return '0人';
    var n = parseInt(count);
    if (n >= 100000000) {
      return Math.floor(n / 100000000) + '億人';
    }
    if (n >= 10000) {
      return Math.floor(n / 10000) + '万人';
    }
    if (n >= 1000) {
      return (n / 1000).toFixed(1).replace(/\.0$/, '') + '千人';
    }
    return n + '人';
  }

  // 投稿日時をフォーマット（相対時間）
  function formatDate(isoDate) {
    if (!isoDate) return '';
    var date = new Date(isoDate);
    var now = new Date();
    var diff = now - date;
    var seconds = Math.floor(diff / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    var months = Math.floor(days / 30);
    var years = Math.floor(days / 365);

    if (years > 0) return years + '年前';
    if (months > 0) return months + 'ヶ月前';
    if (days > 0) return days + '日前';
    if (hours > 0) return hours + '時間前';
    if (minutes > 0) return minutes + '分前';
    return 'たった今';
  }

  // Shorts判定
  function isShorts(video) {
    // durationが60秒以下
    if (video.contentDetails && video.contentDetails.duration) {
      var seconds = parseDuration(video.contentDetails.duration);
      if (seconds > 0 && seconds <= 60) return true;
    }
    // タイトルに#shortsを含む
    var title = (video.snippet && video.snippet.title || '').toLowerCase();
    if (title.includes('#shorts') || title.includes('#short')) return true;
    return false;
  }

  // サムネイルURLを取得（高画質優先）
  function getThumbnail(snippet) {
    if (!snippet || !snippet.thumbnails) return '';
    var thumbs = snippet.thumbnails;
    if (thumbs.medium) return thumbs.medium.url;
    if (thumbs.high) return thumbs.high.url;
    if (thumbs.default) return thumbs.default.url;
    return '';
  }

  // HTMLエスケープ
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // デバウンス
  function debounce(fn, delay) {
    var timer = null;
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(context, args);
      }, delay);
    };
  }

  // NGワード判定（中国・韓国・KPOP関連）
  var ngPattern = /中国|中華|中共|韓国|KPOP|K-POP|한국|中國|BTS|BLACKPINK|TWICE|ENHYPEN|STRAY\s*KIDS|SEVENTEEN|AESPA|IVE|LE\s*SSERAFIM|NEWJEANS|NEW\s*JEANS|韓流|華流|チャイナ|コリア/i;

  function containsNGWords(text) {
    if (!text) return false;
    return ngPattern.test(text);
  }

  function filterNGVideos(items) {
    if (!items || !items.length) return items;
    return items.filter(function(item) {
      var snippet = item.snippet;
      if (!snippet) return true;
      if (containsNGWords(snippet.title)) return false;
      if (containsNGWords(snippet.channelTitle)) return false;
      return true;
    });
  }

  return {
    parseDuration: parseDuration,
    formatDuration: formatDuration,
    formatViewCount: formatViewCount,
    formatSubscriberCount: formatSubscriberCount,
    formatDate: formatDate,
    isShorts: isShorts,
    getThumbnail: getThumbnail,
    escapeHtml: escapeHtml,
    debounce: debounce,
    containsNGWords: containsNGWords,
    filterNGVideos: filterNGVideos
  };
})();
