/**
 * Eva Framework —— 开发期热刷新（live reload）。
 *
 * 加载条件：
 * - 仅在 PHP 常量 `EVA_FW_DEV` 为 true 时由 Admin / Standalone 注入。
 * - 生产环境应关闭 `EVA_FW_DEV`，避免额外 HEAD 轮询请求。
 *
 * 工作方式：
 * - PHP 会把需要监听的 CSS/JS URL 列表注入到 `window.EvaFWDev.assets`。
 * - 本脚本定时对这些资源发起 `HEAD` 请求，并读取 Last-Modified / ETag / Content-Length。
 * - 任一资源指纹变化即刷新页面，让开发时修改 CSS/JS 后无需手动刷新。
 *
 * 设计取舍：
 * - 使用轮询而非 WebSocket，避免本地 WordPress Studio 环境额外启动 dev server。
 * - 使用 `_t=Date.now()` 防缓存查询参数，避免浏览器或代理缓存 HEAD 结果。
 */
(function () {
  'use strict';

  var cfg = window.EvaFWDev;
  // 未启用或没有监听资源时静默退出，不影响正常页面运行。
  if (!cfg || !cfg.enabled || !cfg.assets || !cfg.assets.length) {
    return;
  }

  // last 记录每个资源上一次观测到的指纹；首次采样只记录，不刷新。
  var last = {};
  var interval = cfg.interval || 1500;

  // 读取单个资源的变更指纹。优先使用 Last-Modified，其次 ETag，最后 Content-Length 兜底。
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

  // 每轮并发检查全部资源，只要有一个资源指纹变化就刷新当前页面。
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

  // 简单定时轮询；无需立即 tick，避免页面刚加载时资源尚未稳定导致误刷新。
  setInterval(tick, interval);
})();
