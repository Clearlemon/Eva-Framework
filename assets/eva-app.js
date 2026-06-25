/**
 * Eva Framework —— 后台管理框架外壳。
 *
 * 运行环境：
 * - 使用 Vue3 全局构建（`window.Vue`），不依赖打包工具。
 * - 由 WordPress 后台页或 Eva 独立页加载，并挂载到 `#eva-app`。
 * - 运行时配置来自 PHP 注入的 `window.EvaFW`，包含菜单、用户、字段 sections、已保存 values、AJAX/REST nonce 等。
 *
 * 核心职责：
 * - 渲染 Eva 管理台外壳：侧边栏、顶部栏、页签栏、设置抽屉、搜索面板。
 * - 根据后端注册的 `sections` 渲染字段表单，并通过 `eva-field` 分发到对应字段组件。
 * - 提供保存、恢复默认、脏状态检测、固定指南入口、悬浮窗开关等后台交互。
 *
 * 设计约束：
 * - 本文件只负责 UI 状态和业务交互，不直接写样式；样式集中在 `eva.css`。
 * - 字段组件通过 `window.EvaFields` 注册，UI 库组件通过 `window.EvaUI` 注册。
 * - 模板以字符串数组拼接，保证插件在无构建流程的 WordPress 环境中可直接运行。
 */
(function () {
  'use strict';

  // Vue 未加载时静默退出，避免影响 WordPress 其它后台页面。
  if (typeof Vue === 'undefined') {
    return;
  }

  // `EvaFW` 由 Admin::enqueue 或 Standalone::render 注入，是前后端约定的唯一运行时入口。
  var boot = window.EvaFW || {};
  var cfg = boot.config || {};

  var App = {
    setup: function () {
      /*
       * 基础 UI 状态：
       * - dark：控制 `.eva-dark` 暗色类。
       * - userOpen：右上角用户菜单。
       * - sidebarCollapsed：侧边栏折叠态。
       */
      var dark = Vue.ref(false);
      var userOpen = Vue.ref(false);
      var sidebarCollapsed = Vue.ref(false);

      var brand = cfg.brand || cfg.title || 'Eva';
      var adminUrl = boot.adminUrl || '';

      // 菜单优先使用后端注册值；没有注册时给出兜底菜单，方便框架单独调试。
      var menu = (cfg.menu && cfg.menu.length) ? cfg.menu : [
        { id: 'home', label: '后台首页', icon: 'ri-dashboard-line' },
        { id: 'posts', label: '文章管理', icon: 'ri-article-line' },
        { id: 'users', label: '用户管理', icon: 'ri-user-3-line', arrow: true },
        { id: 'media', label: '附件管理', icon: 'ri-attachment-line' },
        { id: 'comments', label: '评论管理', icon: 'ri-chat-3-line' },
        { id: 'security', label: '站点安全', icon: 'ri-shield-check-line' },
        { id: 'ext', label: '扩展模块', icon: 'ri-puzzle-2-line' },
      ];

      // 当前登录用户信息由 PHP 读取 wp_get_current_user 后注入；兜底对象避免模板空引用。
      var user = cfg.user || {
        name: '管理员',
        role: '超级管理员',
        initials: '管',
        avatar: '',
        email: 'admin@example.com',
        profileUrl: '#',
        logoutUrl: '#',
      };

      var first = menu.length ? menu[0] : null;
      var active = Vue.ref(first ? first.id : '');
      var tabs = Vue.reactive(
        first ? [{ id: first.id, label: first.label, icon: first.icon, closable: false }] : []
      );
      var activeTab = Vue.ref(first ? first.id : '');

      // 保存每个可展开一级菜单的展开状态，key 为菜单 id。
      var openMenus = Vue.reactive({});

      // 搜索命令面板（右上角按钮 / Ctrl+K 弹出）：检索一级与二级菜单，仅列可跳转的叶子页
      var searchOpen = Vue.ref(false);
      var searchQuery = Vue.ref('');
      var searchInput = Vue.ref(null);

      // 全局「当前编辑语言」：顶部切换器与所有多语言字段(i18n)共享同一状态。
      // 挂在 window 上，供顶部/侧栏语言切换器与 tv() 跨组件共享同一语言。
      var evaLangs = (window.EvaFW && EvaFW.config && Array.isArray(EvaFW.config.languages) && EvaFW.config.languages.length)
        ? EvaFW.config.languages
        : [{ code: 'zh', label: '中文' }, { code: 'en', label: 'English' }, { code: 'ja', label: '日本語' }];
      window.EvaI18nState = window.EvaI18nState || Vue.reactive({ lang: evaLangs[0].code });
      var evaI18nState = window.EvaI18nState;
      // 当前语言对象（取不到则回退到首个）。
      var curLang = Vue.computed(function () {
        var hit = evaLangs.filter(function (l) { return l.code === evaI18nState.lang; })[0];
        return hit || evaLangs[0];
      });
      // 点击循环切换到下一种语言。
      function cycleLang() {
        var i = evaLangs.findIndex(function (l) { return l.code === evaI18nState.lang; });
        evaI18nState.lang = evaLangs[(i + 1) % evaLangs.length].code;
      }
      // 顶部语言下拉的展开状态与选择。
      var langOpen = Vue.ref(false);
      function chooseLang(code) { evaI18nState.lang = code; langOpen.value = false; }

      // 界面文案翻译：统一挂到全局 window.EvaI18n，eva-app 自身与所有字段/库组件复用同一套。
      // t(key) 取框架词条；tv(v) 翻译「值」（多语言对象按当前语言取，普通字符串原样）。
      // 两者内部都读 window.EvaI18nState.lang（reactive）+ EvaFW.config.messages，故模板调用即随切换重渲染。
      window.EvaI18n = window.EvaI18n || {
        t: function (key) {
          var m = (window.EvaFW && window.EvaFW.config && window.EvaFW.config.messages) || {};
          var lang = (window.EvaI18nState && window.EvaI18nState.lang) || 'zh';
          var dict = m[lang] || m.zh || {};
          if (dict[key] != null) { return dict[key]; }
          if (m.zh && m.zh[key] != null) { return m.zh[key]; }
          return key;
        },
        tv: function (v) {
          var lang = (window.EvaI18nState && window.EvaI18nState.lang) || 'zh';
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            if (v[lang] != null) { return v[lang]; }
            if (v.zh != null) { return v.zh; }
            for (var k in v) { if (Object.prototype.hasOwnProperty.call(v, k)) { return v[k]; } }
            return '';
          }
          return v != null ? v : '';
        }
      };
      var t = window.EvaI18n.t;
      var tv = window.EvaI18n.tv;

      var searchResults = Vue.computed(function () {
        var q = searchQuery.value.trim().toLowerCase();
        if (!q) { return []; }
        var hit = function (v) {
          return (tv(v) || '').toLowerCase().indexOf(q) !== -1;
        };
        var out = [];
        sections.forEach(function (s) {
          var sHit = hit(s.title);
          (s.fields || []).forEach(function (f) {
            if (sHit || hit(f.title) || hit(f.desc)) {
              out.push({ id: f.id, sectionId: s.id, label: tv(f.title) || f.id, desc: tv(f.desc) || '', icon: s.icon, parent: tv(s.title) });
            }
          });
        });
        return out;
      });
      function openSearch() {
        searchOpen.value = true;
        searchQuery.value = '';
        Vue.nextTick(function () {
          if (searchInput.value && searchInput.value.focus) { searchInput.value.focus(); }
        });
      }
      function closeSearch() {
        searchOpen.value = false;
      }
      function gotoResult(r) {
        openMenu(r.sectionId);
        if (active.value !== r.sectionId) {
          active.value = r.sectionId;
          activeTab.value = r.sectionId;
        }
        closeSearch();
      }
      function onSearchEnter() {
        var list = searchResults.value;
        if (list.length) { gotoResult(list[0]); }
      }
      function onGlobalKey(e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
          e.preventDefault();
          if (searchOpen.value) { closeSearch(); } else { openSearch(); }
        } else if (e.key === 'Escape' && searchOpen.value) {
          closeSearch();
        }
      }
      Vue.onMounted(function () { document.addEventListener('keydown', onGlobalKey); });
      Vue.onBeforeUnmount(function () { document.removeEventListener('keydown', onGlobalKey); });
      // 语言下拉：点击下拉外部时关闭（捕获阶段 mousedown，先于 click 触发）。
      function onLangDocDown(e) {
        if (langOpen.value && e.target && e.target.closest && !e.target.closest('.eva-lang-wrap')) {
          langOpen.value = false;
        }
      }
      Vue.onMounted(function () { document.addEventListener('mousedown', onLangDocDown, true); });
      Vue.onBeforeUnmount(function () { document.removeEventListener('mousedown', onLangDocDown, true); });

      // 在一二级菜单树中按 id 查找菜单项，用于打开页面、标题展示和页签生成。
      function findMenuItem(id) {
        for (var i = 0; i < menu.length; i++) {
          if (menu[i].id === id) return menu[i];
          var ch = menu[i].children || [];
          for (var j = 0; j < ch.length; j++) {
            if (ch[j].id === id) return ch[j];
          }
        }
        return null;
      }

      function hasChildren(m) {
        return !!(m.children && m.children.length);
      }
      function isOpen(id) {
        return !!openMenus[id];
      }

      var currentTitle = Vue.computed(function () {
        if (active.value === 'eva-guide') return t('guide_menu');
        var m = findMenuItem(active.value);
        return m ? tv(m.label) : '';
      });

      // 打开菜单对应内容页；首次打开时同步创建一个可关闭页签。
      function openMenu(id) {
        var m = findMenuItem(id);
        if (!m) return;
        active.value = id;
        activeTab.value = id;
        if (!tabs.find(function (t) { return t.id === id; })) {
          tabs.push({ id: id, label: m.label, icon: m.icon, closable: true });
        }
      }

      // 点一级项：有子菜单则展开/收起，否则直接打开
      function onMenuClick(m) {
        if (hasChildren(m)) {
          openMenus[m.id] = !openMenus[m.id];
        } else {
          openMenu(m.id);
        }
      }

      function selectTab(id) {
        activeTab.value = id;
        active.value = id;
      }

      function closeTab(id) {
        var i = tabs.findIndex(function (t) { return t.id === id; });
        if (i === -1 || !tabs[i].closable) return;
        tabs.splice(i, 1);
        if (activeTab.value === id && tabs.length) {
          var last = tabs[tabs.length - 1];
          activeTab.value = last.id;
          active.value = last.id;
        }
      }

      // 关闭其他：保留固定页签（不可关）与当前页签，其余关闭
      function closeOtherTabs() {
        var keep = tabs.filter(function (t) {
          return !t.closable || t.id === activeTab.value;
        });
        tabs.splice(0, tabs.length);
        keep.forEach(function (t) { tabs.push(t); });
      }

      // 刷新当前页（等价 router.go(0)）
      function refresh() {
        window.location.reload();
      }

      var closableCount = Vue.computed(function () {
        return tabs.filter(function (t) { return t.closable; }).length;
      });

      function toggleDark() {
        dark.value = !dark.value;
      }
      function toggleSidebar() {
        sidebarCollapsed.value = !sidebarCollapsed.value;
      }
      function toggleUser() {
        userOpen.value = !userOpen.value;
      }
      function closeUser() {
        userOpen.value = false;
      }

      // 设置抽屉
      var settingsOpen = Vue.ref(false);
      function toggleSettings() {
        settingsOpen.value = !settingsOpen.value;
      }
      function closeSettings() {
        settingsOpen.value = false;
      }

      // 主题色：选中后覆盖 --eva-primary 系列变量到根节点
      var accents = [
        { key: 'coral', label: '珊瑚粉', color: '#ff758c', c600: '#f0607a', c050: '#ffe0e8' },
        { key: 'blue', label: '蓝', color: '#3b82f6', c600: '#2563eb', c050: '#eff6ff' },
        { key: 'cyan', label: '青', color: '#06b6d4', c600: '#0891b2', c050: '#ecfeff' },
        { key: 'emerald', label: '绿', color: '#10b981', c600: '#059669', c050: '#ecfdf5' },
        { key: 'amber', label: '橙', color: '#f59e0b', c600: '#d97706', c050: '#fffbeb' },
        { key: 'rose', label: '玫红', color: '#f43f5e', c600: '#e11d48', c050: '#fff1f2' },
        { key: 'violet', label: '紫', color: '#8b5cf6', c600: '#7c3aed', c050: '#f5f3ff' },
        { key: 'indigo', label: '靛紫', color: '#6366f1', c600: '#4f46e5', c050: '#eef0fe' },
      ];
      var accent = Vue.ref('coral');
      function setAccent(a) {
        accent.value = a.key;
      }
      var rootStyle = Vue.computed(function () {
        var a = accents.find(function (x) { return x.key === accent.value; });
        if (!a) return {};
        return {
          '--eva-primary': a.color,
          '--eva-primary-600': a.c600,
          '--eva-primary-050': a.c050,
        };
      });

      // 固定菜单《EVA框架使用指南》：显隐持久化，仅管理员可开关
      var isAdmin = !!cfg.isAdmin;
      var guideVisible = Vue.ref(cfg.guideVisible !== false);

      function openGuide() {
        active.value = 'eva-guide';
        activeTab.value = 'eva-guide';
        if (!tabs.find(function (t) { return t.id === 'eva-guide'; })) {
          tabs.push({ id: 'eva-guide', label: 'EVA框架使用指南', icon: 'ri-book-open-line', closable: true });
        }
      }

      function toggleGuide() {
        if (!isAdmin) return;
        var next = !guideVisible.value;
        guideVisible.value = next; // 乐观更新
        var url = cfg.ajaxUrl || ((boot.adminUrl || '') + 'admin-ajax.php');
        if (!url) return;
        var body = 'action=eva_fw_set_guide&nonce=' + encodeURIComponent(cfg.nonce || '') +
          '&visible=' + (next ? '1' : '0');
        fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: body,
        }).then(function (r) { return r.json(); }).then(function (res) {
          if (!res || !res.success) { guideVisible.value = !next; } // 保存失败回滚
        }).catch(function () { guideVisible.value = !next; });
      }

      // 后台悬浮窗开关（仅管理员，全站生效）
      var floatingEnabled = Vue.ref(cfg.floatingEnabled !== false);
      function toggleFloating() {
        if (!isAdmin) return;
        var next = !floatingEnabled.value;
        floatingEnabled.value = next; // 乐观更新
        var url = cfg.ajaxUrl || ((boot.adminUrl || '') + 'admin-ajax.php');
        if (!url) return;
        var body = 'action=eva_fw_set_floating&nonce=' + encodeURIComponent(cfg.nonce || '') +
          '&enabled=' + (next ? '1' : '0');
        fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: body,
        }).then(function (r) { return r.json(); }).then(function (res) {
          if (!res || !res.success) { floatingEnabled.value = !next; } // 保存失败回滚
        }).catch(function () { floatingEnabled.value = !next; });
      }

      function guideEnvironment() {
        var items = Array.isArray(cfg.guideEnvironment) ? cfg.guideEnvironment : [];
        if (!items.length) {
          items = [
            { name: 'WordPress', value: '未知', ok: false },
            { name: 'PHP', value: '未知', ok: false },
            { name: 'Vue', value: '运行时检测中', ok: true, runtime: 'vue' },
            { name: '构建工具', value: '无需构建', ok: true },
          ];
        }
        return items.map(function (item) {
          var out = Object.assign({}, item);
          if (out.runtime === 'vue') {
            var vueVersion = (window.Vue && Vue.version) ? Vue.version : '';
            out.value = vueVersion || '未检测到 Vue';
            out.ok = !!vueVersion;
          }
          return out;
        });
      }

      // 《EVA框架使用指南》页面内容（数据驱动，便于维护）
      var guide = {
        version: boot.version || '',
        intro: 'Eva Framework 是一套轻量、现代、好看的 WordPress 后台设置框架（CSF 的替代方案）。通过简洁的注册 API，即可生成脱离 /wp-admin 的全屏沉浸式设置页。',
        stats: [
          { label: '入口模式', value: '独立页 / 后台页' },
          { label: '注册方式', value: 'create* API' },
          { label: '字段渲染', value: 'EvaFields' },
        ],
        features: [
          { icon: 'ri-flashlight-line', title: '零配置上手', desc: '一个 createOptions 调用即可生成菜单与页面。' },
          { icon: 'ri-window-2-line', title: '独立全屏页', desc: '默认脱离 wp-admin，访问 /eva/<slug>。' },
          { icon: 'ri-palette-line', title: '外观可定制', desc: '内置暗色模式与主题色切换，CSS 变量驱动。' },
          { icon: 'ri-shield-keyhole-line', title: '权限可控', desc: '基于 capability 控制访问与管理员专属开关。' },
        ],
        sections: [
          {
            id: 'start', icon: 'ri-rocket-2-line', title: '快速开始',
            desc: '在主题 functions.php 或你的插件中注册一个设置页：',
            code: [
              "// 1) 创建设置页（菜单）",
              "\\Eva::createOptions('my_panel', [",
              "    'menu_title' => '我的面板',",
              "    'menu_slug'  => 'my-panel',",
              "    'subtitle'   => '站点功能设置',",
              "    'location'   => 'admin_bar', // admin_bar=顶部入口 / left=左侧菜单",
              "    'standalone' => true,        // true=独立全屏页",
              "]);",
            ].join('\n'),
          },
          {
            id: 'menu', icon: 'ri-list-check-2', title: '注册左侧菜单',
            desc: '用 addMenuItem 增加菜单项，支持二级 children：',
            code: [
              "\\Eva::addMenuItem('my_panel', [",
              "    'id' => 'home', 'label' => '后台首页', 'icon' => 'ri-dashboard-line',",
              "]);",
              "",
              "\\Eva::addMenuItem('my_panel', [",
              "    'id' => 'posts', 'label' => '内容管理', 'icon' => 'ri-article-line',",
              "    'children' => [",
              "        ['id' => 'list', 'label' => '列表', 'icon' => 'ri-file-list-2-line'],",
              "        ['id' => 'new',  'label' => '新建', 'icon' => 'ri-add-circle-line'],",
              "    ],",
              "]);",
            ].join('\n'),
          },
          {
            id: 'access', icon: 'ri-links-line', title: '访问与权限',
            desc: '独立页地址为 /eva/<slug>；capability 默认 manage_options，仅有权用户可进入，否则会跳转登录或提示无权。',
            code: [
              "// 获取某页的独立访问地址",
              "$url = \\Eva\\Framework\\Standalone::url('my-panel');",
              "// => https://你的站点/eva/my-panel",
            ].join('\n'),
          },
          {
            id: 'ui', icon: 'ri-settings-4-line', title: '界面功能',
            desc: '点击右上角齿轮打开设置抽屉：可切换暗色模式、折叠侧边栏与主题色；管理员还能在“功能”分区控制本指南固定菜单的全站显隐。',
            code: '',
          },
          {
            id: 'dev', icon: 'ri-terminal-box-line', title: '开发与上线',
            desc: '开发期支持 CSS/JS 资源热刷新，便于调试；上线前请在 wp-config.php 关闭：',
            code: [
              "// 生产环境关闭热刷新",
              "define('EVA_FW_DEV', false);",
            ].join('\n'),
          },
        ],
        requirements: guideEnvironment(),
        resources: [
          { icon: 'ri-book-open-line', title: '官方文档', desc: '查看使用方式与 API 约定' },
          { icon: 'ri-github-line', title: '字段组件', desc: '按 Fields 拆分维护' },
          { icon: 'ri-refresh-line', title: '更新日志', desc: '跟踪框架迭代记录' },
        ],
      };
      guide.groups = [
        {
          id: 'quickstart', label: '快速开始', icon: 'ri-rocket-2-line', desc: '从创建面板到添加字段',
          sections: [
            {
              id: 'quick-start', icon: 'ri-rocket-2-line', title: '快速开始',
              desc: '用最少的代码创建一个 Eva 设置页。把示例放进主题或插件入口文件后，就可以看到完整的菜单、分组和字段表单。',
              steps: [
                '确保 Eva Framework 已安装并处于启用状态。',
                '打开当前主题的 functions.php，或你的插件入口文件。',
                '复制下面的示例代码，并按项目需要修改面板 ID、菜单标题和字段配置。',
              ],
              codeBlocks: [
                {
                  title: '创建第一个设置页',
                  code: [
                    "// 确认 Eva Framework 已加载，避免框架未启用时触发错误",
                    "if (class_exists('Eva')) {",
                    "",
                    "  // 设置一个唯一面板 ID，保存和读取配置时都会用到",
                    "  $prefix = 'my_framework';",
                    "",
                    "  // 创建设置面板",
                    "  Eva::createOptions($prefix, [",
                    "    'menu_title' => '我的设置面板',",
                    "    'menu_slug'  => 'my-framework',",
                    "    'standalone' => true,",
                    "  ]);",
                    "",
                    "  // 创建第一个分组：基础信息",
                    "  Eva::createSection($prefix, [",
                    "    'title'  => '基础信息',",
                    "    'fields' => [",
                    "",
                    "      // 单行文本字段",
                    "      [",
                    "        'id'    => 'site_title',",
                    "        'type'  => 'text',",
                    "        'title' => '站点标题',",
                    "      ],",
                    "",
                    "    ]",
                    "  ]);",
                    "",
                    "  // 创建第二个分组：内容设置",
                    "  Eva::createSection($prefix, [",
                    "    'title'  => '内容设置',",
                    "    'fields' => [",
                    "",
                    "      // 多行文本字段",
                    "      [",
                    "        'id'    => 'site_desc',",
                    "        'type'  => 'textarea',",
                    "        'title' => '站点简介',",
                    "      ],",
                    "",
                    "    ]",
                    "  ]);",
                    "",
                    "}",
                  ].join('\n'),
                },
                {
                  title: '在主题中读取设置值',
                  code: [
                    "// 读取当前面板保存的配置",
                    "$options = get_option('my_framework');",
                    "",
                    "echo $options['site_title'] ?? '';",
                    "echo $options['site_desc'] ?? '';",
                  ].join('\n'),
                },
              ],
              notes: [
                { title: '想看更多字段？', text: '可以打开 Eva Framework 的演示配置页查看完整字段效果。后续新增字段时，也建议同步补到演示页，方便调试和复用。' },
              ],
            },
          ],
        },
        {
          id: 'framework', label: '框架', icon: 'ri-layout-grid-line', desc: '入口、菜单、权限与独立页',
          sections: [
            {
              id: 'framework-overview', icon: 'ri-layout-grid-line', title: '框架结构',
              desc: 'Eva Framework 以“注册配置 → 渲染页面 → 保存数据”为主线，把菜单、分组、字段和数据处理拆成清晰的模块。',
              cards: [
                { icon: 'ri-window-line', title: 'Options', desc: '定义设置面板、菜单入口和独立页访问方式。' },
                { icon: 'ri-folder-3-line', title: 'Sections', desc: '组织页面分组，每个分组承载一组字段。' },
                { icon: 'ri-input-method-line', title: 'Fields', desc: '按字段类型渲染组件，并同步到表单 model。' },
                { icon: 'ri-database-2-line', title: 'Data', desc: '统一保存、清洗和读取 WordPress option。' },
              ],
              flow: ['注册面板', '添加分组', '渲染字段', '保存配置'],
              code: [
                "Eva::createOptions('my_panel', [",
                "    'menu_title' => '主题设置',",
                "    'menu_slug'  => 'theme-options',",
                "]);",
                "",
                "Eva::createSection('my_panel', [",
                "    'title'  => '基础设置',",
                "    'fields' => [",
                "        ['id' => 'site_title', 'type' => 'text', 'title' => '站点标题'],",
                "    ],",
                "]);",
              ].join('\n'),
            },
          ],
        },
        {
          id: 'fields', label: '字段', icon: 'ri-input-method-line', desc: '字段注册、渲染与保存',
          sections: [
            {
              id: 'field-basic', icon: 'ri-text', title: '基础字段',
              desc: '字段由后端 schema 定义，前端按 type 从 window.EvaFields 注册表取对应组件渲染。',
              code: [
                "Eva::createSection('my_panel', [",
                "    'id'     => 'basic',",
                "    'title'  => '基础设置',",
                "    'fields' => [",
                "        ['id' => 'site_title', 'type' => 'text', 'title' => '站点标题'],",
                "        ['id' => 'summary', 'type' => 'textarea', 'title' => '简介'],",
                "    ],",
                "]);",
              ].join('\n'),
            },
            {
              id: 'field-select', icon: 'ri-list-check', title: '选择字段',
              desc: 'select 字段复用 eva-select，支持搜索、分组、空状态文案和统一视觉。',
              code: [
                "['id' => 'layout', 'type' => 'select', 'title' => '布局', 'options' => [",
                "    'wide' => '宽屏',",
                "    'boxed' => '盒装',",
                "]];",
              ].join('\n'),
            },
            {
              id: 'field-custom', icon: 'ri-puzzle-line', title: '自定义字段',
              desc: '新增字段时在 Fields 注册组件，并确保 eva-app 的字段分发可以按 type 找到它。',
              code: [
                "window.EvaFields.my_field = {",
                "  props: ['field', 'modelValue'],",
                "  emits: ['update:modelValue'],",
                "  template: '<input :value=\"modelValue\" @input=\"$emit(\\'update:modelValue\\', $event.target.value)\">'",
                "};",
              ].join('\n'),
            },
          ],
        },
        {
          id: 'other', label: '其他', icon: 'ri-more-2-line', desc: '调试、热刷新与维护建议',
          sections: [
            {
              id: 'debug', icon: 'ri-bug-line', title: '开发调试',
              desc: '开发期可开启热刷新和文件 mtime 版本号，修改资源后自动刷新页面。',
              code: [
                "define('EVA_FW_DEV', true);",
                "// 生产环境上线前切换为 false",
              ].join('\n'),
            },
            {
              id: 'assets', icon: 'ri-folder-settings-line', title: '资源组织',
              desc: '字段脚本、UI 库和页面脚本应分目录维护，避免单文件无限膨胀。',
              code: [
                "assets/",
                "  fields/",
                "  libs/",
                "  eva-app.js",
                "  eva.css",
              ].join('\n'),
            },
            {
              id: 'maintain', icon: 'ri-shield-check-line', title: '维护建议',
              desc: '新增字段时同步补 demo 示例、清洗逻辑、注释和基础诊断，保持框架可扩展。',
              code: '',
            },
          ],
        },
      ];

      function copyGuideCode(code) {
        if (!code || !navigator.clipboard) { return; }
        navigator.clipboard.writeText(code);
      }

      // 设置表单（字段系统）：sections/values 来自后端，model 为可编辑副本
      var sections = cfg.sections || [];
      var optionId = cfg.optionId || '';
      var model = Vue.reactive(Object.assign({}, cfg.values || {}));
      // 补齐默认值：后端没保存过的字段，前端仍按 schema.default 显示初始值。
      sections.forEach(function (s) {
        (s.fields || []).forEach(function (f) {
          if (!(f.id in model)) { model[f.id] = (f.default !== undefined ? f.default : ''); }
        });
      });

      // 脏状态：当前 model 与上次保存快照不一致即为「有未保存更改」
      var savedSnapshot = Vue.ref(JSON.stringify(model));
      var isDirty = Vue.computed(function () { return JSON.stringify(model) !== savedSnapshot.value; });
      var activeGuideTab = Vue.ref('quickstart');
      var currentGuideGroup = Vue.computed(function () {
        return guide.groups.filter(function (g) { return g.id === activeGuideTab.value; })[0] || guide.groups[0];
      });
      var currentGuideSections = Vue.computed(function () {
        return (currentGuideGroup.value && currentGuideGroup.value.sections) || [];
      });
      function discardChanges() {
        var orig = {};
        try { orig = JSON.parse(savedSnapshot.value); } catch (e) {}
        Object.keys(model).forEach(function (k) { delete model[k]; });
        Object.assign(model, orig);
      }

      var currentSection = Vue.computed(function () {
        for (var i = 0; i < sections.length; i++) {
          if (sections[i].id === active.value) { return sections[i]; }
        }
        return null;
      });

      // 恢复默认（CSF 风格）：把字段还原为 default，再由用户点保存持久化
      var resetOpen = Vue.ref(false);
      // 整页型字段（如 backup / html 嵌入/挂载点）所在页：表单去内边距与外层卡片包裹，让内容铺满
      var isFlush = Vue.computed(function () {
        var s = currentSection.value;
        if (!s || !s.fields) { return false; }
        return s.fields.some(function (f) { return f.type === 'backup' || f.type === 'html'; });
      });

      function fieldDefault(f) { return (f.default !== undefined ? f.default : ''); }
      function resetSection() {
        var s = currentSection.value;
        if (s && s.fields) { s.fields.forEach(function (f) { model[f.id] = fieldDefault(f); }); }
        resetOpen.value = false;
      }
      function resetAll() {
        sections.forEach(function (s) {
          (s.fields || []).forEach(function (f) { model[f.id] = fieldDefault(f); });
        });
        resetOpen.value = false;
      }

      // 字段宽度 → 12 栅格列跨度 class（默认整行；字段配置里写 width 即可多列并排）
      function fieldCol(f) {
        var map = {
          'full': 'eva-col-12', '1': 'eva-col-12', '1/1': 'eva-col-12',
          '3/4': 'eva-col-9', '2/3': 'eva-col-8',
          '1/2': 'eva-col-6', 'half': 'eva-col-6',
          '1/3': 'eva-col-4', 'third': 'eva-col-4',
          '1/4': 'eva-col-3', 'quarter': 'eva-col-3'
        };
        return map[(f && f.width) || ''] || 'eva-col-12';
      }

      var saving = Vue.ref(false);
      var saveMsg = Vue.ref('');
      // 保存设置页字段：通过 admin-ajax 调用 Data::ajax_save，后端按 schema 清洗未知字段。
      function saveOptions() {
        if (saving.value) { return; }
        saving.value = true;
        saveMsg.value = '保存中…';
        var url = cfg.ajaxUrl || ((boot.adminUrl || '') + 'admin-ajax.php');
        var body = 'action=eva_fw_save_options&nonce=' + encodeURIComponent(cfg.nonce || '') +
          '&option_id=' + encodeURIComponent(optionId) +
          '&values=' + encodeURIComponent(JSON.stringify(model));
        fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: body
        }).then(function (r) { return r.json(); }).then(function (res) {
          saving.value = false;
          if (res && res.success) {
            saveMsg.value = '已保存';
            if (res.data && res.data.values) { Object.assign(model, res.data.values); }
            savedSnapshot.value = JSON.stringify(model);
          } else {
            saveMsg.value = (res && res.data && res.data.msg) ? ('保存失败: ' + res.data.msg) : '保存失败';
          }
          setTimeout(function () { saveMsg.value = ''; }, 2500);
        }).catch(function () {
          saving.value = false;
          saveMsg.value = '保存失败';
          setTimeout(function () { saveMsg.value = ''; }, 2500);
        });
      }

      return {
        // 返回给模板的所有状态 / 方法统一集中在这里，便于审查模板依赖。
        dark: dark,
        userOpen: userOpen,
        sidebarCollapsed: sidebarCollapsed,
        brand: brand,
        adminUrl: adminUrl,
        menu: menu,
        searchOpen: searchOpen,
        searchQuery: searchQuery,
        searchInput: searchInput,
        searchResults: searchResults,
        evaLangs: evaLangs,
        evaI18nState: evaI18nState,
        curLang: curLang,
        cycleLang: cycleLang,
        langOpen: langOpen,
        chooseLang: chooseLang,
        t: t,
        tv: tv,
        openSearch: openSearch,
        closeSearch: closeSearch,
        gotoResult: gotoResult,
        onSearchEnter: onSearchEnter,
        user: user,
        active: active,
        tabs: tabs,
        activeTab: activeTab,
        currentTitle: currentTitle,
        openMenu: openMenu,
        onMenuClick: onMenuClick,
        isOpen: isOpen,
        hasChildren: hasChildren,
        selectTab: selectTab,
        closeTab: closeTab,
        closeOtherTabs: closeOtherTabs,
        refresh: refresh,
        closableCount: closableCount,
        toggleDark: toggleDark,
        toggleSidebar: toggleSidebar,
        toggleUser: toggleUser,
        closeUser: closeUser,
        settingsOpen: settingsOpen,
        toggleSettings: toggleSettings,
        closeSettings: closeSettings,
        accents: accents,
        accent: accent,
        setAccent: setAccent,
        rootStyle: rootStyle,
        isAdmin: isAdmin,
        guideVisible: guideVisible,
        openGuide: openGuide,
        toggleGuide: toggleGuide,
        floatingEnabled: floatingEnabled,
        toggleFloating: toggleFloating,
        guide: guide,
        activeGuideTab: activeGuideTab,
        currentGuideGroup: currentGuideGroup,
        currentGuideSections: currentGuideSections,
        copyGuideCode: copyGuideCode,
        sections: sections,
        model: model,
        currentSection: currentSection,
        isFlush: isFlush,
        saving: saving,
        saveMsg: saveMsg,
        saveOptions: saveOptions,
        isDirty: isDirty,
        discardChanges: discardChanges,
        resetOpen: resetOpen,
        resetSection: resetSection,
        resetAll: resetAll,
        fieldCol: fieldCol,
      };
    },
    template: [
      '<div class="eva-admin" :class="{ \'eva-dark\': dark, \'is-collapsed\': sidebarCollapsed }" :style="rootStyle">',
      '  <aside class="eva-sidebar">',
      '    <div class="eva-sb-logo">',
      '      <div class="eva-logo-box"><i class="ri-sparkling-2-fill"></i></div>',
      '      <span class="eva-logo-text">{{ brand }}</span>',
      '    </div>',
      '    <div class="eva-sb-title">',
      '      <span class="eva-eyebrow">Admin Console</span>',
      '      <span class="eva-h-title">{{ currentTitle }}</span>',
      '    </div>',
      '    <nav class="eva-sb-menu">',
      '      <div v-show="guideVisible" class="eva-sb-group eva-sb-group--fixed">',
      '        <div class="eva-sb-item" :class="{ \'is-active\': active === \'eva-guide\' }" @click="openGuide">',
      '          <i class="eva-sb-ico ri-book-open-line"></i>',
      '          <span class="eva-sb-label">{{ t(\'guide_menu\') }}</span>',
      '        </div>',
      '        <div class="eva-sb-tip">{{ t(\'guide_menu\') }}</div>',
      '      </div>',
      '      <div v-for="m in menu" :key="m.id" class="eva-sb-group">',
      '        <div class="eva-sb-item" :class="{ \'is-active\': m.id === active, \'is-open\': isOpen(m.id) }" @click="onMenuClick(m)">',
      '          <eva-icon class="eva-sb-ico" :icon="m.icon"></eva-icon>',
      '          <span class="eva-sb-label">{{ tv(m.label) }}</span>',
      '          <i v-if="hasChildren(m)" class="eva-sb-arrow ri-arrow-down-s-line" :class="{ \'is-open\': isOpen(m.id) }"></i>',
      '        </div>',
      '        <div v-if="hasChildren(m)" v-show="isOpen(m.id)" class="eva-sb-sub">',
      '          <div v-for="c in m.children" :key="c.id" class="eva-sb-subitem"',
      '               :class="{ \'is-active\': c.id === active }" @click="openMenu(c.id)">',
      '            <eva-icon class="eva-sb-subico" :icon="c.icon"></eva-icon>',
      '            <span>{{ tv(c.label) }}</span>',
      '          </div>',
      '        </div>',
      '        <div v-if="!hasChildren(m)" class="eva-sb-tip">{{ tv(m.label) }}</div>',
      '        <div v-if="hasChildren(m)" class="eva-sb-flyout">',
      '          <div v-for="c in m.children" :key="c.id" class="eva-flyout-item"',
      '               :class="{ \'is-active\': c.id === active }" @click="openMenu(c.id)">',
      '            <eva-icon :icon="c.icon"></eva-icon><span>{{ tv(c.label) }}</span>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </nav>',
      '  </aside>',
      '  <div class="eva-main">',
      '    <header class="eva-header">',
      '      <div class="eva-header-titles">',
      '        <span class="eva-eyebrow">Admin Console</span>',
      '        <span class="eva-h-title">{{ currentTitle }}</span>',
      '      </div>',
      '      <div class="eva-header-right">',
      '        <button class="eva-hbtn" :title="t(\'search_tip\')" @click="openSearch"><i class="ri-search-line"></i></button>',
      '        <button class="eva-hbtn eva-hbtn-collapse" :title="sidebarCollapsed ? t(\'expand_sidebar\') : t(\'collapse_sidebar\')" @click="toggleSidebar">',
      '          <i :class="sidebarCollapsed ? \'ri-menu-unfold-line\' : \'ri-menu-fold-line\'"></i>',
      '        </button>',
      '        <button class="eva-hbtn" :title="t(\'notifications\')"><i class="ri-notification-3-line"></i></button>',
      '        <button class="eva-hbtn" :title="t(\'settings\')" @click="toggleSettings"><i class="ri-settings-3-line"></i></button>',
      '        <button class="eva-hbtn" @click="toggleDark" :title="dark ? t(\'to_light\') : t(\'to_dark\')">',
      '          <i :class="dark ? \'ri-sun-line\' : \'ri-moon-line\'"></i>',
      '        </button>',
      '        <div class="eva-user-wrap" :class="{ \'is-open\': userOpen }" @mouseleave="closeUser">',
      '          <button type="button" class="eva-user" aria-haspopup="menu"',
      '                  :aria-expanded="userOpen ? \'true\' : \'false\'" @click="toggleUser">',
      '            <span class="eva-avatar">',
      '              <img v-if="user.avatar" :src="user.avatar" :alt="user.name">',
      '              <template v-else>{{ user.initials }}</template>',
      '            </span>',
      '          </button>',
      '          <div class="eva-user-menu" role="menu">',
      '            <div class="eva-um-head">',
      '              <span class="eva-um-avatar">',
      '                <img v-if="user.avatar" :src="user.avatar" :alt="user.name">',
      '                <template v-else>{{ user.initials }}</template>',
      '              </span>',
      '              <div class="eva-um-info">',
      '                <strong class="eva-um-name">{{ user.name }}</strong>',
      '                <p class="eva-um-email">{{ user.email }}</p>',
      '              </div>',
      '            </div>',
      '            <a class="eva-um-item" :href="user.profileUrl" role="menuitem">{{ t(\'profile\') }}</a>',
      '            <a class="eva-um-item" v-if="adminUrl" :href="adminUrl" role="menuitem">{{ t(\'back_wp\') }}</a>',
      '            <a class="eva-um-item eva-um-logout" :href="user.logoutUrl" role="menuitem">{{ t(\'logout\') }}</a>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </header>',
      '    <div class="eva-tabsbar">',
      '      <div class="eva-tabs">',
      '        <div v-for="t in tabs" :key="t.id" class="eva-tab"',
      '             :class="{ \'is-active\': t.id === activeTab }" @click="selectTab(t.id)">',
      '          <eva-icon class="eva-tab-ico" :icon="t.icon"></eva-icon>',
      '          <span>{{ tv(t.label) }}</span>',
      '          <i v-if="t.closable" class="eva-tab-close ri-close-line" @click.stop="closeTab(t.id)"></i>',
      '        </div>',
      '      </div>',
      '      <div class="eva-tabs-right">',
      '        <button class="eva-tbtn" :title="t(\'refresh_page\')" @click="refresh"><i class="ri-refresh-line"></i></button>',
      '        <button v-if="closableCount" class="eva-tbtn" :title="t(\'close_other_tabs\')" @click="closeOtherTabs"><i class="ri-close-circle-line"></i></button>',
      '        <div class="eva-crumb">',
      '          <i class="ri-home-4-line"></i><i class="eva-crumb-sep ri-arrow-right-s-line"></i>',
      '          <span>{{ t(\'admin_home\') }}</span><i class="eva-crumb-sep ri-arrow-right-s-line"></i>',
      '          <span class="eva-crumb-cur">{{ currentTitle }}</span>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <main class="eva-content">',
      '      <div v-if="active === \'eva-guide\'" class="eva-guide">',
      '        <section class="eva-guide-hero">',
      '          <div class="eva-guide-hero-main">',
      '            <div class="eva-guide-hero-icon"><i class="ri-book-open-line"></i></div>',
      '            <div class="eva-guide-hero-copy">',
      '              <h1 class="eva-guide-title">EVA 框架使用指南<span v-if="guide.version" class="eva-guide-ver">v{{ guide.version }}</span></h1>',
      '              <p class="eva-guide-sub">{{ guide.intro }}</p>',
      '            </div>',
      '          </div>',
      '          <div class="eva-guide-art" aria-hidden="true">',
      '            <span class="eva-guide-cube is-a"></span><span class="eva-guide-cube is-b"></span><span class="eva-guide-cube is-c"></span>',
      '          </div>',
      '        </section>',
      '        <div class="eva-guide-features">',
      '          <div v-for="(f, i) in guide.features" :key="f.title" class="eva-guide-feature">',
      '            <i :class="f.icon"></i>',
      '            <div><strong>{{ tv(f.title) }}</strong><span>{{ f.desc }}</span></div>',
      '            <em>{{ String(i + 1).padStart(2, \'0\') }}</em>',
      '          </div>',
      '        </div>',
      '        <div class="eva-guide-tabs" role="tablist" aria-label="指南分类">',
      '          <button v-for="g in guide.groups" :key="g.id" type="button" class="eva-guide-tab" :class="{ \'is-active\': activeGuideTab === g.id }" @click="activeGuideTab = g.id" role="tab" :aria-selected="activeGuideTab === g.id ? \'true\' : \'false\'">',
      '            <i :class="g.icon"></i><span>{{ g.label }}</span>',
      '          </button>',
      '        </div>',
      '        <div class="eva-guide-grid">',
      '          <div class="eva-guide-docs">',
      '            <section v-for="s in currentGuideSections" :key="s.id" :id="\'eva-guide-\' + activeGuideTab + \'-\' + s.id" class="eva-guide-card" :class="{ \'is-quick\': s.steps, \'is-framework\': s.cards }">',
      '              <div class="eva-guide-card-head">',
      '                <h2><i :class="s.icon"></i><span>{{ s.title }}</span></h2>',
      '                <button v-if="s.code" type="button" class="eva-guide-copy" @click="copyGuideCode(s.code)"><i class="ri-file-copy-line"></i>复制代码</button>',
      '              </div>',
      '              <p>{{ s.desc }}</p>',
      '              <div v-if="s.cards" class="eva-guide-fw-cards"><div v-for="card in s.cards" :key="card.title" class="eva-guide-fw-card"><i :class="card.icon"></i><strong>{{ card.title }}</strong><span>{{ card.desc }}</span></div></div>',
      '              <div v-if="s.flow" class="eva-guide-fw-flow"><div v-for="(item, fi) in s.flow" :key="item" class="eva-guide-fw-step"><em>{{ String(fi + 1).padStart(2, \'0\') }}</em><span>{{ item }}</span></div></div>',
      '              <ol v-if="s.steps" class="eva-guide-steps"><li v-for="(step, si) in s.steps" :key="si">{{ step }}</li></ol>',
      '              <pre v-if="s.code" class="eva-guide-code"><code>{{ s.code }}</code></pre>',
      '              <div v-if="s.codeBlocks" class="eva-guide-codeblocks">',
      '                <div v-for="(block, bi) in s.codeBlocks" :key="bi" class="eva-guide-codeblock">',
      '                  <div class="eva-guide-codebar"><strong>{{ block.title }}</strong><button type="button" class="eva-guide-copy" @click="copyGuideCode(block.code)"><i class="ri-file-copy-line"></i>复制代码</button></div>',
      '                  <pre class="eva-guide-code"><code>{{ block.code }}</code></pre>',
      '                </div>',
      '              </div>',
      '              <div v-if="s.notes" class="eva-guide-notes"><div v-for="note in s.notes" :key="note.title" class="eva-guide-note"><strong>{{ note.title }}</strong><span>{{ note.text }}</span></div></div>',
      '            </section>',
      '          </div>',
      '          <aside class="eva-guide-side">',
      '            <div class="eva-guide-side-card">',
      '              <h3><i :class="currentGuideGroup.icon"></i>{{ currentGuideGroup.label }}导航</h3>',
      '              <a v-for="(s, i) in currentGuideSections" :key="s.id" :href="\'#eva-guide-\' + activeGuideTab + \'-\' + s.id" class="eva-guide-side-link"><span>{{ s.title }}</span><em>{{ String(i + 1).padStart(2, \'0\') }}</em></a>',
      '            </div>',
      '            <div class="eva-guide-side-card">',
      '              <h3><i class="ri-pulse-line"></i>运行环境</h3>',
      '              <div v-for="r in guide.requirements" :key="r.name" class="eva-guide-req"><span>{{ r.name }}</span><strong>{{ r.value }}</strong><i :class="r.ok ? \'ri-checkbox-circle-line\' : \'ri-error-warning-line\'"></i></div>',
      '            </div>',
      '            <div class="eva-guide-side-card">',
      '              <h3><i class="ri-links-line"></i>相关资源</h3>',
      '              <div v-for="r in guide.resources" :key="r.title" class="eva-guide-resource"><i :class="r.icon"></i><div><strong>{{ r.title }}</strong><span>{{ r.desc }}</span></div></div>',
      '            </div>',
      '          </aside>',
      '        </div>',
      '        <footer class="eva-guide-foot"><span>EVA Framework v{{ guide.version || \'1.0.0\' }}</span><span>轻量 / 现代 / 好看</span></footer>',
      '      </div>',
      '      <div v-else-if="currentSection" class="eva-form" :class="{ \'eva-form--flush\': isFlush }">',
      '        <div class="eva-form-card">',
      '          <div v-for="f in currentSection.fields" :key="f.id" class="eva-field-row" :class="fieldCol(f)">',
      '            <div class="eva-field-meta"><span class="eva-field-title">{{ tv(f.title) }}</span><span v-if="tv(f.desc)" class="eva-field-desc">{{ tv(f.desc) }}</span></div>',
      '            <div class="eva-field-control"><eva-field :field="f" v-model="model[f.id]"></eva-field></div>',
      '          </div>',
      '        </div>',
      '        <div class="eva-savedock" v-show="isDirty || saveMsg">',
      '          <button type="button" class="eva-savefab" :disabled="saving || !isDirty" @click="saveOptions"><i class="ri-save-3-line"></i><span>{{ saveMsg || t(\'save\') }}</span></button>',
      '          <div class="eva-reset-wrap" @mouseleave="resetOpen = false">',
      '            <button type="button" class="eva-reset-btn" :disabled="saving" :title="t(\'restore_default\')" @click="resetOpen = !resetOpen"><i class="ri-arrow-go-back-line"></i></button>',
      '            <div class="eva-reset-menu" v-show="resetOpen">',
      '              <button type="button" class="eva-reset-item" @click="resetSection">{{ t(\'reset_section\') }}</button>',
      '              <button type="button" class="eva-reset-item" @click="resetAll">{{ t(\'reset_all\') }}</button>',
      '            </div>',
      '          </div>',
      '        </div>',
      '      </div>',
      '      <div v-else class="eva-placeholder">',
      '        <i class="ri-inbox-2-line"></i>',
      '        <p>{{ currentTitle || t(\'welcome\') }}</p>',
      '        <span>{{ t(\'building\') }}</span>',
      '      </div>',
      '    </main>',
      '  </div>',
      '  <div class="eva-drawer-mask" v-show="settingsOpen" @click="closeSettings"></div>',
      '  <aside class="eva-drawer" :class="{ \'is-open\': settingsOpen }" role="dialog" :aria-label="t(\'settings\')">',
      '    <div class="eva-drawer-head">',
      '      <div class="eva-drawer-titles"><i class="ri-settings-3-line"></i><span>{{ t(\'settings\') }}</span></div>',
      '      <button type="button" class="eva-drawer-close" :title="t(\'close\')" @click="closeSettings"><i class="ri-close-line"></i></button>',
      '    </div>',
      '    <div class="eva-drawer-body">',
      '      <div class="eva-set-section">',
      '        <p class="eva-set-title">{{ t(\'appearance\') }}</p>',
      '        <div class="eva-set-row">',
      '          <div class="eva-set-label"><i class="ri-translate-2"></i><span>{{ t(\'language\') }}</span></div>',
      '          <div class="eva-lang-wrap" :class="{ \'is-open\': langOpen }">',
      '            <button type="button" class="eva-lang-btn" @click="langOpen = !langOpen"><span v-if="curLang.flag" class="eva-lang-flag fi" :class="\'fi-\' + curLang.flag"></span><span>{{ tv(curLang.label) }}</span><i class="ri-arrow-down-s-line eva-lang-caret"></i></button>',
      '            <div class="eva-lang-menu" role="menu">',
      '              <button v-for="l in evaLangs" :key="l.code" type="button" class="eva-lang-item" :class="{ \'is-active\': l.code === evaI18nState.lang }" role="menuitem" @click="chooseLang(l.code)"><span v-if="l.flag" class="eva-lang-flag fi" :class="\'fi-\' + l.flag"></span>{{ tv(l.label) }}</button>',
      '            </div>',
      '          </div>',
      '        </div>',
      '        <div class="eva-set-row">',
      '          <div class="eva-set-label"><i class="ri-contrast-2-line"></i><span>{{ t(\'dark_mode\') }}</span></div>',
      '          <button type="button" class="eva-switch" :class="{ \'is-on\': dark }" role="switch" :aria-checked="dark ? \'true\' : \'false\'" @click="toggleDark"><span class="eva-switch-dot"></span></button>',
      '        </div>',
      '        <div class="eva-set-row">',
      '          <div class="eva-set-label"><i class="ri-layout-left-line"></i><span>{{ t(\'collapse_sidebar_label\') }}</span></div>',
      '          <button type="button" class="eva-switch" :class="{ \'is-on\': sidebarCollapsed }" role="switch" :aria-checked="sidebarCollapsed ? \'true\' : \'false\'" @click="toggleSidebar"><span class="eva-switch-dot"></span></button>',
      '        </div>',
      '      </div>',
      '      <div class="eva-set-section" v-if="isAdmin">',
      '        <p class="eva-set-title">{{ t(\'features\') }}</p>',
      '        <div class="eva-set-row">',
      '          <div class="eva-set-label"><i class="ri-book-open-line"></i><span>{{ t(\'show_guide\') }}</span></div>',
      '          <button type="button" class="eva-switch" :class="{ \'is-on\': guideVisible }" role="switch" :aria-checked="guideVisible ? \'true\' : \'false\'" @click="toggleGuide"><span class="eva-switch-dot"></span></button>',
      '        </div>',
      '        <div class="eva-set-row">',
      '          <div class="eva-set-label"><i class="ri-window-line"></i><span>{{ t(\'floating\') }}</span></div>',
      '          <button type="button" class="eva-switch" :class="{ \'is-on\': floatingEnabled }" role="switch" :aria-checked="floatingEnabled ? \'true\' : \'false\'" @click="toggleFloating"><span class="eva-switch-dot"></span></button>',
      '        </div>',
      '      </div>',
      '      <div class="eva-set-section">',
      '        <p class="eva-set-title">{{ t(\'theme_color\') }}</p>',
      '        <div class="eva-accents">',
      '          <button v-for="a in accents" :key="a.key" type="button" class="eva-accent" :class="{ \'is-active\': accent === a.key }" :style="{ background: a.color }" :title="a.label" @click="setAccent(a)"></button>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </aside>',
      '  <div class="eva-search-mask" v-show="searchOpen" @click="closeSearch"></div>',
      '  <div class="eva-search" v-show="searchOpen" role="dialog" aria-label="搜索">',
      '    <div class="eva-search-bar">',
      '      <i class="ri-search-line"></i>',
      '      <input ref="searchInput" class="eva-search-input" type="text" v-model="searchQuery" :placeholder="t(\'search_ph\')" @keydown.enter="onSearchEnter" @keydown.esc="closeSearch">',
      '      <button type="button" class="eva-search-kbd" @click="closeSearch">ESC</button>',
      '    </div>',
      '    <div class="eva-search-results">',
      '      <div v-for="r in searchResults" :key="r.sectionId + \'/\' + r.id" class="eva-search-item" :class="{ \'is-active\': r.sectionId === active }" @click="gotoResult(r)">',
      '        <i class="eva-search-ico" :class="r.icon"></i>',
      '        <div class="eva-search-text">',
      '          <span class="eva-search-label">{{ r.label }}</span>',
      '          <span v-if="r.desc" class="eva-search-desc">{{ r.desc }}</span>',
      '        </div>',
      '        <span v-if="r.parent" class="eva-search-parent">{{ r.parent }}</span>',
      '      </div>',
      '      <div v-if="searchQuery && !searchResults.length" class="eva-search-empty">{{ t(\'no_result\') }}</div>',
      '      <div v-else-if="!searchQuery" class="eva-search-empty">{{ t(\'search_hint\') }}</div>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n'),
  };

  var mount = document.getElementById('eva-app');
  if (mount) {
    mount.innerHTML = '';
    var app = Vue.createApp(App);
    // 通用图标组件：智能判断 字体class / #svg-symbol / 图片URL / 原始svg。
    // 注册菜单时 icon 可自定义形式：'ri-xxx' / '#icon-xxx'(阿里iconfont.js symbol) / 图片URL / '<svg…>'。
    // 说明：symbol 形式需页面已加载对应 iconfont.js（Eva 只负责判断渲染，不强制加载图标库）。
    app.component('eva-icon', {
      inheritAttrs: false,
      props: { icon: { type: String, default: '' } },
      computed: {
        kind: function () {
          var s = (this.icon || '').trim();
          if (!s) { return 'empty'; }
          if (s.charAt(0) === '#') { return 'symbol'; }
          if (s.slice(0, 4) === '<svg') { return 'raw'; }
          if (/^https?:\/\//i.test(s) || s.charAt(0) === '/' || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(s)) { return 'img'; }
          return 'class';
        }
      },
      template:
        '<i v-if="kind===\'class\'" :class="icon" v-bind="$attrs"></i>' +
        '<svg v-else-if="kind===\'symbol\'" class="eva-svg-ico" aria-hidden="true" v-bind="$attrs"><use :xlink:href="icon"></use></svg>' +
        '<img v-else-if="kind===\'img\'" class="eva-img-ico" :src="icon" alt="" v-bind="$attrs">' +
        '<span v-else-if="kind===\'raw\'" class="eva-svg-ico" v-html="icon" v-bind="$attrs"></span>' +
        '<i v-else v-bind="$attrs"></i>'
    });

    // 注册 UI 库组件（Libs/）：供字段模板使用，如 <eva-select>
    // 注：eva-modal / eva-drawer 等其余库目前是骨架，实现后在此各加一行 app.component 注册即可。
    if (window.EvaUI && window.EvaUI.Select) {
      app.component('eva-select', window.EvaUI.Select);
    }
    // 字段分发组件：按 field.type 从 window.EvaFields 注册表取对应组件渲染
    app.component('eva-field', {
      props: ['field', 'modelValue'],
      emits: ['update:modelValue'],
      computed: {
        comp: function () {
          var reg = window.EvaFields || {};
          return reg[this.field && this.field.type] || reg.text || null;
        }
      },
      template: '<component v-if="comp" :is="comp" :field="field" :model-value="modelValue" @update:model-value="$emit(\'update:modelValue\', $event)"></component>'
    });
    // 最后挂载主应用。字段脚本和 UI 库必须在此之前已被 WordPress enqueue。
    app.mount('#eva-app');
  }
})();
