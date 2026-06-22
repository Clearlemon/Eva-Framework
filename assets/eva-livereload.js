/* Eva Framework —— 开发期热刷新（live reload）。
 * 轮询关键资源的 Last-Modified/ETag，变化即刷新页面。
 * 仅在 EVA_FW_DEV 为 true 时加载；删除本文件并移除相关 enqueue 即可回滚。 */
(function () {
  'use strict';

  var cfg = window.EvaFWDev;
  if (!cfg || !cfg.enabled || !cfg.assets || !cfg.assets.length) {
    return;
  }

  var last = {};
  var interval = cfg.interval || 1500;

  function stamp(url) {
    var bust = url + (url.indexOf('?') > -1 ? '&' : '?') + '_t=' + Date.now();
    return fetch(bust, { method: 'HEAD', cache: 'no-store' })
      .then(function (r) {
        return (
          r.headers.get('last-modified') ||
          r.headers.get('etag') ||
          r.headers.get('content-length') ||
          ''
        );
      })
      .catch(function () { return ''; });
  }

  function tick() {
    Promise.all(cfg.assets.map(stamp)).then(function (vals) {
      var changed = false;
      cfg.assets.forEach(function (u, i) {
        if (last[u] === undefined) {
          last[u] = vals[i];
        } else if (vals[i] && last[u] !== vals[i]) {
          changed = true;
        }
      });
      if (changed) {
        window.location.reload();
      }
    });
  }

  setInterval(tick, interval);
})();
