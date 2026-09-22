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
      // 后端按 CSF 的同名参数（theme / show_search / show_reset_* / class）给出的界面开关，见 Eva::page_payload()。
      var ui = cfg.ui || {};
      // 暗色：用户在抽屉里切过就以 user_meta（cfg.darkMode）为准，没切过才听注册时的 theme 参数。
      var dark = Vue.ref(cfg.darkMode === '1' || (cfg.darkMode !== '0' && ui.theme === 'dark'));
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

      // 保存当前打开的页面、页签和菜单展开状态，刷新后恢复到原位置。
      // 按站点路径隔离，避免同一浏览器中的不同 Eva Framework 站点互相覆盖。
      var workspaceStorageKey = 'eva_fw_workspace_v1:' + window.location.pathname;
      function readWorkspaceState() {
        try {
          var raw = window.sessionStorage.getItem(workspaceStorageKey);
          return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
      }
      function validWorkspacePage(id) {
        return id === 'eva-guide' || !!findMenuItem(id);
      }
      function workspaceTab(id, closable) {
        if (id === 'eva-guide') {
          return { id: id, label: 'EVA框架使用指南', icon: 'ri-book-open-line', closable: closable !== false };
        }
        var item = findMenuItem(id);
        return item ? { id: id, label: item.label, icon: item.icon, closable: closable !== false } : null;
      }

      var first = menu.length ? menu[0] : null;
      // CSF 风格的父分区只是二级菜单的壳、没有自己的字段：默认页落到它的第一个子项，而不是一张空白页。
      if (first && first.children && first.children.length && !(cfg.sections || []).some(function (s) { return s.id === first.id; })) {
        first = first.children[0];
      }
      var savedWorkspace = readWorkspaceState();
      var initialPage = validWorkspacePage(savedWorkspace.active) ? savedWorkspace.active : (first ? first.id : '');
      var initialTabs = [];
      if (first) { initialTabs.push({ id: first.id, label: first.label, icon: first.icon, closable: false }); }
      (Array.isArray(savedWorkspace.tabs) ? savedWorkspace.tabs : []).forEach(function (id) {
        if (!validWorkspacePage(id) || initialTabs.some(function (tab) { return tab.id === id; })) return;
        var tab = workspaceTab(id, true);
        if (tab) initialTabs.push(tab);
      });
      if (initialPage && !initialTabs.some(function (tab) { return tab.id === initialPage; })) {
        var currentTab = workspaceTab(initialPage, initialPage !== (first && first.id));
        if (currentTab) initialTabs.push(currentTab);
      }

      var active = Vue.ref(initialPage);
      var tabs = Vue.reactive(initialTabs);
      var activeTab = Vue.ref(initialPage);
      var suppressDependencyAnimation = Vue.ref(false);

      function suppressDependencyAnimationOnce() {
        suppressDependencyAnimation.value = true;
        Vue.nextTick(function () {
          window.setTimeout(function () { suppressDependencyAnimation.value = false; }, 0);
        });
      }

      // 保存每个可展开一级菜单的展开状态，key 为菜单 id。
      var openMenus = Vue.reactive(savedWorkspace.openMenus && typeof savedWorkspace.openMenus === 'object' ? savedWorkspace.openMenus : {});
      // 指南左栏目录的分组折叠状态，key 为分组 id；没记录过的一律算展开。
      var openGuideGroups = Vue.reactive(savedWorkspace.guideGroups && typeof savedWorkspace.guideGroups === 'object' ? savedWorkspace.guideGroups : {});
      function persistWorkspaceState() {
        try {
          window.sessionStorage.setItem(workspaceStorageKey, JSON.stringify({
            active: active.value,
            activeTab: activeTab.value,
            tabs: tabs.map(function (tab) { return tab.id; }),
            openMenus: Object.assign({}, openMenus),
            guideGroups: Object.assign({}, openGuideGroups)
          }));
        } catch (e) {}
      }
      Vue.watch([
        active,
        activeTab,
        function () { return tabs.map(function (tab) { return tab.id; }); },
        function () { return Object.assign({}, openMenus); },
        function () { return Object.assign({}, openGuideGroups); }
      ], persistWorkspaceState, { deep: true });

      // 搜索命令面板（右上角按钮 / Ctrl+K 弹出）：检索一级与二级菜单，仅列可跳转的叶子页
      var searchOpen = Vue.ref(false);
      var searchQuery = Vue.ref('');
      var searchInput = Vue.ref(null);

      // 全局「当前编辑语言」：顶部切换器与所有多语言字段(i18n)共享同一状态。
      // 挂在 window 上，供顶部/侧栏语言切换器与 tv() 跨组件共享同一语言。
      var evaLangs = (window.EvaFW && EvaFW.config && Array.isArray(EvaFW.config.languages) && EvaFW.config.languages.length)
        ? EvaFW.config.languages
        : [{ code: 'zh', label: '中文' }, { code: 'en', label: 'English' }, { code: 'ja', label: '日本語' }];
      // 语言属于界面偏好，不随业务表单一起提交；使用 localStorage 保留刷新后的选择。
      // localStorage 可能因浏览器隐私策略不可用，因此所有读写均做容错。
      var evaLangStorageKey = 'eva_i18n_lang';
      var storedEvaLang = '';
      try { storedEvaLang = window.localStorage.getItem(evaLangStorageKey) || ''; } catch (e) {}
      var initialEvaLang = evaLangs.some(function (l) { return l.code === storedEvaLang; })
        ? storedEvaLang
        : evaLangs[0].code;
      window.EvaI18nState = window.EvaI18nState || Vue.reactive({ lang: initialEvaLang });
      var evaI18nState = window.EvaI18nState;
      // 多个 Eva 容器共用同一全局状态；若已有状态无效，也回退到当前可用语言。
      if (!evaLangs.some(function (l) { return l.code === evaI18nState.lang; })) {
        evaI18nState.lang = initialEvaLang;
      }
      Vue.watch(function () { return evaI18nState.lang; }, function (code) {
        if (!evaLangs.some(function (l) { return l.code === code; })) { return; }
        try { window.localStorage.setItem(evaLangStorageKey, code); } catch (e) {}
      });
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
        // show_search => false：搜索入口和 Ctrl/⌘ + K 快捷键一起关掉。
        if (ui.search === false) { return; }
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
        suppressDependencyAnimationOnce();
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

      // 桌面端页签隐藏滚动条后，用鼠标滚轮转换为横向滚动。
      function onTabsWheel(event) {
        var el = event.currentTarget;
        if (!el || el.scrollWidth <= el.clientWidth) return;
        var delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        if (!delta) return;
        var max = el.scrollWidth - el.clientWidth;
        var next = Math.max(0, Math.min(max, el.scrollLeft + delta));
        if (next === el.scrollLeft) return;
        event.preventDefault();
        el.scrollLeft = next;
      }

      function selectTab(id) {
        suppressDependencyAnimationOnce();
        activeTab.value = id;
        active.value = id;
      }

      function closeTab(id) {
        suppressDependencyAnimationOnce();
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
        persistWorkspaceState();
        window.location.reload();
      }

      var closableCount = Vue.computed(function () {
        return tabs.filter(function (t) { return t.closable; }).length;
      });

      // 个人外观偏好（暗色 / 主题色）落 user_meta：抽屉里改完立刻发一条，失败回滚。
      // 与「使用指南」「悬浮窗」那两个全站开关共用 eva_fw_guide 这个 nonce。
      function savePref(body, rollback) {
        var url = cfg.ajaxUrl || ((boot.adminUrl || '') + 'admin-ajax.php');
        if (!url) { return; }
        fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: body + '&nonce=' + encodeURIComponent(cfg.nonce || ''),
        }).then(function (r) { return r.json(); }).then(function (res) {
          if (!res || !res.success) { rollback(); }
        }).catch(rollback);
      }

      function toggleDark() {
        var next = !dark.value;
        dark.value = next; // 乐观更新
        savePref('action=eva_fw_set_dark&dark=' + (next ? '1' : '0'), function () {
          dark.value = !next; // 保存失败回滚
        });
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

      // Iconfont Symbol 项目管理：保存在当前浏览器，并在图标选择器中即时刷新。
      var iconfontStorageKey = 'eva_fw_iconfont_svg_url';
      var iconfontUrl = Vue.ref('');
      var iconfontProjects = Vue.ref(['']);
      var activeIconfontProject = Vue.ref(0);
      var iconfontMsg = Vue.ref('');

      function normalizeIconfontUrl(url) {
        url = String(url || '').trim();
        if (!url) return '';
        if (url.indexOf('//') === 0) return 'https:' + url;
        if (/^https?:\/\//i.test(url)) return url;
        return '';
      }

      function parseIconfontUrls(value) {
        var seen = {};
        return String(value || '').split(/[\n,]+/).map(normalizeIconfontUrl).filter(function (url) {
          if (!url || seen[url]) return false;
          seen[url] = true;
          return true;
        });
      }

      function iconfontProjectsFromValue(value) {
        var raw = String(value || '').split(/[\n,]+/).map(function (item) { return item.trim(); }).filter(Boolean);
        return raw.length ? raw : [''];
      }

      function syncIconfontUrlFromProjects() {
        iconfontUrl.value = iconfontProjects.value.join('\n').trim();
      }

      function selectIconfontProject(index) {
        activeIconfontProject.value = index;
      }

      function addIconfontProject() {
        iconfontProjects.value.push('');
        activeIconfontProject.value = iconfontProjects.value.length - 1;
        syncIconfontUrlFromProjects();
      }

      function removeIconfontProject(index) {
        iconfontProjects.value.splice(index, 1);
        if (!iconfontProjects.value.length) iconfontProjects.value.push('');
        if (activeIconfontProject.value >= iconfontProjects.value.length) {
          activeIconfontProject.value = iconfontProjects.value.length - 1;
        }
        syncIconfontUrlFromProjects();
      }

      function dispatchIconfontLoaded() {
        var event;
        if (typeof window.CustomEvent === 'function') {
          event = new CustomEvent('eva:iconfont-loaded');
        } else {
          event = document.createEvent('CustomEvent');
          event.initCustomEvent('eva:iconfont-loaded', false, false, {});
        }
        window.dispatchEvent(event);
      }

      function countIconfontSymbols() {
        return document.querySelectorAll('symbol[id]').length;
      }

      function loadIconfontScript(url, index) {
        url = normalizeIconfontUrl(url);
        if (!url) return Promise.resolve(false);
        return new Promise(function (resolve, reject) {
          var script = document.createElement('script');
          script.id = 'eva-iconfont-symbol-script-' + index;
          script.setAttribute('data-eva-iconfont-symbol', '1');
          script.src = url;
          script.async = true;
          script.onload = function () {
            dispatchIconfontLoaded();
            window.setTimeout(dispatchIconfontLoaded, 120);
            window.setTimeout(dispatchIconfontLoaded, 360);
            resolve(true);
          };
          script.onerror = function () { reject(new Error('Iconfont load failed')); };
          document.head.appendChild(script);
        });
      }

      function clearIconfontScripts() {
        document.querySelectorAll('script[data-eva-iconfont-symbol="1"]').forEach(function (script) {
          if (script.parentNode) script.parentNode.removeChild(script);
        });
      }

      function loadIconfontScripts(urls) {
        clearIconfontScripts();
        var chain = Promise.resolve();
        urls.forEach(function (url, index) {
          chain = chain.then(function () { return loadIconfontScript(url, index); });
        });
        return chain;
      }

      function initIconfontUrl() {
        try {
          iconfontUrl.value = window.localStorage ? (window.localStorage.getItem(iconfontStorageKey) || '') : '';
        } catch (e) {
          iconfontUrl.value = '';
        }
        if (/^http:\/\/at\.alicdn\.com\//i.test(iconfontUrl.value)) {
          iconfontUrl.value = iconfontUrl.value.replace(/^http:\/\//i, 'https://');
          try {
            if (window.localStorage) window.localStorage.setItem(iconfontStorageKey, iconfontUrl.value);
          } catch (e) {}
        }
        iconfontProjects.value = iconfontProjectsFromValue(iconfontUrl.value);
        var urls = parseIconfontUrls(iconfontUrl.value);
        if (urls.length) {
          iconfontUrl.value = urls.join('\n');
          iconfontProjects.value = urls.slice();
          loadIconfontScripts(urls).catch(function () {});
        }
      }

      function saveIconfontUrl() {
        syncIconfontUrlFromProjects();
        var urls = parseIconfontUrls(iconfontUrl.value);
        if (!urls.length) {
          iconfontMsg.value = iconfontUrl.value ? t('iconfont_invalid') : t('iconfont_cleared');
          try {
            if (window.localStorage) window.localStorage.removeItem(iconfontStorageKey);
          } catch (e) {}
          clearIconfontScripts();
          dispatchIconfontLoaded();
          return;
        }
        iconfontUrl.value = urls.join('\n');
        iconfontProjects.value = urls.slice();
        try {
          if (window.localStorage) window.localStorage.setItem(iconfontStorageKey, iconfontUrl.value);
        } catch (e) {}
        iconfontMsg.value = t('loading');
        loadIconfontScripts(urls).then(function () {
          window.setTimeout(function () {
            var count = countIconfontSymbols();
            iconfontMsg.value = count
              ? t('iconfont_loaded').replace('%d', urls.length).replace('%d', count)
              : t('iconfont_no_symbols');
          }, 380);
          window.setTimeout(function () { iconfontMsg.value = ''; }, 1800);
        }).catch(function () {
          iconfontMsg.value = t('load_failed');
        });
      }

      initIconfontUrl();
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
      // 默认值来自服务端：用户挑过就是他挑的那档；没挑过则去匹配主题用 \Eva::setThemeColor()
      // 指定的品牌色——品牌色不在这 8 档里就一档都不高亮（颜色本身由 PHP 输出的 :root 令牌负责）。
      var savedAccent = (cfg.accent && cfg.accent.key) ? String(cfg.accent.key) : '';
      var brandColor = String(cfg.themeColor || '').toLowerCase();
      var brandAccent = accents.filter(function (a) { return a.color.toLowerCase() === brandColor; })[0];
      var accent = Vue.ref(savedAccent || (brandAccent ? brandAccent.key : (brandColor ? '' : 'coral')));

      // 令牌写在 <html> 的行内样式上，而不是 .eva-admin 上：行内样式盖得过 PHP 输出的 :root 规则，
      // 且同一页里 #eva-app 之外的 Eva 界面（postbox 皮肤、短代码弹窗、嵌入式容器…）也都吃得到。
      function applyAccent(a) {
        var root = document.documentElement;
        if (!root || !root.style) { return; }
        root.style.setProperty('--eva-primary', a.color);
        root.style.setProperty('--eva-primary-600', a.c600);
        root.style.setProperty('--eva-primary-050', a.c050);
      }

      function clearAccent() {
        var root = document.documentElement;
        if (!root || !root.style) { return; }
        root.style.removeProperty('--eva-primary');
        root.style.removeProperty('--eva-primary-600');
        root.style.removeProperty('--eva-primary-050');
      }

      function setAccent(a) {
        var prev = accent.value;
        accent.value = a.key; // 乐观更新
        applyAccent(a);
        savePref(
          'action=eva_fw_set_accent' +
          '&key=' + encodeURIComponent(a.key) +
          '&color=' + encodeURIComponent(a.color) +
          '&c600=' + encodeURIComponent(a.c600) +
          '&c050=' + encodeURIComponent(a.c050),
          function () {
            // 保存失败回滚：连颜色一起退回上一档，没有上一档就把行内令牌撤掉交还给 :root。
            accent.value = prev;
            var back = accents.filter(function (x) { return x.key === prev; })[0];
            if (back) { applyAccent(back); } else { clearAccent(); }
          }
        );
      }

      // 界面字体：默认使用系统字体，可切换为主题同款的荆南麦圆体。
      // 该偏好只属于当前浏览器，不随业务设置表单提交。
      var fontStorageKey = 'eva_fw_ui_font';
      var fontOptions = [
        { key: 'default', labelKey: 'font_default', icon: 'ri-font-size-2' },
        { key: 'jingnan', labelKey: 'font_jingnan', icon: 'ri-quill-pen-line' },
      ];
      var storedFont = '';
      try { storedFont = window.localStorage.getItem(fontStorageKey) || ''; } catch (e) {}
      var uiFont = Vue.ref(fontOptions.some(function (font) { return font.key === storedFont; }) ? storedFont : 'default');
      function setFont(font) {
        if (!font || !fontOptions.some(function (item) { return item.key === font.key; })) return;
        uiFont.value = font.key;
        try { window.localStorage.setItem(fontStorageKey, font.key); } catch (e) {}
      }

      // 固定菜单《EVA框架使用指南》：显隐持久化，仅管理员可开关
      var isAdmin = !!cfg.isAdmin;
      var guideVisible = Vue.ref(cfg.guideVisible !== false);

      function openGuide() {
        suppressDependencyAnimationOnce();
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
          id: 'framework', label: '框架', icon: 'ri-layout-grid-line', desc: '结构、容器类型与数据存储',
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
            {
              id: 'containers', icon: 'ri-stack-line', title: '容器类型',
              desc: '除了主题设置页，Eva 还能把同一套字段挂到文章、分类、用户、菜单、区块等地方。注册方法不同，但字段写法、依赖规则和清洗逻辑完全一致。',
              diagram: [
                '<svg viewBox="0 0 720 224" role="img" aria-label="同一套字段定义可以挂到不同容器，值落进不同的存储位置">',
                '<text class="d-cap" x="10" y="12">一套字段定义</text>',
                '<text class="d-cap" x="252" y="12">挑一种容器</text>',
                '<text class="d-cap" x="550" y="12">值落在哪</text>',
                '<rect class="d-box-hi" x="10" y="74" width="150" height="96" rx="6"/>',
                '<text class="d-t" x="26" y="100">fields[]</text>',
                '<text class="d-s" x="26" y="122">id / type / title</text>',
                '<text class="d-s" x="26" y="140">default / options</text>',
                '<text class="d-s" x="26" y="158">dependency / width</text>',
                '<path class="d-line" d="M160 122 H205 M205 46 V196 M205 46 H242 M205 96 H242 M205 146 H242 M205 196 H242"/>',
                '<polygon class="d-arrow" points="242,42 250,46 242,50"/>',
                '<polygon class="d-arrow" points="242,92 250,96 242,100"/>',
                '<polygon class="d-arrow" points="242,142 250,146 242,150"/>',
                '<polygon class="d-arrow" points="242,192 250,196 242,200"/>',
                '<rect class="d-box" x="252" y="28" width="218" height="36" rx="6"/>',
                '<text class="d-code" x="266" y="51">createOptions()</text>',
                '<rect class="d-box" x="252" y="78" width="218" height="36" rx="6"/>',
                '<text class="d-code" x="266" y="101">createMetabox()</text>',
                '<rect class="d-box" x="252" y="128" width="218" height="36" rx="6"/>',
                '<text class="d-code" x="266" y="151">createTaxonomyOptions()</text>',
                '<rect class="d-fill" x="252" y="178" width="218" height="36" rx="6"/>',
                '<text class="d-s" x="266" y="200">……共 10 种，见下表</text>',
                '<path class="d-line" d="M470 46 H542 M470 96 H542 M470 146 H542 M470 196 H542"/>',
                '<polygon class="d-arrow" points="542,42 550,46 542,50"/>',
                '<polygon class="d-arrow" points="542,92 550,96 542,100"/>',
                '<polygon class="d-arrow" points="542,142 550,146 542,150"/>',
                '<polygon class="d-arrow" points="542,192 550,196 542,200"/>',
                '<rect class="d-fill" x="550" y="30" width="160" height="32" rx="6"/>',
                '<text class="d-s" x="564" y="50">wp_options[id]</text>',
                '<rect class="d-fill" x="550" y="80" width="160" height="32" rx="6"/>',
                '<text class="d-s" x="564" y="100">post_meta</text>',
                '<rect class="d-fill" x="550" y="130" width="160" height="32" rx="6"/>',
                '<text class="d-s" x="564" y="150">term_meta</text>',
                '<rect class="d-fill" x="550" y="180" width="160" height="32" rx="6"/>',
                '<text class="d-s" x="564" y="200">user_meta / …</text>',
                '</svg>',
              ].join(''),
              diagramCaption: '字段写法只有一套，换容器只是换注册方法和读取值的函数。',
              cards: [
                { icon: 'ri-window-line', title: '设置页', api: 'createOptions', desc: '独立设置页，值存 wp_options[id]。' },
                { icon: 'ri-file-edit-line', title: '文章 / 页面', api: 'createMetabox', desc: '文章、页面或自定义文章类型的 metabox，值存 post_meta。' },
                { icon: 'ri-price-tag-3-line', title: '分类法', api: 'createTaxonomyOptions', desc: '分类、标签等分类法的编辑页，值存 term_meta。' },
                { icon: 'ri-user-settings-line', title: '用户资料', api: 'createProfileOptions', desc: '用户资料页，值存 user_meta。' },
                { icon: 'ri-menu-2-line', title: '导航菜单项', api: 'createNavMenuOptions', desc: '外观 → 菜单里的每个菜单项，值存菜单项的 post_meta。' },
                { icon: 'ri-chat-3-line', title: '评论', api: 'createCommentMetabox', desc: '评论编辑页，值存 comment_meta。' },
                { icon: 'ri-palette-line', title: '定制器', api: 'createCustomizeOptions', desc: '外观 → 自定义里的面板，值存 option 或 theme_mod。' },
                { icon: 'ri-code-box-line', title: '短代码', api: 'createShortcoder', desc: '编辑器里的短代码生成器，同时注册前台短代码。' },
                { icon: 'ri-layout-left-line', title: '小工具', api: 'createWidget', desc: '外观 → 小工具，注册为 WP_Widget。' },
                { icon: 'ri-layout-masonry-line', title: '区块', api: 'createBlock', desc: '区块编辑器里的区块，值写在文章内容里。' },
              ],
              tables: [
                {
                  title: '十种容器对照',
                  columns: ['容器', '注册方法', '值存在哪', '默认 capability'],
                  rows: [
                    ['设置页', '<code>createOptions</code>', '<code>wp_options[id]</code>', '<code>manage_options</code>'],
                    ['文章 / 页面', '<code>createMetabox</code>', '<code>post_meta</code>', '<code>edit_posts</code>'],
                    ['分类法', '<code>createTaxonomyOptions</code>', '<code>term_meta</code>', '<code>manage_categories</code>'],
                    ['用户资料', '<code>createProfileOptions</code>', '<code>user_meta</code>', '<code>edit_user</code>'],
                    ['导航菜单项', '<code>createNavMenuOptions</code>', '菜单项的 <code>post_meta</code>', '<code>edit_theme_options</code>'],
                    ['评论', '<code>createCommentMetabox</code>', '<code>comment_meta</code>', '<code>edit_comment</code>'],
                    ['定制器', '<code>createCustomizeOptions</code>', '<code>wp_options[id]</code> 或 <code>theme_mod</code>', '<code>edit_theme_options</code>'],
                    ['短代码', '<code>createShortcoder</code>', '短代码属性（不入库）', '<code>edit_posts</code>'],
                    ['小工具', '<code>createWidget</code>', 'widget 实例设置', '跟随 WordPress'],
                    ['区块', '<code>createBlock</code>', '文章内容里的区块属性（不入库）', '<code>edit_posts</code>'],
                  ],
                },
              ],
              notes: [
                { title: '分区写法是通用的', text: 'createSection 的第一个参数可以是任意 create* 的 id，Eva 会自动找到它所属的容器，不必为每种容器换一套 API。' },
                { title: 'data_type 决定怎么存', text: 'serialize（默认）把整个容器的值存成一个键；direct 则逐字段写独立的 meta，方便 meta_query 查询或对接旧数据。' },
              ],
            },
            {
              id: 'container-post', icon: 'ri-file-edit-line', title: '文章与评论',
              desc: 'createMetabox 给文章、页面或自定义文章类型加字段，context 可选 normal / advanced（默认）/ side；createCommentMetabox 是评论编辑页的同款。',
              diagram: [
                '<svg viewBox="0 0 720 200" role="img" aria-label="文章编辑页与评论编辑页上 Eva 字段出现的位置">',
                '<text class="d-cap" x="10" y="14">文章编辑页</text>',
                '<text class="d-cap" x="430" y="14">评论编辑页</text>',
                '<rect class="d-box" x="10" y="24" width="390" height="166" rx="6"/>',
                '<path class="d-line" d="M10 46 H400"/>',
                '<text class="d-s" x="22" y="40">编辑文章</text>',
                '<rect class="d-fill" x="22" y="58" width="248" height="22" rx="4"/>',
                '<text class="d-s" x="32" y="73">标题</text>',
                '<rect class="d-fill" x="22" y="88" width="248" height="52" rx="4"/>',
                '<text class="d-s" x="32" y="107">正文编辑器</text>',
                '<rect class="d-box-hi" x="22" y="148" width="248" height="32" rx="4"/>',
                '<circle class="d-mark" cx="34" cy="164" r="3"/>',
                '<text class="d-t" x="44" y="162">Eva 字段</text>',
                '<text class="d-s" x="44" y="175">context: advanced（默认）</text>',
                '<rect class="d-fill" x="282" y="58" width="106" height="34" rx="4"/>',
                '<text class="d-s" x="292" y="79">发布</text>',
                '<rect class="d-box-hi" x="282" y="100" width="106" height="80" rx="4"/>',
                '<circle class="d-mark" cx="294" cy="118" r="3"/>',
                '<text class="d-t" x="304" y="122">Eva 字段</text>',
                '<text class="d-s" x="292" y="140">context: side</text>',
                '<text class="d-s" x="292" y="156">窄栏变体</text>',
                '<rect class="d-box" x="430" y="24" width="280" height="166" rx="6"/>',
                '<path class="d-line" d="M430 46 H710"/>',
                '<text class="d-s" x="442" y="40">编辑评论</text>',
                '<rect class="d-fill" x="442" y="58" width="256" height="46" rx="4"/>',
                '<text class="d-s" x="452" y="77">评论内容</text>',
                '<rect class="d-box-hi" x="442" y="114" width="256" height="62" rx="4"/>',
                '<circle class="d-mark" cx="454" cy="134" r="3"/>',
                '<text class="d-t" x="464" y="138">Eva 字段</text>',
                '<text class="d-s" x="452" y="158">值存 comment_meta</text>',
                '</svg>',
              ].join(''),
              diagramCaption: '同一个 metabox 放在 side 时会自动切到窄栏变体，字段配置不用改。',
              codeBlocks: [
                {
                  title: '文章 Metabox',
                  code: [
                    "Eva::createMetabox('post_settings', [",
                    "    'title'     => '文章设置',",
                    "    'post_type' => ['post', 'page'],",
                    "    'context'   => 'side',      // normal / advanced / side",
                    "    'data_type' => 'serialize', // serialize=单键；direct=逐字段独立 meta",
                    "]);",
                    "",
                    "Eva::createSection('post_settings', [",
                    "    'fields' => [",
                    "        ['id' => 'show_toc', 'type' => 'switcher', 'title' => '显示目录', 'default' => true],",
                    "        ['id' => 'source_url', 'type' => 'text', 'title' => '转载链接', 'placeholder' => 'https://'],",
                    "    ],",
                    "]);",
                    "",
                    "// 模板里读取",
                    "$meta = get_post_meta(get_the_ID(), 'post_settings', true);",
                    "if (! empty($meta['show_toc'])) { /* 输出目录 */ }",
                  ].join('\n'),
                },
                {
                  title: '评论 Metabox',
                  code: [
                    "Eva::createCommentMetabox('comment_extra', [",
                    "    'title' => '评论附加信息',",
                    "]);",
                    "",
                    "Eva::createSection('comment_extra', [",
                    "    'fields' => [",
                    "        ['id' => 'mood', 'type' => 'select', 'title' => '心情', 'options' => [",
                    "            'happy' => '开心',",
                    "            'angry' => '生气',",
                    "        ]],",
                    "    ],",
                    "]);",
                    "",
                    "$extra = get_comment_meta($comment_id, 'comment_extra', true);",
                  ].join('\n'),
                },
              ],
              tables: [
                {
                  title: 'createMetabox 参数',
                  columns: ['参数', '类型', '默认值', '说明'],
                  rows: [
                    ['<code>title</code>', 'string', '同 id', 'postbox 的标题'],
                    ['<code>post_type</code>', 'string / array', '<code>post</code>', '挂到哪些文章类型'],
                    ['<code>context</code>', 'string', '<code>advanced</code>', '<code>normal</code> / <code>advanced</code> / <code>side</code>'],
                    ['<code>priority</code>', 'string', '<code>default</code>', 'WordPress 的 postbox 排序'],
                    ['<code>data_type</code>', 'string', '<code>serialize</code>', '<code>serialize</code> 单键；<code>direct</code> 逐字段独立 meta'],
                    ['<code>capability</code>', 'string', '<code>edit_posts</code>', '显示与保存所需权限'],
                  ],
                },
                {
                  title: 'createCommentMetabox 参数',
                  columns: ['参数', '类型', '默认值', '说明'],
                  rows: [
                    ['<code>title</code>', 'string', '同 id', '评论页上的区块标题'],
                    ['<code>data_type</code>', 'string', '<code>serialize</code>', '同上，决定 comment_meta 的存法'],
                    ['<code>capability</code>', 'string', '<code>edit_comment</code>', '显示与保存所需权限'],
                  ],
                },
              ],
            },
            {
              id: 'container-term', icon: 'ri-price-tag-3-line', title: '分类、标签与菜单',
              desc: '分类法容器默认挂在 category 和 post_tag 上，也可以指定自定义分类法；菜单容器则把字段加到「外观 → 菜单」里每一个菜单项下面。',
              diagram: [
                '<svg viewBox="0 0 720 200" role="img" aria-label="分类编辑页与菜单页上 Eva 字段出现的位置">',
                '<text class="d-cap" x="10" y="14">分类 / 标签页</text>',
                '<text class="d-cap" x="430" y="14">外观 → 菜单</text>',
                '<rect class="d-box" x="10" y="24" width="390" height="166" rx="6"/>',
                '<path class="d-line" d="M10 46 H400"/>',
                '<text class="d-s" x="22" y="40">分类</text>',
                '<text class="d-s" x="22" y="64">添加新分类</text>',
                '<rect class="d-fill" x="22" y="72" width="164" height="18" rx="4"/>',
                '<text class="d-s" x="30" y="85">名称</text>',
                '<rect class="d-fill" x="22" y="96" width="164" height="18" rx="4"/>',
                '<text class="d-s" x="30" y="109">别名</text>',
                '<rect class="d-box-hi" x="22" y="120" width="164" height="60" rx="4"/>',
                '<circle class="d-mark" cx="34" cy="138" r="3"/>',
                '<text class="d-t" x="44" y="142">Eva 字段</text>',
                '<text class="d-s" x="30" y="162">新增 / 编辑分类时都在</text>',
                '<rect class="d-fill" x="202" y="64" width="186" height="22" rx="4"/>',
                '<text class="d-s" x="212" y="79">已有分类列表</text>',
                '<rect class="d-fill" x="202" y="92" width="186" height="22" rx="4"/>',
                '<rect class="d-fill" x="202" y="120" width="186" height="22" rx="4"/>',
                '<rect class="d-fill" x="202" y="148" width="186" height="22" rx="4"/>',
                '<rect class="d-box" x="430" y="24" width="280" height="166" rx="6"/>',
                '<path class="d-line" d="M430 46 H710"/>',
                '<text class="d-s" x="442" y="40">菜单结构</text>',
                '<rect class="d-fill" x="442" y="58" width="256" height="20" rx="4"/>',
                '<text class="d-s" x="452" y="72">首页</text>',
                '<rect class="d-box-hi" x="442" y="84" width="256" height="92" rx="4"/>',
                '<text class="d-s" x="452" y="99">关于我们</text>',
                '<path class="d-dash" d="M452 108 H688"/>',
                '<rect class="d-fill" x="452" y="116" width="226" height="16" rx="3"/>',
                '<text class="d-s" x="460" y="128">导航标签</text>',
                '<circle class="d-mark" cx="460" cy="150" r="3"/>',
                '<text class="d-t" x="470" y="154">Eva 字段</text>',
                '<text class="d-s" x="452" y="170">展开某个菜单项即可看到</text>',
                '</svg>',
              ].join(''),
              diagramCaption: '分类法字段在新增和编辑两处都会出现；菜单字段按菜单项各存各的。',
              codeBlocks: [
                {
                  title: '分类与标签',
                  code: [
                    "Eva::createTaxonomyOptions('term_settings', [",
                    "    'taxonomy'   => ['category', 'post_tag'], // 默认值，可换成自定义分类法",
                    "    'capability' => 'manage_categories',",
                    "]);",
                    "",
                    "Eva::createSection('term_settings', [",
                    "    'fields' => [",
                    "        ['id' => 'cover', 'type' => 'upload', 'title' => '分类封面', 'preview' => true],",
                    "        ['id' => 'color', 'type' => 'color', 'title' => '主题色', 'default' => '#ff758c'],",
                    "    ],",
                    "]);",
                    "",
                    "// 读取某个分类的值",
                    "$term = get_term_meta($term_id, 'term_settings', true);",
                  ].join('\n'),
                },
                {
                  title: '导航菜单项',
                  code: [
                    "// 不传参数也可以，值按菜单项保存",
                    "Eva::createNavMenuOptions('menu_item_extra');",
                    "",
                    "Eva::createSection('menu_item_extra', [",
                    "    'fields' => [",
                    "        ['id' => 'icon', 'type' => 'icon', 'title' => '菜单图标'],",
                    "        ['id' => 'highlight', 'type' => 'switcher', 'title' => '高亮显示'],",
                    "    ],",
                    "]);",
                    "",
                    "// 遍历菜单项时读取",
                    "$extra = get_post_meta($item->ID, 'menu_item_extra', true);",
                  ].join('\n'),
                },
              ],
              tables: [
                {
                  title: 'createTaxonomyOptions 参数',
                  columns: ['参数', '类型', '默认值', '说明'],
                  rows: [
                    ['<code>taxonomy</code>', 'string / array', "<code>['category','post_tag']</code>", '挂到哪些分类法，可填自定义分类法'],
                    ['<code>data_type</code>', 'string', '<code>serialize</code>', '<code>serialize</code> 单键；<code>direct</code> 逐字段独立 term_meta'],
                    ['<code>capability</code>', 'string', '<code>manage_categories</code>', '显示与保存所需权限'],
                  ],
                },
                {
                  title: 'createNavMenuOptions 参数',
                  columns: ['参数', '类型', '默认值', '说明'],
                  rows: [
                    ['<code>data_type</code>', 'string', '<code>serialize</code>', '同上，决定菜单项 post_meta 的存法'],
                    ['<code>capability</code>', 'string', '<code>edit_theme_options</code>', '显示与保存所需权限'],
                  ],
                },
              ],
            },
            {
              id: 'container-user', icon: 'ri-user-settings-line', title: '用户资料与定制器',
              desc: '用户资料容器把字段加到个人资料页，值存 user_meta；定制器容器把字段搬进 WordPress 实时预览面板，值默认存 wp_options。',
              diagram: [
                '<svg viewBox="0 0 720 200" role="img" aria-label="用户资料页与定制器面板上 Eva 字段出现的位置">',
                '<text class="d-cap" x="10" y="14">用户 → 个人资料</text>',
                '<text class="d-cap" x="430" y="14">外观 → 自定义</text>',
                '<rect class="d-box" x="10" y="24" width="390" height="166" rx="6"/>',
                '<path class="d-line" d="M10 46 H400"/>',
                '<text class="d-s" x="22" y="40">个人资料</text>',
                '<rect class="d-fill" x="22" y="58" width="366" height="18" rx="4"/>',
                '<text class="d-s" x="30" y="71">昵称 / 邮箱 / 网站</text>',
                '<rect class="d-fill" x="22" y="82" width="366" height="18" rx="4"/>',
                '<text class="d-s" x="30" y="95">关于你自己</text>',
                '<rect class="d-box-hi" x="22" y="108" width="366" height="70" rx="4"/>',
                '<circle class="d-mark" cx="34" cy="126" r="3"/>',
                '<text class="d-t" x="44" y="130">Eva 字段（扩展资料）</text>',
                '<path class="d-dash" d="M32 140 H378"/>',
                '<rect class="d-fill" x="32" y="148" width="166" height="20" rx="3"/>',
                '<text class="d-s" x="40" y="162">头衔</text>',
                '<rect class="d-fill" x="212" y="148" width="166" height="20" rx="3"/>',
                '<text class="d-s" x="220" y="162">微博地址</text>',
                '<rect class="d-box" x="430" y="24" width="280" height="166" rx="6"/>',
                '<rect class="d-box-hi" x="430" y="24" width="104" height="166" rx="6"/>',
                '<path class="d-line" d="M430 46 H710"/>',
                '<text class="d-s" x="442" y="40">自定义</text>',
                '<rect class="d-fill" x="440" y="58" width="84" height="18" rx="3"/>',
                '<text class="d-s" x="448" y="71">站点身份</text>',
                '<rect class="d-fill" x="440" y="82" width="84" height="18" rx="3"/>',
                '<text class="d-s" x="448" y="95">菜单</text>',
                '<circle class="d-mark" cx="450" cy="116" r="3"/>',
                '<text class="d-t" x="460" y="120">Eva 分区</text>',
                '<text class="d-s" x="440" y="138">改一下立刻</text>',
                '<text class="d-s" x="440" y="152">在右边预览</text>',
                '<rect class="d-fill" x="548" y="58" width="150" height="120" rx="4"/>',
                '<text class="d-s" x="588" y="122">实时预览</text>',
                '</svg>',
              ].join(''),
              diagramCaption: '定制器里 Eva 分区和 WordPress 原生分区并排，右边是同一套实时预览。',
              codeBlocks: [
                {
                  title: '用户资料',
                  code: [
                    "Eva::createProfileOptions('user_extra', [",
                    "    'capability' => 'edit_user',",
                    "]);",
                    "",
                    "Eva::createSection('user_extra', [",
                    "    'title'  => '扩展资料',",
                    "    'fields' => [",
                    "        ['id' => 'job_title', 'type' => 'text', 'title' => '头衔'],",
                    "        ['id' => 'weibo', 'type' => 'text', 'title' => '微博地址'],",
                    "    ],",
                    "]);",
                    "",
                    "$profile = get_user_meta($user_id, 'user_extra', true);",
                  ].join('\n'),
                },
                {
                  title: '定制器',
                  code: [
                    "Eva::createCustomizeOptions('live_settings', [",
                    "    'title'    => '实时预览设置',",
                    "    'database' => 'option', // option=存 wp_options[id]；theme_mod=跟随当前主题",
                    "]);",
                    "",
                    "Eva::createSection('live_settings', [",
                    "    'title'  => '页头',",
                    "    'fields' => [",
                    "        ['id' => 'logo', 'type' => 'media', 'title' => '站点 Logo'],",
                    "    ],",
                    "]);",
                    "",
                    "$live = get_option('live_settings');",
                  ].join('\n'),
                },
              ],
              tables: [
                {
                  title: 'createProfileOptions 参数',
                  columns: ['参数', '类型', '默认值', '说明'],
                  rows: [
                    ['<code>data_type</code>', 'string', '<code>serialize</code>', '<code>serialize</code> 单键；<code>direct</code> 逐字段独立 user_meta'],
                    ['<code>capability</code>', 'string', '<code>edit_user</code>', '显示与保存所需权限'],
                  ],
                },
                {
                  title: 'createCustomizeOptions 参数',
                  columns: ['参数', '类型', '默认值', '说明'],
                  rows: [
                    ['<code>title</code>', 'string', '同 id', '定制器面板里的分区标题'],
                    ['<code>database</code>', 'string', '<code>option</code>', '<code>option</code> 存 wp_options；<code>theme_mod</code> 跟随当前主题'],
                    ['<code>capability</code>', 'string', '<code>edit_theme_options</code>', '显示与保存所需权限'],
                  ],
                },
              ],
            },
            {
              id: 'container-shortcode', icon: 'ri-code-box-line', title: '短代码与小工具',
              desc: '短代码容器在编辑器里生成一个插入入口，同时注册前台短代码；小工具容器注册成 WP_Widget，出现在「外观 → 小工具」中。',
              diagram: [
                '<svg viewBox="0 0 720 200" role="img" aria-label="编辑器里的短代码生成器与小工具页上 Eva 字段的位置">',
                '<text class="d-cap" x="10" y="14">编辑器工具栏</text>',
                '<text class="d-cap" x="430" y="14">外观 → 小工具</text>',
                '<rect class="d-box" x="10" y="24" width="390" height="166" rx="6"/>',
                '<path class="d-line" d="M10 52 H400"/>',
                '<rect class="d-fill" x="22" y="32" width="26" height="14" rx="3"/>',
                '<rect class="d-fill" x="54" y="32" width="26" height="14" rx="3"/>',
                '<rect class="d-box-hi" x="86" y="30" width="72" height="18" rx="3"/>',
                '<text class="d-s" x="94" y="43">Eva 短代码</text>',
                '<rect class="d-box-hi" x="130" y="62" width="258" height="86" rx="5"/>',
                '<circle class="d-mark" cx="142" cy="80" r="3"/>',
                '<text class="d-t" x="152" y="84">短代码生成器</text>',
                '<path class="d-dash" d="M140 94 H378"/>',
                '<rect class="d-fill" x="140" y="102" width="238" height="16" rx="3"/>',
                '<text class="d-s" x="148" y="114">按钮文字</text>',
                '<rect class="d-fill" x="140" y="122" width="238" height="16" rx="3"/>',
                '<text class="d-s" x="148" y="134">链接地址</text>',
                '<text class="d-s" x="22" y="170">插入后写进正文：</text>',
                '<text class="d-code" x="126" y="170">[eva_button text=&quot;…&quot;]</text>',
                '<rect class="d-box" x="430" y="24" width="280" height="166" rx="6"/>',
                '<path class="d-line" d="M430 46 H710"/>',
                '<text class="d-s" x="442" y="40">小工具</text>',
                '<text class="d-s" x="442" y="64">可用小工具</text>',
                '<rect class="d-fill" x="442" y="72" width="120" height="20" rx="3"/>',
                '<text class="d-s" x="450" y="86">搜索</text>',
                '<rect class="d-box-hi" x="442" y="98" width="120" height="38" rx="3"/>',
                '<circle class="d-mark" cx="454" cy="112" r="3"/>',
                '<text class="d-t" x="464" y="116">最新文章</text>',
                '<text class="d-s" x="450" y="130">Eva 注册</text>',
                '<text class="d-s" x="578" y="64">侧边栏</text>',
                '<rect class="d-fill" x="578" y="72" width="120" height="64" rx="3"/>',
                '<path class="d-dash" d="M566 117 H574"/>',
                '<polygon class="d-arrow" points="570,113 578,117 570,121"/>',
                '<text class="d-s" x="442" y="162">拖进侧边栏后，字段就是这个小工具的设置项</text>',
                '</svg>',
              ].join(''),
              diagramCaption: '短代码字段填完即生成短代码；小工具字段就是该 widget 的实例设置。',
              codeBlocks: [
                {
                  title: '短代码生成器',
                  code: [
                    "Eva::createShortcoder('eva_button', [",
                    "    'title'     => '按钮',",
                    "    'shortcode' => 'eva_button', // 省略时等于 id",
                    "]);",
                    "",
                    "Eva::createSection('eva_button', [",
                    "    'fields' => [",
                    "        ['id' => 'text', 'type' => 'text', 'title' => '按钮文字', 'default' => '了解更多'],",
                    "        ['id' => 'url', 'type' => 'text', 'title' => '链接地址'],",
                    "    ],",
                    "]);",
                    "",
                    "// 插入后形如：[eva_button text=\"了解更多\" url=\"/about\"]",
                  ].join('\n'),
                },
                {
                  title: '小工具',
                  code: [
                    "// id 即 widget 的 id_base",
                    "Eva::createWidget('eva_recent', [",
                    "    'title'       => '最新文章',",
                    "    'description' => '显示最近发布的文章列表',",
                    "]);",
                    "",
                    "Eva::createSection('eva_recent', [",
                    "    'fields' => [",
                    "        ['id' => 'count', 'type' => 'number', 'title' => '显示数量', 'default' => 5],",
                    "    ],",
                    "]);",
                  ].join('\n'),
                },
              ],
              tables: [
                {
                  title: 'createShortcoder 参数',
                  columns: ['参数', '类型', '默认值', '说明'],
                  rows: [
                    ['<code>title</code>', 'string', '同 id', '生成器入口显示的名字'],
                    ['<code>shortcode</code>', 'string', '同 id', '实际注册的短代码标签'],
                    ['<code>capability</code>', 'string', '<code>edit_posts</code>', '谁能用这个生成器'],
                  ],
                },
                {
                  title: 'createWidget 参数',
                  columns: ['参数', '类型', '默认值', '说明'],
                  rows: [
                    ['<code>title</code>', 'string', '同 id', '小工具名称'],
                    ['<code>description</code>', 'string', '空', '小工具列表里的一句说明'],
                  ],
                },
              ],
            },
            {
              id: 'container-block', icon: 'ri-layout-masonry-line', title: '区块编辑器区块',
              desc: 'createBlock 注册一个真正的 Gutenberg 区块：字段收在编辑器右侧栏，前台由 PHP 现渲染（动态区块）。它是 Eva 独有的，CSF 没有对应 API——CSF 所谓的「区块」只是短代码生成器附带的一个插入入口，区块本体只有一个文本框。',
              diagram: [
                '<svg viewBox="0 0 720 224" role="img" aria-label="区块编辑器里字段在右侧栏、画布显示服务端预览，值写进文章内容">',
                '<text class="d-cap" x="10" y="12">编辑器画布</text>',
                '<text class="d-cap" x="446" y="12">右侧栏</text>',
                '<rect class="d-box" x="10" y="22" width="416" height="128" rx="6"/>',
                '<rect class="d-box-hi" x="26" y="38" width="384" height="96" rx="5"/>',
                '<circle class="d-mark" cx="38" cy="56" r="3"/>',
                '<text class="d-t" x="48" y="60">提示框</text>',
                '<path class="d-dash" d="M36 70 H400"/>',
                '<text class="d-s" x="36" y="88">这块是 render 回调现渲染的结果，</text>',
                '<text class="d-s" x="36" y="106">和前台看到的一模一样。</text>',
                '<text class="d-s" x="36" y="126">（inner_blocks 时这里换成嵌套区块编辑区）</text>',
                '<rect class="d-box" x="446" y="22" width="264" height="128" rx="6"/>',
                '<path class="d-line" d="M446 46 H710"/>',
                '<text class="d-t" x="458" y="40">区块设置</text>',
                '<text class="d-s" x="458" y="64">样式</text>',
                '<rect class="d-fill" x="458" y="70" width="240" height="16" rx="3"/>',
                '<text class="d-s" x="458" y="104">标题</text>',
                '<rect class="d-fill" x="458" y="110" width="240" height="16" rx="3"/>',
                '<text class="d-s" x="458" y="144">……Eva 字段</text>',
                '<path class="d-dash" d="M446 86 H418"/>',
                '<polygon class="d-arrow" points="422,82 414,86 422,90"/>',
                '<text class="d-cap" x="10" y="176">保存后写进文章内容（不入库）</text>',
                '<rect class="d-box" x="10" y="184" width="700" height="32" rx="5"/>',
                '<text class="d-code" x="24" y="204">&lt;!-- wp:eva/notice {&quot;eva&quot;:{&quot;style&quot;:&quot;warning&quot;,&quot;title&quot;:&quot;…&quot;}} /--&gt;</text>',
                '</svg>',
              ].join(''),
              diagramCaption: '右侧栏的字段值驱动画布预览，保存后作为一个对象属性写在文章内容里。',
              codeBlocks: [
                {
                  title: '注册一个区块',
                  code: [
                    "Eva::createBlock('eva/notice', [",
                    "    'title'    => '提示框',",
                    "    'icon'     => 'info',          // dashicon 名，或整段 SVG",
                    "    'category' => 'lentasy',       // 分类不存在时自动注册",
                    "    'category_title' => '柠檬主题',",
                    "    'fields'   => [                // 只有一组字段时可省掉 sections",
                    "        ['id' => 'style', 'type' => 'button_set', 'title' => '样式',",
                    "         'options' => ['info' => '信息', 'warning' => '警告'], 'default' => 'info'],",
                    "        ['id' => 'text',  'type' => 'textarea',   'title' => '内容'],",
                    "    ],",
                    "    'render'   => 'lf_render_notice',",
                    "]);",
                    "",
                    "// $values 是拍平的 [field_id => value]，已补默认值、已过字段清洗",
                    "function lf_render_notice($values, $content = '', $block = null) {",
                    "    return '<div class=\"lf-notice is-' . esc_attr($values['style']) . '\">'",
                    "        . wp_kses_post(wpautop($values['text'])) . '</div>';",
                    "}",
                  ].join('\n'),
                },
                {
                  title: '不写 render：交给过滤器',
                  code: [
                    "// 区块声明和渲染想分开放时用这种写法，",
                    "// 和短代码容器的 eva_shortcode_{tag} 是同一套路子。",
                    "add_filter('eva_block_eva/notice', function ($html, $values, $content, $block) {",
                    "    return '<div class=\"lf-notice\">' . esc_html($values['text']) . '</div>';",
                    "}, 10, 4);",
                  ].join('\n'),
                },
              ],
              tables: [
                {
                  title: 'createBlock 参数',
                  columns: ['参数', '类型', '默认值', '说明'],
                  rows: [
                    ['<code>title</code> / <code>description</code>', 'string|array', '同 id / 空', '可写成 <code>{zh,en,ja}</code> 多语言对象'],
                    ['<code>icon</code>', 'string', '<code>screenoptions</code>', 'dashicon 名，或整段 SVG'],
                    ['<code>category</code>', 'string', '<code>widgets</code>', '分类未注册时按 <code>category_title</code> 自动补一条'],
                    ['<code>render</code>', 'callable', '—', '<code>($values, $content, $block)</code>；不给则走 <code>eva_block_{name}</code>'],
                    ['<code>preview</code>', 'bool', '跟随 render', '画布内显示服务端渲染的真实效果'],
                    ['<code>placement</code>', 'string', '<code>inspector</code>', '<code>inspector</code>=字段在右侧栏；<code>content</code>=字段画在区块里'],
                    ['<code>inner_blocks</code>', 'bool', '<code>false</code>', '支持嵌套子区块；此时画布留给 InnerBlocks，不做预览'],
                    ['<code>supports</code> / <code>example</code>', 'array', '—', '原样透传 <code>register_block_type</code>'],
                    ['<code>capability</code>', 'string', '<code>edit_posts</code>', '权限不足者在插入器里看不到它（区块本身仍注册）'],
                    ['字段上的 <code>toolbar</code>', 'bool', '<code>false</code>', '把该字段从右侧栏搬到区块工具栏（仅 button_set / radio / select / switcher）'],
                    ['字段上的 <code>toolbar_icon</code>', 'string', '—', 'switcher 在工具栏上的 dashicon；button_set 的图标写在各选项里'],
                  ],
                },
              ],
              notes: [
                { title: '值不进数据库', text: '区块的字段值作为一个对象属性 eva 写在文章内容里。渲染回调拿到的 $values 是拍平的 [field_id => value]，已经补过默认值、过过字段清洗，形态和其它容器一致（开了 csf_compat 就是 CSF 形态），所以 _LF_* 那套读法照用。' },
                { title: '为什么不逐字段一个属性', text: '区块属性带类型校验，而 Eva 四十来种字段的值形态从标量到嵌套数组都有：逐字段映射既容易对不上，作者以后改某个字段的类型时，还会让文章里已经插好的区块失效。统一收在一个 object 属性里没有这个问题。' },
                { title: '全部是动态区块', text: 'save 一律返回 null，HTML 每次由 PHP 现渲染。好处是改了 render 立刻对全站生效，不会出现「区块内容与其预期格式不符」的校验错误；停用 Eva 后文章里留下的是空区块，而不是坏掉的 HTML。' },
                { title: '常用字段可以放进工具栏', text: '字段上标 toolbar => true，它就从右侧栏搬到选中区块时浮出来的工具栏上，不用开侧栏就能改。只有离散选项类的字段塞得进去（button_set / radio / select / switcher），其余类型忽略这个标记。工具栏用的是 WordPress 原生控件而非 Eva 的 Vue 组件，但读写同一个区块属性，和侧栏的字段天然同步。' },
                { title: 'placement=content 的画布样式', text: '字段画在区块里时，它们位于编辑器画布的 iframe 内，而 enqueue_block_editor_assets 的样式只进外层文档。Eva 会通过 block_editor_settings_all 自动把样式表注入画布；站点没有这类区块时一个字节都不注入。' },
              ],
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
      var dependencySources = cfg.dependencySources || {};
      var fieldErrors = Vue.reactive({});
      // 补齐默认值：后端没保存过的字段，前端仍按 schema.default 显示初始值。
      sections.forEach(function (s) {
        (s.fields || []).forEach(function (f) {
          if (!(f.id in model)) { model[f.id] = (f.default !== undefined ? f.default : ''); }
        });
      });

      // 脏状态：当前 model 与上次保存快照不一致即为「有未保存更改」
      var savedSnapshot = Vue.ref(JSON.stringify(model));
      var isDirty = Vue.computed(function () { return JSON.stringify(model) !== savedSnapshot.value; });
      // 指南正文一次性平铺全部分组，锚点 id 沿用 eva-guide-<分组>-<小节>，
      // 这样 #eva-guide-fields-field-basic 之类的老链接仍然有效。
      var guideSections = [];
      guide.groups.forEach(function (g) {
        (g.sections || []).forEach(function (s) {
          guideSections.push(Object.assign({}, s, {
            anchor: 'eva-guide-' + g.id + '-' + s.id,
            groupId: g.id,
            groupLabel: g.label,
            groupIcon: g.icon,
            groupDesc: g.desc,
          }));
        });
      });
      var activeGuideAnchor = Vue.ref(guideSections.length ? guideSections[0].anchor : '');

      // 左栏目录：按分组列出小节；“字段”分组末尾附上字段展示页的跳转项。
      var guideOutline = Vue.computed(function () {
        var fieldMenu = menu.filter(function (item) { return item.id === 'field-showcase'; })[0] || {};
        var fieldChildren = Array.isArray(fieldMenu.children) ? fieldMenu.children : [];
        return guide.groups.map(function (g) {
          var items = (g.sections || []).map(function (s) {
            return {
              key: g.id + '-' + s.id,
              label: s.title,
              icon: s.icon || g.icon,
              anchor: 'eva-guide-' + g.id + '-' + s.id,
            };
          });
          var menus = [];
          if (g.id === 'fields') {
            var seen = {};
            (g.sections || []).forEach(function (s) { seen[s.id] = true; });
            fieldChildren.forEach(function (item) {
              if (!item || !item.id || seen[item.id]) { return; }
              seen[item.id] = true;
              menus.push({
                key: 'menu-' + item.id,
                menuId: item.id,
                label: item.label,
                icon: item.icon || 'ri-input-method-line',
              });
            });
          }
          return { id: g.id, label: g.label, icon: g.icon, desc: g.desc, items: items, menus: menus };
        });
      });

      // 目录分组折叠：没手动收过的分组默认展开。
      function isGuideGroupOpen(id) { return openGuideGroups[id] !== false; }
      function toggleGuideGroup(id) { openGuideGroups[id] = !isGuideGroupOpen(id); }

      // 当前选中的小节；正文只渲染它一节，包成数组是为了复用原来的卡片模板
      var currentGuideSection = Vue.computed(function () {
        return guideSections.filter(function (s) { return s.anchor === activeGuideAnchor.value; })[0] || guideSections[0] || null;
      });
      var visibleGuideSections = Vue.computed(function () {
        return currentGuideSection.value ? [currentGuideSection.value] : [];
      });

      // 切换式下没法一路往下读，正文底部给一组前后翻页（跨分组按目录顺序）
      var guideNav = Vue.computed(function () {
        var idx = guideSections.indexOf(currentGuideSection.value);
        return {
          prev: idx > 0 ? guideSections[idx - 1] : null,
          next: (idx > -1 && idx < guideSections.length - 1) ? guideSections[idx + 1] : null,
        };
      });

      // 当前小节所在的分组，用于收起时把分组标题标成选中色
      var activeGuideGroupId = Vue.computed(function () {
        return currentGuideSection.value ? currentGuideSection.value.groupId : '';
      });

      // 点目录：直接切换正文，不再整页平铺靠滚动定位。
      // 若用户已经滚过正文顶部，切完把正文区带回视野，免得看到半截内容。
      var guideScrollHost = null;
      function selectGuideSection(anchor) {
        if (!anchor || activeGuideAnchor.value === anchor) { return; }
        activeGuideAnchor.value = anchor;
        Vue.nextTick(function () {
          var host = guideScrollHost || document.querySelector('.eva-content');
          var grid = document.querySelector('.eva-guide-grid');
          if (!host || !grid) { return; }
          var top = grid.getBoundingClientRect().top - host.getBoundingClientRect().top + host.scrollTop - 8;
          if (host.scrollTop > top) { host.scrollTop = Math.max(0, top); }
        });
      }
      Vue.onMounted(function () { guideScrollHost = document.querySelector('.eva-content'); });
      Vue.onBeforeUnmount(function () { guideScrollHost = null; });

      // 支持用锚点链接直接打开指南并切到对应小节（例如 #eva-guide-fields-field-basic）。
      var guideHash = String(window.location.hash || '');
      if (guideHash.indexOf('#eva-guide-') === 0) {
        var hashAnchor = guideHash.slice(1);
        active.value = 'eva-guide';
        activeTab.value = 'eva-guide';
        if (!tabs.find(function (tab) { return tab.id === 'eva-guide'; })) {
          tabs.push({ id: 'eva-guide', label: 'EVA框架使用指南', icon: 'ri-book-open-line', closable: true });
        }
        if (guideSections.some(function (s) { return s.anchor === hashAnchor; })) {
          activeGuideAnchor.value = hashAnchor;
        }
      }
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
      // 图像选择演示页的字段代码预览：悬停显示，点击后固定。
      var fieldCodeOpen = Vue.ref('');
      // 只有真正的整页型内容才移除表单卡片。混合页面中的 html 字段通常只是
      // 分组说明，不能因此把整页切换成 flush，否则字段标题、间距和栅格都会被压平。
      var isFlush = Vue.computed(function () {
        var s = currentSection.value;
        var fields = (s && Array.isArray(s.fields)) ? s.fields : [];
        if (!fields.length) { return false; }
        if (fields.some(function (f) { return f.type === 'theme_backup' || f.type === 'builder'; })) { return true; }
        return fields.length === 1 && fields[0].type === 'html';
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

      // 功能：判断字段是否包含可显示的 HTML 辅助内容。
      function Field_Has_Html(value) {
        return value !== null && value !== undefined && String(value) !== '';
      }

      // 功能：读取字段级错误信息。
      function Field_Error(f) {
        if (!f || !f.id) { return ''; }
        return fieldErrors[f.id] || f._error || '';
      }

      // 功能：清除指定字段的错误提示。
      function Clear_Field_Error(id) {
        if (id && fieldErrors[id]) {
          delete fieldErrors[id];
        }
      }

      // 功能：清空全部字段错误。
      function Clear_Field_Errors() {
        Object.keys(fieldErrors).forEach(function (key) { delete fieldErrors[key]; });
      }

      // 功能：保存失败时跳转到第一个字段错误。
      function Focus_First_Field_Error(errors) {
        var keys = Object.keys(errors || {});
        if (!keys.length) { return; }
        Vue.nextTick(function () {
          var el = document.querySelector('[data-eva-field-id="' + keys[0] + '"]');
          if (el && el.scrollIntoView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }

      // 功能：按逗号字符串或数组生成依赖比较集合。
      function Dependency_List(value) {
        if (Array.isArray(value)) { return value; }
        if (value === null || value === undefined) { return []; }
        return String(value).split(',').map(function (item) { return item.trim(); });
      }

      // 功能：把依赖值转成布尔值，兼容 CSF 的 true/false 字符串。
      function Dependency_Bool(value) {
        if (value === true || value === 'true' || value === 1 || value === '1') { return true; }
        if (value === false || value === 'false' || value === 0 || value === '0' || value === null || value === undefined || value === '') { return false; }
        return null;
      }

      // 功能：归一化依赖等值比较时的实际值。
      function Dependency_Compare_Value(value) {
        var bool = Dependency_Bool(value);
        if (bool !== null) { return bool ? 'true' : 'false'; }
        if (Array.isArray(value)) { return value.map(Dependency_Compare_Value).join(','); }
        if (value && typeof value === 'object') { return JSON.stringify(value); }
        return String(value);
      }

      // 功能：判断依赖值是否为空。
      function Dependency_Is_Empty(value) {
        return value === null || value === undefined || value === '' || value === false || (Array.isArray(value) && !value.length);
      }

      // 功能：读取对象中的点号路径值。
      function Dependency_Path_Value(source, path) {
        if (!path || path === '__value') { return source; }
        var current = source;
        String(path).split('.').forEach(function (part) {
          if (current === null || current === undefined || part === '') { current = undefined; return; }
          current = current[part];
        });
        return current;
      }

      // 功能：读取依赖规则对应的数据源值。
      function Dependency_Source_Value(rule) {
        if (!rule) { return undefined; }
        var source = rule.source || 'field';
        if (source === 'option' || source === 'site_option') {
          var group = dependencySources[source] || {};
          var optionValues = group[rule.option] || {};
          if (rule.key && Object.prototype.hasOwnProperty.call(optionValues, rule.key)) {
            return optionValues[rule.key];
          }
          return Dependency_Path_Value(optionValues.__value, rule.key || '__value');
        }
        return model[rule.id];
      }

      // 功能：判断实际值是否命中依赖期望集合。
      function Dependency_Contains_Any(actual, expected) {
        var actuals = Dependency_List(actual).map(Dependency_Compare_Value);
        var expects = Dependency_List(expected).map(Dependency_Compare_Value);
        return expects.some(function (item) { return actuals.indexOf(item) !== -1; });
      }

      // 功能：执行单条依赖规则比较。
      function Dependency_Match_Rule(rule) {
        if (!rule) { return true; }
        var actual = Dependency_Source_Value(rule);
        var expected = rule.value;
        var operator = rule.operator || '==';

        if (operator === 'empty') { return Dependency_Is_Empty(actual); }
        if (operator === 'not_empty' || operator === 'not-empty') { return !Dependency_Is_Empty(actual); }
        if (operator === 'truthy') { return Dependency_Bool(actual) === true; }
        if (operator === 'falsy') { return Dependency_Bool(actual) === false; }

        if (operator === 'any' || operator === 'in' || operator === 'contains') {
          return Dependency_Contains_Any(actual, expected);
        }
        if (operator === 'not_any' || operator === 'not-any' || operator === 'not_in' || operator === 'not-in' || operator === 'not_contains') {
          return !Dependency_Contains_Any(actual, expected);
        }

        if (operator === '>' || operator === '>=' || operator === '<' || operator === '<=') {
          var left = Number(actual);
          var right = Number(expected);
          if (Number.isNaN(left)) { left = 0; }
          if (Number.isNaN(right)) { right = 0; }
          if (operator === '>') { return left > right; }
          if (operator === '>=') { return left >= right; }
          if (operator === '<') { return left < right; }
          return left <= right;
        }

        if (operator === '!=') {
          return Dependency_Compare_Value(actual) !== Dependency_Compare_Value(expected);
        }
        return Dependency_Compare_Value(actual) === Dependency_Compare_Value(expected);
      }

      // 功能：执行一个依赖规则组，relation=or/any 时任一满足即可。
      function Dependency_Match_Group(group) {
        var rules = (group && Array.isArray(group.rules)) ? group.rules : [];
        if (!rules.length) { return true; }
        var relation = group.relation || 'and';
        if (relation === 'or' || relation === 'any') {
          return rules.some(Dependency_Match_Rule);
        }
        return rules.every(Dependency_Match_Rule);
      }

      // 功能：计算字段当前依赖状态。
      function Field_State(f) {
        var dependency = (f && f.eva_dependency) ? f.eva_dependency : {};
        var visible = dependency.visible || null;
        var visibleMatched = visible ? Dependency_Match_Group(visible) : true;
        var visibleAction = visible ? (visible.action || 'hide') : 'hide';
        var disabledMatched = dependency.disabled ? Dependency_Match_Group(dependency.disabled) : false;
        var readonlyMatched = dependency.readonly ? Dependency_Match_Group(dependency.readonly) : false;

        return {
          hidden: !!(visible && !visibleMatched && visibleAction === 'hide'),
          muted: !!(visible && !visibleMatched && visibleAction === 'visible'),
          disabled: !!(disabledMatched || (visible && !visibleMatched && visibleAction === 'disabled')),
          readonly: !!(readonlyMatched || (visible && !visibleMatched && visibleAction === 'readonly')),
        };
      }

      // 功能：判断字段行是否显示。
      function Field_Row_Show(f) {
        return !Field_State(f).hidden;
      }

      // 功能：过滤出当前可显示字段，供 transition-group 做进入/离开动画。
      function Visible_Fields(fields) {
        return (fields || []).filter(Field_Row_Show);
      }

      // 功能：生成字段行 class，加入依赖状态样式。
      function Field_Row_Class(f) {
        var state = Field_State(f);
        return [
          fieldCol(f),
          f && f.class ? f.class : '',
          {
            'is-dependency-muted': state.muted,
            'is-dependency-disabled': state.disabled,
            'is-dependency-readonly': state.readonly,
            'has-error': !!Field_Error(f),
          }
        ];
      }

      // 功能：为字段组件合并依赖产生的 disabled/readonly 状态。
      function Field_For_Render(f) {
        var state = Field_State(f);
        if (!state.disabled && !state.readonly) { return f; }
        return Object.assign({}, f, {
          disabled: state.disabled || f.disabled,
          readonly: state.readonly || f.readonly,
        });
      }

      // 功能：仅在图像选择演示页显示字段代码入口。
      function Show_Field_Code(f) {
        return !!(currentSection.value && currentSection.value.id === 'field-image-select' && f && f.id);
      }

      function Field_Code_String(value, depth, key) {
        var indent = new Array(depth + 1).join('  ');
        var childIndent = new Array(depth + 2).join('  ');
        if (value === null) { return 'null'; }
        if (typeof value === 'boolean') { return value ? 'true' : 'false'; }
        if (typeof value === 'number') { return String(value); }
        if (typeof value === 'string') {
          // 图像选择的 data URI 很长，代码预览保留语义但避免撑爆浮层。
          var text = value;
          if (key === 'url' && text.indexOf('data:image/') === 0) { text = '[preview image]'; }
          if (text.length > 180) { text = text.slice(0, 177) + '…'; }
          return "'" + text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'";
        }
        if (Array.isArray(value)) {
          if (!value.length) { return '[]'; }
          return '[\n' + value.map(function (item) {
            return childIndent + Field_Code_String(item, depth + 1, key);
          }).join(',\n') + '\n' + indent + ']';
        }
        if (typeof value === 'object') {
          var keys = Object.keys(value);
          if (!keys.length) { return '[]'; }
          return '[\n' + keys.map(function (itemKey) {
            return childIndent + "'" + itemKey.replace(/'/g, "\\'") + "' => " + Field_Code_String(value[itemKey], depth + 1, itemKey);
          }).join(',\n') + '\n' + indent + ']';
        }
        return "'" + String(value) + "'";
      }

      // 功能：把字段 schema 格式化为可直接参考的 PHP 数组片段。
      function Field_Code(f) {
        if (!f) { return ''; }
        var keys = Object.keys(f).filter(function (key) { return key.charAt(0) !== '_' && typeof f[key] !== 'function'; });
        return '[\n' + keys.map(function (key) {
          return "  '" + key.replace(/'/g, "\\'") + "' => " + Field_Code_String(f[key], 1, key);
        }).join(',\n') + '\n]';
      }

      function Toggle_Field_Code(id) {
        fieldCodeOpen.value = fieldCodeOpen.value === id ? '' : id;
      }

      function Copy_Field_Code(f) {
        var code = Field_Code(f);
        if (navigator.clipboard && code) { navigator.clipboard.writeText(code); }
      }

      var dependencyGsapPromise = null;
      // 功能：按需加载 GSAP，依赖动画优先使用它，失败时交给 CSS 兜底。
      function Ensure_Dependency_Gsap() {
        if (window.gsap) { return Promise.resolve(window.gsap); }
        if (dependencyGsapPromise) { return dependencyGsapPromise; }
        dependencyGsapPromise = new Promise(function (resolve, reject) {
          var script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';
          script.async = true;
          script.onload = function () { resolve(window.gsap); };
          script.onerror = function () { reject(new Error('GSAP load failed')); };
          document.head.appendChild(script);
        });
        return dependencyGsapPromise;
      }

      // 功能：清理依赖动画写入的内联样式，避免跳过动画时内容残留透明状态。
      function Clear_Dependency_Animation_Styles(el) {
        el.style.opacity = '';
        el.style.visibility = '';
        el.style.transform = '';
      }

      // 功能：依赖字段进入前设置初始状态，避免首帧闪烁。
      function Dependency_Before_Enter(el) {
        if (suppressDependencyAnimation.value) {
          Clear_Dependency_Animation_Styles(el);
          return;
        }
        el.style.opacity = '0';
        el.style.transform = 'translateY(-8px) scale(0.985)';
      }

      // 功能：依赖字段显示时执行展开动画。
      function Dependency_Enter(el, done) {
        if (suppressDependencyAnimation.value) {
          Clear_Dependency_Animation_Styles(el);
          done();
          return;
        }
        Ensure_Dependency_Gsap().then(function (gsap) {
          gsap.killTweensOf(el);
          gsap.fromTo(el, {
            autoAlpha: 0,
            y: -8,
            scale: 0.985,
          }, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.24,
            ease: 'power2.out',
            clearProps: 'all',
            onComplete: done,
          });
        }).catch(function () {
          el.classList.add('eva-dependency-css-enter');
          window.requestAnimationFrame(function () {
            el.classList.add('is-active');
            window.setTimeout(function () {
              el.classList.remove('eva-dependency-css-enter', 'is-active');
              done();
            }, 260);
          });
        });
      }

      // 功能：依赖字段隐藏时执行收起动画。
      function Dependency_Leave(el, done) {
        if (window.gsap) { window.gsap.killTweensOf(el); }
        Clear_Dependency_Animation_Styles(el);
        done();
      }

      var saving = Vue.ref(false);
      var saveMsg = Vue.ref('');
      // 保存设置页字段：通过 admin-ajax 调用 Data::ajax_save，后端按 schema 清洗未知字段。
      function saveOptions() {
        if (saving.value) { return; }
        saving.value = true;
        saveMsg.value = '保存中…';
        Clear_Field_Errors();
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
          var linger = 2500;
          if (res && res.success) {
            // 后端已落库。带 errors 表示这几个字段没过校验、值被还原成了库里的旧值，
            // 其余字段正常保存（与 CSF 的逐字段回滚同语义），所以走的是成功分支。
            var invalid = (res.data && res.data.errors) ? res.data.errors : null;
            var invalidCount = invalid ? Object.keys(invalid).length : 0;
            if (res.data && res.data.values) { Object.assign(model, res.data.values); }
            savedSnapshot.value = JSON.stringify(model);
            if (invalidCount) {
              Object.assign(fieldErrors, invalid);
              Focus_First_Field_Error(invalid);
              saveMsg.value = '已保存（' + invalidCount + ' 项有误，已还原）';
              linger = 4500;
            } else {
              saveMsg.value = '已保存';
            }
          } else {
            // 整次请求不成立：nonce 失效、无权限、设置页不存在等。
            saveMsg.value = (res && res.data && res.data.msg) ? ('保存失败: ' + res.data.msg) : '保存失败';
          }
          setTimeout(function () { saveMsg.value = ''; }, linger);
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
        onTabsWheel: onTabsWheel,
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
        fieldCodeOpen: fieldCodeOpen,
        iconfontUrl: iconfontUrl,
        iconfontProjects: iconfontProjects,
        activeIconfontProject: activeIconfontProject,
        iconfontMsg: iconfontMsg,
        selectIconfontProject: selectIconfontProject,
        addIconfontProject: addIconfontProject,
        removeIconfontProject: removeIconfontProject,
        saveIconfontUrl: saveIconfontUrl,
        accents: accents,
        accent: accent,
        setAccent: setAccent,
        fontOptions: fontOptions,
        uiFont: uiFont,
        setFont: setFont,
        isAdmin: isAdmin,
        guideVisible: guideVisible,
        openGuide: openGuide,
        toggleGuide: toggleGuide,
        floatingEnabled: floatingEnabled,
        toggleFloating: toggleFloating,
        guide: guide,
        visibleGuideSections: visibleGuideSections,
        guideNav: guideNav,
        guideOutline: guideOutline,
        activeGuideAnchor: activeGuideAnchor,
        activeGuideGroupId: activeGuideGroupId,
        isGuideGroupOpen: isGuideGroupOpen,
        toggleGuideGroup: toggleGuideGroup,
        selectGuideSection: selectGuideSection,
        copyGuideCode: copyGuideCode,
        sections: sections,
        ui: ui,
        // 对应 CSF 的 csf_options_before / csf_options_after：PHP 端 eva_options_before / _after 回调输出的 HTML。
        beforeHtml: cfg.beforeHtml || '',
        afterHtml: cfg.afterHtml || '',
        model: model,
        fieldErrors: fieldErrors,
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
        Field_Row_Show: Field_Row_Show,
        Visible_Fields: Visible_Fields,
        Field_Row_Class: Field_Row_Class,
        Field_For_Render: Field_For_Render,
        Show_Field_Code: Show_Field_Code,
        Field_Code: Field_Code,
        Toggle_Field_Code: Toggle_Field_Code,
        Copy_Field_Code: Copy_Field_Code,
        Field_Has_Html: Field_Has_Html,
        Field_Error: Field_Error,
        Clear_Field_Error: Clear_Field_Error,
        Dependency_Before_Enter: Dependency_Before_Enter,
        Dependency_Enter: Dependency_Enter,
        Dependency_Leave: Dependency_Leave,
      };
    },
    template: [
      '<div class="eva-admin" :class="[{ \'eva-dark\': dark, \'is-collapsed\': sidebarCollapsed, \'eva-font-jingnan\': uiFont === \'jingnan\' }, ui.rootClass || \'\']">',
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
      '    <div class="eva-sidebar-save">',
      '      <div class="eva-savedock" v-show="isDirty || saveMsg">',
      '        <button type="button" class="eva-savefab" :disabled="saving || !isDirty" @click="saveOptions"><i class="ri-save-3-line"></i><span>{{ saveMsg || t(\'save\') }}</span></button>',
      '        <div v-if="ui.resetSection !== false || ui.resetAll !== false" class="eva-reset-wrap" @mouseleave="resetOpen = false">',
      '          <button type="button" class="eva-reset-btn" :disabled="saving" :title="t(\'restore_default\')" @click="resetOpen = !resetOpen"><i class="ri-arrow-go-back-line"></i></button>',
      '          <div class="eva-reset-menu" v-show="resetOpen">',
      '            <button v-if="ui.resetSection !== false" type="button" class="eva-reset-item" @click="resetSection">{{ t(\'reset_section\') }}</button>',
      '            <button v-if="ui.resetAll !== false" type="button" class="eva-reset-item" @click="resetAll">{{ t(\'reset_all\') }}</button>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </aside>',
      '  <div class="eva-main">',
      '    <header class="eva-header">',
      '      <div class="eva-header-titles">',
      '        <span class="eva-eyebrow">Admin Console</span>',
      '        <span class="eva-h-title">{{ currentTitle }}</span>',
      '      </div>',
      '      <div class="eva-header-right">',
      '        <button v-if="ui.search !== false" class="eva-hbtn" :title="t(\'search_tip\')" @click="openSearch"><i class="ri-search-line"></i></button>',
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
      '      <div class="eva-tabs" @wheel="onTabsWheel">',
      '        <div v-for="tab in tabs" :key="tab.id" class="eva-tab"',
      '             :class="{ \'is-active\': tab.id === activeTab }" @click="selectTab(tab.id)">',
      '          <eva-icon class="eva-tab-ico" :icon="tab.icon"></eva-icon>',
      '          <span>{{ tv(tab.label) }}</span>',
      '          <button v-if="tab.closable" type="button" class="eva-tab-close ri-close-line" :title="t(\'close\')" :aria-label="t(\'close\')" @click.stop="closeTab(tab.id)"></button>',
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
      '        <div class="eva-guide-grid">',
      '          <nav class="eva-guide-outline" aria-label="指南目录">',
      '            <div v-for="g in guideOutline" :key="g.id" class="eva-guide-outline-group" :class="{ \'is-open\': isGuideGroupOpen(g.id) }">',
      '              <button type="button" class="eva-guide-outline-head" :class="{ \'is-current\': !isGuideGroupOpen(g.id) && activeGuideGroupId === g.id }" :aria-expanded="isGuideGroupOpen(g.id) ? \'true\' : \'false\'" @click="toggleGuideGroup(g.id)">',
      '                <i :class="g.icon"></i><span>{{ g.label }}</span><em class="ri-arrow-down-s-line"></em>',
      '              </button>',
      '              <div v-show="isGuideGroupOpen(g.id)" class="eva-guide-outline-body">',
      '                <a v-for="item in g.items" :key="item.key" :href="\'#\' + item.anchor" class="eva-guide-outline-link" :class="{ \'is-active\': activeGuideAnchor === item.anchor }" @click.prevent="selectGuideSection(item.anchor)"><i :class="item.icon"></i><span>{{ tv(item.label) }}</span></a>',
      '                <div v-if="g.menus.length" class="eva-guide-outline-menus">',
      '                  <button v-for="item in g.menus" :key="item.key" type="button" class="eva-guide-outline-link is-menu" @click="openMenu(item.menuId)"><i :class="item.icon"></i><span>{{ tv(item.label) }}</span><em class="ri-arrow-right-up-line"></em></button>',
      '                </div>',
      '              </div>',
      '            </div>',
      '          </nav>',
      '          <div class="eva-guide-docs" :key="activeGuideAnchor">',
      '            <template v-for="s in visibleGuideSections" :key="s.anchor">',
      '              <div class="eva-guide-part"><i :class="s.groupIcon"></i><strong>{{ s.groupLabel }}</strong><span>{{ s.groupDesc }}</span></div>',
      '              <section :id="s.anchor" class="eva-guide-card" :class="{ \'is-quick\': s.steps, \'is-framework\': s.cards }">',
      '                <div class="eva-guide-card-head">',
      '                  <h2><i :class="s.icon"></i><span>{{ s.title }}</span></h2>',
      '                  <button v-if="s.code" type="button" class="eva-guide-copy" @click="copyGuideCode(s.code)"><i class="ri-file-copy-line"></i>复制代码</button>',
      '                </div>',
      '                <p>{{ s.desc }}</p>',
      '                <figure v-if="s.diagram" class="eva-guide-diagram"><div class="eva-guide-diagram-art" v-html="s.diagram"></div><figcaption v-if="s.diagramCaption">{{ s.diagramCaption }}</figcaption></figure>',
      '                <div v-if="s.cards" class="eva-guide-fw-cards"><div v-for="card in s.cards" :key="card.title" class="eva-guide-fw-card"><i :class="card.icon"></i><div class="eva-guide-fw-card-body"><div class="eva-guide-fw-card-head"><strong>{{ card.title }}</strong><code v-if="card.api">{{ card.api }}</code></div><span>{{ card.desc }}</span></div></div></div>',
      '                <div v-if="s.flow" class="eva-guide-fw-flow"><div v-for="(item, fi) in s.flow" :key="item" class="eva-guide-fw-step"><em>{{ String(fi + 1).padStart(2, \'0\') }}</em><span>{{ item }}</span></div></div>',
      '                <ol v-if="s.steps" class="eva-guide-steps"><li v-for="(step, si) in s.steps" :key="si">{{ step }}</li></ol>',
      '                <pre v-if="s.code" class="eva-guide-code"><code>{{ s.code }}</code></pre>',
      '                <div v-if="s.codeBlocks" class="eva-guide-codeblocks">',
      '                  <div v-for="(block, bi) in s.codeBlocks" :key="bi" class="eva-guide-codeblock">',
      '                    <div class="eva-guide-codebar"><strong>{{ block.title }}</strong><button type="button" class="eva-guide-copy" @click="copyGuideCode(block.code)"><i class="ri-file-copy-line"></i>复制代码</button></div>',
      '                    <pre class="eva-guide-code"><code>{{ block.code }}</code></pre>',
      '                  </div>',
      '                </div>',
      '                <div v-if="s.tables" class="eva-guide-tables">',
      '                  <div v-for="(tb, ti) in s.tables" :key="ti" class="eva-guide-table-wrap">',
      '                    <strong v-if="tb.title" class="eva-guide-table-title">{{ tb.title }}</strong>',
      '                    <div class="eva-guide-table-scroll">',
      '                      <table class="eva-guide-table">',
      '                        <thead><tr><th v-for="col in tb.columns" :key="col">{{ col }}</th></tr></thead>',
      '                        <tbody><tr v-for="(row, ri) in tb.rows" :key="ri"><td v-for="(cell, ci) in row" :key="ci" v-html="cell"></td></tr></tbody>',
      '                      </table>',
      '                    </div>',
      '                  </div>',
      '                </div>',
      '                <div v-if="s.notes" class="eva-guide-notes"><div v-for="note in s.notes" :key="note.title" class="eva-guide-note"><strong>{{ note.title }}</strong><span>{{ note.text }}</span></div></div>',
      '              </section>',
      '            </template>',
      '            <nav v-if="guideNav.prev || guideNav.next" class="eva-guide-pager">',
      '              <button v-if="guideNav.prev" type="button" class="eva-guide-pager-btn" @click="selectGuideSection(guideNav.prev.anchor)"><i class="ri-arrow-left-s-line"></i><span><em>上一节</em><strong>{{ guideNav.prev.title }}</strong></span></button>',
      '              <button v-if="guideNav.next" type="button" class="eva-guide-pager-btn is-next" @click="selectGuideSection(guideNav.next.anchor)"><span><em>下一节</em><strong>{{ guideNav.next.title }}</strong></span><i class="ri-arrow-right-s-line"></i></button>',
      '            </nav>',
      '          </div>',
      '          <aside class="eva-guide-side">',
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
      '        <div v-if="beforeHtml" class="eva-form-before" v-html="beforeHtml"></div>',
      '        <transition-group name="eva-dependency" tag="div" class="eva-form-card" @before-enter="Dependency_Before_Enter" @enter="Dependency_Enter" @leave="Dependency_Leave">',
      '          <div v-for="f in Visible_Fields(currentSection.fields)" :key="f.id" class="eva-field-row" :class="Field_Row_Class(f)" :data-eva-field-id="f.id">',
      '            <div v-if="Show_Field_Code(f)" class="eva-field-code" :class="{ \'is-open\': fieldCodeOpen === f.id }">',
      '              <button type="button" class="eva-field-code-trigger" :aria-label="\'查看\' + tv(f.title) + \'代码\'" @click.stop="Toggle_Field_Code(f.id)"><i class="ri-code-s-slash-line"></i></button>',
      '              <div class="eva-field-code-popover" :class="{ \'is-pinned\': fieldCodeOpen === f.id }" @click.stop>',
      '                <div class="eva-field-code-head"><strong>字段配置</strong><button type="button" @click="Copy_Field_Code(f)"><i class="ri-file-copy-line"></i>复制</button></div>',
      '                <pre><code>{{ Field_Code(f) }}</code></pre>',
      '              </div>',
      '            </div>',
      '            <div class="eva-field-meta"><span class="eva-field-title">{{ tv(f.title) }}<span v-if="tv(f.help)" class="eva-field-help" tabindex="0"><i class="ri-question-line"></i><em>{{ tv(f.help) }}</em></span></span><span v-if="tv(f.subtitle)" class="eva-field-subtitle" v-html="tv(f.subtitle)"></span><span v-if="tv(f.desc)" class="eva-field-desc" v-html="tv(f.desc)"></span></div>',
      '            <div v-if="Field_Has_Html(f.before)" class="eva-field-before" v-html="f.before"></div>',
      '            <div v-if="Field_Has_Html(f.content)" class="eva-field-content" v-html="f.content"></div>',
      '            <div class="eva-field-control"><eva-field :field="Field_For_Render(f)" v-model="model[f.id]" @update:model-value="Clear_Field_Error(f.id)"></eva-field></div>',
      '            <div v-if="Field_Has_Html(f.after)" class="eva-field-after" v-html="f.after"></div>',
      '            <div v-if="Field_Error(f)" class="eva-field-error"><i class="ri-error-warning-line"></i><span>{{ Field_Error(f) }}</span></div>',
      '          </div>',
      '        </transition-group>',
      '        <div v-if="afterHtml" class="eva-form-after" v-html="afterHtml"></div>',
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
      '        <p class="eva-set-title">{{ t(\'icon_library\') }}</p>',
      '        <div class="eva-set-row eva-set-row--stack">',
      '          <div class="eva-set-label"><i class="ri-symbol"></i><span>{{ t(\'iconfont_svg\') }}</span></div>',
      '          <div class="eva-iconfont-tabs">',
      '            <button v-for="(url, index) in iconfontProjects" :key="index" type="button" class="eva-iconfont-tab" :class="{ \'is-active\': activeIconfontProject === index }" @click="selectIconfontProject(index)">',
      '              <i class="ri-links-line"></i><span>{{ t(\'iconfont_project\') }} {{ index + 1 }}</span>',
      '              <i v-if="iconfontProjects.length > 1" class="ri-close-line eva-iconfont-remove" @click.stop="removeIconfontProject(index)"></i>',
      '            </button>',
      '            <button type="button" class="eva-iconfont-add" :title="t(\'iconfont_add_project\')" @click="addIconfontProject"><i class="ri-add-line"></i></button>',
      '          </div>',
      '          <div class="eva-set-input-row">',
      '            <input class="eva-set-input" v-model="iconfontProjects[activeIconfontProject]" type="url" :placeholder="t(\'iconfont_placeholder\')">',
      '            <button type="button" class="eva-set-mini-btn" @click="saveIconfontUrl">{{ t(\'load\') }}</button>',
      '          </div>',
      '          <p class="eva-set-hint">{{ iconfontMsg || t(\'iconfont_hint\') }}</p>',
      '        </div>',
      '      </div>',
      '      <div class="eva-set-section">',
      '        <p class="eva-set-title">{{ t(\'theme_color\') }}</p>',
      '        <div class="eva-accents">',
      '          <button v-for="a in accents" :key="a.key" type="button" class="eva-accent" :class="{ \'is-active\': accent === a.key }" :style="{ background: a.color }" :title="a.label" @click="setAccent(a)"></button>',
      '        </div>',
      '        <div class="eva-font-setting">',
      '          <p class="eva-set-subtitle">{{ t(\'interface_font\') }}</p>',
      '          <div class="eva-font-options" role="radiogroup" :aria-label="t(\'interface_font\')">',
      '            <button v-for="font in fontOptions" :key="font.key" type="button" class="eva-font-option" :class="{ \'is-active\': uiFont === font.key, \'is-jingnan\': font.key === \'jingnan\' }" role="radio" :aria-checked="uiFont === font.key ? \'true\' : \'false\'" @click="setFont(font)">',
      '              <i :class="font.icon"></i><span>{{ t(font.labelKey) }}</span>',
      '            </button>',
      '          </div>',
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
    // 另：CSF 时代的主题习惯把 symbol id 直接写成 'icon-xxx'（不带 #），这里按 Libs/Icon-picker 的口径
    // 判断——页面里确实有同名 <symbol> 才当 symbol 渲染，否则仍按图标字体 class 处理，不会误伤 .icon-xxx 字体。
    app.component('eva-icon', {
      inheritAttrs: false,
      props: { icon: { type: String, default: '' } },
      data: function () { return { symbolTick: 0 }; },
      mounted: function () { window.addEventListener('eva:iconfont-loaded', this.On_Iconfont_Loaded); },
      beforeUnmount: function () { window.removeEventListener('eva:iconfont-loaded', this.On_Iconfont_Loaded); },
      methods: {
        // iconfont.js 是异步注入的，晚到时重算一次 kind，否则图标会一直停在 class 形态。
        On_Iconfont_Loaded: function () { this.symbolTick++; }
      },
      computed: {
        kind: function () {
          var s = (this.icon || '').trim();
          if (!s) { return 'empty'; }
          if (s.charAt(0) === '#') { return 'symbol'; }
          if (s.slice(0, 4) === '<svg') { return 'raw'; }
          if (/^https?:\/\//i.test(s) || s.charAt(0) === '/' || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(s)) { return 'img'; }
          this.symbolTick; // 读一下建立响应依赖：iconfont.js 晚到时触发重算
          if (/^[A-Za-z][\w-]*$/.test(s)) {
            var node = document.getElementById(s);
            if (node && String(node.tagName).toLowerCase() === 'symbol') { return 'symbol'; }
          }
          return 'class';
        },
        symbolHref: function () {
          var s = (this.icon || '').trim();
          return s.charAt(0) === '#' ? s : '#' + s;
        }
      },
      template:
        '<i v-if="kind===\'class\'" :class="icon" v-bind="$attrs"></i>' +
        '<svg v-else-if="kind===\'symbol\'" class="eva-svg-ico" aria-hidden="true" v-bind="$attrs"><use :xlink:href="symbolHref"></use></svg>' +
        '<img v-else-if="kind===\'img\'" class="eva-img-ico" :src="icon" alt="" v-bind="$attrs">' +
        '<span v-else-if="kind===\'raw\'" class="eva-svg-ico" v-html="icon" v-bind="$attrs"></span>' +
        '<i v-else v-bind="$attrs"></i>'
    });

    // 注册 UI 库组件（Libs/）：供字段模板使用，如 <eva-select>
    // 注：eva-modal / eva-drawer 等其余库目前是骨架，实现后在此各加一行 app.component 注册即可。
    if (window.EvaUI && window.EvaUI.Select) {
      app.component('eva-select', window.EvaUI.Select);
    }
    if (window.EvaUI && window.EvaUI.Color) {
      app.component('eva-color', window.EvaUI.Color);
    }
    if (window.EvaUI && window.EvaUI.IconPicker) {
      app.component('eva-icon-picker', window.EvaUI.IconPicker);
    }
    if (window.EvaUI && window.EvaUI.Media) {
      app.component('eva-media', window.EvaUI.Media);
    }
    if (window.EvaUI && window.EvaUI.Accordion) {
      app.component('eva-accordion', window.EvaUI.Accordion);
    }
    if (window.EvaUI && window.EvaUI.DatePicker) {
      app.component('eva-datepicker', window.EvaUI.DatePicker);
    }
    if (window.EvaUI && window.EvaUI.Slider) {
      app.component('eva-slider', window.EvaUI.Slider);
    }
    if (window.EvaUI && window.EvaUI.Tabs) {
      app.component('eva-tabs', window.EvaUI.Tabs);
    }
    // 字段分发组件：按 field.type 从 window.EvaFields 注册表取对应组件渲染
    app.component('eva-field', {
      props: ['field', 'modelValue'],
      emits: ['update:modelValue'],
      computed: {
        comp: function () {
          var reg = window.EvaFields || {};
          var type = this.field && this.field.type;
          var selectAliases = ['ajax_select', 'post_selector', 'post', 'term_selector', 'term', 'taxonomy', 'user_selector', 'user', 'relationship', 'nav_menu', 'menu', 'sidebar', 'sidebars'];
          if (type === 'content') { type = 'html'; }
          if (type === 'sortable') { type = 'sorter'; }
          if (type === 'editor') { type = 'wp_editor'; }
          // CSF 类型名：后端归一化分区时已经换过，这里兜底 Builder 模块等不经过后端归一化的字段。
          if (type === 'fieldset') { type = 'group'; }
          if (type === 'backup') { type = 'theme_backup'; }
          if (selectAliases.indexOf(type) !== -1) { type = 'select'; }
          return reg[type] || reg.text || null;
        }
      },
      template: '<component v-if="comp" :is="comp" :field="field" :model-value="modelValue" @update:model-value="$emit(\'update:modelValue\', $event)"></component>'
    });
    // 最后挂载主应用。字段脚本和 UI 库必须在此之前已被 WordPress enqueue。
    app.mount('#eva-app');
  }
})();
