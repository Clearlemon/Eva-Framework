/**
 * Eva Framework —— 开发期热刷新（live reload）。
 *
 * 加载条件：
 * - 仅在 PHP 常量 `EVA_FW_DEV` 为 true 时由 Admin / Standalone / enqueue_runtime 注入。
 * - 生产环境应关闭 `EVA_FW_DEV`，避免额外轮询请求。
 *
 * 工作方式：
 * - PHP 把指纹接口地址注入到 `window.EvaFWDev.url`（wp_ajax_eva_fw_dev_stamp）。
 * - 接口在服务端 stat 全部被监听的 CSS/JS，返回一个总指纹（md5）。
 * - 本脚本定时取这一个指纹，变了就刷新页面。
 *
 * 设计取舍：
 * - 早期版本是浏览器逐个对近百个资源发 HEAD，一轮就是近百个并发请求。
 *   Studio 本地站点的 PHP 是小进程池，几轮下来就被打满、整站 ERR_CONNECTION_REFUSED。
 *   改成服务端算指纹后，一轮只有 1 个请求。
 * - 同一时刻只允许一个请求在途；标签页切到后台就不请求；失败指数退避到最长 60s，
 *   这样即使服务端真的挂了，也不会被前端持续敲打而起不来。
 * - 使用轮询而非 WebSocket，避免本地 WordPress Studio 环境额外启动 dev server。
 * - 使用 `_t=Date.now()` 防缓存查询参数，避免浏览器或代理缓存结果。
 */
(function () {
  'use strict';

  var cfg = window.EvaFWDev;
  // 未启用或没有指纹接口时静默退出，不影响正常页面运行。
  if (!cfg || !cfg.enabled || !cfg.url) {
    return;
  }

  // last 记录上一次观测到的指纹；首次采样只记录，不刷新。
  var last = null;
  // busy 保证同一时刻只有一个请求在途：服务端慢的时候不会越堆越多。
  var busy = false;
  // wp_localize_script 会把数字转成字符串，这里统一转回数字再参与计算。
  var interval = parseInt(cfg.interval, 10) || 2000;
  // 连续失败次数，用于指数退避。
  var fails = 0;
  var timer = null;

  function Schedule(delay) {
    window.clearTimeout(timer);
    timer = window.setTimeout(Tick, delay);
  }

  function Tick() {
    // 标签页不可见（切到别的标签、窗口最小化）时不打扰服务端，回到前台会立刻补一轮。
    if (document.hidden || busy) {
      Schedule(interval);
      return;
    }

    busy = true;
    fetch(cfg.url + '&_t=' + Date.now(), { method: 'GET', cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (text) {
        busy = false;
        fails = 0;
        var stamp = (text || '').trim();
        // 空响应视作一次无效采样，下一轮再看。
        if (!stamp) {
          Schedule(interval);
          return;
        }
        if (last === null) {
          last = stamp;
          Schedule(interval);
          return;
        }
        if (stamp !== last) {
          window.location.reload();
          return;
        }
        Schedule(interval);
      })
      .catch(function () {
        busy = false;
        fails++;
        // 服务端挂了 / 没权限 / 被登出：退避到最长 60s，给它喘息的机会。
        Schedule(Math.min(interval * Math.pow(2, fails), 60000));
      });
  }

  // 切回前台时尽快补一轮，避免离开期间的改动要等一个完整间隔才生效。
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      Schedule(300);
    }
  });

  // 首轮延后一个间隔，避免页面刚加载时资源尚未稳定导致误刷新。
  Schedule(interval);
})();
