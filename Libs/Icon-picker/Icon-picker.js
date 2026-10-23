/**
 * Eva UI 库 · eva-icon-picker（图标选择器）。
 *
 * 支持常用 Font Awesome 名称、Remixicon 类名与 Dashicons 名称。保存值保持为
 * 字段值字符串，组件只负责搜索、预览和选择。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  var gsapPromise = null;
  var pickerScript = document.currentScript && document.currentScript.src;
  // 优先复用框架配置及已加载的 GSAP；独立使用组件时也读取同目录内的本地资源。
  function Ensure_Gsap() {
    if (window.gsap) { return Promise.resolve(window.gsap); }
    if (gsapPromise) { return gsapPromise; }
    var config = window.EvaFW && window.EvaFW.config || {};
    var url = config.gsapUrl || (pickerScript ? new URL('../../assets/vendor/gsap.min.js', pickerScript).href : '');
    if (!url) { return Promise.reject(new Error('GSAP URL unavailable')); }
    url = new URL(url, document.baseURI).href;
    gsapPromise = new Promise(function (resolve, reject) {
      var script = Array.from(document.scripts).find(function (item) { return item.src === url; });
      var created = !script;
      if (!script) { script = document.createElement('script'); script.src = url; script.async = true; }
      script.addEventListener('load', function () { if (window.gsap) { resolve(window.gsap); } else { reject(new Error('GSAP unavailable')); } }, { once: true });
      script.addEventListener('error', function () { if (created) { script.remove(); } reject(new Error('GSAP load failed')); }, { once: true });
      if (created) { document.head.appendChild(script); }
    }).catch(function (error) { gsapPromise = null; throw error; });
    return gsapPromise;
  }

  var FA_MAP = {
    star: 'ri-star-fill',
    heart: 'ri-heart-line',
    bell: 'ri-notification-3-line',
    user: 'ri-user-3-line',
    cog: 'ri-settings-3-line',
    gear: 'ri-settings-3-line',
    home: 'ri-home-4-line',
    folder: 'ri-folder-line',
    file: 'ri-file-line',
    list: 'ri-list-check',
    menu: 'ri-menu-line',
    search: 'ri-search-line',
    eye: 'ri-eye-line',
    'eye-slash': 'ri-eye-off-line',
    calendar: 'ri-calendar-line',
    clock: 'ri-time-line',
    bookmark: 'ri-bookmark-line',
    flag: 'ri-flag-line',
    check: 'ri-check-line',
    times: 'ri-close-line',
    plus: 'ri-add-line',
    minus: 'ri-subtract-line',
    edit: 'ri-edit-2-line',
    trash: 'ri-delete-bin-line',
    upload: 'ri-upload-2-line',
    download: 'ri-download-2-line',
    print: 'ri-printer-line',
    refresh: 'ri-refresh-line',
    link: 'ri-link',
    unlink: 'ri-link-unlink',
    lock: 'ri-lock-line',
    unlock: 'ri-lock-unlock-line',
    info: 'ri-information-line',
    question: 'ri-question-line',
    'question-circle': 'ri-question-line',
    'arrow-left': 'ri-arrow-left-line',
    'arrow-right': 'ri-arrow-right-line',
    'arrow-up': 'ri-arrow-up-line',
    'arrow-down': 'ri-arrow-down-line',
    thumbs_up: 'ri-thumb-up-line',
    thumbs_down: 'ri-thumb-down-line',
    share: 'ri-share-line',
    image: 'ri-image-line',
    video: 'ri-movie-line',
    music: 'ri-music-2-line',
    github: 'ri-github-line',
    wordpress: 'ri-wordpress-line'
  };

  var FA_ITEMS = [
    ['star', '星标', 'common'], ['heart', '收藏', 'common'], ['bell', '通知', 'common'], ['user', '用户', 'common'],
    ['cog', '设置', 'common'], ['home', '首页', 'common'], ['folder', '文件夹', 'common'], ['file', '文件', 'common'],
    ['list', '列表', 'common'], ['menu', '菜单', 'common'], ['search', '搜索', 'common'], ['eye', '可见', 'common'],
    ['eye-slash', '隐藏', 'common'], ['calendar', '日历', 'common'], ['clock', '时间', 'common'], ['bookmark', '书签', 'common'],
    ['flag', '旗帜', 'common'], ['check', '确认', 'interface'], ['times', '关闭', 'interface'], ['plus', '添加', 'interface'],
    ['minus', '减少', 'interface'], ['edit', '编辑', 'interface'], ['trash', '删除', 'interface'], ['refresh', '刷新', 'interface'],
    ['lock', '锁定', 'interface'], ['unlock', '解锁', 'interface'], ['info', '信息', 'interface'], ['question-circle', '帮助', 'interface'],
    ['arrow-left', '左箭头', 'direction'], ['arrow-right', '右箭头', 'direction'], ['arrow-up', '上箭头', 'direction'], ['arrow-down', '下箭头', 'direction'],
    ['link', '链接', 'interface'], ['unlink', '取消链接', 'interface'], ['share', '分享', 'interface'], ['upload', '上传', 'media'],
    ['download', '下载', 'media'], ['print', '打印', 'media'], ['image', '图片', 'media'], ['video', '视频', 'media'],
    ['music', '音乐', 'media'], ['github', 'GitHub', 'brand'], ['wordpress', 'WordPress', 'brand']
  ];

  var REMIX_ITEMS = [
    ['ri-star-fill', '星标', 'common'], ['ri-heart-line', '收藏', 'common'], ['ri-notification-3-line', '通知', 'common'],
    ['ri-user-3-line', '用户', 'common'], ['ri-settings-3-line', '设置', 'common'], ['ri-home-4-line', '首页', 'common'],
    ['ri-folder-line', '文件夹', 'common'], ['ri-file-line', '文件', 'common'], ['ri-list-check', '列表', 'common'],
    ['ri-menu-line', '菜单', 'common'], ['ri-search-line', '搜索', 'common'], ['ri-eye-line', '可见', 'common'],
    ['ri-eye-off-line', '隐藏', 'common'], ['ri-calendar-line', '日历', 'common'], ['ri-time-line', '时间', 'common'],
    ['ri-bookmark-line', '书签', 'common'], ['ri-flag-line', '旗帜', 'common'], ['ri-check-line', '确认', 'interface'],
    ['ri-close-line', '关闭', 'interface'], ['ri-add-line', '添加', 'interface'], ['ri-subtract-line', '减少', 'interface'],
    ['ri-edit-2-line', '编辑', 'interface'], ['ri-delete-bin-line', '删除', 'interface'], ['ri-refresh-line', '刷新', 'interface'],
    ['ri-arrow-left-line', '左箭头', 'direction'], ['ri-arrow-right-line', '右箭头', 'direction'],
    ['ri-arrow-up-line', '上箭头', 'direction'], ['ri-arrow-down-line', '下箭头', 'direction'], ['ri-upload-2-line', '上传', 'media'],
    ['ri-download-2-line', '下载', 'media'], ['ri-printer-line', '打印', 'media'], ['ri-image-line', '图片', 'media'],
    ['ri-movie-line', '视频', 'media'], ['ri-music-2-line', '音乐', 'media'], ['ri-github-line', 'GitHub', 'brand'],
    ['ri-wordpress-line', 'WordPress', 'brand']
  ];

  var DASH_ITEMS = [
    ['star-filled', '星标', 'common'], ['heart', '收藏', 'common'], ['bell', '通知', 'common'], ['admin-users', '用户', 'common'],
    ['admin-settings', '设置', 'common'], ['admin-home', '首页', 'common'], ['portfolio', '文件夹', 'common'], ['media-default', '文件', 'common'],
    ['menu', '菜单', 'common'], ['search', '搜索', 'common'], ['visibility', '可见', 'common'], ['calendar-alt', '日历', 'common'],
    ['clock', '时间', 'common'], ['yes', '确认', 'interface'], ['no-alt', '关闭', 'interface'], ['plus-alt2', '添加', 'interface'],
    ['minus', '减少', 'interface'], ['edit', '编辑', 'interface'], ['trash', '删除', 'interface'], ['update', '刷新', 'interface'],
    ['arrow-left-alt2', '左箭头', 'direction'], ['arrow-right-alt2', '右箭头', 'direction'], ['arrow-up-alt2', '上箭头', 'direction'],
    ['arrow-down-alt2', '下箭头', 'direction'], ['upload', '上传', 'media'], ['download', '下载', 'media'], ['format-image', '图片', 'media'],
    ['format-video', '视频', 'media'], ['format-audio', '音乐', 'media'], ['wordpress', 'WordPress', 'brand']
  ];

  var REMIX_CACHE = null;
  var REMIX_PROMISE = null;

  // 使用主题实际加载的图标文件，保证完整清单与字体版本一致；多个选择器共用一次请求。
  function Load_Remix_Items() {
    if (REMIX_CACHE) { return Promise.resolve(REMIX_CACHE); }
    if (REMIX_PROMISE) { return REMIX_PROMISE; }
    var config = window.EvaFW && window.EvaFW.config || {};
    var sheet = document.querySelector('link[href*="remixicon.css"]');
    var url = config.remixCssUrl || (sheet && sheet.href) || (pickerScript ? new URL('../../assets/vendor/remixicon.css', pickerScript).href : '');
    if (!url || !window.fetch) { return Promise.reject(new Error('Remixicon source unavailable')); }
    REMIX_PROMISE = window.fetch(new URL(url, document.baseURI).href)
      .then(function (res) {
        if (!res.ok) { throw new Error('Remixicon load failed'); }
        return res.text();
      })
      .then(function (css) {
        var seen = {}, labels = {}, items = [], match;
        REMIX_ITEMS.forEach(function (item) { labels[item[0]] = item[1]; });
        var re = /\.ri-([a-z0-9-]+)\s*::?before\b/g;
        while ((match = re.exec(css))) {
          var value = 'ri-' + match[1];
          if (seen[value]) { continue; }
          seen[value] = true;
          items.push({ value: value, label: labels[value] || Label_From_Icon(value) });
        }
        if (!items.length) { throw new Error('Remixicon list is empty'); }
        REMIX_CACHE = items.sort(function (a, b) { return a.value.localeCompare(b.value); });
        return REMIX_CACHE;
      })
      .catch(function (error) { REMIX_PROMISE = null; throw error; });
    return REMIX_PROMISE;
  }

  // 功能：处理 To Items 相关逻辑。
  function To_Items(list) {
    return list.map(function (x) {
      return { value: x[0], label: x[1] };
    });
  }

  // 功能：读取主题注入的自定义图标集。
  // 来源：PHP 过滤器 eva_field_icon_add_icons（格式与 CSF 的 csf_field_icon_add_icons 相同：
  // [{ title: '名称', icons: ['类名或 symbol id', …] }]），由后端输出为 window.EvaIconSets。
  // 所有图标集合并展示；保存值就是注册时写的字符串本身，不加任何库前缀。
  var CUSTOM_CACHE = null;
  var CUSTOM_MAP = {};
  function Custom_Items() {
    if (CUSTOM_CACHE) { return CUSTOM_CACHE; }
    var sets = Array.isArray(window.EvaIconSets) ? window.EvaIconSets : [];
    var out = [];
    sets.forEach(function (set) {
      if (!set || !Array.isArray(set.icons)) { return; }
      set.icons.forEach(function (icon) {
        icon = String(icon == null ? '' : icon).trim();
        if (!icon || CUSTOM_MAP[icon]) { return; }
        CUSTOM_MAP[icon] = true;
        out.push({ value: icon, label: icon.replace(/^(fa[srbl]?\s+)?(fa|ri|icon|dashicons)-/, '').replace(/[-_]/g, ' ') });
      });
    });
    CUSTOM_CACHE = out;
    return out;
  }

  // 功能：判断一个值是不是自定义图标集里的图标。
  function Is_Custom(value) {
    Custom_Items();
    return !!CUSTOM_MAP[String(value == null ? '' : value).trim()];
  }

  // 功能：处理 Library Key 相关逻辑。
  function Library_Key(value) {
    value = String(value || '').toLowerCase();
    if (value === 'fontawesome' || value === 'font-awesome') { return 'fa'; }
    if (value === 'dashicon') { return 'dashicons'; }
    if (value === 'ali' || value === 'alibaba' || value === 'iconfont' || value === 'symbol' || value === 'svg') { return 'svg'; }
    if (value === 'eva') { return 'remix'; }
    return value || 'remix';
  }

  // 功能：处理 Label From Icon 相关逻辑。
  function Label_From_Icon(value) {
    return String(value || '').replace(/^ri-/, '').replace(/-(line|fill)$/, '').replace(/-/g, ' ');
  }

  window.EvaUI.IconPicker = {
    components: {
      EvaSymbolIcon: {
        props: ['href'],
        mounted: function () { this.syncHref(); },
        updated: function () { this.syncHref(); },
        methods: {
          // 功能：以 DOM API 写入 SVG use 引用，兼容 href 与 xlink:href。
          syncHref: function () {
            var use = this.$el && this.$el.querySelector ? this.$el.querySelector('use') : null;
            if (!use || !this.href) { return; }
            use.setAttribute('href', this.href);
            use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.href);
          }
        },
        template: '<svg class="eva-icon-svg" aria-hidden="true" focusable="false"><use></use></svg>'
      }
    },
    props: {
      modelValue: { type: String, default: '' },
      set: { type: String, default: '' },
      library: { type: String, default: '' },
      placeholder: { type: String, default: '' },
      defaultValue: { type: String, default: '' },
      disabled: { type: Boolean, default: false },
      readonly: { type: Boolean, default: false },
      clearable: { type: Boolean, default: true },
      showReset: { type: Boolean, default: true },
      allowInput: { type: Boolean, default: true },
      searchable: { type: Boolean, default: true }
    },
    emits: ['update:modelValue'],
    // 功能：初始化组件响应式状态与对外数据。
    data: function () {
      return {
        open: false,
        query: '',
        draft: '',
        remixItems: REMIX_CACHE || [],
        remixLoading: false,
        remixError: '',
        svgItems: []
      };
    },
    computed: {
      // 功能：处理 lib 相关逻辑。
      lib: function () {
        return Library_Key(this.library || this.set || 'remix');
      },
      // 功能：处理 items 相关逻辑。
      items: function () {
        if (this.lib === 'svg') { return this.svgItems; }
        var base;
        if (this.lib === 'fa') {
          base = To_Items(FA_ITEMS);
        } else if (this.lib === 'dashicons') {
          base = To_Items(DASH_ITEMS);
        } else {
          base = this.remixItems;
        }
        var custom = Custom_Items();
        var merged = this.svgItems.length ? base.concat(this.svgItems) : base;
        return custom.length ? merged.concat(custom) : merged;
      },
      // 功能：处理 visible Items 相关逻辑。
      visibleItems: function () {
        var q = this.query.trim().toLowerCase();
        return this.items.filter(function (item) {
          return !q || item.value.toLowerCase().indexOf(q) !== -1 || item.label.toLowerCase().indexOf(q) !== -1;
        });
      },
      // 功能：处理 display Value 相关逻辑。
      displayValue: function () {
        return this.modelValue || '';
      },
      // 功能：处理 preview Class 相关逻辑。
      previewClass: function () {
        return this.iconClass(this.displayValue || this.defaultValue || this.draft);
      },
      // 功能：处理 draft Class 相关逻辑。
      draftClass: function () {
        return this.iconClass(this.draft);
      }
    },
    watch: {
      visibleItems: function () {
        if (this.open) { this.$nextTick(this.animateGrid); }
      },
      query: function () {
        var grid = this.$refs.popover && this.$refs.popover.querySelector('.eva-icon-grid');
        if (grid) { grid.scrollTop = 0; }
      },
      modelValue: {
        immediate: true,
        // 功能：响应监听值变化并同步组件状态。
        handler: function (value) {
          this.draft = this.normalizeValue(value || this.defaultValue || '');
        }
      },
      // 功能：处理 lib 相关逻辑。
      lib: function () {
        this.draft = this.normalizeValue(this.modelValue || this.defaultValue || '');
        if (this.lib === 'remix') { this.ensureRemixItems(); }
        if (this.lib === 'svg') { this.scanSvgSymbols(); }
      }
    },
    // 功能：组件挂载后执行初始化和事件绑定。
    mounted: function () {
      document.addEventListener('mousedown', this.onDocumentDown, true);
      window.addEventListener('eva:iconfont-loaded', this.onIconfontLoaded);
      if (this.lib === 'remix') { this.ensureRemixItems(); }
      this.scanSvgSymbols();
    },
    // 功能：组件销毁前清理事件、计时器或临时状态。
    beforeUnmount: function () {
      this._disposed = true;
      this.cancelPopover();
      document.removeEventListener('mousedown', this.onDocumentDown, true);
      window.removeEventListener('eva:iconfont-loaded', this.onIconfontLoaded);
    },
    methods: {
      reduceMotion: function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); },
      clearMotion: function (el) {
        if (!el) { return; }
        ['opacity', 'visibility', 'transform'].forEach(function (property) { el.style.removeProperty(property); });
      },
      stopGridMotion: function () {
        var self = this;
        (this._gridTargets || []).forEach(function (el) { if (window.gsap) { window.gsap.killTweensOf(el); } self.clearMotion(el); });
        this._gridTargets = [];
      },
      // Vue transition 负责显示与隐藏，GSAP 只处理动效，避免关闭时闪回或快速连点后残留透明状态。
      cancelPopover: function () {
        this._motionRun = (this._motionRun || 0) + 1;
        this._popoverEntering = false;
        this.stopGridMotion();
        var el = this.$refs.popover;
        if (el && window.gsap) { window.gsap.killTweensOf(el); }
        this.clearMotion(el);
      },
      beforeEnterPopover: function (el) {
        this.cancelPopover();
        this._popoverEntering = true;
        if (!this.reduceMotion()) { el.style.opacity = '0'; el.style.transform = 'translateY(-8px) scale(0.96)'; }
      },
      enterPopover: function (el, done) {
        var self = this, run = this._motionRun;
        if (this.reduceMotion()) { this._popoverEntering = false; this.clearMotion(el); done(); return; }
        Ensure_Gsap().then(function (gsap) {
          if (self._disposed || !self.open || run !== self._motionRun) { return; }
          gsap.fromTo(el, { autoAlpha: 0, y: -8, scale: 0.96 }, {
            autoAlpha: 1, y: 0, scale: 1, duration: 0.24, ease: 'power3.out',
            clearProps: 'opacity,visibility,transform',
            onComplete: function () { self._popoverEntering = false; done(); self.animateGrid(); }
          });
        }).catch(function () {
          if (self._disposed || run !== self._motionRun) { return; }
          self._popoverEntering = false; self.clearMotion(el); done();
        });
      },
      leavePopover: function (el, done) {
        // 从当前帧收起；取消尚未完成的入场与图标交错动画。
        this._motionRun = (this._motionRun || 0) + 1;
        this._popoverEntering = false;
        this.stopGridMotion();
        if (window.gsap) { window.gsap.killTweensOf(el); }
        if (!window.gsap || this.reduceMotion()) { this.clearMotion(el); done(); return; }
        window.gsap.to(el, { autoAlpha: 0, y: -6, scale: 0.975, duration: 0.15, ease: 'power2.in', onComplete: done });
      },
      afterLeavePopover: function (el) { this.clearMotion(el); },
      // 图标或搜索更新时仅动画当前可见区域，避免全量图标库产生大量 tween。
      animateGrid: function () {
        if (!this.open || this._disposed || this._popoverEntering || !window.gsap || this.reduceMotion()) { return; }
        var grid = this.$refs.popover && this.$refs.popover.querySelector('.eva-icon-grid');
        if (!grid) { return; }
        this.stopGridMotion();
        var top = grid.scrollTop, bottom = top + grid.clientHeight;
        this._gridTargets = Array.from(grid.querySelectorAll('button')).filter(function (button) {
          return button.offsetTop + button.offsetHeight > top && button.offsetTop < bottom;
        }).slice(0, 36);
        if (!this._gridTargets.length) { return; }
        // 从上方进入，避免末行向下位移短暂撑大 scrollHeight，产生闪现的滚动条。
        window.gsap.fromTo(this._gridTargets, { opacity: 0, y: -5, scale: 0.94 }, {
          opacity: 1, y: 0, scale: 1, duration: 0.18, stagger: { amount: 0.1 }, ease: 'power2.out', clearProps: 'opacity,transform'
        });
      },
      // 功能：归一化 normalize Value 数据结构。
      normalizeValue: function (value) {
        value = String(value || '').trim();
        // 自定义图标集的值原样保存（可能是「fa fa-home」这种多类名，也可能是「icon-xxx」这种 symbol id）。
        if (Is_Custom(value)) { return value; }
        if (this.lib === 'fa') {
          return value.replace(/^fa[srb]?\s+fa-/i, '').replace(/^fa-/i, '');
        }
        if (this.lib === 'dashicons') {
          return value.replace(/^dashicons\s+dashicons-/i, '').replace(/^dashicons-/i, '');
        }
        if (this.lib === 'svg') {
          return value && value.charAt(0) === '#' ? value : (value ? '#' + value.replace(/^#/, '') : '');
        }
        return value;
      },
      // 功能：处理 icon Class 相关逻辑。
      iconClass: function (value) {
        value = this.normalizeValue(value);
        if (!value) { return 'ri-star-line'; }
        if (this.isSymbol(value)) { return ''; }
        // 自定义图标集：类名由主题自己的图标字体 CSS 提供（用 eva_enqueue 动作加载），这里不加前缀。
        if (Is_Custom(value)) { return value; }
        if (this.lib === 'fa') { return FA_MAP[value] || ('fa fa-' + value); }
        if (this.lib === 'dashicons') { return 'dashicons dashicons-' + value; }
        return value.indexOf('ri-') === 0 ? value : ('ri-' + value);
      },
      // 功能：判断 is Symbol 状态。
      isSymbol: function (value) {
        value = this.normalizeValue(value);
        if (value.charAt(0) === '#') { return true; }
        // 自定义图标集里写的是 symbol 的 id（如阿里 iconfont 的 icon-xxx），且页面里确实有这个 <symbol>。
        if (Is_Custom(value) && /^[A-Za-z][\w-]*$/.test(value)) {
          var node = document.getElementById(value);
          return !!(node && String(node.tagName).toLowerCase() === 'symbol');
        }
        return false;
      },
      // 功能：处理 symbol Href 相关逻辑。
      symbolHref: function (value) {
        value = this.normalizeValue(value);
        return value.charAt(0) === '#' ? value : '#' + value;
      },
      // 功能：处理 scan Svg Symbols 相关逻辑。
      scanSvgSymbols: function () {
        var nodes = document.querySelectorAll('symbol[id]');
        var out = [];
        for (var i = 0; i < nodes.length; i++) {
          var id = nodes[i].getAttribute('id');
          if (!id) { continue; }
          out.push({ value: '#' + id, label: id.replace(/^icon-/, '').replace(/[-_]/g, ' ') });
        }
        this.svgItems = out.sort(function (a, b) { return a.value.localeCompare(b.value); });
      },
      // 功能：阿里 Iconfont Symbol 脚本加载后，刷新当前 SVG 图标库。
      onIconfontLoaded: function () {
        this.scanSvgSymbols();
      },
      // 功能：处理 ensure Remix Items 相关逻辑。
      ensureRemixItems: function () {
        var self = this;
        if (REMIX_CACHE && REMIX_CACHE.length) {
          this.remixItems = REMIX_CACHE;
          this.remixError = '';
          return;
        }
        if (this.remixLoading) { return; }
        this.remixLoading = true;
        this.remixError = '';
        return Load_Remix_Items()
          .then(function (items) {
            if (!self._disposed && self.lib === 'remix') { self.remixItems = items; }
          })
          .catch(function () {
            if (!self._disposed) { self.remixError = '完整图标库加载失败，请重试'; }
          })
          .finally(function () { if (!self._disposed) { self.remixLoading = false; } });
      },
      // 功能：切换 toggle 状态。
      toggle: function () {
        if (this.disabled || this.readonly) { return; }
        this.open = !this.open;
        if (this.open) {
          this.draft = this.normalizeValue(this.modelValue || this.defaultValue || '');
          this.query = '';
          if (this.lib === 'remix') { this.ensureRemixItems(); }
          this.scanSvgSymbols();
        }
      },
      // 功能：关闭 close 相关界面或状态。
      close: function () {
        this.open = false;
      },
      // 功能：处理 on Document Down 相关逻辑。
      onDocumentDown: function (event) {
        if (!this.open || !this.$el || this.$el.contains(event.target)) { return; }
        this.close();
      },
      // 功能：更新 set Draft 对应状态。
      setDraft: function (item) {
        if (this.disabled || this.readonly) { return; }
        this.draft = item.value;
      },
      // 功能：处理 commit Input 相关逻辑。
      commitInput: function (event) {
        if (this.disabled || this.readonly || !this.allowInput) { return; }
        this.$emit('update:modelValue', this.normalizeValue(event.target.value));
      },
      // 功能：清空 clear 相关状态。
      clear: function () {
        if (this.disabled || this.readonly || !this.clearable) { return; }
        this.draft = '';
        this.$emit('update:modelValue', '');
        this.close();
      },
      // 功能：重置 reset 相关状态。
      reset: function () {
        if (this.disabled || this.readonly) { return; }
        var value = this.normalizeValue(this.defaultValue || '');
        this.draft = value;
        this.$emit('update:modelValue', value);
      },
      // 功能：处理 apply 相关逻辑。
      apply: function () {
        if (this.disabled || this.readonly) { return; }
        this.$emit('update:modelValue', this.normalizeValue(this.draft));
        this.close();
      }
    },
    template: [
      '<div class="eva-icon-picker" :class="{ \'is-open\': open, \'is-disabled\': disabled, \'is-readonly\': readonly }">',
      '  <div class="eva-icon-control">',
      '    <span class="eva-icon-preview"><eva-symbol-icon v-if="isSymbol(displayValue || defaultValue || draft)" :href="symbolHref(displayValue || defaultValue || draft)"></eva-symbol-icon><i v-else :class="previewClass"></i></span>',
      '    <input class="eva-icon-input" :placeholder="placeholder || \'请选择一个图标\'" :value="displayValue" :disabled="disabled" :readonly="readonly || !allowInput" @change="commitInput" @keydown.enter.prevent="$event.target.blur()">',
      '    <button type="button" class="eva-icon-open" :class="{ \'is-active\': open }" :disabled="disabled || readonly" @click="toggle" aria-label="选择图标"><i class="ri-grid-line"></i></button>',
      '    <button v-if="showReset" type="button" class="eva-icon-reset" :disabled="disabled || readonly" @click="reset" aria-label="恢复默认"><i class="ri-restart-line"></i></button>',
      '  </div>',
      '  <transition :css="false" @before-enter="beforeEnterPopover" @enter="enterPopover" @leave="leavePopover" @after-leave="afterLeavePopover" @enter-cancelled="cancelPopover" @leave-cancelled="cancelPopover">',
      '  <div v-show="open" ref="popover" class="eva-icon-popover">',
      '    <div v-if="searchable" class="eva-icon-search"><i class="ri-search-line"></i><input v-model="query" type="search" placeholder="搜索图标..."></div>',
      '    <div v-if="remixLoading" class="eva-icon-loading">正在加载 Remixicon 全量图标...</div>',
      '    <div v-else-if="lib === \'remix\' && remixError" class="eva-icon-loading" role="status">{{ remixError }} <button type="button" class="eva-icon-btn" @click="ensureRemixItems">重试</button></div>',
      '    <div class="eva-icon-grid">',
      '      <button v-for="item in visibleItems" :key="item.value" type="button" :class="{ \'is-selected\': draft === item.value }" :title="item.value" @click="setDraft(item)">',
      '        <eva-symbol-icon v-if="isSymbol(item.value)" :href="symbolHref(item.value)"></eva-symbol-icon><i v-else :class="iconClass(item.value)"></i>',
      '      </button>',
      '      <div v-if="!visibleItems.length" class="eva-icon-empty">{{ lib === \'svg\' ? \'未发现 SVG symbol，请先加载阿里 iconfont.js\' : \'没有匹配的图标\' }}</div>',
      '    </div>',
      '    <div class="eva-icon-actions">',
      '      <button v-if="clearable" type="button" class="eva-icon-btn" @click="clear">清除</button>',
      '      <span class="eva-icon-current"><eva-symbol-icon v-if="isSymbol(draft)" :href="symbolHref(draft)"></eva-symbol-icon><i v-else :class="draftClass"></i><span class="eva-icon-current-text">{{ draft || \'未选择\' }}</span></span>',
      '      <button type="button" class="eva-icon-btn is-primary" @click="apply">应用</button>',
      '    </div>',
      '  </div>',
      '  </transition>',
      '</div>'
    ].join('\n')
  };
})();
