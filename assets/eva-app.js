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
      var managementMenu = Array.isArray(cfg.managementMenu) ? cfg.managementMenu : [];

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
        if (id === 'eva-guide') { return true; }
        return !!findMenuItem(id);
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
      var sidebarMode = Vue.ref(savedWorkspace.sidebarMode === 'management' && managementMenu.length ? 'management' : 'settings');
      function toggleSidebarMode() { sidebarMode.value = sidebarMode.value === 'settings' ? 'management' : 'settings'; }
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
      // Caption groups start open and then reuse the saved per-group fold state.
      menu.forEach(function (item) {
        if (item.menu_style === 'heading' && item.children && item.children.length && !Object.prototype.hasOwnProperty.call(openMenus, item.id)) {
          openMenus[item.id] = true;
        }
      });
      // 指南左栏目录的分组折叠状态，key 为分组 id；没记录过的一律算展开。
      var openGuideGroups = Vue.reactive(savedWorkspace.guideGroups && typeof savedWorkspace.guideGroups === 'object' ? savedWorkspace.guideGroups : {});
      function persistWorkspaceState() {
        try {
          window.sessionStorage.setItem(workspaceStorageKey, JSON.stringify({
            active: active.value,
            activeTab: activeTab.value,
            tabs: tabs.map(function (tab) { return tab.id; }),
            openMenus: Object.assign({}, openMenus),
            guideGroups: Object.assign({}, openGuideGroups),
            sidebarMode: sidebarMode.value
          }));
        } catch (e) {}
      }
      Vue.watch([
        active,
        activeTab,
        sidebarMode,
        function () { return tabs.map(function (tab) { return tab.id; }); },
        function () { return Object.assign({}, openMenus); },
        function () { return Object.assign({}, openGuideGroups); }
      ], persistWorkspaceState, { deep: true });

      // 搜索命令面板（右上角按钮 / Ctrl+K 弹出）：检索一级与二级菜单，仅列可跳转的叶子页
      var searchOpen = Vue.ref(false);
      var searchQuery = Vue.ref('');
      var accordionSearchTarget = Vue.ref(null);
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
            // 手风琴子字段保留完整路径，搜索结果可直接打开所属面板。
            function walkAccordion(field, value, path, parent) {
              if (field.type !== 'accordion' || field.disabled) { return; }
              var values = {};
              (field.sections || []).forEach(function (panel, index) {
                var id = panel.id != null && panel.id !== '' ? String(panel.id) : String(panel.key != null ? panel.key : index);
                var children = Object.assign({}, (value || {})[id] || {});
                (panel.fields || []).forEach(function (child) { if (!(child.id in children)) { children[child.id] = child.default !== undefined ? child.default : ''; } });
                values[id] = children;
              });
              (field.sections || []).forEach(function (panel, index) {
                if (panel.disabled || (panel.eva_dependency && !Dependency_Match_Group(panel.eva_dependency.visible, values))) { return; }
                var id = panel.id != null && panel.id !== '' ? String(panel.id) : String(panel.key != null ? panel.key : index);
                (panel.fields || []).forEach(function (child) {
                  if (child.disabled || (child.eva_dependency && !Dependency_Match_Group(child.eva_dependency.visible, values[id]))) { return; }
                  var childPath = path + '/' + encodeURIComponent(id) + '/' + encodeURIComponent(child.id);
                  if (hit(child.title) || hit(child.desc) || hit(panel.title)) {
                    out.push({ id: childPath, path: childPath, sectionId: s.id, label: tv(child.title) || child.id, desc: tv(child.desc) || '', icon: panel.icon || s.icon, parent: parent + ' / ' + tv(panel.title) });
                  }
                  walkAccordion(child, values[id][child.id], childPath, parent + ' / ' + tv(panel.title));
                });
              });
            }
            if (Field_Row_Show(f)) { walkAccordion(f, model[f.id], f.id, tv(f.title)); }
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
        accordionSearchTarget.value = { path: r.path || r.id, reason: 'search', token: Date.now() };
        Vue.nextTick(function () {
          if (r.path) { return; }
          var el = Array.from(document.querySelectorAll('[data-eva-field-id]')).find(function (node) { return node.dataset.evaFieldId === r.id; });
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        });
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
        if (id === 'eva-guide') { openGuide(); return; }
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
      // 与全站开关复用 EvaApi，由客户端统一发送 wp_rest nonce。
      function savePref(body, rollback) {
        var url = cfg.restActions;
        if (!url) { return; }
        window.EvaApi.action(body + '&nonce=' + encodeURIComponent(cfg.nonce || '')).then(function (res) {
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
      var settingsHost = Vue.shallowRef(null);
      function setSettingsHost(element, active) {
        if (active) { settingsHost.value = element; }
        else if (!element || settingsHost.value === element) { settingsHost.value = null; }
      }
      Vue.provide('evaShellControls', Vue.reactive({ sidebarCollapsed: sidebarCollapsed, settingsOpen: settingsOpen, toggleSidebar: toggleSidebar, toggleSettings: toggleSettings, setSettingsHost: setSettingsHost }));
      function toggleSettings() {
        settingsOpen.value = !settingsOpen.value;
      }
      function closeSettings() {
        settingsOpen.value = false;
      }

      var iconfont = window.EvaApp.iconfont(t);
      var iconfontUrl = iconfont.iconfontUrl;
      var iconfontProjects = iconfont.iconfontProjects;
      var activeIconfontProject = iconfont.activeIconfontProject;
      var iconfontMsg = iconfont.iconfontMsg;
      var selectIconfontProject = iconfont.selectIconfontProject;
      var addIconfontProject = iconfont.addIconfontProject;
      var removeIconfontProject = iconfont.removeIconfontProject;
      var saveIconfontUrl = iconfont.saveIconfontUrl;

      var appearance = window.EvaApp.appearance(cfg, savePref);
      var accents = appearance.accents;
      var accent = appearance.accent;
      var setAccent = appearance.setAccent;
      var fontOptions = appearance.fontOptions;
      var uiFont = appearance.uiFont;
      var setFont = appearance.setFont;

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
        var url = cfg.restActions;
        if (!url) return;
        var body = 'action=eva_fw_set_guide&nonce=' + encodeURIComponent(cfg.nonce || '') +
          '&visible=' + (next ? '1' : '0');
        window.EvaApi.action(body).then(function (res) {
          if (!res || !res.success) { guideVisible.value = !next; } // 保存失败回滚
        }).catch(function () { guideVisible.value = !next; });
      }

      // 后台悬浮窗开关（仅管理员，全站生效）
      var floatingEnabled = Vue.ref(cfg.floatingEnabled !== false);
      function toggleFloating() {
        if (!isAdmin) return;
        var next = !floatingEnabled.value;
        floatingEnabled.value = next; // 乐观更新
        var url = cfg.restActions;
        if (!url) return;
        var body = 'action=eva_fw_set_floating&nonce=' + encodeURIComponent(cfg.nonce || '') +
          '&enabled=' + (next ? '1' : '0');
        window.EvaApi.action(body).then(function (res) {
          if (!res || !res.success) { floatingEnabled.value = !next; } // 保存失败回滚
        }).catch(function () { floatingEnabled.value = !next; });
      }

      var guide = window.EvaApp.guideContent(boot).guide;

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
      Vue.provide('evaFormContext', { optionId: optionId, model: model, errors: fieldErrors, savedSnapshot: savedSnapshot, searchTarget: accordionSearchTarget, clearError: function (path, descendants) {
        Object.keys(fieldErrors).forEach(function (key) { if (key === path || (descendants && key.indexOf(path + '/') === 0)) { delete fieldErrors[key]; } });
      } });
      var manualSaves = Vue.shallowReactive(new Map());
      Vue.provide('evaManualSaves', manualSaves);
      var isDirty = Vue.computed(function () { return JSON.stringify(model) !== savedSnapshot.value || Array.from(manualSaves.values()).some(function (participant) { return participant.isDirty(); }); });
      // 指南正文一次性平铺全部分组，锚点 id 沿用 eva-guide-<分组>-<小节>，
      // 这样 #eva-guide-fields-field-basic 之类的老链接仍然有效。
      var guideNavigation = window.EvaApp.guideNavigation(guide, menu, openGuideGroups);
      var guideSections = guideNavigation.guideSections;
      var activeGuideAnchor = guideNavigation.activeGuideAnchor;
      var guideOutline = guideNavigation.guideOutline;
      var isGuideGroupOpen = guideNavigation.isGuideGroupOpen;
      var toggleGuideGroup = guideNavigation.toggleGuideGroup;
      var visibleGuideSections = guideNavigation.visibleGuideSections;
      var guideNav = guideNavigation.guideNav;
      var activeGuideGroupId = guideNavigation.activeGuideGroupId;
      var selectGuideSection = guideNavigation.selectGuideSection;

      // 支持用锚点链接直接打开指南并切到对应小节（例如 #eva-guide-fields-field-basic）。
      var guideHash = String(window.location.hash || '');
      if (guideHash.indexOf('#eva-guide-') === 0) {
        var hashAnchor = guideHash.slice(1);
        openGuide();
        if (guideSections.some(function (s) { return s.anchor === hashAnchor; })) {
          activeGuideAnchor.value = hashAnchor;
        }
      }
      if (active.value === 'eva-guide') { openGuide(); }
      var sectionHash = String(window.location.hash || '');
      if (sectionHash.indexOf('#eva-section-') === 0) {
        var linkedSection = sectionHash.slice('#eva-section-'.length);
        if (findMenuItem(linkedSection)) {
          openMenu(linkedSection);
          menu.forEach(function (item) {
            if ((item.children || []).some(function (child) { return child.id === linkedSection; })) { openMenus[item.id] = true; }
          });
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
      // 只有真正的整页型内容才移除表单卡片。混合页面中的 html 字段通常只是
      // 分组说明，不能因此把整页切换成 flush，否则字段标题、间距和栅格都会被压平。
      var isFlush = Vue.computed(function () {
        var s = currentSection.value;
        if (s && s.flush === true) { return true; }
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
        var currentIds = currentSection.value ? (currentSection.value.fields || []).map(function (field) { return field.id; }) : [];
        var first = keys.find(function (key) { return currentIds.indexOf(key.split('/')[0]) !== -1; }) || keys[0];
        var root = first.split('/')[0];
        var section = sections.find(function (item) { return (item.fields || []).some(function (f) { return f.id === root; }); });
        if (section) { openMenu(section.id); active.value = section.id; activeTab.value = section.id; }
        if (first.indexOf('/') !== -1) {
          accordionSearchTarget.value = { path: first, reason: 'error', token: Date.now() };
          return;
        }
        Vue.nextTick(function () {
          var el = Array.from(document.querySelectorAll('[data-eva-field-id]')).find(function (node) { return node.dataset.evaFieldId === first; });
          if (el && el.scrollIntoView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }

      var fieldDependencies = window.EvaApp.fieldDependencies(model, dependencySources, fieldCol, Field_Error);
      var Field_Row_Show = fieldDependencies.Field_Row_Show;
      var Visible_Fields = fieldDependencies.Visible_Fields;
      var Field_Row_Class = fieldDependencies.Field_Row_Class;
      var Field_For_Render = fieldDependencies.Field_For_Render;

      var fieldCode = window.EvaApp.fieldCode(currentSection);
      var fieldCodeOpen = fieldCode.fieldCodeOpen;
      var Show_Field_Code = fieldCode.Show_Field_Code;
      var Field_Code = fieldCode.Field_Code;
      var Toggle_Field_Code = fieldCode.Toggle_Field_Code;
      var Copy_Field_Code = fieldCode.Copy_Field_Code;

      var fieldMotion = window.EvaApp.fieldMotion(cfg, suppressDependencyAnimation);
      var Dependency_Before_Enter = fieldMotion.Dependency_Before_Enter;
      var Dependency_Enter = fieldMotion.Dependency_Enter;
      var Dependency_Leave = fieldMotion.Dependency_Leave;

      var optionsSave = window.EvaApp.saveOptions(cfg, optionId, model, savedSnapshot, manualSaves, fieldErrors, Clear_Field_Errors, Focus_First_Field_Error);
      var saving = optionsSave.saving;
      var saveMsg = optionsSave.saveMsg;
      var saveOptions = optionsSave.saveOptions;

      return {
        // 返回给模板的所有状态 / 方法统一集中在这里，便于审查模板依赖。
        dark: dark,
        userOpen: userOpen,
        sidebarCollapsed: sidebarCollapsed,
        brand: brand,
        adminUrl: adminUrl,
        menu: menu,
        managementMenu: managementMenu,
        sidebarMode: sidebarMode,
        toggleSidebarMode: toggleSidebarMode,
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
        settingsHost: settingsHost,
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
    template: window.EvaApp.template,
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
      emits: ['update:modelValue', 'update:global', 'update:container'],
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
      template: '<component v-if="comp" :is="comp" :field="field" :model-value="modelValue" @update:model-value="$emit(\'update:modelValue\', $event)" @update:global="$emit(\'update:global\', $event)" @update:container="$emit(\'update:container\', $event)"></component>'
    });
    // 最后挂载主应用。字段脚本和 UI 库必须在此之前已被 WordPress enqueue。
    app.mount('#eva-app');
  }
})();
