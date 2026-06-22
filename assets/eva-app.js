/* Eva Framework —— 后台管理框架外壳（Vue3 全局构建，Composition API；Remix Icon） */
(function () {
  'use strict';

  if (typeof Vue === 'undefined') {
    return;
  }

  var boot = window.EvaFW || {};
  var cfg = boot.config || {};

  var App = {
    setup: function () {
      var dark = Vue.ref(false);
      var userOpen = Vue.ref(false);
      var sidebarCollapsed = Vue.ref(false);

      var brand = cfg.brand || cfg.title || 'Eva';
      var adminUrl = boot.adminUrl || '';

      var menu = (cfg.menu && cfg.menu.length) ? cfg.menu : [
        { id: 'home', label: '后台首页', icon: 'ri-dashboard-line' },
        { id: 'posts', label: '文章管理', icon: 'ri-article-line' },
        { id: 'users', label: '用户管理', icon: 'ri-user-3-line', arrow: true },
        { id: 'media', label: '附件管理', icon: 'ri-attachment-line' },
        { id: 'comments', label: '评论管理', icon: 'ri-chat-3-line' },
        { id: 'security', label: '站点安全', icon: 'ri-shield-check-line' },
        { id: 'ext', label: '扩展模块', icon: 'ri-puzzle-2-line' },
      ];

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

      var openMenus = Vue.reactive({});

      // 搜索命令面板（右上角按钮 / Ctrl+K 弹出）：检索一级与二级菜单，仅列可跳转的叶子页
      var searchOpen = Vue.ref(false);
      var searchQuery = Vue.ref('');
      var searchInput = Vue.ref(null);
      var searchResults = Vue.computed(function () {
        var q = searchQuery.value.trim().toLowerCase();
        if (!q) { return []; }
        var hit = function (t) {
          return (t || '').toLowerCase().indexOf(q) !== -1;
        };
        var out = [];
        sections.forEach(function (s) {
          var sHit = hit(s.title);
          (s.fields || []).forEach(function (f) {
            if (sHit || hit(f.title) || hit(f.desc)) {
              out.push({ id: f.id, sectionId: s.id, label: f.title || f.id, desc: f.desc || '', icon: s.icon, parent: s.title });
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
        if (active.value === 'eva-guide') return 'EVA框架使用指南';
        var m = findMenuItem(active.value);
        return m ? m.label : '';
      });

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

      // 《EVA框架使用指南》页面内容（数据驱动，便于维护）
      var guide = {
        version: boot.version || '',
        intro: 'Eva Framework 是一套轻量、现代、好看的 WordPress 后台设置框架（CSF 的替代方案）。通过简洁的注册 API，即可生成脱离 /wp-admin 的全屏沉浸式设置页。',
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
      };

      // 设置表单（字段系统）：sections/values 来自后端，model 为可编辑副本
      var sections = cfg.sections || [];
      var optionId = cfg.optionId || '';
      var model = Vue.reactive(Object.assign({}, cfg.values || {}));
      sections.forEach(function (s) {
        (s.fields || []).forEach(function (f) {
          if (!(f.id in model)) { model[f.id] = (f.default !== undefined ? f.default : ''); }
        });
      });

      // 脏状态：当前 model 与上次保存快照不一致即为「有未保存更改」
      var savedSnapshot = Vue.ref(JSON.stringify(model));
      var isDirty = Vue.computed(function () { return JSON.stringify(model) !== savedSnapshot.value; });
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
        sections: sections,
        model: model,
        currentSection: currentSection,
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
      '          <span class="eva-sb-label">EVA框架使用指南</span>',
      '        </div>',
      '        <div class="eva-sb-tip">EVA框架使用指南</div>',
      '      </div>',
      '      <div v-for="m in menu" :key="m.id" class="eva-sb-group">',
      '        <div class="eva-sb-item" :class="{ \'is-active\': m.id === active, \'is-open\': isOpen(m.id) }" @click="onMenuClick(m)">',
      '          <eva-icon class="eva-sb-ico" :icon="m.icon"></eva-icon>',
      '          <span class="eva-sb-label">{{ m.label }}</span>',
      '          <i v-if="hasChildren(m)" class="eva-sb-arrow ri-arrow-down-s-line" :class="{ \'is-open\': isOpen(m.id) }"></i>',
      '        </div>',
      '        <div v-if="hasChildren(m)" v-show="isOpen(m.id)" class="eva-sb-sub">',
      '          <div v-for="c in m.children" :key="c.id" class="eva-sb-subitem"',
      '               :class="{ \'is-active\': c.id === active }" @click="openMenu(c.id)">',
      '            <eva-icon class="eva-sb-subico" :icon="c.icon"></eva-icon>',
      '            <span>{{ c.label }}</span>',
      '          </div>',
      '        </div>',
      '        <div v-if="!hasChildren(m)" class="eva-sb-tip">{{ m.label }}</div>',
      '        <div v-if="hasChildren(m)" class="eva-sb-flyout">',
      '          <div v-for="c in m.children" :key="c.id" class="eva-flyout-item"',
      '               :class="{ \'is-active\': c.id === active }" @click="openMenu(c.id)">',
      '            <eva-icon :icon="c.icon"></eva-icon><span>{{ c.label }}</span>',
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
      '        <button class="eva-hbtn" title="搜索 (Ctrl+K)" @click="openSearch"><i class="ri-search-line"></i></button>',
      '        <button class="eva-hbtn eva-hbtn-collapse" :title="sidebarCollapsed ? \'展开侧栏\' : \'折叠侧栏\'" @click="toggleSidebar">',
      '          <i :class="sidebarCollapsed ? \'ri-menu-unfold-line\' : \'ri-menu-fold-line\'"></i>',
      '        </button>',
      '        <button class="eva-hbtn" title="通知"><i class="ri-notification-3-line"></i></button>',
      '        <button class="eva-hbtn" title="设置" @click="toggleSettings"><i class="ri-settings-3-line"></i></button>',
      '        <button class="eva-hbtn" @click="toggleDark" :title="dark ? \'切换亮色\' : \'切换暗色\'">',
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
      '            <a class="eva-um-item" :href="user.profileUrl" role="menuitem">个人资料</a>',
      '            <a class="eva-um-item" v-if="adminUrl" :href="adminUrl" role="menuitem">返回 WP 后台</a>',
      '            <a class="eva-um-item eva-um-logout" :href="user.logoutUrl" role="menuitem">退出登录</a>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </header>',
      '    <div class="eva-tabsbar">',
      '      <div class="eva-tabs">',
      '        <div v-for="t in tabs" :key="t.id" class="eva-tab"',
      '             :class="{ \'is-active\': t.id === activeTab }" @click="selectTab(t.id)">',
      '          <eva-icon class="eva-tab-ico" :icon="t.icon"></eva-icon>',
      '          <span>{{ t.label }}</span>',
      '          <i v-if="t.closable" class="eva-tab-close ri-close-line" @click.stop="closeTab(t.id)"></i>',
      '        </div>',
      '      </div>',
      '      <div class="eva-tabs-right">',
      '        <button class="eva-tbtn" title="刷新当前页" @click="refresh"><i class="ri-refresh-line"></i></button>',
      '        <button v-if="closableCount" class="eva-tbtn" title="关闭其他页签" @click="closeOtherTabs"><i class="ri-close-circle-line"></i></button>',
      '        <div class="eva-crumb">',
      '          <i class="ri-home-4-line"></i><i class="eva-crumb-sep ri-arrow-right-s-line"></i>',
      '          <span>后台管理</span><i class="eva-crumb-sep ri-arrow-right-s-line"></i>',
      '          <span class="eva-crumb-cur">{{ currentTitle }}</span>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <main class="eva-content">',
      '      <div v-if="active === \'eva-guide\'" class="eva-guide">',
      '        <div class="eva-guide-hero">',
      '          <div class="eva-guide-hero-icon"><i class="ri-book-open-line"></i></div>',
      '          <div>',
      '            <h1 class="eva-guide-title">EVA 框架使用指南<span v-if="guide.version" class="eva-guide-ver">v{{ guide.version }}</span></h1>',
      '            <p class="eva-guide-sub">{{ guide.intro }}</p>',
      '          </div>',
      '        </div>',
      '        <div class="eva-guide-features">',
      '          <div v-for="f in guide.features" :key="f.title" class="eva-feature">',
      '            <i :class="f.icon"></i>',
      '            <div class="eva-feature-tt">{{ f.title }}</div>',
      '            <div class="eva-feature-ds">{{ f.desc }}</div>',
      '          </div>',
      '        </div>',
      '        <section v-for="s in guide.sections" :key="s.id" class="eva-guide-card">',
      '          <h2 class="eva-guide-h2"><i :class="s.icon"></i><span>{{ s.title }}</span></h2>',
      '          <p class="eva-guide-p">{{ s.desc }}</p>',
      '          <pre v-if="s.code" class="eva-code"><code>{{ s.code }}</code></pre>',
      '        </section>',
      '      </div>',
      '      <div v-else-if="currentSection" class="eva-form">',
      '        <div class="eva-form-card">',
      '          <div v-for="f in currentSection.fields" :key="f.id" class="eva-field-row" :class="fieldCol(f)">',
      '            <div class="eva-field-meta"><span class="eva-field-title">{{ f.title }}</span><span v-if="f.desc" class="eva-field-desc">{{ f.desc }}</span></div>',
      '            <div class="eva-field-control"><eva-field :field="f" v-model="model[f.id]"></eva-field></div>',
      '          </div>',
      '        </div>',
      '        <div class="eva-savedock" v-show="isDirty || saveMsg">',
      '          <button type="button" class="eva-savefab" :disabled="saving || !isDirty" @click="saveOptions">',
      '            <i class="ri-save-3-line"></i><span>{{ saveMsg || \'保存\' }}</span>',
      '          </button>',
      '          <div class="eva-reset-wrap" @mouseleave="resetOpen = false">',
      '            <button type="button" class="eva-reset-btn" :disabled="saving" title="恢复默认" @click="resetOpen = !resetOpen"><i class="ri-arrow-go-back-line"></i></button>',
      '            <div class="eva-reset-menu" v-show="resetOpen">',
      '              <button type="button" class="eva-reset-item" @click="resetSection">恢复此页</button>',
      '              <button type="button" class="eva-reset-item" @click="resetAll">恢复全部</button>',
      '            </div>',
      '          </div>',
      '        </div>',
      '      </div>',
      '      <div v-else class="eva-placeholder">',
      '        <i class="ri-inbox-2-line"></i>',
      '        <p>{{ currentTitle || \'欢迎使用 Eva Framework\' }}</p>',
      '        <span>该页面正在建设中</span>',
      '      </div>',
      '    </main>',
      '  </div>',
      '  <div class="eva-drawer-mask" v-show="settingsOpen" @click="closeSettings"></div>',
      '  <aside class="eva-drawer" :class="{ \'is-open\': settingsOpen }" role="dialog" aria-label="设置">',
      '    <div class="eva-drawer-head">',
      '      <div class="eva-drawer-titles"><i class="ri-settings-3-line"></i><span>设置</span></div>',
      '      <button type="button" class="eva-drawer-close" title="关闭" @click="closeSettings"><i class="ri-close-line"></i></button>',
      '    </div>',
      '    <div class="eva-drawer-body">',
      '      <div class="eva-set-section">',
      '        <p class="eva-set-title">外观</p>',
      '        <div class="eva-set-row">',
      '          <div class="eva-set-label"><i class="ri-contrast-2-line"></i><span>暗色模式</span></div>',
      '          <button type="button" class="eva-switch" :class="{ \'is-on\': dark }" role="switch" :aria-checked="dark ? \'true\' : \'false\'" @click="toggleDark"><span class="eva-switch-dot"></span></button>',
      '        </div>',
      '        <div class="eva-set-row">',
      '          <div class="eva-set-label"><i class="ri-layout-left-line"></i><span>折叠侧边栏</span></div>',
      '          <button type="button" class="eva-switch" :class="{ \'is-on\': sidebarCollapsed }" role="switch" :aria-checked="sidebarCollapsed ? \'true\' : \'false\'" @click="toggleSidebar"><span class="eva-switch-dot"></span></button>',
      '        </div>',
      '      </div>',
      '      <div class="eva-set-section" v-if="isAdmin">',
      '        <p class="eva-set-title">功能</p>',
      '        <div class="eva-set-row">',
      '          <div class="eva-set-label"><i class="ri-book-open-line"></i><span>显示《EVA框架使用指南》</span></div>',
      '          <button type="button" class="eva-switch" :class="{ \'is-on\': guideVisible }" role="switch" :aria-checked="guideVisible ? \'true\' : \'false\'" @click="toggleGuide"><span class="eva-switch-dot"></span></button>',
      '        </div>',
      '        <div class="eva-set-row">',
      '          <div class="eva-set-label"><i class="ri-window-line"></i><span>后台悬浮窗</span></div>',
      '          <button type="button" class="eva-switch" :class="{ \'is-on\': floatingEnabled }" role="switch" :aria-checked="floatingEnabled ? \'true\' : \'false\'" @click="toggleFloating"><span class="eva-switch-dot"></span></button>',
      '        </div>',
      '      </div>',
      '      <div class="eva-set-section">',
      '        <p class="eva-set-title">主题色</p>',
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
      '      <input ref="searchInput" class="eva-search-input" type="text" v-model="searchQuery" placeholder="搜索设置…" @keydown.enter="onSearchEnter" @keydown.esc="closeSearch">',
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
      '      <div v-if="searchQuery && !searchResults.length" class="eva-search-empty">无匹配结果</div>',
      '      <div v-else-if="!searchQuery" class="eva-search-empty">输入关键词以搜索设置项</div>',
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

    // 注册 UI 库组件（assets/libs/）：供字段模板使用，如 <eva-select> / <eva-builder>
    if (window.EvaUI && window.EvaUI.Select) {
      app.component('eva-select', window.EvaUI.Select);
    }
    if (window.EvaUI && window.EvaUI.Builder) {
      app.component('eva-builder', window.EvaUI.Builder);
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
    app.mount('#eva-app');
  }
})();
