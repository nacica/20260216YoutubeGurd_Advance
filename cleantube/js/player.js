// player.js - 動画プレーヤー制御
var Player = (function() {

  // youtube-nocookie embed プレーヤーHTMLを生成
  function createPlayer(videoId) {
    var origin = encodeURIComponent(window.location.origin);
    return '<div class="player-wrapper">' +
      '<iframe ' +
        'src="https://www.youtube-nocookie.com/embed/' + Utils.escapeHtml(videoId) + '?rel=0&autoplay=1&playsinline=1&origin=' + origin + '" ' +
        'frameborder="0" ' +
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
        'allowfullscreen ' +
        'referrerpolicy="strict-origin-when-cross-origin">' +
      '</iframe>' +
    '</div>';
  }

  // 現在のプレーヤーを破棄
  function destroyPlayer() {
    var wrapper = document.querySelector('.player-wrapper');
    if (wrapper) {
      wrapper.innerHTML = '';
      wrapper.remove();
    }
  }

  return {
    createPlayer: createPlayer,
    destroyPlayer: destroyPlayer
  };
})();
