<?php

namespace Eva\Framework;

if (! defined('ABSPATH')) {
    exit;
}

/**
 * 后台悬浮窗：在前台/后台任意页右下角悬浮一个可拖拽、可缩放的浮窗，内嵌 wp-admin，
 * 免去来回切换页面。属 Eva 框架自带功能，可在 Eva 设置抽屉的「功能」里开关。
 *
 * 说明：浮窗需在全站(前台 + 后台)所有页面生效才有意义，故全站注入；
 * 是否启用由 wp_options 的 eva_fw_floating 控制(默认开启)，管理员可在抽屉里切换。
 */
class Floating
{
    /**
     * 挂载浮窗的前台资源、前台输出与「后台 iframe 内隐藏原生 chrome」三组钩子。
     */
    public function __construct()
    {
        // 前台按需加载 dashicons（浮窗图标用）。
        add_action('wp_enqueue_scripts', [$this, 'enqueue_dashicons']);
        add_action('wp_footer', [$this, 'render']);
        // 不在 wp-admin 整页注入浮窗：官方后台本身已有完整导航，浮窗在此多余。
        // 浮窗只在前台与 Eva 独立页出现；后台仅保留下面这条供浮窗 iframe 内隐藏原生 chrome。
        add_action('admin_head', [$this, 'embed_admin_chrome']);
    }

    /**
     * 全站开关（持久化于 wp_options，默认开启）。
     *
     * @return bool 选项不为 '0' 即视为启用。
     */
    public static function is_enabled()
    {
        return get_option('eva_fw_floating', '1') !== '0';
    }

    /**
     * 当前请求是否应展示浮窗：需已登录 + 具备 edit_posts 能力 + 全站开关开启。
     *
     * @return bool
     */
    public static function can_use()
    {
        return is_user_logged_in() && current_user_can('edit_posts') && self::is_enabled();
    }

    /**
     * 前台按需加载 dashicons 样式（仅在浮窗可用时，避免无谓加载）。
     *
     * @return void
     */
    public function enqueue_dashicons()
    {
        if (self::can_use()) {
            wp_enqueue_style('dashicons');
        }
    }

    /**
     * 当 wp-admin 被嵌入浮窗 iframe 内时，隐藏其原生顶栏与左侧菜单、内容全宽，
     * 让浮窗里的后台更聚焦（导航改用浮窗顶部快捷入口）。
     * 仅在 iframe 内生效（靠 JS 判断 window.self !== window.top），
     * 直接整页访问 wp-admin 完全不受影响。
     */
    public function embed_admin_chrome()
    {
        if (! self::is_enabled()) {
            return;
        }
        ?>
        <script>if (window.self !== window.top) { document.documentElement.className += ' eva-fa-embed'; }</script>
        <style>
        html.eva-fa-embed.wp-toolbar { padding-top: 0 !important; }
        html.eva-fa-embed #wpadminbar,
        html.eva-fa-embed #adminmenumain { display: none !important; }
        html.eva-fa-embed #wpcontent,
        html.eva-fa-embed #wpfooter { margin-left: 0 !important; }
        html.eva-fa-embed #wpbody-content { padding-top: 8px; }
        </style>
        <?php
    }

    /**
     * 浮窗顶部快捷入口清单：每项为 [标题, dashicons 图标类, 后台地址]。
     *
     * @return array<int,array{0:string,1:string,2:string}>
     */
    private static function links()
    {
        return array(
            array('仪表盘', 'dashicons-dashboard',        admin_url('index.php')),
            array('文章',   'dashicons-admin-post',       admin_url('edit.php')),
            array('新建',   'dashicons-plus-alt',         admin_url('post-new.php')),
            array('媒体',   'dashicons-admin-media',      admin_url('upload.php')),
            array('页面',   'dashicons-admin-page',       admin_url('edit.php?post_type=page')),
            array('评论',   'dashicons-admin-comments',   admin_url('edit-comments.php')),
            array('外观',   'dashicons-admin-appearance', admin_url('themes.php')),
            array('插件',   'dashicons-admin-plugins',    admin_url('plugins.php')),
            array('用户',   'dashicons-admin-users',      admin_url('users.php')),
            array('设置',   'dashicons-admin-settings',   admin_url('options-general.php')),
        );
    }

    /**
     * footer 钩子回调（前台 wp_footer）：委托 markup() 输出浮窗。
     *
     * @return void
     */
    public function render()
    {
        self::markup();
    }

    /**
     * 直接输出浮窗标记（HTML + 内联 CSS/JS），供 footer 钩子与 Eva 独立页整页渲染共用。
     *
     * 不满足展示条件（can_use）时静默返回，不输出任何内容。
     *
     * @return void
     */
    public static function markup()
    {
        if (! self::can_use()) {
            return;
        }

        $start = esc_url(admin_url('index.php'));

        $tabs = '';
        foreach (self::links() as $l) {
            $tabs .= sprintf(
                '<button type="button" class="xn-fa-tab" data-url="%s"><span class="dashicons %s"></span><span>%s</span></button>',
                esc_url($l[2]),
                esc_attr($l[1]),
                esc_html($l[0])
            );
        }
        ?>
        <div id="xn-fa-root" data-start="<?php echo $start; ?>">
            <button id="xn-fa-fab" class="xn-fa-fab" type="button" title="后台快捷面板" aria-label="打开后台快捷面板">
                <span class="dashicons dashicons-wordpress-alt"></span>
            </button>
            <div id="xn-fa-panel" class="xn-fa-panel" role="dialog" aria-label="后台快捷面板">
                <div id="xn-fa-bar" class="xn-fa-bar">
                    <span class="xn-fa-title"><span class="dashicons dashicons-wordpress-alt"></span>后台快捷</span>
                    <div class="xn-fa-actions">
                        <button type="button" data-act="reload" title="刷新"><span class="dashicons dashicons-update"></span></button>
                        <button type="button" data-act="newtab" title="新标签打开"><span class="dashicons dashicons-external"></span></button>
                        <button type="button" data-act="max" title="最大化 / 还原"><span class="dashicons dashicons-editor-expand"></span></button>
                        <button type="button" data-act="close" title="收起"><span class="dashicons dashicons-no-alt"></span></button>
                    </div>
                </div>
                <div class="xn-fa-tabs"><?php echo $tabs; ?></div>
                <div class="xn-fa-frame-wrap">
                    <iframe id="xn-fa-frame" class="xn-fa-frame" src="about:blank" title="WordPress 后台"></iframe>
                </div>
                <div id="xn-fa-resize" class="xn-fa-resize" title="拖拽调整大小"></div>
            </div>
        </div>
        <?php
        echo "<style>\n" . self::css() . "\n</style>\n";
        echo "<script>\n" . self::js() . "\n</script>\n";
    }

    /**
     * 浮窗的内联 CSS（悬浮按钮、面板、标签条、iframe、缩放手柄，含响应式与暗色模式）。
     *
     * 用 nowdoc（'CSS'）原样返回，不做变量插值；样式全部加 xn-fa 前缀避免污染站点。
     *
     * @return string 纯 CSS 文本。
     */
    private static function css()
    {
        return <<<'CSS'
#xn-fa-root, #xn-fa-root * { box-sizing: border-box; }
.xn-fa-fab {
  position: fixed; right: 24px; bottom: 24px; z-index: 2147483600;
  width: 52px; height: 52px; border: 0; border-radius: 50%; cursor: pointer;
  display: grid; place-items: center; color: #fff; touch-action: none;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  box-shadow: 0 8px 24px rgba(79, 70, 229, .45);
  transition: transform .18s ease, box-shadow .18s ease;
}
.xn-fa-fab:hover { transform: translateY(-2px) scale(1.06); box-shadow: 0 12px 30px rgba(79, 70, 229, .55); }
.xn-fa-fab .dashicons { font-size: 28px; width: 28px; height: 28px; line-height: 1; }
.xn-fa-panel {
  position: fixed; z-index: 2147483600; display: none; flex-direction: column;
  width: 440px; height: 620px; max-width: 96vw; max-height: 92vh;
  background: #fff; border: 1px solid rgba(0, 0, 0, .08); border-radius: 14px;
  overflow: hidden; box-shadow: 0 20px 64px rgba(0, 0, 0, .32);
}
.xn-fa-panel.is-max { left: 2vw !important; top: 2vh !important; width: 96vw !important; height: 96vh !important; }
.xn-fa-bar {
  flex: none; display: flex; align-items: center; justify-content: space-between;
  padding: 8px 8px 8px 14px; background: #1f2330; color: #fff; cursor: move; user-select: none;
}
.xn-fa-title { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; }
.xn-fa-title .dashicons { font-size: 18px; width: 18px; height: 18px; color: #8b93ff; }
.xn-fa-actions { display: flex; gap: 2px; }
.xn-fa-actions button {
  width: 28px; height: 28px; border: 0; border-radius: 6px; cursor: pointer;
  background: transparent; color: #c7ccd6; display: grid; place-items: center; transition: all .15s ease;
}
.xn-fa-actions button:hover { background: rgba(255, 255, 255, .14); color: #fff; }
.xn-fa-actions .dashicons { font-size: 17px; width: 17px; height: 17px; }
.xn-fa-tabs {
  flex: none; display: flex; gap: 6px; padding: 8px 10px; overflow-x: auto; white-space: nowrap;
  background: #f5f6f8; border-bottom: 1px solid #ececf1;
}
.xn-fa-tabs::-webkit-scrollbar { height: 6px; }
.xn-fa-tabs::-webkit-scrollbar-thumb { background: #cfd3da; border-radius: 3px; }
.xn-fa-tab {
  flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; line-height: 1;
  border: 1px solid #e3e5ea; border-radius: 999px; background: #fff; color: #41454d; font-size: 12px; cursor: pointer;
  transition: all .15s ease;
}
.xn-fa-tab:hover { border-color: #6366f1; color: #4f46e5; }
.xn-fa-tab.is-active { border-color: #6366f1; background: #eef0fe; color: #4f46e5; }
.xn-fa-tab .dashicons { font-size: 15px; width: 15px; height: 15px; }
.xn-fa-frame-wrap { position: relative; flex: 1; min-height: 0; background: #fff; }
.xn-fa-frame { display: block; width: 100%; height: 100%; border: 0; }
.xn-fa-resize { position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; cursor: nwse-resize; z-index: 6; }
.xn-fa-resize::after {
  content: ""; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(120, 120, 120, .55); border-bottom: 2px solid rgba(120, 120, 120, .55);
}
@media (max-width: 782px) {
  .xn-fa-fab { right: 16px; bottom: 84px; }
}
@media (prefers-color-scheme: dark) {
  .xn-fa-panel { background: #1a1e25; border-color: #2c323b; }
  .xn-fa-tabs { background: #242a33; border-color: #2c323b; }
  .xn-fa-tab { background: #1a1e25; border-color: #2c323b; color: #cdd3dd; }
  .xn-fa-tab.is-active { background: rgba(99, 102, 241, .22); border-color: #6366f1; color: #c7cbff; }
  .xn-fa-frame-wrap { background: #1a1e25; }
}
CSS;
    }

    /**
     * 浮窗的内联 JS（IIFE）：处理打开/收起、拖拽、缩放、最大化、标签切换与状态持久化。
     *
     * 用 nowdoc（'JS'）原样返回；内部带防套娃（iframe 内不再注入）与 localStorage 记忆。
     *
     * @return string 纯 JavaScript 文本。
     */
    private static function js()
    {
        return <<<'JS'
(function () {
  var root = document.getElementById('xn-fa-root');
  if (!root) { return; }
  // 防止 iframe 内的 wp-admin 再次注入浮窗（套娃）
  if (window.top !== window.self) { root.parentNode && root.parentNode.removeChild(root); return; }
  if (window.__xnFAInit) { return; }
  window.__xnFAInit = true;

  var fab = document.getElementById('xn-fa-fab');
  var panel = document.getElementById('xn-fa-panel');
  var bar = document.getElementById('xn-fa-bar');
  var frame = document.getElementById('xn-fa-frame');
  var resize = document.getElementById('xn-fa-resize');
  var tabsWrap = panel.querySelector('.xn-fa-tabs');
  var start = root.getAttribute('data-start') || '';
  var KEY = 'xn_fa_state_v1';

  var st = load();

  function load() {
    var d = { open: false, max: false, url: start, left: null, top: null, width: 440, height: 620, fabLeft: null, fabTop: null };
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || '{}');
      for (var k in s) { if (s.hasOwnProperty(k)) { d[k] = s[k]; } }
    } catch (e) {}
    return d;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  }

  function clamp() {
    var maxL = Math.max(0, window.innerWidth - st.width);
    var maxT = Math.max(0, window.innerHeight - st.height);
    if (st.left === null) { st.left = Math.max(0, window.innerWidth - st.width - 24); }
    if (st.top === null) { st.top = Math.max(0, window.innerHeight - st.height - 24); }
    st.left = Math.min(Math.max(0, st.left), maxL);
    st.top = Math.min(Math.max(0, st.top), maxT);
  }

  function apply() {
    clamp();
    panel.classList.toggle('is-max', !!st.max);
    if (!st.max) {
      panel.style.left = st.left + 'px';
      panel.style.top = st.top + 'px';
      panel.style.width = st.width + 'px';
      panel.style.height = st.height + 'px';
    }
    if (st.open) {
      panel.style.display = 'flex';
      fab.style.display = 'none';
      if (!frame.src || frame.src === 'about:blank') { frame.src = st.url || start; }
      markActive(st.url);
    } else {
      panel.style.display = 'none';
      fab.style.display = 'grid';
    }
    applyFab();
  }

  function markActive(url) {
    var btns = tabsWrap.querySelectorAll('.xn-fa-tab');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-active', btns[i].getAttribute('data-url') === url);
    }
  }

  function open() { st.open = true; apply(); save(); }
  function close() { st.open = false; apply(); save(); }

  // FAB 可拖拽（鼠标 + 触摸）：移动超过阈值视为拖拽并记忆位置，否则视为点击打开
  function applyFab() {
    if (st.fabLeft === null || st.fabTop === null) { return; }
    var w = fab.offsetWidth || 52, h = fab.offsetHeight || 52;
    var l = Math.min(Math.max(0, st.fabLeft), Math.max(0, window.innerWidth - w));
    var t = Math.min(Math.max(0, st.fabTop), Math.max(0, window.innerHeight - h));
    fab.style.left = l + 'px'; fab.style.top = t + 'px';
    fab.style.right = 'auto'; fab.style.bottom = 'auto';
  }
  (function () {
    var down = false, moved = false, sx = 0, sy = 0, sl = 0, stp = 0;
    fab.addEventListener('pointerdown', function (e) {
      down = true; moved = false; sx = e.clientX; sy = e.clientY;
      var r = fab.getBoundingClientRect(); sl = r.left; stp = r.top;
      try { fab.setPointerCapture(e.pointerId); } catch (err) {}
    });
    fab.addEventListener('pointermove', function (e) {
      if (!down) { return; }
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && (Math.abs(dx) + Math.abs(dy)) < 5) { return; }
      moved = true; st.fabLeft = sl + dx; st.fabTop = stp + dy; applyFab();
    });
    function endDrag() { if (!down) { return; } down = false; if (moved) { save(); } else { open(); } }
    fab.addEventListener('pointerup', endDrag);
    fab.addEventListener('pointercancel', endDrag);
  })();

  tabsWrap.addEventListener('click', function (e) {
    var btn = e.target.closest('.xn-fa-tab');
    if (!btn) { return; }
    st.url = btn.getAttribute('data-url');
    frame.src = st.url;
    markActive(st.url);
    save();
  });

  panel.querySelector('.xn-fa-actions').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) { return; }
    var act = btn.getAttribute('data-act');
    if (act === 'close') { close(); }
    else if (act === 'max') { st.max = !st.max; apply(); save(); }
    else if (act === 'reload') { try { frame.contentWindow.location.reload(); } catch (err) { frame.src = frame.src; } }
    else if (act === 'newtab') { window.open(frame.src && frame.src !== 'about:blank' ? frame.src : (st.url || start), '_blank'); }
  });

  // 拖拽 / 缩放期间屏蔽 iframe 抢占鼠标
  function lockFrame(lock) { frame.style.pointerEvents = lock ? 'none' : ''; document.body.style.userSelect = lock ? 'none' : ''; }

  // 拖拽移动
  bar.addEventListener('mousedown', function (e) {
    if (e.target.closest('.xn-fa-actions') || st.max) { return; }
    e.preventDefault();
    var sx = e.clientX, sy = e.clientY, sl = st.left, str = st.top;
    lockFrame(true);
    function mv(ev) {
      st.left = sl + (ev.clientX - sx);
      st.top = str + (ev.clientY - sy);
      apply();
    }
    function up() { lockFrame(false); save(); document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  });

  // 右下角缩放
  resize.addEventListener('mousedown', function (e) {
    if (st.max) { return; }
    e.preventDefault(); e.stopPropagation();
    var sx = e.clientX, sy = e.clientY, sw = st.width, sh = st.height;
    lockFrame(true);
    function mv(ev) {
      st.width = Math.min(Math.max(320, sw + (ev.clientX - sx)), window.innerWidth);
      st.height = Math.min(Math.max(300, sh + (ev.clientY - sy)), window.innerHeight);
      apply();
    }
    function up() { lockFrame(false); save(); document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  });

  window.addEventListener('resize', function () { apply(); });

  apply();
})();
JS;
    }
}
