/**
 * Eva 字段：builder（页面构建器 · 三栏外壳）。
 *
 * 布局：
 * - 左：模块库。数据源 = window.EvaModules（用户自行注册，框架内置一个 hero 示例）。
 * - 中：画布预览。遍历实例数组，调 EvaModules[type].render(values) 输出 HTML；可选中 / 上移下移 / 复制 / 删除。
 * - 右：参数面板。取选中模块的 fields，逐个用 <eva-field> 渲染（复用现有 window.EvaFields 体系）。
 *
 * 保存值（modelValue）= 模块实例数组：
 *   [ { uid: 'm1', type: 'hero', values: { 标题: '...', ... } } ]
 *
 * 扩展：用户在自己的脚本里 `window.EvaModules.xxx = { label, icon, fields, render }` 即可新增模块。
 */
(function () {
  window.EvaFields = window.EvaFields || {};
  window.EvaModules = window.EvaModules || {};

  var UID_SEED = 0;
  var MENU_ADD_SEED = 0;
  var cfg = (window.EvaFW && window.EvaFW.config) || {};
  var gsapPromise = null;

  // 功能：按需加载 GSAP，页面构建器折叠/展开动画复用。
  function loadGsap() {
    if (window.gsap) { return Promise.resolve(window.gsap); }
    if (gsapPromise) { return gsapPromise; }
    var url = new URL(cfg.gsapUrl || 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js', document.baseURI).href;
    gsapPromise = new Promise(function (resolve, reject) {
      var script = Array.from(document.scripts).find(function (item) { return item.src === url; });
      var created = !script;
      if (!script) { script = document.createElement('script'); script.src = url; script.async = true; }
      var timer = window.setTimeout(function () { finish(new Error('GSAP load timed out')); }, 8000);
      function finish(error) {
        window.clearTimeout(timer);
        script.removeEventListener('load', loaded); script.removeEventListener('error', failed);
        if (error) { if (created) { script.remove(); } reject(error); } else { resolve(window.gsap); }
      }
      function loaded() { finish(window.gsap ? null : new Error('GSAP unavailable')); }
      function failed() { finish(new Error('GSAP load failed')); }
      script.addEventListener('load', loaded, { once: true }); script.addEventListener('error', failed, { once: true });
      if (created) { document.head.appendChild(script); }
    }).catch(function (error) { gsapPromise = null; throw error; });
    return gsapPromise;
  }


  // Top-level tab transitions are cancellable and owned by the builder instance.
  function menuReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function clearMenuMotion(el) {
    ['opacity', 'transform', 'willChange', 'pointerEvents'].forEach(function (name) { el.style[name] = ''; });
    el.inert = false;
    if (el.classList.contains('eva-pb-tab-content')) { ['position', 'top', 'left', 'width'].forEach(function (name) { el.style[name] = ''; }); }
  }
  function stopMenuMotion(el, clear) {
    var state = el && el._evaMenuMotion;
    if (state) {
      state.cancelled = true;
      if (state.frame) { window.cancelAnimationFrame(state.frame); }
      if (state.timer) { window.clearTimeout(state.timer); }
      if (state.tween) { state.tween.kill(); }
      if (state.owner._menuMotionElements) { state.owner._menuMotionElements.delete(el); }
      el._evaMenuMotion = null;
    }
    if (el && clear) { clearMenuMotion(el); }
  }
  function runModuleTabMotion(owner, el, done, entering, options) {
    options = options || {};
    stopMenuMotion(el, false);
    var state = { owner: owner, cancelled: false, tween: null, frame: 0, timer: 0 };
    el._evaMenuMotion = state;
    owner._menuMotionElements = owner._menuMotionElements || new Set();
    owner._menuMotionElements.add(el);
    function finish() {
      if (state.cancelled || el._evaMenuMotion !== state) { return; }
      stopMenuMotion(el, true);
      if (done) { done(); }
      if (options.onComplete) { options.onComplete(); }
    }
    state.finish = finish;
    if (owner._menuMotionDisposed || menuReducedMotion()) { finish(); return; }
    if (!entering) { el.style.pointerEvents = 'none'; el.inert = true; }
    // A slow or failed dependency must never leave controls invisible or block Vue removal.
    state.timer = window.setTimeout(finish, 400);
    loadGsap().then(function (gsap) {
      if (state.cancelled || !gsap) { if (!state.cancelled) { finish(); } return; }
      window.clearTimeout(state.timer);
      state.frame = window.requestAnimationFrame(function () {
        if (state.cancelled || owner._menuMotionDisposed || !el.isConnected) { finish(); return; }
        el.style.willChange = 'opacity,transform';
        var vars = { opacity: entering ? 1 : 0, duration: entering ? .3 : .2, ease: entering ? 'power3.out' : 'power2.in', x: entering ? 0 : -options.direction * options.distance, y: 0, overwrite: 'auto', onComplete: finish };
        if (entering) {
          state.tween = gsap.fromTo(el, { opacity: 0, x: options.direction * options.distance, y: 0 }, vars);
        } else { state.tween = gsap.to(el, vars); }
      });
    }).catch(finish);
  }

  // 功能：生成模块实例唯一 id。
  function genUid() {
    UID_SEED += 1;
    return 'm' + Date.now().toString(36) + UID_SEED.toString(36);
  }

  // 功能：深拷贝纯数据（实例值均可 JSON 序列化）。
  function clone(value) {
    if (value === null || value === undefined) { return value; }
    try { return JSON.parse(JSON.stringify(value)); } catch (e) { return value; }
  }

  // 功能：判断对象自有属性。
  function hasOwn(obj, key) {
    return obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  // 功能：判断 Builder 模块字段的 CSF/Eva dependency 是否成立。
  function dependencyRuleMatches(rule, values) {
    if (!Array.isArray(rule) || !rule.length) { return true; }
    var source = String(rule[0] || '');
    var operator = String(rule[1] || '==').toLowerCase();
    var expected = rule.length > 2 ? rule[2] : '';
    var actual = hasOwn(values, source) ? values[source] : '';
    var actualList = Array.isArray(actual) ? actual.map(String) : [String(actual === null || actual === undefined ? '' : actual)];
    var expectedList = Array.isArray(expected) ? expected.map(String) : [String(expected === null || expected === undefined ? '' : expected)];
    var intersects = expectedList.some(function (value) { return actualList.indexOf(value) !== -1; });

    if (operator === '!=' || operator === '!==' || operator === 'not' || operator === 'neq' || operator === 'not-any' || operator === 'not_in') {
      return !intersects;
    }
    if (operator === 'empty') {
      return actualList.length === 0 || (actualList.length === 1 && actualList[0] === '');
    }
    if (operator === 'not-empty' || operator === 'not_empty') {
      return actualList.length > 0 && !(actualList.length === 1 && actualList[0] === '');
    }
    return intersects;
  }

  // 功能：支持单条依赖和多条依赖；多条规则默认全部成立才显示。
  function dependencyVisible(field, values) {
    var dependency = field && field.dependency;
    if (!Array.isArray(dependency) || !dependency.length) { return true; }
    var rules = Array.isArray(dependency[0]) ? dependency : [dependency];
    return rules.every(function (rule) { return dependencyRuleMatches(rule, values || {}); });
  }

  // 功能：转义预览中的文本，避免模块预览直接拼接用户输入。
  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Builder 不再内置示例模块；模块由 PHP manifest 或用户脚本显式注册。

  var runtimeModules = cfg.builderModules || {};
  Object.keys(runtimeModules).forEach(function (key) {
    var existing = window.EvaModules[key] || {};
    window.EvaModules[key] = Object.assign({}, runtimeModules[key], existing);
  });

  function storedPanelOpacity() {
    var value = 88;
    try {
      var stored = parseInt(window.localStorage.getItem('eva_fw_panel_opacity'), 10);
      if (!isNaN(stored)) value = stored;
    } catch (e) {}
    return Math.max(40, Math.min(100, value));
  }

  function previewRoleOptions() {
    var roles = Array.isArray(cfg.builderPreviewRoles) ? cfg.builderPreviewRoles : [];
    return roles.length ? roles : [
      { value: 'current', label: '当前用户' },
      { value: 'guest', label: '游客' }
    ];
  }

  function storedPreviewRole() {
    var roles = previewRoleOptions();
    var value = cfg.builderPreviewRole || 'current';
    try {
      var stored = window.localStorage.getItem('eva_fw_builder_preview_role') || '';
      if (roles.some(function (role) { return String(role.value) === String(stored); })) {
        value = stored;
      }
    } catch (e) {}
    return roles.some(function (role) { return String(role.value) === String(value); }) ? String(value) : 'current';
  }

  window.EvaFields.builder = {
    components: { 'eva-confirm': window.EvaUI.Confirm },
    inject: { menuSaveRegistry: { from: 'evaManualSaves', default: null }, shellControls: { from: 'evaShellControls', default: null }, formContext: { from: 'evaFormContext', default: null } },
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    data: function () {
      return {
        historyOpen: false,
        historyLoading: false,
        historyDetailLoading: false,
        historyEntries: [],
        historySelectedId: '',
        historyDetail: null,
        historyError: '',
        historyNotice: '',
        historyRestoreConfirm: false,
        selectedUid: '',
        selectedStructureId: '',
        leftTab: 'components',
        rightTab: 'page',
        device: 'desktop',
        fullScreen: false,
        activeSlot: '',
        activePage: '',
        pageMenuOpen: false,
        draggingModule: '',
        draggingMenuLocation: '',
        previewTimer: null,
        previewReady: false,
        previewSeq: 0,
        leftCollapsed: false,
        rightCollapsed: false,
        pageBlocksCollapsed: true,
        panelOpacity: storedPanelOpacity(),
        panelOpacityOptions: [
          { value: 40, label: '40%' },
          { value: 50, label: '50%' },
          { value: 60, label: '60%' },
          { value: 70, label: '70%' },
          { value: 80, label: '80%' },
          { value: 88, label: '88%' },
          { value: 90, label: '90%' },
          { value: 100, label: '100%' }
        ],
        moduleTab: 'components',
        moduleTabDirection: 1,
        moduleTabAnimating: false,
        widgetAreas: [],
        availableWidgets: [],
        widgetArea: '',
        widgetsEditorUrl: '',
        widgetsLoading: false,
        widgetsLoaded: false,
        widgetsError: '',
        widgetsSaving: false,
        widgetsStatus: '',
        draggingWidget: null,
        draggingWidgetArea: '',
        menuLocation: '',
        menuLocationDataOverride: null,
        menuEditor: null,
        menuEditorLoading: false,
        menuEditorError: '',
        menuEditorStatus: '',
        menuCreateName: '',
        menuCreateError: '',
        menuCreating: false,
        menuExistingId: '',
        menuAssigning: false,
        menuAssignError: '',
        menuEditorSaving: false,
        menuEditorDrafts: {},
        menuEditorLoadSeq: 0,
        menuEditorSelectedItem: '',
        menuEditorScopeKey: '',
        menuSubmenuOpen: false,
        menuSubmenuPath: [],
        menuSubmenuAnchorKey: '',
        menuSubmenuQuery: '',
        menuSubmenuPosition: { left: 0, top: 0, width: 260, height: 480, arrow: 72, gap: 24, side: 'right', ready: false },
        menuEditorRemovedIds: [],
        menuDeleteRequest: null,
        menuActionKey: '',
        menuActionStatus: '',
        menuEditOpen: false,
        menuEditSetting: 'title',
        menuEditPosition: { left: 0, top: 0, width: 320, height: 520, ready: false },
        menuActionPosition: { left: 0, top: 0, width: 232, height: 380, ready: false },
        menuEditorDraggingKey: '',
        menuEditorDropKey: '',
        menuEditorDropSide: '',
        menuLocationsOpen: false,
        menuLocationsPosition: { left: 0, top: 0, width: 360, height: 540, arrow: 72, gap: 8, side: 'right', ready: false },
        menuAddOpen: false,
        menuAddParentKey: '',
        menuAddId: 'eva-menu-add-' + (++MENU_ADD_SEED),
        menuAddType: 'custom',
        menuAddTypeSearch: '',
        menuAddPosition: { left: 0, top: 0, width: 427, height: 373, arrow: 72, gap: 24, side: 'right', ready: false },
        menuAddSearch: '',
        menuAddQueries: {},
        menuAddExpanded: { custom: true },
        menuAddItems: {},
        menuAddSelected: {},
        menuAddLoading: {},
        menuAddErrors: {},
        menuAddCustom: { url: '', text: '', target: '_self', rel: '' },
        containerTab: '',
        previewRole: storedPreviewRole(),
        previewRoleOptions: previewRoleOptions(),
        leftWidth: 320,
        rightWidth: 360,
        resizingPanel: '',
        resizeSource: '',
        resizeMoved: false,
        suppressToggleClick: false,
        resizeStartX: 0,
        resizeStartWidth: 0,
        collapsedGroups: {}
      };
    },
    computed: {
      historyOptionId: function () {
        var group = (cfg.saveGroups || []).find(function (entry) { return (entry.fieldIds || []).indexOf(this.field.id) !== -1; }.bind(this));
        return group ? group.optionId : (this.formContext && this.formContext.optionId || cfg.optionId || '');
      },
      menuLocationsSelectedCount: function () { return (this.menuEditor && this.menuEditor.locations || []).filter(function (location) { return location.checked; }).length; },
      menuSaveKey: function () { return 'builder-menu:' + (this.field.id || 'default'); },
      menuEditorDirty: function () { return Object.keys(this.menuEditorDrafts).length > 0; },
      moduleTabMotionProps: function () {
        return { css: false, onBeforeEnter: this.menuBeforeEnter, onEnter: this.enterModuleTab, onLeave: this.leaveModuleTab, onEnterCancelled: this.menuCancelMotion, onLeaveCancelled: this.menuCancelMotion };
      },
      menuListMotionProps: function () {
        return { name: 'eva-pb-menu-stack', onEnter: this.measureMenuRow, onBeforeLeave: this.measureMenuRow, onAfterEnter: this.clearMenuRowHeight, onAfterLeave: this.clearMenuRowHeight, onEnterCancelled: this.clearMenuRowHeight, onLeaveCancelled: this.clearMenuRowHeight };
      },
      menuDropdownMotionProps: function () {
        return { name: 'eva-pb-menu-dropdown', onEnter: this.measureMenuDropdown, onBeforeLeave: this.measureMenuDropdown, onAfterEnter: this.clearMenuDropdownHeight, onAfterLeave: this.clearMenuDropdownHeight, onEnterCancelled: this.clearMenuDropdownHeight, onLeaveCancelled: this.clearMenuDropdownHeight };
      },
      menuPopoverMotionProps: function () {
        return { name: 'eva-pb-menu-pullout', onEnter: this.menuAfterEnter, onAfterEnter: this.menuAfterEnter };
      },
      menuMotionProps: function () {
        return { css: false, onAfterEnter: this.menuAfterEnter };
      },
      menuActionItem: function () { return this.menuEditorFind(this.menuActionKey); },
      menuEditorScopeParent: function () { return this.menuEditorFind(this.menuEditorScopeKey); },
      menuEditorVisibleItems: function () {
        var parent = this.menuEditorFind(this.menuEditorScopeKey), parentId = parent ? Number(parent.id) : 0;
        return this.menuEditorChildren(parentId);
      },
      menuSubmenuParent: function () { return this.menuEditorFind(this.menuSubmenuPath[this.menuSubmenuPath.length - 1]); },
      menuSubmenuItems: function () {
        var parent = this.menuSubmenuParent, query = this.menuSubmenuQuery.trim().toLowerCase();
        return parent ? this.menuEditorChildren(parent.id).filter(function (item) { return !query || String(item.title || '').toLowerCase().indexOf(query) !== -1; }) : [];
      },
      menuAddParent: function () { return this.menuEditorFind(this.menuAddParentKey); },
      menuAddActiveGroup: function () {
        var groups = this.menuAddGroups();
        return groups.find(function (group) { return group.id === this.menuAddType; }.bind(this)) || groups[0];
      },
      menuAddFilteredGroups: function () {
        var query = this.menuAddTypeSearch.trim().toLowerCase();
        return this.menuAddGroups().filter(function (group) { return !query || (group.label + ' ' + group.id).toLowerCase().indexOf(query) !== -1; });
      },
      menuEditorActiveItem: function () {
        var items = this.menuEditor && Array.isArray(this.menuEditor.items) ? this.menuEditor.items : [];
        for (var i = 0; i < items.length; i += 1) {
          if (this.menuEditorItemKey(items[i], i) === this.menuEditorSelectedItem && !this.menuEditorItemIsRemoved(items[i])) {
            return items[i];
          }
        }
        return null;
      }
    },
    mounted: function () {
      if (this.menuSaveRegistry) {
        var previous = this.menuSaveRegistry.get(this.menuSaveKey);
        if (previous) { this.menuEditorDrafts = previous.drafts; }
        this._menuSaveParticipant = { drafts: this.menuEditorDrafts, isDirty: function () { return this.menuEditorDirty; }.bind(this), save: this.saveMenuEditor };
        this.menuSaveRegistry.set(this.menuSaveKey, this._menuSaveParticipant);
      }
      this._resizeMoveHandler = this.onPanelResizeMove.bind(this);
      this._resizeEndHandler = this.stopPanelResize.bind(this);
      this._menuDragMoveHandler = this.onMenuEditorPointerMove.bind(this);
      this._menuDragEndHandler = this.onMenuEditorPointerUp.bind(this);
      this._menuDragCancelHandler = this.cancelMenuEditorDrag.bind(this);
      document.addEventListener('fullscreenchange', this.syncFullscreenState);
      document.addEventListener('pointermove', this._resizeMoveHandler);
      document.addEventListener('pointerup', this._resizeEndHandler);
      document.addEventListener('pointercancel', this._resizeEndHandler);
      document.addEventListener('pointermove', this._menuDragMoveHandler);
      document.addEventListener('pointerup', this._menuDragEndHandler);
      document.addEventListener('pointercancel', this._menuDragCancelHandler);
      document.addEventListener('mousemove', this._resizeMoveHandler);
      document.addEventListener('mouseup', this._resizeEndHandler);
      window.addEventListener('message', this.handlePreviewMessage);
      this.$nextTick(function () {
        this.positionModuleTabIndicator(false);
        this._moduleTabLayout = function () { this.positionModuleTabIndicator(false); }.bind(this);
        if (typeof ResizeObserver !== 'undefined' && this.$refs.moduleTabRail) {
          this._moduleTabResize = new ResizeObserver(this._moduleTabLayout);
          this._moduleTabResize.observe(this.$refs.moduleTabRail);
        } else { window.addEventListener('resize', this._moduleTabLayout); }
      });
      this.queuePreview();
    },
    beforeUnmount: function () {
      if (this.shellControls) { this.shellControls.setSettingsHost(this.$refs.pbRoot, false); }
      this.closeSaveHistory(false);
      this.closeMenuLocations(false);
      if (this.menuSaveRegistry && !this.menuEditorDirty && this.menuSaveRegistry.get(this.menuSaveKey) === this._menuSaveParticipant) { this.menuSaveRegistry.delete(this.menuSaveKey); }
      this._menuMotionDisposed = true;
      this._moduleTabIndicatorSeq = (this._moduleTabIndicatorSeq || 0) + 1;
      if (this._moduleTabResize) { this._moduleTabResize.disconnect(); }
      if (this._moduleTabLayout) { window.removeEventListener('resize', this._moduleTabLayout); }
      if (window.gsap && this.$refs.moduleTabIndicator) { window.gsap.killTweensOf(this.$refs.moduleTabIndicator); }
      if (this._menuMotionElements) { Array.from(this._menuMotionElements).forEach(function (el) { stopMenuMotion(el, true); }); }

      this.closeMenuActions(false);
      this._widgetsDisposed = true;
      this.stopMenuAddTracking();
      this.cancelMenuEditorDrag();
      document.removeEventListener('fullscreenchange', this.syncFullscreenState);
      document.removeEventListener('pointermove', this._resizeMoveHandler || this.onPanelResizeMove);
      document.removeEventListener('pointerup', this._resizeEndHandler || this.stopPanelResize);
      document.removeEventListener('pointercancel', this._resizeEndHandler || this.stopPanelResize);
      document.removeEventListener('pointermove', this._menuDragMoveHandler);
      document.removeEventListener('pointerup', this._menuDragEndHandler);
      document.removeEventListener('pointercancel', this._menuDragCancelHandler);
      this.stopMenuAddRequests();
      if (this._menuEditorReadController) { this._menuEditorReadController.abort(); }
      this.menuEditorLoadSeq += 1;
      document.removeEventListener('mousemove', this._resizeMoveHandler || this.onPanelResizeMove);
      document.removeEventListener('mouseup', this._resizeEndHandler || this.stopPanelResize);
      window.removeEventListener('message', this.handlePreviewMessage);
      document.body.classList.remove('eva-pb-resizing');
      if (this.previewTimer) {
        clearTimeout(this.previewTimer);
      }
      if (this._previewController) { this._previewController.abort(); }
      if (this._widgetsController) { this._widgetsController.abort(); }
      this.previewSeq += 1;
    },
    watch: {
      fullScreen: function (value) { if (this.shellControls) { this.shellControls.setSettingsHost(this.$refs.pbRoot, value); } },
      moduleTab: function (next, previous) { if (this._menuMotionElements) { Array.from(this._menuMotionElements).forEach(function (el) { if (el.classList.contains('eva-pb-tab-content') && el._evaMenuMotion && el._evaMenuMotion.finish) { el._evaMenuMotion.finish(); } }); } var tabs = this.moduleTabs().map(function (tab) { return tab.id; }); this.moduleTabDirection = tabs.indexOf(next) >= tabs.indexOf(previous) ? 1 : -1; this.moduleTabAnimating = true; this.$nextTick(function () { this.positionModuleTabIndicator(true); }); this.closeMenuLocations(false); this.closeMenuActions(false); this.closeMenuAddPanel(false); this.closeMenuSubmenu(false); this.cancelMenuEditorDrag(); this.sendPreviewMenuState(); this.sendPreviewWidgetState(); if (this.moduleTab === 'widgets' && !this.widgetsLoaded) { this.loadWidgets(); } },
      widgetArea: function () { this.sendPreviewWidgetState(); },
      menuLocation: function () { this.sendPreviewMenuState(); },
      menuActionItem: function (item) { if (this.menuActionKey && (!item || this.menuEditorItemIsRemoved(item))) { this.closeMenuActions(false); } },
      menuEditorActiveItem: function (item) { if (this.menuEditOpen && !item) { this.closeMenuItemEditor(false); } },
      leftCollapsed: function (value) { if (value) { this.closeMenuLocations(false); this.closeMenuActions(false); this.closeMenuAddPanel(false); this.closeMenuSubmenu(false); } },
      menuSubmenuParent: function (parent) { if (this.menuSubmenuOpen) { if (!parent) { this.closeMenuSubmenu(false); } else { this.queueMenuAddPosition(); } } },
      menuSubmenuItems: function () { if (this.menuSubmenuOpen) { this.queueMenuAddPosition(); } },
      modelValue: {
        deep: true,
        handler: function () {
          this.queuePreview();
        }
      },
      'field.structure_values': { deep: true, handler: function () { this.queuePreview(); } },
      activeSlot: function () {
        this.queuePreview();
      },
      draggingModule: function (value) {
        this.sendPreviewDragState(!!value);
      }
    },
    methods: {

  openSaveHistory: function () {
    this.closeMenuLocations(false); this.closeMenuActions(false); this.closeMenuAddPanel(false); this.closeMenuSubmenu(false);
    this.historyOpen = true; this.historyNotice = '';
    document.addEventListener('keydown', this.historyKeyDown);
    this.loadSaveHistory();
    this.$nextTick(function () { if (this.$refs.historyPanel) { this.$refs.historyPanel.focus({ preventScroll: true }); } });
  },
  closeSaveHistory: function (restoreFocus) {
    this.historyOpen = false; this.historyRestoreConfirm = false;
    this._historySeq = (this._historySeq || 0) + 1;
    if (this._historyController) { this._historyController.abort(); this._historyController = null; }
    document.removeEventListener('keydown', this.historyKeyDown);
    if (restoreFocus !== false) { this.$nextTick(function () { if (this.$refs.historyTrigger) { this.$refs.historyTrigger.focus({ preventScroll: true }); } }); }
  },
  historyKeyDown: function (event) {
    if (!this.historyOpen || this.historyRestoreConfirm) { return; }
    if (event.key === 'Escape') { event.preventDefault(); this.closeSaveHistory(); return; }
    if (event.key !== 'Tab') { return; }
    var panel = this.$refs.historyPanel;
    var nodes = panel && Array.from(panel.querySelectorAll('button:not(:disabled), [href], input, [tabindex="0"]')).filter(function (node) { return node.getClientRects().length; });
    if (!nodes || !nodes.length) { event.preventDefault(); return; }
    var at = nodes.indexOf(document.activeElement), next = at < 0 ? (event.shiftKey ? nodes.length - 1 : 0) : (at + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
    event.preventDefault(); nodes[next].focus();
  },
  loadSaveHistory: function (id) {
    if (!cfg.ajaxUrl || !this.historyOptionId) { this.historyError = '当前构建器不支持保存历史。'; return; }
    if (this._historyController) { this._historyController.abort(); }
    var controller = new AbortController(), seq = this._historySeq = (this._historySeq || 0) + 1;
    this._historyController = controller; this.historyError = ''; this.historyNotice = '';
    this.historySelectedId = id || ''; this.historyDetail = null;
    this.historyLoading = !id; this.historyDetailLoading = !!id;
    var fd = new FormData();
    fd.append('action', 'eva_fw_builder_history'); fd.append('nonce', cfg.nonce || '');
    fd.append('option_id', this.historyOptionId); fd.append('field_id', this.field.id || '');
    if (id) { fd.append('history_id', id); }
    return fetch(cfg.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: fd, signal: controller.signal }).then(function (response) { return response.json(); }).then(function (json) {
      if (seq !== this._historySeq) { return; }
      if (!json || !json.success || !json.data) { throw new Error(json && json.data && json.data.message || '历史读取失败，请重试。'); }
      if (id) { this.historyDetail = json.data.entry; } else { this.historyEntries = json.data.entries || []; }
    }.bind(this)).catch(function (error) {
      if (seq === this._historySeq && error.name !== 'AbortError') { this.historyError = error.message || '历史读取失败，请重试。'; }
    }.bind(this)).finally(function () {
      if (seq === this._historySeq) { this.historyLoading = false; this.historyDetailLoading = false; this._historyController = null; }
    }.bind(this));
  },
  historyTime: function (entry) {
    if (!entry.timestamp) { return entry.time || ''; }
    var date = new Date(entry.timestamp * 1000), pad = function (n) { return String(n).padStart(2, '0'); };
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  },
  historyPreviewRows: function () {
    var detail = this.historyDetail;
    if (!detail) { return []; }
    if (detail.kind === 'menu') {
      return (detail.payload.items || []).slice(0, 12).map(function (item) { return { label: item.title, value: item.parent ? '子菜单' : '菜单项' }; });
    }
    var values = detail.payload.values || {}, labels = {}, definitions = {};
    labels[this.field.id] = '页面内容';
    ['global_fields', 'container_fields'].forEach(function (group) { (this.field[group] || []).forEach(function (f) { if (f.id && f.title) { labels[f.id] = this.tv(f.title).replace(/<[^>]*>/g, ''); definitions[f.id] = f; } }.bind(this)); }.bind(this));
    (this.field.fixed_structure || []).forEach(function (node) { (node.fields || []).forEach(function (f) { if (f.id && f.title) { labels[f.id] = this.tv(f.title).replace(/<[^>]*>/g, ''); definitions[f.id] = f; } }.bind(this)); }.bind(this));
    return Object.keys(values).filter(function (key) { return !!labels[key]; }).map(function (key) {
      var value = values[key], field = definitions[key] || {}, text;
      if (value && typeof value === 'object') { text = Array.isArray(value) ? value.length + ' 项配置' : '已保存配置'; }
      else if (field.type === 'switcher' || field.type === 'switch' || typeof value === 'boolean') { text = value === true || value === 1 || value === '1' ? '开启' : '关闭'; }
      else { text = value == null || value === '' ? '未设置' : String(value); }
      if (field.options && !Array.isArray(field.options) && Object.prototype.hasOwnProperty.call(field.options, String(value))) { text = field.options[String(value)]; }
      if (Array.isArray(field.options)) { var option = field.options.find(function (row) { return String(row.value) === String(value); }); if (option) { text = option.label; } }
      if (/^https?:\/\//i.test(String(text))) { text = '已设置链接'; }
      if (/^value-\d+$/.test(String(text))) { text = '已保存选项'; }
      return { label: labels[key], value: String(text).slice(0, 60) };
    });
  },
  restoreSaveHistory: function () {
    var detail = this.historyDetail;
    this.historyRestoreConfirm = false;
    if (!detail) { return; }
    if (this.menuEditorSaving || (this.formContext && this.formContext.saving && this.formContext.saving.value)) { this.historyError = '请等待当前保存完成后再恢复。'; return; }
    if (detail.kind === 'builder') {
      var values = clone(detail.payload.values || {});
      Object.keys(values).forEach(function (id) {
        if (id === this.field.id) { this.$emit('update:modelValue', values[id]); }
        else if (this.formContext && this.formContext.model) { this.formContext.model[id] = values[id]; }
      }.bind(this));
      this.selectedUid = ''; this.selectedStructureId = ''; this.queuePreview();
    } else {
      var historical = detail.payload, current = clone(detail.current), wanted = {};
      (historical.items || []).forEach(function (item) { wanted[Number(item.id)] = true; });
      var removed = (current.items || []).filter(function (item) { return !wanted[Number(item.id)]; }).map(function (item) { return Number(item.id); });
      current.items = clone(historical.items || []).map(function (item) { item.client_key = 'item-' + item.id; return item; });
      current.menu_name = historical.menu_name;
      current.locations = (current.locations || []).map(function (location) { location.checked = (historical.assigned_locations || []).indexOf(location.id) !== -1; return location; });
      current.history_restore_id = detail.id;
      if (this._menuEditorReadController) { this._menuEditorReadController.abort(); }
      this.menuEditorLoadSeq += 1; this.menuEditorLoading = false;
      this.closeMenuLocations(false); this.closeMenuActions(false); this.closeMenuAddPanel(false); this.closeMenuSubmenu(false);
      this.menuLocation = current.location_id; this.menuEditor = current; this.menuEditorRemovedIds = removed;
      this.menuEditorSelectedItem = ''; this.menuEditorScopeKey = ''; this.menuEditorError = '';
      this._menuEditorCache = {}; this.moduleTab = 'menu'; this.leftCollapsed = false;
      this.markMenuEditorDirty();
    }
    this.historyNotice = '已恢复到编辑器，请点击左下角保存。';
  }
,
      selectModuleTab: function (id) {
        if (this.moduleTab === id || !this.moduleTabs().some(function (tab) { return tab.id === id; })) { return; }
        this.moduleTab = id;
        this.collapsedGroups = {};
      },
      moveModuleTab: function (step) {
        var tabs = this.moduleTabs(), index = tabs.findIndex(function (tab) { return tab.id === this.moduleTab; }.bind(this));
        var next = step === 'first' ? 0 : step === 'last' ? tabs.length - 1 : (index + step + tabs.length) % tabs.length;
        this.selectModuleTab(tabs[next].id);
        this.$nextTick(function () {
          var rail = this.$refs.moduleTabRail;
          var button = rail && rail.querySelector('[data-module-tab="' + this.moduleTab + '"]');
          if (button) { button.focus({ preventScroll: true }); }
        });
      },
      positionModuleTabIndicator: function (animate) {
        var seq = this._moduleTabIndicatorSeq = (this._moduleTabIndicatorSeq || 0) + 1;
        var place = function (gsap) {
          if (this._menuMotionDisposed || seq !== this._moduleTabIndicatorSeq) { return; }
          var rail = this.$refs.moduleTabRail, indicator = this.$refs.moduleTabIndicator;
          var button = rail && rail.querySelector('[data-module-tab="' + this.moduleTab + '"]');
          if (!button || !indicator || button.offsetWidth < 1) { return; }
          var values = { x: button.offsetLeft, y: button.offsetTop, width: button.offsetWidth, height: button.offsetHeight, opacity: 1 };
          if (gsap) {
            gsap.killTweensOf(indicator);
            if (animate && !menuReducedMotion()) { gsap.to(indicator, Object.assign(values, { duration: .28, ease: 'power3.out', overwrite: 'auto' })); }
            else { gsap.set(indicator, values); }
          } else {
            indicator.style.transform = 'translate(' + values.x + 'px,' + values.y + 'px)';
            indicator.style.width = values.width + 'px'; indicator.style.height = values.height + 'px'; indicator.style.opacity = '1';
          }
        }.bind(this);
        if (window.gsap) { place(window.gsap); }
        else { loadGsap().then(place).catch(function () { place(null); }); }
      },
      enterModuleTab: function (el, done) {
        var id = el.getAttribute('data-module-panel');
        runModuleTabMotion(this, el, done, true, { direction: this.moduleTabDirection, distance: Math.min(240, Math.max(60, el.offsetWidth * .75)), onComplete: function () { if (id === this.moduleTab) { this.moduleTabAnimating = false; } }.bind(this) });
      },
      leaveModuleTab: function (el, done) {
        var width = el.offsetWidth;
        el.style.width = width + 'px'; el.style.position = 'absolute'; el.style.top = '0'; el.style.left = '0';
        runModuleTabMotion(this, el, done, false, { direction: this.moduleTabDirection, distance: Math.min(240, Math.max(60, width * .75)) });
      },
      menuBeforeEnter: function (el) { stopMenuMotion(el, true); el.style.opacity = '0'; },
      // CSS handles staggered unfolding; restore natural heights after each transition.
      measureMenuRow: function (el) {
        el.style.setProperty('--eva-menu-row-height', (el.scrollHeight + 1) + 'px');
      },
      clearMenuRowHeight: function (el) {
        el.style.removeProperty('--eva-menu-row-height');
      },
      measureMenuDropdown: function (el) {
        el.style.setProperty('--eva-menu-dropdown-height', (el.scrollHeight + 2) + 'px');
      },
      clearMenuDropdownHeight: function (el) {
        el.style.removeProperty('--eva-menu-dropdown-height');
      },
      // Keep anchored controls positioned when they mount and finish sliding.
      menuAfterEnter: function (el) {
        if (this._menuMotionDisposed) { return; }
        if (el === this.$refs.menuActionsPanel) { this.positionMenuActions(); }
        else if (el === this.$refs.menuItemEditor) { this.positionMenuItemEditor(); }
        else if (el === this.$refs.menuLocationsPanel) { this.positionMenuLocations(); }
        else if (el === this.$refs.menuAddPanel) { this.positionMenuAddPanel(); }
        else if (el === this.$refs.menuSubmenuPanel) { this.positionMenuSubmenuPanel(); }
      },
      menuCancelMotion: function (el) { stopMenuMotion(el, true); },
      // 功能：i18n 兜底取值。
      tv: function (value) {
        return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(value) : (value || '');
      },
      // 功能：取词条。外壳文案走 Languages/*.php 的 pb_* 键。
      t: function (key) {
        return window.EvaI18n && window.EvaI18n.t ? window.EvaI18n.t(key) : key;
      },
      // 功能：更新构建器两侧浮动面板透明度。
      setPanelOpacity: function (value) {
        var next = Math.max(40, Math.min(100, parseInt(value, 10) || 88));
        this.panelOpacity = next;
        document.documentElement.style.setProperty('--eva-pb-panel-opacity', String(next) + '%');
        try { window.localStorage.setItem('eva_fw_panel_opacity', String(next)); } catch (e) {}
      },
      // 功能：切换构建器 iframe 的临时预览身份，不改变真实登录状态。
      setPreviewRole: function (value) {
        var next = String(value || 'current');
        if (!this.previewRoleOptions.some(function (role) { return String(role.value) === next; })) {
          next = 'current';
        }
        this.previewRole = next;
        try { window.localStorage.setItem('eva_fw_builder_preview_role', next); } catch (e) {}
        this.queuePreview(0);
      },
      // 功能：顶栏品牌名。字段可用 brand 指定，让构建器显示宿主主题/插件的名字，
      // 不传才回落到框架自己的标识。
      brandName: function () {
        return (this.field && this.field.brand) || 'EVA Framework';
      },
      // 功能：顶栏品牌版本号，同样可由字段的 brand_version 指定。
      brandVersion: function () {
        return (this.field && this.field.brand_version) || 'v1.0.0';
      },
      // 功能：模块注册表。
      registry: function () {
        return window.EvaModules || {};
      },
      // 功能：真实前台 iframe 预览地址。
      // 字段可用 preview_url 指定自己的预览目标（例如文章页画布预览一篇文章），
      // 没指定时回落到全局的首页预览地址。
      previewUrl: function () {
        var page = this.currentPage();
        var base = (page && page.preview_url) || (this.field && this.field.preview_url) || cfg.builderPreviewUrl || '/';
        try {
          var url = new URL(base, window.location.origin);
          url.searchParams.set('eva_preview_role', this.previewRole || 'current');
          return url.toString();
        } catch (e) {
          return base;
        }
      },
      // 功能：预览目标的显示名，字段可用 preview_label 指定。
      previewLabel: function () {
        var page = this.currentPage();
        if (page) { return page.label; }
        return (this.field && this.field.preview_label) || '首页 (Home)';
      },
      // 功能：监听 iframe 准备完成消息。
      handlePreviewMessage: function (event) {
        if (event.origin !== window.location.origin || !event.data) { return; }
        var frame = this.$refs.previewFrame;
        if (!frame || event.source !== frame.contentWindow) { return; }
        if (event.data.type === 'eva-builder-preview-ready') {
          this.previewReady = true;
          this.queuePreview(0);
          this.sendPreviewMenuState();
          this.sendPreviewWidgetState();
          this.sendPreviewDragState(!!this.draggingModule);
          return;
        }
        if (event.data.type === 'eva-builder-structure-select') {
          this.selectStructure(event.data.id);
          return;
        }
        if (event.data.type === 'eva-builder-widget-area-select') {
          if (this.widgetAreas.some(function (area) { return area.id === event.data.area; })) {
            this.moduleTab = 'widgets';
            this.widgetArea = event.data.area;
          }
          return;
        }
        if (event.data.type === 'eva-builder-menu-location-select') {
          this.selectPreviewMenuLocation(event.data.location);
          return;
        }
        if (event.data.type !== 'eva-builder-module-action') { return; }
        var uid = event.data.uid || '';
        var action = event.data.action || 'select';
        if (!uid) { return; }
        if (this.usesSlots()) {
          var value = this.builderValue();
          var owner = this.slots().find(function (slot) {
            return (value.slots[slot.id] || []).some(function (item) { return item.uid === uid; });
          });
          if (!owner) { return; }
          this.activeSlot = owner.id;
        }
        this.selectedUid = uid;
        this.selectedStructureId = '';
        this.rightTab = 'component';
        if (action === 'up') {
          this.moveItem(uid, -1);
        } else if (action === 'down') {
          this.moveItem(uid, 1);
        } else if (action === 'duplicate') {
          this.duplicateItem(uid);
        } else if (action === 'remove') {
          this.removeItem(uid);
        } else {
          this.queuePreview(0);
        }
      },
      // 功能：合并连续变更，延迟刷新 iframe。
      queuePreview: function (delay) {
        if (!this.usesSlots()) { return; }
        this.previewSeq += 1;
        if (this._previewController) { this._previewController.abort(); }
        if (this.previewTimer) {
          clearTimeout(this.previewTimer);
        }
        if (this.previewReady) { this.postPreviewHtml(this.optimisticSlots()); }
        var wait = typeof delay === 'number' ? delay : 180;
        this.previewTimer = setTimeout(this.renderPreview, wait);
      },
      // 功能：生成预览工具条 HTML，先用于本地乐观预览，随后由 PHP 真实渲染替换。
      previewToolsHtml: function () {
        return '<div class="eva-builder-preview-tools" aria-hidden="true">'
          + '<button type="button" data-eva-builder-action="up">' + this.t('pb_move_up') + '</button>'
          + '<button type="button" data-eva-builder-action="down">' + this.t('pb_move_down') + '</button>'
          + '<button type="button" data-eva-builder-action="duplicate">' + this.t('pb_duplicate') + '</button>'
          + '<button type="button" data-eva-builder-action="remove">' + this.t('pb_delete') + '</button>'
          + '</div>';
      },
      // 功能：用模块的前端 render 或 preview 模板生成即时真实预览。
      renderInstantModule: function (item) {
        var reg = this.registry();
        var module = reg[item.type] || {};
        var values = item.values || {};
        if (typeof module.render === 'function') {
          try {
            return module.render(values);
          } catch (e) {}
        }
        if (typeof module.preview === 'string' && module.preview) {
          return module.preview.replace(/\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g, function (match, key) {
            return esc(values[key] === undefined ? '' : values[key]);
          });
        }
        return '';
      },
      // 功能：生成单个模块的即时占位 HTML。
      optimisticModuleHtml: function (item) {
        var uid = esc(item && item.uid ? item.uid : '');
        var type = esc(item && item.type ? item.type : '');
        var label = esc(this.tv(this.moduleLabel(item.type)));
        var instant = this.renderInstantModule(item);
        return '<div class="eva-builder-preview-module is-pending" data-eva-builder-module="' + uid + '" data-eva-builder-type="' + type + '">'
          + this.previewToolsHtml()
          + (instant || '<section class="eva-builder-preview-pending"><strong>' + label + '</strong><span>' + this.t('pb_rendering') + '</span></section>')
          + '</div>';
      },
      // 功能：把当前 Builder 值转换成 iframe 可立即显示的占位 HTML。
      optimisticSlots: function () {
        return this.optimisticSlotsFromValue(this.builderValue());
      },
      // 功能：把指定 Builder 值转换成 iframe 可立即显示的占位 HTML。
      optimisticSlotsFromValue: function (value) {
        var slots = {};
        Object.keys(value.slots || {}).forEach(function (slot) {
          var items = Array.isArray(value.slots[slot]) ? value.slots[slot] : [];
          slots[slot] = items.map(function (item) {
            return this.optimisticModuleHtml(item);
          }, this).join('');
        }, this);
        return slots;
      },
      // 功能：向 iframe 发送 HTML 更新。
      postPreviewHtml: function (slots, structures) {
        var frame = this.$refs.previewFrame;
        if (!frame || !frame.contentWindow) { return; }
        frame.contentWindow.postMessage({
          type: 'eva-builder-preview-html',
          slots: slots || {},
          structures: structures || {},
          activeSlot: this.currentSlotId(),
          selectedUid: this.selectedUid || '',
          selectedStructure: this.selectedStructureId || ''
        }, window.location.origin);
      },
      // 功能：通知 iframe 当前是否处于拖拽投放状态。
      sendPreviewDragState: function (active) {
        var frame = this.$refs.previewFrame;
        if (!frame || !frame.contentWindow) { return; }
        frame.contentWindow.postMessage({
          type: 'eva-builder-drag-state',
          active: !!active || !!this.draggingWidget,
          moduleType: this.draggingModule || '',
          menuLocation: this.draggingMenuLocation || '',
          widgetDragging: !!this.draggingWidget,
          widgetArea: this.draggingWidgetArea || ''
        }, window.location.origin);
      },
      // 功能：菜单面板与 iframe 中的真实菜单位置同步高亮。
      sendPreviewMenuState: function () {
        var frame = this.$refs.previewFrame;
        if (!frame || !frame.contentWindow) { return; }
        frame.contentWindow.postMessage({
          type: 'eva-builder-menu-state',
          active: this.moduleTab === 'menu',
          location: this.menuLocation || ''
        }, window.location.origin);
      },
      selectPreviewMenuLocation: function (location) {
        var id = String(location || '');
        if (!this.menuLocationData().some(function (item) { return String(item.id) === id; })) { return; }
        this.moduleTab = 'menu';
        this.setMenuLocation(id);
        this.sendPreviewMenuState();
      },
      // 功能：拖拽遮罩接收坐标，再映射回 iframe 真实菜单节点，兼容画布缩放。
      previewMenuLocationAt: function (event) {
        var frame = this.$refs.previewFrame;
        if (!frame || !event) { return ''; }
        try {
          var rect = frame.getBoundingClientRect();
          if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { return ''; }
          var x = (event.clientX - rect.left) * frame.clientWidth / rect.width;
          var y = (event.clientY - rect.top) * frame.clientHeight / rect.height;
          var doc = frame.contentDocument;
          var element = doc && doc.elementFromPoint(x, y);
          var target = element && element.closest('[data-eva-menu-location]');
          var location = target ? target.getAttribute('data-eva-menu-location') : '';
          return this.menuLocationData().some(function (item) { return String(item.id) === location; }) ? location : '';
        } catch (error) { return ''; }
      },
      // 拖放以鼠标所在的真实区域为准，并按模块中线确定插入位置，兼容 iframe 缩放。
      previewModuleTargetAt: function (event) {
        var frame = this.$refs.previewFrame;
        if (!frame || !event) { return null; }
        try {
          var rect = frame.getBoundingClientRect();
          if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { return null; }
          var x = (event.clientX - rect.left) * frame.clientWidth / rect.width;
          var y = (event.clientY - rect.top) * frame.clientHeight / rect.height;
          var doc = frame.contentDocument;
          var node = doc && doc.elementFromPoint(x, y);
          var target = node && node.closest('[data-eva-builder-slot]');
          var slot = target ? target.getAttribute('data-eva-builder-slot') : '';
          if (!this.slots().some(function (entry) { return entry.id === slot; })) { return null; }
          var items = this.builderValue().slots[slot] || [];
          var modules = Array.from(target.querySelectorAll('[data-eva-builder-module]')).filter(function (module) {
            return module.closest('[data-eva-builder-slot]') === target;
          });
          var index = items.length;
          for (var i = 0; i < modules.length; i += 1) {
            var uid = modules[i].getAttribute('data-eva-builder-module');
            var at = items.findIndex(function (item) { return item.uid === uid; });
            var bounds = modules[i].getBoundingClientRect();
            if (at >= 0 && bounds.height && y < bounds.top + bounds.height / 2) {
              index = at;
              break;
            }
          }
          return { slot: slot, index: index };
        } catch (error) { return null; }
      },
      // 功能：请求 PHP 渲染未保存内容，再 postMessage 给 iframe。
      renderPreview: function () {
        if (!this.usesSlots() || !cfg.ajaxUrl || !this.previewReady) { return; }
        var frame = this.$refs.previewFrame;
        if (!frame || !frame.contentWindow) { return; }

        var seq = ++this.previewSeq;
        var current = this.builderValue();
        var slots = {};
        this.slots().forEach(function (slot) { slots[slot.id] = current.slots[slot.id] || []; });
        var serialized = JSON.stringify({ slots: slots });
        var structureValues = this.structureValues();
        var key = (this.previewRole || 'current') + '|' + (this.activePage || '') + '|' + serialized + '|' + JSON.stringify(structureValues);
        this._previewCache = this._previewCache || new Map();
        if (this._previewCache.has(key)) {
          var cached = this._previewCache.get(key);
          this.postPreviewHtml(cached.slots, cached.structures);
          return;
        }
        if (this._previewController) { this._previewController.abort(); }
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        this._previewController = controller;

        var fd = new FormData();
        fd.append('action', 'eva_fw_render_builder_preview');
        fd.append('nonce', cfg.nonce || '');
        fd.append('preview_role', this.previewRole || 'current');
        fd.append('value', serialized);
        fd.append('option_id', this.field.fixed_option_id || '');
        fd.append('field_id', this.field.id || '');
        fd.append('page_id', this.currentPage() ? this.currentPage().id : '');
        fd.append('structure_values', JSON.stringify(structureValues));

        fetch(cfg.ajaxUrl, {
          method: 'POST',
          credentials: 'same-origin',
          body: fd,
          signal: controller ? controller.signal : undefined
        }).then(function (res) {
          if (!res.ok) { throw new Error('Preview request failed'); }
          return res.json();
        }).then(function (json) {
          if (seq !== this.previewSeq) { return; }
          if (!json || !json.success || !json.data) { return; }
          this._previewCache.set(key, { slots: json.data.slots || {}, structures: json.data.structures || {} });
          if (this._previewCache.size > 20) { this._previewCache.delete(this._previewCache.keys().next().value); }
          this.postPreviewHtml(json.data.slots || {}, json.data.structures || {});
        }.bind(this)).catch(function () {}).finally(function () {
          if (this._previewController === controller) { this._previewController = null; }
        }.bind(this));
      },
      // 功能：构建器模块分组。
      moduleTabs: function () {
        return [
          { id: 'components', label: '组件', icon: 'ri-layout-grid-line' },
          { id: 'menu', label: '菜单', icon: 'ri-menu-line' },
          { id: 'widgets', label: '小工具', icon: 'ri-layout-grid-line' },
          { id: 'container', label: '容器设置', icon: 'ri-settings-3-line' }
        ];
      },
      modulesForTab: function () {
        if (this.moduleTab !== 'components') { return []; }
        return this.moduleList().filter(function (item) {
          return item.type !== 'wp_menu' && item.type !== 'wp_widgets';
        });
      },
      // 小工具页签只管理实际区域与内容，不提供原生区域的插入卡片。
      widgetAreaOptions: function () {
        return this.widgetAreas.map(function (area) { return { value: area.id, label: area.name }; });
      },
      selectedWidgetArea: function () {
        return this.widgetAreas.find(function (area) { return area.id === this.widgetArea; }.bind(this)) || null;
      },
      sendPreviewWidgetState: function () {
        var frame = this.$refs.previewFrame;
        if (!frame || !frame.contentWindow) { return; }
        frame.contentWindow.postMessage({ type: 'eva-builder-widget-state', active: this.moduleTab === 'widgets', area: this.widgetArea || '' }, window.location.origin);
      },
      onWidgetDragStart: function (event, operation, id) {
        if (this.widgetsSaving || this.widgetsLoading || !this.widgetAreas.length) { event.preventDefault(); return; }
        this.draggingModule = '';
        this.draggingWidget = { operation: operation, id: id };
        this.draggingWidgetArea = '';
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = operation === 'add' ? 'copy' : 'move';
          event.dataTransfer.setData('application/x-eva-widget', JSON.stringify(this.draggingWidget));
          event.dataTransfer.setData('text/plain', id);
        }
        this.sendPreviewDragState(true);
      },
      onWidgetDragEnd: function () {
        this.draggingWidget = null;
        this.draggingWidgetArea = '';
        this.sendPreviewDragState(false);
      },
      previewWidgetAreaAt: function (event) {
        var frame = this.$refs.previewFrame;
        if (!frame || !event) { return ''; }
        try {
          var rect = frame.getBoundingClientRect();
          if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { return ''; }
          var node = frame.contentDocument.elementFromPoint((event.clientX - rect.left) * frame.clientWidth / rect.width, (event.clientY - rect.top) * frame.clientHeight / rect.height);
          var target = node && node.closest('[data-eva-widget-area]');
          var id = target ? target.getAttribute('data-eva-widget-area') : '';
          return this.widgetAreas.some(function (area) { return area.id === id; }) ? id : '';
        } catch (error) { return ''; }
      },
      dropWidget: function (area, before) {
        var dragged = this.draggingWidget;
        this.onWidgetDragEnd();
        if (dragged && area) { return this.changeWidget(dragged.operation, dragged.id, area, before || ''); }
      },
      moveWidget: function (item, direction) {
        var area = this.selectedWidgetArea();
        if (!area) { return; }
        var at = area.items.findIndex(function (entry) { return entry.id === item.id; });
        if (at < 0 || at + direction < 0 || at + direction >= area.items.length) { return; }
        var before = direction < 0 ? area.items[at - 1].id : ((area.items[at + 2] || {}).id || '');
        return this.changeWidget('move', item.id, area.id, before);
      },
      changeWidget: function (operation, id, area, before) {
        if (this.widgetsSaving || this.widgetsLoading || !cfg.ajaxUrl || !this.widgetAreas.some(function (entry) { return entry.id === area; })) { return Promise.resolve(); }
        this.widgetsSaving = true;
        this.widgetsError = '';
        this.widgetsStatus = '正在保存…';
        var fd = new FormData();
        fd.append('action', 'eva_fw_builder_widget_change');
        fd.append('nonce', cfg.nonce || '');
        fd.append('operation', operation);
        fd.append('widget', id);
        fd.append('area', area);
        fd.append('before', before || '');
        return fetch(cfg.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: fd }).then(function (res) { return res.json(); }).then(function (json) {
          if (this._widgetsDisposed) { return; }
          if (!json || !json.success || !json.data) { throw new Error((json && json.data && json.data.message) || '小工具保存失败'); }
          this.widgetAreas = Array.isArray(json.data.areas) ? json.data.areas : [];
          this.availableWidgets = Array.isArray(json.data.available) ? json.data.available : [];
          this.widgetArea = json.data.area_id || area;
          this.widgetsStatus = operation === 'add' ? '已添加。需要填写内容的小工具，请在小工具编辑器中配置。' : (operation === 'remove' ? '已从区域删除，配置保留在未启用的小工具中。' : '位置已保存。');
          var frame = this.$refs.previewFrame;
          if (frame && frame.contentWindow) {
            this.previewReady = false;
            frame.contentWindow.location.reload();
          }
        }.bind(this)).catch(function (error) {
          if (!this._widgetsDisposed) { this.widgetsError = error.message || '小工具保存失败，请重试。'; this.widgetsStatus = ''; }
        }.bind(this)).finally(function () { if (!this._widgetsDisposed) { this.widgetsSaving = false; } }.bind(this));
      },
      loadWidgets: function () {
        if (this.widgetsLoading || this.widgetsSaving) { return; }
        if (!cfg.ajaxUrl) { this.widgetsError = '小工具读取接口不可用。'; return; }
        var controller = new AbortController();
        this._widgetsController = controller;
        this.widgetsLoading = true;
        this.widgetsError = '';
        var fd = new FormData();
        fd.append('action', 'eva_fw_builder_widgets_get');
        fd.append('nonce', cfg.nonce || '');
        fetch(cfg.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: fd, signal: controller.signal }).then(function (res) {
          if (!res.ok) { throw new Error('读取失败'); }
          return res.json();
        }).then(function (json) {
          if (!json || !json.success || !json.data) { throw new Error((json && json.data && json.data.message) || '小工具读取失败'); }
          this.widgetAreas = Array.isArray(json.data.areas) ? json.data.areas : [];
          this.availableWidgets = Array.isArray(json.data.available) ? json.data.available : [];
          this.widgetsEditorUrl = json.data.editor_url || '';
          if (!this.selectedWidgetArea()) { this.widgetArea = this.widgetAreas.length ? this.widgetAreas[0].id : ''; }
          this.widgetsLoaded = true;
          this.sendPreviewWidgetState();
        }.bind(this)).catch(function (error) {
          if (error.name !== 'AbortError') { this.widgetsError = error.message || '小工具读取失败，请重试。'; }
        }.bind(this)).finally(function () {
          this.widgetsLoading = false;
          this._widgetsController = null;
        }.bind(this));
      },
      menuLocationData: function () {
        var data = Array.isArray(this.menuLocationDataOverride) ? this.menuLocationDataOverride : (this.field && this.field.menu_location_data);
        return Array.isArray(data) ? data : [];
      },
      menuLocationCount: function () {
        return this.menuLocationData().length;
      },
      menuLocationAssignedCount: function () {
        return this.menuLocationData().filter(function (location) {
          return Number(location.menu_id || 0) > 0;
        }).length;
      },
      menuLocationOptions: function () {
        return this.menuLocationData().map(function (location) {
          var label = location.label || location.id;
          return {
            value: String(location.id),
            label: location.menu_name ? label + ' —— ' + location.menu_name : label
          };
        });
      },
      setMenuLocation: function (value) {
        this.closeMenuLocations(false);
        this.closeMenuActions(false);
        this.menuDeleteRequest = null;
        this.closeMenuAddPanel(false);
        this.closeMenuSubmenu(false);
        this.cancelMenuEditorDrag();
        this.menuLocation = String(value || '');
        this.menuEditor = null;
        this.menuEditorError = '';
        this.menuEditorStatus = '';
        this.menuCreateName = '';
        this.menuCreateError = '';
        this.menuExistingId = '';
        this.menuAssignError = '';
        this.menuEditorSelectedItem = '';
        this.menuEditorScopeKey = '';
        this.menuAddParentKey = '';
        this.menuEditorRemovedIds = [];
        this.menuEditorLoadSeq += 1;
        this.menuEditorLoading = false;
        if (this._menuEditorReadController) { this._menuEditorReadController.abort(); }
        if (this.menuLocation) { this.loadMenuEditor(); }
      },
      loadMenuEditor: function () {
        if (!cfg.ajaxUrl || !this.menuLocation) { return; }
        if (this._menuEditorReadController) { this._menuEditorReadController.abort(); }
        var seq = ++this.menuEditorLoadSeq;
        var location = this.menuLocation;
        this._menuEditorCache = this._menuEditorCache || {};
        var cached = this._menuEditorCache[location];
        if (cached && Date.now() - cached.time < 10000) {
          this.applyMenuEditorData(clone(cached.data));
          this.menuEditorLoading = false;
          return;
        }
        var controller = new AbortController();
        this._menuEditorReadController = controller;
        this.menuEditorLoading = true;
        this.menuEditorError = '';
        var fd = new FormData();
        fd.append('action', 'eva_fw_builder_menu_get');
        fd.append('nonce', cfg.nonce || '');
        fd.append('location_id', this.menuLocation);
        if (this.menuAddGroups().some(function (group) { return group.id !== 'custom' && !this.menuAddCached(group.id, ''); }.bind(this))) {
          fd.append('include_resources', '1');
        }
        fetch(cfg.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: fd, signal: controller.signal }).then(function (res) {
          return res.json();
        }).then(function (json) {
          if (seq !== this.menuEditorLoadSeq) { return; }
          if (!json || !json.success || !json.data) {
            this.menuEditorError = (json && json.data && json.data.message) || '菜单读取失败';
            return;
          }
          this.applyMenuEditorData(json.data);
          this._menuEditorCache[location] = { time: Date.now(), data: clone(this.menuEditor) };
        }.bind(this)).catch(function (error) {
          if (error && error.name === 'AbortError') { return; }
          if (seq === this.menuEditorLoadSeq) { this.menuEditorError = '菜单读取失败，请稍后重试'; }
        }.bind(this)).finally(function () {
          if (seq === this.menuEditorLoadSeq) { this.menuEditorLoading = false; this._menuEditorReadController = null; }
        }.bind(this));
      },
      applyMenuEditorData: function (data) {
        if (data.resources) {
          Object.keys(data.resources).forEach(function (type) { this.cacheMenuAddItems(type, '', data.resources[type]); }.bind(this));
          delete data.resources;
        }
        data.items = (data.items || []).map(function (item) {
          item.client_key = item.client_key || ('item-' + String(item.id));
          return item;
        });
        var draft = this.menuEditorDrafts[String(data.menu_id || '')];
        if (draft) {
          var location = data.location_id;
          data = clone(draft.data);
          data.location_id = location;
        }
        this.menuEditor = data;
        this.menuEditorStatus = draft ? '有未保存的修改' : '';
        this.menuExistingId = '';
        this.menuAssignError = '';
        if (!Number(data.menu_id || 0)) { this.menuCreateName = data.location_label || ''; }
        this.menuEditorRemovedIds = draft ? draft.removedIds.slice() : [];
        if (Array.isArray(data.menu_location_data)) { this.menuLocationDataOverride = data.menu_location_data; }
      },
      existingMenuOptions: function () {
        var menus = this.menuEditor && this.menuEditor.available_menus;
        return (Array.isArray(menus) ? menus : []).map(function (menu) {
          var used = !!menu.disabled || (Array.isArray(menu.locations) && menu.locations.length > 0);
          return {
            value: String(menu.id),
            label: menu.name + (used ? '（已使用：' + (menu.locations || []).join('、') + '）' : '（未使用）'),
            disabled: used
          };
        });
      },
      selectExistingMenu: function (value) {
        var option = this.existingMenuOptions().find(function (entry) { return entry.value === String(value); });
        this.menuExistingId = option && !option.disabled ? option.value : '';
        this.menuAssignError = '';
      },
      refreshMenuChoices: function () {
        if (this.menuAssigning || this.menuCreating) { return; }
        this._menuEditorCache = {};
        this.loadMenuEditor();
      },
      assignExistingMenu: function () {
        if (this.menuAssigning || this.menuCreating || !this.menuEditor || Number(this.menuEditor.menu_id || 0)) { return; }
        var option = this.existingMenuOptions().find(function (entry) { return entry.value === String(this.menuExistingId); }, this);
        this.menuAssignError = '';
        if (!option || option.disabled) { this.menuAssignError = '请选择未使用的菜单。'; return; }
        if (!cfg.ajaxUrl) { this.menuAssignError = '菜单绑定接口不可用。'; return; }
        var location = this.menuLocation;
        var fd = new FormData();
        fd.append('action', 'eva_fw_builder_menu_assign');
        fd.append('nonce', cfg.nonce || '');
        fd.append('location_id', location);
        fd.append('menu_id', option.value);
        this.menuAssigning = true;
        return fetch(cfg.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: fd }).then(function (res) {
          return res.json();
        }).then(function (json) {
          if (!json || !json.success || !json.data) { throw new Error((json && json.data && json.data.message) || '菜单绑定失败，请重试。'); }
          this._menuEditorCache = {};
          if (Array.isArray(json.data.menu_location_data)) { this.menuLocationDataOverride = json.data.menu_location_data; }
          if (this.menuLocation === location) {
            // 清除绑定前发出的读取请求，避免空位置的旧响应覆盖新绑定结果。
            this.menuEditorLoadSeq += 1;
            if (this._menuEditorReadController) { this._menuEditorReadController.abort(); }
            this.menuEditorLoading = false;
            this.applyMenuEditorData(json.data);
            this.menuEditorStatus = '菜单已绑定，可编辑菜单项';
          }
          this.refreshMenuPreview();
        }.bind(this)).catch(function (error) {
          if (this.menuLocation === location) { this.menuAssignError = error.message || '菜单绑定失败，请重试。'; }
        }.bind(this)).finally(function () {
          this.menuAssigning = false;
        }.bind(this));
      },
      createMenu: function () {
        if (this.menuCreating || this.menuAssigning || !this.menuEditor || Number(this.menuEditor.menu_id || 0)) { return; }
        var name = String(this.menuCreateName || '').trim();
        this.menuCreateError = '';
        if (!name) { this.menuCreateError = '请输入菜单名称。'; return; }
        if (!cfg.ajaxUrl) { this.menuCreateError = '菜单创建接口不可用。'; return; }
        var location = this.menuLocation;
        var fd = new FormData();
        fd.append('action', 'eva_fw_builder_menu_create');
        fd.append('nonce', cfg.nonce || '');
        fd.append('location_id', location);
        fd.append('menu_name', name);
        this.menuCreating = true;
        fetch(cfg.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: fd }).then(function (res) {
          return res.json();
        }).then(function (json) {
          if (!json || !json.success || !json.data) { throw new Error((json && json.data && json.data.message) || '菜单创建失败，请重试。'); }
          this._menuEditorCache = {};
          if (Array.isArray(json.data.menu_location_data)) { this.menuLocationDataOverride = json.data.menu_location_data; }
          if (this.menuLocation === location) {
            this.applyMenuEditorData(json.data);
            this.menuEditorStatus = '菜单已创建，可添加菜单项';
          }
          this.refreshMenuPreview();
        }.bind(this)).catch(function (error) {
          if (this.menuLocation === location) { this.menuCreateError = error.message || '菜单创建失败，请重试。'; }
        }.bind(this)).finally(function () {
          this.menuCreating = false;
        }.bind(this));
      },
      menuActionUrl: function (item) {
        if (!item || !String(item.url || '').trim()) { return ''; }
        try {
          var url = new URL(String(item.url), window.location.href);
          return /^https?:$/.test(url.protocol) ? url.href : '';
        } catch (error) { return ''; }
      },
      toggleMenuActions: function (item, event) {
        this.closeMenuLocations(false);
        var key = this.menuEditorItemKey(item);
        if (this.menuActionKey === key) { this.closeMenuActions(); return; }
        this.closeMenuActions(false);
        this.closeMenuAddPanel(false);
        this.closeMenuSubmenu(false);
        this.menuActionKey = key;
        this.menuActionStatus = '';
        this.menuActionPosition.ready = false;
        this._menuActionsTrigger = event.currentTarget;
        this.$nextTick(function () {
          if (this.menuActionKey !== key) { return; }
          this.positionMenuActions();
          if (!this.menuActionKey) { return; }
          this._menuActionsOutside = function (event) {
            var panel = this.$refs.menuActionsPanel, trigger = this._menuActionsTrigger, editor = this.$refs.menuItemEditor;
            var picker = this.menuEditOpen && event.target.closest && event.target.closest('.eva-link-picker-backdrop.is-portal');
            if (picker || (editor && editor.contains(event.target))) { return; }
            if ((!panel || !panel.contains(event.target)) && (!trigger || !trigger.contains(event.target))) { this.closeMenuActions(false); }
          }.bind(this);
          this._menuActionsLayout = this.positionMenuActions.bind(this);
          this._menuActionsKey = this.onMenuActionsKey.bind(this);
          this._menuActionsBlur = function () { this.closeMenuActions(false); }.bind(this);
          document.addEventListener('pointerdown', this._menuActionsOutside, true);
          document.addEventListener('keydown', this._menuActionsKey);
          document.addEventListener('scroll', this._menuActionsLayout, true);
          window.addEventListener('resize', this._menuActionsLayout);
          window.addEventListener('blur', this._menuActionsBlur);
          if (typeof ResizeObserver !== 'undefined') {
            this._menuActionsResize = new ResizeObserver(this._menuActionsLayout);
            this._menuActionsResize.observe(this.$el.querySelector('.eva-pb-body'));
          }
          this.$nextTick(function () {
            if (this.menuActionKey !== key || this.menuEditOpen) { return; }
            var panel = this.$refs.menuActionsPanel;
            var first = panel && panel.querySelector('[role="menuitem"]:not([disabled])');
            if (first) { first.focus({ preventScroll: true }); }
          });
        });
      },
      positionMenuActions: function () {
        var panel = this.$refs.menuActionsPanel, trigger = this._menuActionsTrigger;
        if (!this.menuActionKey || !panel || !trigger || !trigger.isConnected) { this.closeMenuActions(false); return; }
        var position = this.menuFloatingPosition(trigger, 232, panel.scrollHeight + 2, 200);
        if (position) { this.menuActionPosition = position; this.positionMenuItemEditor(); } else { this.closeMenuActions(false); }
      },
      menuActionsStyle: function () {
        var p = this.menuActionPosition;
        return { left: p.left + 'px', top: p.top + 'px', width: p.width + 'px', maxHeight: p.height + 'px', visibility: p.ready ? 'visible' : 'hidden', '--eva-menu-anchor-y': p.arrow + 'px', '--eva-menu-anchor-gap': p.gap + 'px' };
      },
      closeMenuActions: function (restoreFocus) {
        this.closeMenuItemEditor(false);
        var trigger = this._menuActionsTrigger;
        this.menuActionKey = '';
        this._menuActionsTrigger = null;
        if (this._menuActionsOutside) { document.removeEventListener('pointerdown', this._menuActionsOutside, true); }
        if (this._menuActionsKey) { document.removeEventListener('keydown', this._menuActionsKey); }
        if (this._menuActionsLayout) {
          document.removeEventListener('scroll', this._menuActionsLayout, true);
          window.removeEventListener('resize', this._menuActionsLayout);
        }
        if (this._menuActionsBlur) { window.removeEventListener('blur', this._menuActionsBlur); }
        if (this._menuActionsResize) { this._menuActionsResize.disconnect(); this._menuActionsResize = null; }
        if (restoreFocus !== false && trigger && trigger.isConnected) { trigger.focus({ preventScroll: true }); }
      },
      onMenuActionsKey: function (event) {
        if (event.defaultPrevented) { return; }
        var editor = this.$refs.menuItemEditor;
        var inEditor = editor && editor.contains(event.target);
        var picker = this.menuEditOpen && event.target.closest && event.target.closest('.eva-link-picker-backdrop.is-portal');
        if (picker) { return; }
        if (inEditor) {
          // 输入框和下拉组件自行处理方向键、Tab 和自己的 Escape。
          if (event.key === 'Escape' && !event.target.closest('.eva-select, .eva-icon-picker')) {
            event.preventDefault(); event.stopPropagation(); this.closeMenuItemEditor();
          }
          return;
        }
        if (event.key === 'Escape' && this.menuEditOpen) { event.preventDefault(); this.closeMenuItemEditor(); return; }
        if (event.key === 'Escape' || event.key === 'Tab') {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
          this.closeMenuActions();
          return;
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(event.key) === -1) { return; }
        var panel = this.$refs.menuActionsPanel;
        if (!panel) { return; }
        event.preventDefault();
        var items = Array.from(panel.querySelectorAll('[role="menuitem"]:not([disabled])'));
        if (!items.length) { return; }
        var index = items.indexOf(document.activeElement);
        index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
        items[index].focus({ preventScroll: true });
      },
      runMenuAction: function (action, event) {
        var item = this.menuActionItem, trigger = this._menuActionsTrigger;
        if (!item || this.menuEditorItemIsRemoved(item)) { this.closeMenuActions(false); return; }
        if (action === 'copy') {
          var url = this.menuActionUrl(item);
          if (!url || !navigator.clipboard || !navigator.clipboard.writeText) { this.menuActionStatus = '请在编辑面板中复制链接'; return; }
          var key = this.menuActionKey;
          navigator.clipboard.writeText(url).then(function () { if (this.menuActionKey === key) { this.menuActionStatus = '链接已复制'; } }.bind(this)).catch(function () { if (this.menuActionKey === key) { this.menuActionStatus = '复制失败，请在编辑面板中复制'; } }.bind(this));
          return;
        }
        if (action === 'edit') {
          this.selectMenuEditorItem(item, this.menuEditor.items.indexOf(item), event && event.currentTarget);
          return;
        }
        this.closeMenuActions(false);
        if (action === 'children') { this.openMenuSubmenu(item, { currentTarget: trigger }); }
        else if (action === 'delete') {
          if (trigger && trigger.isConnected) { trigger.focus({ preventScroll: true }); }
          this.removeMenuEditorItem(this.menuEditor.items.indexOf(item));
        }
      },
      menuEditorItemKey: function (item, index) {
        return item && item.client_key ? item.client_key : (item && item.id ? 'item-' + item.id : 'new-' + index);
      },
      menuEditorItemType: function (item) {
        if (!item) { return '菜单项'; }
        if (item.type === 'custom') { return '自定义链接'; }
        if (item.type === 'post_type') { return item.object === 'page' ? '页面' : '文章'; }
        if (item.type === 'taxonomy') { return item.object === 'post_tag' ? '标签' : (item.object === 'post_format' ? '格式' : '分类目录'); }
        if (item.type === 'post_type_archive') { return '内容归档'; }
        return '菜单项';
      },
      menuEditorCustomSettings: function (item) {
        item = item || this.menuActionItem || this.menuEditorActiveItem;
        if (!item || !this.menuEditor) { return []; }
        var depth = this.menuEditorItemDepth(item), entries = [];
        (this.menuEditor.menu_field_containers || []).forEach(function (container) {
          var values = item.custom_fields && item.custom_fields[container.id] || {};
          (container.sections || []).forEach(function (section) {
            this.visibleFields(section.fields || [], values).forEach(function (field) {
              if (!field.id || field.save === false || ['html', 'content', 'heading', 'subheading', 'notice', 'submessage'].indexOf(field.type) !== -1) { return; }
              if (field.menu !== undefined && field.menu !== '') {
                var range = String(field.menu).split(',').map(Number), from = range[0] - 1, to = (range.length > 1 ? range[1] : range[0]) - 1;
                if (depth < from || depth > to) { return; }
              }
              entries.push({ id: 'registered:' + encodeURIComponent(container.id) + ':' + encodeURIComponent(field.id), container: container.id, field: field, label: this.tv(field.title || field.subtitle || '菜单项设置'), icon: field.type === 'icon' ? 'ri-star-line' : field.type === 'image_select' ? 'ri-layout-line' : 'ri-edit-line' });
            }.bind(this));
          }.bind(this));
        }.bind(this));
        return entries;
      },
      menuEditorCustomSetting: function () {
        return this.menuEditorCustomSettings(this.menuEditorActiveItem).find(function (entry) { return entry.id === this.menuEditSetting; }.bind(this));
      },
      menuEditorCustomField: function (setting) {
        return Object.assign({}, setting.field, { picker_portal: true });
      },
      menuEditorCustomValue: function (item, setting) {
        var values = item.custom_fields && item.custom_fields[setting.container] || {};
        return hasOwn(values, setting.field.id) ? values[setting.field.id] : (setting.field.default !== undefined ? setting.field.default : '');
      },
      setMenuEditorCustomValue: function (item, setting, value) {
        if (!item.custom_fields) { item.custom_fields = {}; }
        if (!item.custom_fields[setting.container]) { item.custom_fields[setting.container] = {}; }
        item.custom_fields[setting.container][setting.field.id] = value;
        if (setting.field.type === 'icon') { item.icon = String(value || ''); }
        this.markMenuEditorDirty();
      },
      menuEditorSettings: function () {
        var item = this.menuActionItem || this.menuEditorActiveItem;
        var native = [
          { id: 'title', label: '导航标签', icon: 'ri-edit-line' },
          { id: 'parent', label: '菜单父级', icon: 'ri-node-tree' },
          { id: 'order', label: '菜单排序', icon: 'ri-sort-asc' }
        ];
        var advanced = [
          { id: 'target', label: '在新标签页打开链接', icon: 'ri-external-link-line' },
          { id: 'attr_title', label: '标题属性', icon: 'ri-text' },
          { id: 'classes', label: 'CSS 类（可选）', icon: 'ri-code-s-slash-line' },
          { id: 'rel', label: '链接关系（XFN）', icon: 'ri-links-line' },
          { id: 'description', label: '描述', icon: 'ri-file-text-line' }
        ];
        if (item && item.type === 'custom') { advanced.unshift({ id: 'url', label: 'URL', icon: 'ri-link' }); }
        return native.concat(this.menuEditorCustomSettings(item), advanced);
      },
      menuEditorSettingLabel: function () {
        var setting = this.menuEditorSettings().find(function (entry) { return entry.id === this.menuEditSetting; }.bind(this));
        return setting ? setting.label : '导航标签';
      },
      openMenuEditorSetting: function (setting, event) {
        var item = this.menuActionItem;
        if (!item || this.menuEditorItemIsRemoved(item)) { return; }
        this.selectMenuEditorItem(item, this.menuEditor.items.indexOf(item), event && event.currentTarget, setting);
      },
      menuEditorIcon: function (item) {
        var setting = this.menuEditorCustomSettings(item).find(function (entry) { return entry.field.type === 'icon'; });
        var icon = setting ? this.menuEditorCustomValue(item, setting) : '';
        if (icon) { return String(icon); }
        if (item && item.object === 'page') { return 'ri-file-list-2-line'; }
        if (item && item.object === 'post_tag') { return 'ri-price-tag-3-line'; }
        if (item && item.type === 'taxonomy') { return 'ri-folder-line'; }
        return item && item.type === 'post_type' ? 'ri-article-line' : 'ri-link';
      },
      menuEditorIconSymbol: function (item) {
        var icon = this.menuEditorIcon(item);
        if (icon.charAt(0) === '#') { return icon; }
        var symbol = document.getElementById(icon);
        return symbol && String(symbol.tagName).toLowerCase() === 'symbol' ? '#' + icon : '';
      },
      menuEditorIsDescendant: function (item, parentId) {
        if (!Number(parentId)) { return false; }
        var items = this.menuEditor.items || [], id = Number(item.parent || 0), seen = {};
        while (id && !seen[id]) {
          if (id === Number(parentId)) { return true; }
          seen[id] = true;
          var parent = items.find(function (entry) { return Number(entry.id || 0) === id; });
          id = parent ? Number(parent.parent || 0) : 0;
        }
        return false;
      },
      menuEditorOrderValue: function (item) {
        if (!item) { return ''; }
        var siblings = this.menuEditorChildren(Number(item.parent || 0));
        var index = siblings.indexOf(item);
        return index < 0 ? '' : String(index + 1);
      },
      menuEditorOrderOptions: function (item) {
        if (!item) { return []; }
        var siblings = this.menuEditorChildren(Number(item.parent || 0));
        return siblings.map(function (entry, index) {
          return { value: String(index + 1), label: '第 ' + (index + 1) + ' 个，共 ' + siblings.length + ' 个' };
        });
      },
      setMenuEditorOrder: function (item, value) {
        if (!item || this.menuEditorSaving || this.menuEditorItemIsRemoved(item)) { return; }
        var siblings = this.menuEditorChildren(Number(item.parent || 0));
        var position = Number(value), current = siblings.indexOf(item);
        if (!Number.isInteger(position) || position < 1 || position > siblings.length || current < 0 || position === current + 1) { return; }
        // 与 WordPress 一致：菜单排序仅计算同级项，并携带整棵子菜单一起移动。
        this.moveMenuEditorBlock(this.menuEditorItemKey(item), this.menuEditorItemKey(siblings[position - 1]), position - 1 < current ? 'before' : 'after');
      },
      menuEditorParentOptions: function (item) {
        var options = [{ value: '0', label: '无父级' }];
        (this.menuEditor.items || []).forEach(function (entry) {
          if (entry !== item && Number(entry.id) > 0 && !this.menuEditorItemIsRemoved(entry) && !this.menuEditorIsDescendant(entry, item.id)) {
            options.push({ value: String(entry.id), label: entry.title || '未命名菜单项' });
          }
        }.bind(this));
        return options;
      },
      setMenuEditorParent: function (item, value) {
        if (!item || this.menuEditorSaving || this.menuEditorItemIsRemoved(item) || Number(item.parent || 0) === Number(value)) { return; }
        var parent = Number(value) > 0 ? (this.menuEditor.items || []).find(function (entry) { return Number(entry.id) === Number(value); }) : null;
        if (parent) {
          this.moveMenuEditorBlock(this.menuEditorItemKey(item), this.menuEditorItemKey(parent), 'inside');
        } else if (!Number(value) && Number(item.parent)) {
          var items = this.menuEditor.items, block = items.filter(function (entry) { return entry === item || this.menuEditorIsDescendant(entry, item.id); }.bind(this));
          item.parent = 0;
          this.menuEditor.items = items.filter(function (entry) { return block.indexOf(entry) === -1; }).concat(block);
          this.markMenuEditorDirty();
        }
      },
      moveMenuEditorBlock: function (sourceKey, targetKey, side) {
        var items = this.menuEditor && this.menuEditor.items || [];
        var source = items.find(function (item, i) { return this.menuEditorItemKey(item, i) === sourceKey; }.bind(this));
        var target = items.find(function (item, i) { return this.menuEditorItemKey(item, i) === targetKey; }.bind(this));
        if (!source || !target || source === target || this.menuEditorIsDescendant(target, source.id) || this.menuEditorItemIsRemoved(target)) { return; }
        if (side === 'inside' && !Number(target.id)) { return; }
        var block = [source].concat(items.filter(function (item) { return item !== source && this.menuEditorIsDescendant(item, source.id); }.bind(this)));
        var remaining = items.filter(function (item) { return block.indexOf(item) === -1; });
        var at = remaining.indexOf(target);
        if (side !== 'before') {
          remaining.forEach(function (item, i) { if (item === target || this.menuEditorIsDescendant(item, target.id)) { at = i + 1; } }.bind(this));
        }
        source.parent = side === 'inside' ? Number(target.id) : Number(target.parent || 0);
        remaining.splice.apply(remaining, [at, 0].concat(block));
        this.menuEditor.items = remaining;
        this.markMenuEditorDirty();
      },
      startMenuEditorDrag: function (event, item, index) {
        this.closeMenuActions(false);
        if (this.menuEditorSaving || (event.button !== undefined && event.button !== 0)) { return; }
        this._menuDrag = { key: this.menuEditorItemKey(item, index), pointerId: event.pointerId, x: event.clientX, y: event.clientY, handle: event.currentTarget };
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        if (event.currentTarget.setPointerCapture) { event.currentTarget.setPointerCapture(event.pointerId); }
      },
      onMenuEditorPointerMove: function (event) {
        var drag = this._menuDrag;
        if (!drag || event.pointerId !== drag.pointerId) { return; }
        if (!this.menuEditorDraggingKey && Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) < 5) { return; }
        event.preventDefault();
        this.menuEditorDraggingKey = drag.key;
        if (this.menuAddOpen) { this.closeMenuAddPanel(false); }
        if (this.menuSubmenuOpen) { this.closeMenuSubmenu(false); }
        document.body.classList.add('eva-menu-dragging');
        var list = this.$refs.menuEditorList, hit = document.elementFromPoint(event.clientX, event.clientY);
        var row = hit && hit.closest('.eva-pb-menu-editor-item');
        this.menuEditorDropKey = '';
        if (row && list && list.contains(row)) {
          var key = row.getAttribute('data-menu-key'), rect = row.getBoundingClientRect();
          var items = this.menuEditor.items || [];
          var target = items.find(function (item, i) { return this.menuEditorItemKey(item, i) === key; }.bind(this));
          var source = items.find(function (item, i) { return this.menuEditorItemKey(item, i) === drag.key; }.bind(this));
          if (target && source && target !== source && !this.menuEditorIsDescendant(target, source.id)) {
            this.menuEditorDropKey = key;
            this.menuEditorDropSide = event.clientX - drag.x > 28 && Number(target.id) ? 'inside' : (event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
          }
        }
        var scroller = list && list.closest('.eva-pb-left');
        if (scroller) {
          var bounds = scroller.getBoundingClientRect();
          if (event.clientY < bounds.top + 36) { scroller.scrollTop -= 14; }
          if (event.clientY > bounds.bottom - 36) { scroller.scrollTop += 14; }
        }
      },
      onMenuEditorPointerUp: function (event) {
        if (!this._menuDrag || event.pointerId !== this._menuDrag.pointerId) { return; }
        if (this.menuEditorDraggingKey && this.menuEditorDropKey) { this.moveMenuEditorBlock(this.menuEditorDraggingKey, this.menuEditorDropKey, this.menuEditorDropSide); }
        this.cancelMenuEditorDrag();
      },
      cancelMenuEditorDrag: function () {
        var drag = this._menuDrag;
        if (drag && drag.handle && drag.handle.hasPointerCapture && drag.handle.hasPointerCapture(drag.pointerId)) { drag.handle.releasePointerCapture(drag.pointerId); }
        this._menuDrag = null;
        this.menuEditorDraggingKey = '';
        this.menuEditorDropKey = '';
        this.menuEditorDropSide = '';
        document.body.classList.remove('eva-menu-dragging');
      },
      keyboardMenuEditorMove: function (item, delta) {
        var siblings = (this.menuEditor.items || []).filter(function (entry) { return Number(entry.parent || 0) === Number(item.parent || 0) && !this.menuEditorItemIsRemoved(entry); }.bind(this));
        var target = siblings[siblings.indexOf(item) + delta];
        if (target) { this.moveMenuEditorBlock(this.menuEditorItemKey(item), this.menuEditorItemKey(target), delta < 0 ? 'before' : 'after'); }
      },
      menuAddGroups: function () {
        return [
          { id: 'custom', label: '自定义链接', icon: 'ri-link' },
          { id: 'page', label: '页面', icon: 'ri-file-list-2-line' },
          { id: 'post', label: '文章', icon: 'ri-article-line' },
          { id: 'category', label: '分类目录', icon: 'ri-folder-line' },
          { id: 'post_tag', label: '标签', icon: 'ri-price-tag-3-line' }
        ];
      },
      openMenuAddPanel: function (parent) {
        this.closeMenuLocations(false);
        this.closeMenuActions(false);
        if (!this.menuEditor || !Number(this.menuEditor.menu_id)) { return; }
        parent = parent && Number(parent.id) > 0 ? parent : this.menuEditorFind(this.menuEditorScopeKey);
        this.menuAddParentKey = parent ? this.menuEditorItemKey(parent) : '';
        this.closeMenuSubmenu(false);
        this.menuAddOpen = true;
        this.menuAddPosition.ready = false;
        this.menuAddExpanded = {};
        this.menuAddExpanded[this.menuAddType] = true;
        if (this.menuAddType !== 'custom') { this.loadMenuAddItems(this.menuAddType); }
        this.$nextTick(function () {
          this.positionMenuAddPanel();
          if (!this.menuAddOpen) { return; }
          this.startMenuAddTracking();
          var panel = this.$refs.menuAddPanel;
          var input = panel && panel.querySelector(this.menuAddType === 'custom' ? 'input[type="url"]' : '.eva-pb-menu-add-editor .eva-pb-menu-add-search input');
          input = input || this.$refs.menuAddSearch;
          if (input) { input.focus({ preventScroll: true }); }
        }.bind(this));
      },
      toggleMenuLocations: function () {
        if (this.menuLocationsOpen) { this.closeMenuLocations(); return; }
        if (!this.menuEditor || !Number(this.menuEditor.menu_id)) { return; }
        this.closeMenuActions(false);
        this.closeMenuAddPanel(false);
        this.closeMenuSubmenu(false);
        this.menuLocationsOpen = true;
        this.menuLocationsPosition.ready = false;
        this.$nextTick(function () {
          if (!this.menuLocationsOpen) { return; }
          this.positionMenuLocations();
          this.startMenuAddTracking();
          var first = this.$refs.menuLocationsPanel && this.$refs.menuLocationsPanel.querySelector('input');
          if (first) { first.focus({ preventScroll: true }); }
        });
      },
      closeMenuLocations: function (restoreFocus) {
        this.menuLocationsOpen = false;
        this.menuLocationsPosition.ready = false;
        if (!this.menuAddOpen && !this.menuSubmenuOpen) { this.stopMenuAddTracking(); }
        if (restoreFocus !== false) { this.$nextTick(function () { if (this.$refs.menuLocationsTrigger) { this.$refs.menuLocationsTrigger.focus({ preventScroll: true }); } }); }
      },
      positionMenuLocations: function () {
        if (!this.menuLocationsOpen || !this.$refs.menuLocationsPanel || !this.$refs.menuLocationsTrigger) { return; }
        var count = this.menuEditor && this.menuEditor.locations ? this.menuEditor.locations.length : 0;
        var position = this.menuFloatingPosition(this.$refs.menuLocationsTrigger, 360, Math.min(650, 160 + count * 62), 280);
        if (position) { this.menuLocationsPosition = position; } else { this.closeMenuLocations(false); }
      },
      menuLocationsStyle: function () {
        var p = this.menuLocationsPosition;
        return { left: p.left + 'px', top: p.top + 'px', width: p.width + 'px', height: p.height + 'px', visibility: p.ready ? 'visible' : 'hidden', '--eva-menu-anchor-y': p.arrow + 'px', '--eva-menu-anchor-gap': p.gap + 'px' };
      },
      activeMenuAuxPanel: function () { return this.menuLocationsOpen ? this.$refs.menuLocationsPanel : (this.menuSubmenuOpen ? this.$refs.menuSubmenuPanel : this.$refs.menuAddPanel); },
      activeMenuAuxTrigger: function () { return this.menuLocationsOpen ? this.$refs.menuLocationsTrigger : (this.menuSubmenuOpen ? this._menuSubmenuAnchor : this.$refs.menuAddTrigger); },
      toggleMenuAddPanel: function () {
        if (this.menuAddOpen) { this.closeMenuAddPanel(); } else { this.openMenuAddPanel(); }
      },
      closeMenuAddPanel: function (restoreFocus) {
        this.menuAddOpen = false;
        this.menuAddPosition.ready = false;
        this.stopMenuAddTracking();
        this.pauseMenuAddRequests();
        if (restoreFocus !== false) { this.$nextTick(function () { if (this.$refs.menuAddTrigger) { this.$refs.menuAddTrigger.focus({ preventScroll: true }); } }.bind(this)); }
      },
      toggleMenuAddGroup: function (type) {
        this.selectMenuAddType(type);
      },
      selectMenuAddType: function (type) {
        if (!this.menuAddGroups().some(function (group) { return group.id === type; })) { return; }
        this.menuAddType = type;
        this.menuAddExpanded = {};
        this.menuAddExpanded[type] = true;
        if (type !== 'custom') { this.loadMenuAddItems(type); }
      },
      moveMenuAddType: function (delta) {
        var groups = this.menuAddFilteredGroups;
        if (!groups.length) { return; }
        var at = groups.findIndex(function (group) { return group.id === this.menuAddType; }.bind(this));
        var next = groups[(at + delta + groups.length) % groups.length];
        this.selectMenuAddType(next.id);
        this.$nextTick(function () {
          var panel = this.$refs.menuAddPanel, button = panel && panel.querySelector('[data-menu-type="' + next.id + '"]');
          if (button) { button.focus(); }
        }.bind(this));
      },
      menuAddTabIndex: function (type) {
        var groups = this.menuAddFilteredGroups;
        if (type === this.menuAddType) { return 0; }
        if (groups.some(function (group) { return group.id === this.menuAddType; }.bind(this))) { return -1; }
        return groups.length && groups[0].id === type ? 0 : -1;
      },
      menuAddDescription: function (type) {
        return type === 'custom' ? '添加任意站内或站外链接' : '选择' + this.menuAddGroups().find(function (group) { return group.id === type; }).label + '，添加到左侧菜单';
      },
      menuAddPanelStyle: function () {
        var p = this.menuAddPosition;
        return { left: p.left + 'px', top: p.top + 'px', width: p.width + 'px', height: p.height + 'px', visibility: p.ready ? 'visible' : 'hidden', '--eva-menu-anchor-y': p.arrow + 'px', '--eva-menu-anchor-gap': p.gap + 'px' };
      },
      menuFloatingPosition: function (trigger, desiredWidth, desiredHeight, minimumWidth) {
        var body = this.$el && this.$el.querySelector('.eva-pb-body');
        if (!trigger || !body) { return null; }
        var bounds = body.getBoundingClientRect(), anchor = trigger.getBoundingClientRect();
        var leftEdge = Math.max(0, bounds.left) + 16, rightEdge = Math.min(window.innerWidth, bounds.right) - 16;
        var topEdge = Math.max(0, bounds.top) + 16, bottomEdge = Math.min(window.innerHeight, bounds.bottom) - 16;
        if (anchor.bottom < topEdge || anchor.top > bottomEdge || rightEdge <= leftEdge || bottomEdge - topEdge < 160) { return null; }
        var gap = 8;
        var host = trigger.closest('.eva-pb-left, .eva-pb-menu-actions-popover, .eva-pb-menu-submenu-panel, .eva-pb-menu-add-panel');
        var hostBounds = host ? host.getBoundingClientRect() : anchor;
        var rightStart = Math.max(anchor.right, hostBounds.right) + gap, leftStart = Math.min(anchor.left, hostBounds.left) - gap;
        var availableRight = rightEdge - rightStart, availableLeft = leftStart - leftEdge;
        var side = availableRight >= minimumWidth ? 'right' : (availableLeft >= minimumWidth ? 'left' : 'overlay');
        var width = Math.min(desiredWidth, side === 'right' ? availableRight : (side === 'left' ? availableLeft : rightEdge - leftEdge));
        var height = Math.min(desiredHeight, bottomEdge - topEdge);
        var left = side === 'right' ? rightStart : (side === 'left' ? leftStart - width : leftEdge + (rightEdge - leftEdge - width) / 2);
        var center = anchor.top + anchor.height / 2;
        var top = Math.max(topEdge, Math.min(center - 72, bottomEdge - height));
        return { left: left - bounds.left, top: top - bounds.top, width: width, height: height, arrow: Math.max(18, Math.min(center - top, height - 18)), gap: Math.max(8, side === 'right' ? left - anchor.right - 8 : anchor.left - left - width - 8), side: side, ready: true };
      },
      positionMenuAddPanel: function () {
        if (!this.menuAddOpen || !this.$refs.menuAddPanel || !this.$refs.menuAddTrigger) { return; }
        var position = this.menuFloatingPosition(this.$refs.menuAddTrigger, 427, 373, 280);
        if (position) { this.menuAddPosition = position; } else { this.closeMenuAddPanel(false); }
      },
      queueMenuAddPosition: function () {
        if ((!this.menuAddOpen && !this.menuSubmenuOpen && !this.menuLocationsOpen) || this._menuAddPositionFrame) { return; }
        this._menuAddPositionFrame = window.requestAnimationFrame(function () { this._menuAddPositionFrame = 0; this.positionMenuAddPanel(); this.positionMenuSubmenuPanel(); this.positionMenuLocations(); }.bind(this));
      },
      onMenuAddOutside: function (event) {
        if (!this.menuAddOpen && !this.menuSubmenuOpen && !this.menuLocationsOpen) { return; }
        var panel = this.activeMenuAuxPanel(), trigger = this.activeMenuAuxTrigger();
        if ((panel && panel.contains(event.target)) || (trigger && trigger.contains(event.target))) { return; }
        this.closeMenuAddPanel(false);
        this.closeMenuSubmenu(false);
        this.closeMenuLocations(false);
      },
      onMenuAddKeyDown: function (event) {
        if ((this.menuAddOpen || this.menuSubmenuOpen || this.menuLocationsOpen) && event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          if (this.menuLocationsOpen) { this.closeMenuLocations(); } else if (this.menuSubmenuOpen) { this.closeMenuSubmenu(); } else { this.closeMenuAddPanel(); }
        }
      },
      onMenuAddWindowBlur: function () {
        if (this._menuAddBlurTimer) { clearTimeout(this._menuAddBlurTimer); }
        this._menuAddBlurTimer = setTimeout(function () {
          var active = document.activeElement;
          if ((this.menuAddOpen || this.menuSubmenuOpen || this.menuLocationsOpen) && active && active.tagName === 'IFRAME') {
            var panel = this.activeMenuAuxPanel();
            if (panel && !panel.contains(active)) { this.closeMenuAddPanel(false); this.closeMenuSubmenu(false); this.closeMenuLocations(false); }
          }
        }.bind(this), 0);
      },
      startMenuAddTracking: function () {
        if (!this.$el || this._menuAddTracking || (!this.menuAddOpen && !this.menuSubmenuOpen && !this.menuLocationsOpen)) { return; }
        this._menuAddTracking = true;
        this._menuAddOutsideHandler = this.onMenuAddOutside.bind(this);
        this._menuAddKeyHandler = this.onMenuAddKeyDown.bind(this);
        this._menuAddLayoutHandler = this.queueMenuAddPosition.bind(this);
        this._menuAddBlurHandler = this.onMenuAddWindowBlur.bind(this);
        document.addEventListener('pointerdown', this._menuAddOutsideHandler, true);
        document.addEventListener('keydown', this._menuAddKeyHandler);
        document.addEventListener('scroll', this._menuAddLayoutHandler, true);
        window.addEventListener('resize', this._menuAddLayoutHandler);
        window.addEventListener('blur', this._menuAddBlurHandler);
        if (typeof ResizeObserver !== 'undefined') {
          this._menuAddResizeObserver = new ResizeObserver(this._menuAddLayoutHandler);
          var body = this.$el.querySelector('.eva-pb-body'), card = this.$refs.menuAddTrigger && this.$refs.menuAddTrigger.closest('.eva-pb-menu-location-card');
          if (body) { this._menuAddResizeObserver.observe(body); }
          if (card) { this._menuAddResizeObserver.observe(card); }
        }
      },
      stopMenuAddTracking: function () {
        if (this._menuAddTracking) {
          document.removeEventListener('pointerdown', this._menuAddOutsideHandler, true);
          document.removeEventListener('keydown', this._menuAddKeyHandler);
          document.removeEventListener('scroll', this._menuAddLayoutHandler, true);
          window.removeEventListener('resize', this._menuAddLayoutHandler);
          window.removeEventListener('blur', this._menuAddBlurHandler);
        }
        this._menuAddTracking = false;
        if (this._menuAddResizeObserver) { this._menuAddResizeObserver.disconnect(); this._menuAddResizeObserver = null; }
        if (this._menuAddPositionFrame) { window.cancelAnimationFrame(this._menuAddPositionFrame); this._menuAddPositionFrame = 0; }
        if (this._menuAddBlurTimer) { clearTimeout(this._menuAddBlurTimer); this._menuAddBlurTimer = null; }
      },
      queueMenuAddSearch: function (type) {
        var state = this.menuAddRequestState(), timerKey = type || 'all';
        if (!type) { this.menuAddQueries = {}; }
        var types = type ? [type] : this.menuAddGroups().filter(function (group) { return group.id !== 'custom'; }).map(function (group) { return group.id; });
        types.forEach(function (id) {
          state.keys[id] = null;
          if (state.queued[id]) { delete state.pending[state.queued[id].key]; delete state.queued[id]; }
          if (state.searchTimers[id]) { clearTimeout(state.searchTimers[id]); delete state.searchTimers[id]; }
          this.menuAddLoading[id] = true;
        }.bind(this));
        this.abortUnusedMenuAddBatches();
        if (state.searchTimers[timerKey]) { clearTimeout(state.searchTimers[timerKey]); }
        state.searchTimers[timerKey] = setTimeout(function () {
          delete state.searchTimers[timerKey];
          if (type) { this.loadMenuAddItems(type); return; }
          this.menuAddGroups().forEach(function (group) {
            if (group.id === 'custom') { return; }
            if (this.menuAddSearch.trim()) { this.menuAddExpanded[group.id] = true; }
            if (this.menuAddExpanded[group.id]) { this.loadMenuAddItems(group.id); }
          }.bind(this));
        }.bind(this), 180);
      },
      menuAddRequestState: function () {
        if (!this._menuAddState) { this._menuAddState = { cache: {}, pending: {}, queued: {}, keys: {}, batches: [], searchTimers: {}, timer: null, disposed: false }; }
        return this._menuAddState;
      },
      menuAddCacheKey: function (type, query) { return JSON.stringify([type, String(query || '').trim()]); },
      menuAddCached: function (type, query) {
        var state = this.menuAddRequestState(), key = this.menuAddCacheKey(type, query), entry = state.cache[key];
        if (entry && Date.now() - entry.time < 30000) { return entry; }
        delete state.cache[key];
        return null;
      },
      cacheMenuAddItems: function (type, query, items) {
        var state = this.menuAddRequestState();
        state.cache[this.menuAddCacheKey(type, query)] = { time: Date.now(), items: items };
        var keys = Object.keys(state.cache);
        if (keys.length > 60) {
          keys.sort(function (a, b) { return state.cache[a].time - state.cache[b].time; });
          keys.slice(0, keys.length - 60).forEach(function (key) { delete state.cache[key]; });
        }
      },
      abortUnusedMenuAddBatches: function () {
        var state = this.menuAddRequestState();
        state.batches.forEach(function (batch) {
          if (batch.entries.some(function (entry) { return state.keys[entry.type] === entry.key; })) { return; }
          batch.controller.abort();
          batch.entries.forEach(function (entry) { if (state.pending[entry.key] === batch) { delete state.pending[entry.key]; } });
        });
      },
      pauseMenuAddRequests: function () {
        var state = this._menuAddState;
        if (!state) { return; }
        if (state.timer) { clearTimeout(state.timer); }
        Object.keys(state.searchTimers).forEach(function (key) { clearTimeout(state.searchTimers[key]); });
        state.timer = null;
        state.searchTimers = {};
        state.keys = {};
        state.queued = {};
        state.pending = {};
        state.batches.forEach(function (batch) { batch.controller.abort(); });
        this.menuAddLoading = {};
      },
      stopMenuAddRequests: function () {
        this.pauseMenuAddRequests();
        if (this._menuAddState) { this._menuAddState.disposed = true; }
      },
      loadMenuAddItems: function (type) {
        if (!cfg.ajaxUrl) { this.menuAddErrors[type] = '资源接口不可用'; return; }
        var query = String(this.menuAddQueries[type] || this.menuAddSearch || '').trim();
        var state = this.menuAddRequestState(), key = this.menuAddCacheKey(type, query), cached = this.menuAddCached(type, query);
        if (state.disposed) { return; }
        state.keys[type] = key;
        this.abortUnusedMenuAddBatches();
        var previous = state.queued[type];
        if (previous && previous.key !== key) { delete state.pending[previous.key]; delete state.queued[type]; }
        this.menuAddErrors[type] = '';
        if (cached) { this.menuAddItems[type] = cached.items; this.menuAddLoading[type] = false; return; }
        this.menuAddLoading[type] = true;
        if (state.pending[key]) { return; }
        var entry = { type: type, query: query, key: key };
        state.queued[type] = entry;
        state.pending[key] = entry;
        if (!state.timer) { state.timer = setTimeout(this.fetchMenuAddBatch, 0); }
      },
      fetchMenuAddBatch: function () {
        var state = this.menuAddRequestState();
        state.timer = null;
        var entries = Object.keys(state.queued).map(function (type) { return state.queued[type]; });
        state.queued = {};
        if (state.disposed || !entries.length) { return; }
        var queries = {};
        entries.forEach(function (entry) { queries[entry.type] = entry.query; });
        var batch = { entries: entries, controller: new AbortController() };
        state.batches.push(batch);
        entries.forEach(function (entry) { state.pending[entry.key] = batch; });
        var fd = new FormData();
        fd.append('action', 'eva_fw_builder_menu_resources');
        fd.append('nonce', cfg.nonce || '');
        fd.append('queries', JSON.stringify(queries));
        fetch(cfg.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: fd, signal: batch.controller.signal }).then(function (response) { return response.json(); }).then(function (json) {
          if (state.disposed || batch.controller.signal.aborted) { return; }
          if (!json || !json.success || !json.data || !json.data.resources) { throw new Error('菜单项读取失败'); }
          entries.forEach(function (entry) {
            var items = json.data.resources[entry.type];
            if (!Array.isArray(items)) { throw new Error('菜单项读取失败'); }
            this.cacheMenuAddItems(entry.type, entry.query, items);
            if (state.keys[entry.type] === entry.key) { this.menuAddItems[entry.type] = items; }
          }.bind(this));
        }.bind(this)).catch(function () {
          if (state.disposed || batch.controller.signal.aborted) { return; }
          entries.forEach(function (entry) { if (state.keys[entry.type] === entry.key) { this.menuAddErrors[entry.type] = '读取失败，请重新展开重试'; } }.bind(this));
        }.bind(this)).finally(function () {
          state.batches = state.batches.filter(function (entry) { return entry !== batch; });
          entries.forEach(function (entry) {
            if (state.pending[entry.key] === batch) {
              delete state.pending[entry.key];
              if (!state.disposed && state.keys[entry.type] === entry.key) { this.menuAddLoading[entry.type] = false; }
            }
          }.bind(this));
        }.bind(this));
      },
      menuAddIsSelected: function (type, item) {
        return (this.menuAddSelected[type] || []).some(function (entry) { return String(entry.value) === String(item.value); });
      },
      menuAddResourceMeta: function (resource) {
        var statuses = { publish: '已发布', draft: '草稿', private: '私密', pending: '待审核', future: '定时发布' };
        return statuses[resource.meta] || resource.meta || '';
      },
      toggleMenuAddSelected: function (type, item, checked) {
        var selected = (this.menuAddSelected[type] || []).filter(function (entry) { return String(entry.value) !== String(item.value); });
        if (checked) { selected.push(item); }
        this.menuAddSelected[type] = selected;
      },
      menuAddAllSelected: function (type) {
        var items = this.menuAddItems[type] || [];
        return items.length > 0 && items.every(function (item) { return this.menuAddIsSelected(type, item); }.bind(this));
      },
      toggleMenuAddAll: function (type, checked) {
        (this.menuAddItems[type] || []).forEach(function (item) { this.toggleMenuAddSelected(type, item, checked); }.bind(this));
      },
      menuAddCustomField: function () {
        return { id: 'new_menu_link', motion: this.menuMotionProps, type: 'link', internal_picker: false, show_url: true, show_text: true, show_target: true, show_rel: false, show_title: false, show_page: false, preview: false, placeholder: 'https://' };
      },
      addMenuEditorItems: function (items) {
        if (!this.menuEditor || !items.length) { return false; }
        var parent = this.menuEditorFind(this.menuAddParentKey), parentId = parent ? Number(parent.id) : 0;
        if (this.menuAddParentKey && !parentId) { this.menuAddErrors[this.menuAddType] = '父菜单项已移除，请重新选择'; return false; }
        if (this.menuEditor.items.length + items.length > 500) { this.menuEditorStatus = '菜单最多支持 500 个项目'; return false; }
        var added = items.map(function (item) {
          var key = 'new-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
          return Object.assign({ id: 0, title: '', url: '', icon: '', type: 'custom', object: 'custom', object_id: 0, resource_type: '', resource_id: 0, status: 'publish', classes: '', target: '_self', rel: '', attr_title: '', client_key: key }, item, { parent: parentId });
        }.bind(this));
        var at = this.menuEditor.items.length;
        if (parent) {
          at = this.menuEditor.items.indexOf(parent) + 1;
          this.menuEditor.items.forEach(function (item, index) { if (this.menuEditorIsDescendant(item, parentId)) { at = index + 1; } }.bind(this));
        }
        this.menuEditor.items.splice.apply(this.menuEditor.items, [at, 0].concat(added));
        this.markMenuEditorDirty();
        return true;
      },
      addMenuCustomLink: function () {
        var value = this.menuAddCustom, url = String(value.url || '').trim(), title = String(value.text || '').trim();
        if (!title || !url || !/^(https?:|mailto:|tel:|#)/i.test(url)) { this.menuAddErrors.custom = '请填写链接文字和有效的链接地址'; return; }
        if (this.addMenuEditorItems([{ title: title, url: url, target: value.target || '_self' }])) {
          this.menuAddCustom = { url: '', text: '', target: '_self', rel: '' };
          this.menuAddErrors.custom = '';
        }
      },
      addMenuResources: function (type) {
        var selected = this.menuAddSelected[type] || [];
        var isTerm = ['category', 'post_tag', 'post_format'].indexOf(type) !== -1;
        var items = selected.map(function (resource) { return { title: resource.label, url: resource.url, type: isTerm ? 'taxonomy' : 'post_type', object: type, object_id: Number(resource.value), resource_type: type, resource_id: Number(resource.value) }; });
        if (this.addMenuEditorItems(items)) { this.menuAddSelected[type] = []; }
      },
      menuEditorItemDepth: function (item) {
        var items = this.menuEditor && Array.isArray(this.menuEditor.items) ? this.menuEditor.items : [];
        var parentId = Number(item && item.parent || 0);
        var seen = {};
        var depth = 0;
        while (parentId > 0 && depth < 8 && !seen[parentId]) {
          seen[parentId] = true;
          var parentItem = null;
          for (var i = 0; i < items.length; i += 1) {
            if (Number(items[i].id || 0) === parentId) { parentItem = items[i]; break; }
          }
          if (!parentItem) { break; }
          depth += 1;
          parentId = Number(parentItem.parent || 0);
        }
        return depth;
      },
      menuEditorIndent: function (item) {
        var depth = this.menuEditorItemDepth(item);
        return Math.max(0, depth - 1) * 10 + 'px';
      },
      menuEditorFind: function (key) {
        if (!key || !this.menuEditor) { return null; }
        return (this.menuEditor.items || []).find(function (item, index) { return this.menuEditorItemKey(item, index) === key && !this.menuEditorItemIsRemoved(item); }.bind(this)) || null;
      },
      menuEditorChildren: function (parentId) {
        return (this.menuEditor && this.menuEditor.items || []).filter(function (item) { return Number(item.parent || 0) === Number(parentId || 0) && !this.menuEditorItemIsRemoved(item); }.bind(this));
      },
      menuEditorItemChildCount: function (item) {
        if (!item || !Number(item.id || 0) || !this.menuEditor || !Array.isArray(this.menuEditor.items)) { return 0; }
        return this.menuEditorChildren(item.id).length;
      },
      menuEditorItemHasChildren: function (item) {
        return this.menuEditorItemChildCount(item) > 0;
      },
      openMenuSubmenu: function (item, event) {
        this.closeMenuLocations(false);
        this.closeMenuActions(false);
        if (!item || !Number(item.id) || this.menuEditorItemIsRemoved(item)) { return; }
        var key = this.menuEditorItemKey(item);
        if (this.menuSubmenuOpen && this.menuSubmenuAnchorKey === key) { this.closeMenuSubmenu(); return; }
        this.closeMenuAddPanel(false);
        this.menuSubmenuAnchorKey = key;
        this.menuSubmenuPath = [key];
        this.menuSubmenuQuery = '';
        this._menuSubmenuAnchor = event && event.currentTarget;
        this.menuSubmenuOpen = true;
        this.menuSubmenuPosition.ready = false;
        this.$nextTick(function () {
          this.positionMenuSubmenuPanel();
          if (!this.menuSubmenuOpen) { return; }
          this.startMenuAddTracking();
          if (this.$refs.menuSubmenuSearch) { this.$refs.menuSubmenuSearch.focus({ preventScroll: true }); }
        }.bind(this));
      },
      enterMenuSubmenu: function (item) {
        if (!item || !Number(item.id) || this.menuEditorItemIsRemoved(item)) { return; }
        var key = this.menuEditorItemKey(item);
        if (this.menuSubmenuPath.indexOf(key) !== -1) { return; }
        this.menuSubmenuPath = this.menuSubmenuPath.concat(key);
        this.menuSubmenuQuery = '';
      },
      backMenuSubmenu: function () {
        if (this.menuSubmenuPath.length > 1) { this.menuSubmenuPath = this.menuSubmenuPath.slice(0, -1); this.menuSubmenuQuery = ''; }
      },
      closeMenuSubmenu: function (restoreFocus) {
        var anchor = this._menuSubmenuAnchor;
        this.menuSubmenuOpen = false;
        this.menuSubmenuPath = [];
        this.menuSubmenuAnchorKey = '';
        this.menuSubmenuQuery = '';
        this._menuSubmenuAnchor = null;
        if (!this.menuAddOpen && !this.menuLocationsOpen) { this.stopMenuAddTracking(); }
        if (restoreFocus !== false && anchor) { this.$nextTick(function () { if (anchor.isConnected) { anchor.focus({ preventScroll: true }); } }); }
      },
      positionMenuSubmenuPanel: function () {
        if (!this.menuSubmenuOpen || !this.$refs.menuSubmenuPanel || !this._menuSubmenuAnchor) { return; }
        var parent = this.menuEditorFind(this.menuSubmenuPath[this.menuSubmenuPath.length - 1]);
        if (!parent || !this._menuSubmenuAnchor.isConnected) { this.closeMenuSubmenu(false); return; }
        var count = this.menuEditorChildren(parent.id).length;
        var anchor = this._menuSubmenuAnchor.closest('.eva-pb-menu-editor-item') || this._menuSubmenuAnchor;
        var position = this.menuFloatingPosition(anchor, 260, Math.min(600, Math.max(270, 180 + count * 34)), 240);
        if (position) { this.menuSubmenuPosition = position; } else { this.closeMenuSubmenu(false); }
      },
      menuSubmenuPanelStyle: function () {
        var p = this.menuSubmenuPosition;
        return { left: p.left + 'px', top: p.top + 'px', width: p.width + 'px', height: p.height + 'px', visibility: p.ready ? 'visible' : 'hidden', '--eva-menu-anchor-y': p.arrow + 'px', '--eva-menu-anchor-gap': p.gap + 'px' };
      },
      manageMenuSubmenu: function () {
        var parent = this.menuEditorFind(this.menuSubmenuPath[this.menuSubmenuPath.length - 1]);
        if (!parent) { return; }
        this.menuEditorScopeKey = this.menuEditorItemKey(parent);
        this.menuEditorSelectedItem = '';
        this.closeMenuSubmenu(false);
      },
      leaveMenuEditorScope: function () {
        var current = this.menuEditorFind(this.menuEditorScopeKey);
        var parent = current && Number(current.parent) > 0 ? (this.menuEditor.items || []).find(function (item) { return Number(item.id) === Number(current.parent); }) : null;
        this.menuEditorScopeKey = parent ? this.menuEditorItemKey(parent) : '';
        this.menuEditorSelectedItem = '';
        this.closeMenuSubmenu(false);
      },
      editMenuSubmenuItem: function (item) {
        if (this.menuEditorItemHasChildren(item)) { this.enterMenuSubmenu(item); return; }
        this.closeMenuSubmenu(false);
        this.selectMenuEditorItem(item, this.menuEditor.items.indexOf(item));
      },
      menuEditorItemHidden: function (item) {
        var parent = this.menuEditorFind(this.menuEditorScopeKey);
        return !item || Number(item.parent || 0) !== Number(parent ? parent.id : 0) || this.menuEditorItemIsRemoved(item);
      },
      selectMenuEditorItem: function (item, index, trigger, setting) {
        if (!item || this.menuEditorItemIsRemoved(item)) { return; }
        setting = this.menuEditorSettings().some(function (entry) { return entry.id === setting; }) ? setting : 'title';
        var key = this.menuEditorItemKey(item, index);
        if (this.menuActionKey !== key) {
          var rows = this.$refs.menuEditorList ? Array.from(this.$refs.menuEditorList.querySelectorAll('[data-menu-key]')) : [];
          var row = rows.find(function (node) { return node.getAttribute('data-menu-key') === key; });
          var anchor = row && row.querySelector('.eva-pb-menu-editor-more');
          anchor = anchor || this.$refs.menuAddTrigger;
          if (!anchor) { return; }
          this.toggleMenuActions(item, { currentTarget: anchor });
          this.$nextTick(function () { if (this.menuActionKey === key) { this.selectMenuEditorItem(item, index, null, setting); } });
          return;
        }
        this.menuEditorSelectedItem = key;
        this.menuEditSetting = setting;
        this.menuEditOpen = true;
        this.menuEditPosition.ready = false;
        this._menuEditTrigger = trigger || (this.$refs.menuActionsPanel && this.$refs.menuActionsPanel.querySelector('[data-menu-setting="' + setting + '"]')) || this._menuActionsTrigger;
        this.$nextTick(function () {
          this.positionMenuItemEditor();
          // 定位后先让 visibility 生效，再把焦点移入输入框。
          this.$nextTick(function () {
            var panel = this.$refs.menuItemEditor;
            var input = panel && panel.querySelector('.eva-pb-menu-edit-body input, .eva-pb-menu-edit-body select, .eva-pb-menu-edit-body button');
            if (this.menuEditOpen && this.menuEditorSelectedItem === key && input) { input.focus({ preventScroll: true }); if (input.tagName === 'INPUT' && ['text', 'url'].indexOf(input.type) !== -1) { input.select(); } }
          });
        });
      },
      positionMenuItemEditor: function () {
        if (!this.menuEditOpen) { return; }
        var trigger = this._menuEditTrigger || this.$refs.menuActionsPanel;
        if (!this.menuEditorActiveItem || !trigger || !trigger.isConnected) { this.closeMenuItemEditor(false); return; }
        var limit = this.menuFloatingPosition(trigger, 320, 540, 260);
        var panel = this.$refs.menuItemEditor;
        var position = limit && this.menuFloatingPosition(trigger, 320, Math.min(limit.height, panel ? panel.scrollHeight + 2 : 240), 260);
        if (position) { position.height = limit.height; this.menuEditPosition = position; } else { this.closeMenuItemEditor(false); }
      },
      menuItemEditorStyle: function () {
        var p = this.menuEditPosition;
        return { left: p.left + 'px', top: p.top + 'px', width: p.width + 'px', maxHeight: p.height + 'px', visibility: p.ready ? 'visible' : 'hidden', '--eva-menu-anchor-y': p.arrow + 'px', '--eva-menu-anchor-gap': p.gap + 'px' };
      },
      closeMenuItemEditor: function (restoreFocus) {
        var trigger = this._menuEditTrigger;
        this.menuEditOpen = false;
        this.menuEditorSelectedItem = '';
        this._menuEditTrigger = null;
        if (restoreFocus !== false && trigger && trigger.isConnected) { trigger.focus({ preventScroll: true }); }
      },
      moveMenuEditorItem: function (index, delta) {
        if (!this.menuEditor || !Array.isArray(this.menuEditor.items)) { return; }
        var next = index + delta;
        if (next < 0 || next >= this.menuEditor.items.length) { return; }
        var items = this.menuEditor.items.slice();
        var moved = items.splice(index, 1)[0];
        items.splice(next, 0, moved);
        this.menuEditor.items = items;
        this.markMenuEditorDirty();
      },
      addCustomMenuItem: function () {
        if (!this.menuEditor || !Number(this.menuEditor.menu_id || 0)) { return; }
        var key = 'new-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
        this.menuEditor.items.push({ id: 0, parent: 0, title: '', url: '', type: 'custom', object: 'custom', object_id: 0, resource_type: '', resource_id: 0, status: 'publish', classes: '', target: '_self', rel: '', attr_title: '', client_key: key });
        this.selectMenuEditorItem(this.menuEditor.items[this.menuEditor.items.length - 1], this.menuEditor.items.length - 1);
        this.markMenuEditorDirty();
        this.menuEditorStatus = '填写名称和链接后，点击左下角保存';
      },
      menuEditorItemIsRemoved: function (item) {
        var id = Number(item && item.id || 0);
        return id > 0 && this.menuEditorRemovedIds.indexOf(id) !== -1;
      },
      removeMenuEditorItem: function (index) {
        if (!this.menuEditor || !Array.isArray(this.menuEditor.items)) { return; }
        var item = this.menuEditor.items[index];
        if (!item) { return; }
        var itemId = Number(item.id || 0);
        if (itemId > 0) {
          this.menuDeleteRequest = { menuId: Number(this.menuEditor.menu_id), itemId: itemId, title: item.title || '菜单项' };
          return;
        }
        this.deleteMenuEditorItem(index);
      },
      confirmMenuEditorRemoval: function () {
        var request = this.menuDeleteRequest;
        this.menuDeleteRequest = null;
        if (!request || !this.menuEditor || Number(this.menuEditor.menu_id) !== request.menuId || !Array.isArray(this.menuEditor.items)) { return; }
        var index = this.menuEditor.items.findIndex(function (item) { return Number(item.id || 0) === request.itemId; });
        if (index !== -1) { this.deleteMenuEditorItem(index); }
      },
      deleteMenuEditorItem: function (index) {
        if (!this.menuEditor || !Array.isArray(this.menuEditor.items)) { return; }
        var item = this.menuEditor.items[index];
        if (!item) { return; }
        var itemId = Number(item.id || 0);
        if (this.menuEditorSelectedItem === this.menuEditorItemKey(item, index)) { this.menuEditorSelectedItem = ''; }
        if (itemId > 0) {
          if (this.menuEditorRemovedIds.indexOf(itemId) === -1) { this.menuEditorRemovedIds.push(itemId); }
        } else {
          this.menuEditor.items.splice(index, 1);
        }
        this.markMenuEditorDirty();
      },
      markMenuEditorDirty: function () {
        if (!this.menuEditor || !Number(this.menuEditor.menu_id || 0)) { return; }
        var key = String(this.menuEditor.menu_id), previous = this.menuEditorDrafts[key];
        this.menuEditorDrafts[key] = { data: clone(this.menuEditor), removedIds: this.menuEditorRemovedIds.slice(), revision: previous ? previous.revision + 1 : 1 };
        this.menuEditorStatus = '有未保存的修改';
      },
      saveMenuEditor: function () {
        if (this.menuEditorSaving || !this.menuEditorDirty) { return Promise.resolve(); }
        var pending = Object.keys(this.menuEditorDrafts).map(function (key) { return clone(this.menuEditorDrafts[key]); }.bind(this));
        this.menuEditorSaving = true;
        this.menuEditorStatus = '正在保存…';
        this._menuEditorCache = {};
        // Only an explicit save starts these requests; no queued autosave or retry.
        return pending.reduce(function (chain, draft) {
          return chain.then(function () { return this.saveMenuDraft(draft); }.bind(this));
        }.bind(this), Promise.resolve()).then(function () {
          this.refreshMenuPreview();
        }.bind(this)).catch(function (error) {
          this.menuEditorStatus = '保存失败：' + (error.message || '请重试');
          throw error;
        }.bind(this)).finally(function () {
          this.menuEditorSaving = false;
          if (this._menuMotionDisposed && !this.menuEditorDirty && this.menuSaveRegistry && this.menuSaveRegistry.get(this.menuSaveKey) === this._menuSaveParticipant) { this.menuSaveRegistry.delete(this.menuSaveKey); }
        }.bind(this));
      },
      saveMenuDraft: function (draft) {
        if (!cfg.ajaxUrl) { return Promise.reject(new Error('菜单保存接口不可用')); }
        var local = draft.data, key = String(local.menu_id), removedIds = draft.removedIds;
        var items = (local.items || []).filter(function (item) { return removedIds.indexOf(Number(item.id || 0)) === -1; });
        if (items.some(function (item) { return !String(item.title || '').trim() || (!Number(item.id || 0) && !String(item.url || '').trim()); })) { return Promise.reject(new Error('请填写菜单项的名称和链接后再保存')); }
        var fd = new FormData();
        fd.append('action', 'eva_fw_builder_menu_save');
        fd.append('nonce', cfg.nonce || '');
        fd.append('location_id', String(local.location_id || ''));
        fd.append('menu_id', String(local.menu_id));
        fd.append('menu_name', String(local.menu_name || ''));
        if (local.history_restore_id) { fd.append('history_restore_id', local.history_restore_id); }
        fd.append('items', JSON.stringify(items));
        fd.append('removed_ids', JSON.stringify(removedIds));
        fd.append('assigned_locations', JSON.stringify((local.locations || []).filter(function (location) { return !!location.checked; }).map(function (location) { return location.id; })));
        return fetch(cfg.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: fd }).then(function (res) { return res.json(); }).then(function (json) {
          if (!json || !json.success || !json.data) { throw new Error((json && json.data && json.data.message) || '菜单保存失败'); }
          var saved = json.data, latest = this.menuEditorDrafts[key];
          if (latest) { delete latest.data.history_restore_id; }
          if (this.menuEditor && String(this.menuEditor.menu_id) === key) { delete this.menuEditor.history_restore_id; }
          this._menuEditorCache = {};
          if (Array.isArray(saved.menu_location_data)) { this.menuLocationDataOverride = saved.menu_location_data; }
          var current = this.menuEditor && String(this.menuEditor.menu_id) === key;
          if (latest && latest.revision === draft.revision) {
            delete this.menuEditorDrafts[key];
            if (current) {
              saved.location_id = this.menuLocation;
              this.applyMenuEditorData(saved);
              this.menuEditorStatus = '已保存，预览已更新';
            }
          } else if (latest) {
            // Keep edits made during the request, including deletion of a newly created row.
            var savedByKey = {}, currentKeys = {};
            (saved.items || []).forEach(function (item) { savedByKey[item.client_key] = item; });
            latest.data.items = (latest.data.items || []).filter(function (item) { return removedIds.indexOf(Number(item.id || 0)) === -1; }).map(function (item) {
              currentKeys[item.client_key] = true;
              var server = savedByKey[item.client_key];
              return server ? Object.assign({}, server, item, { id: server.id }) : item;
            });
            latest.removedIds = latest.removedIds.filter(function (id) { return removedIds.indexOf(id) === -1; });
            items.filter(function (item) { return !Number(item.id || 0) && !currentKeys[item.client_key]; }).forEach(function (item) {
              var server = savedByKey[item.client_key];
              if (server && latest.removedIds.indexOf(Number(server.id)) === -1) { latest.removedIds.push(Number(server.id)); }
            });
            if (current) {
              this.menuEditor.items = clone(latest.data.items);
              this.menuEditorRemovedIds = latest.removedIds.slice();
              this.menuEditorStatus = '有新的修改，请再次点击保存';
            }
          }
        }.bind(this));
      },
      refreshMenuPreview: function () {
        if (this._menuMotionDisposed) { return; }
        if (!this.usesSlots()) { return; }
        this._previewCache = new Map();
        var frame = this.$refs.previewFrame;
        if (!frame) { return; }
        this.previewReady = false;
        try {
          frame.contentWindow.location.reload();
        } catch (e) {
          frame.src = this.previewUrl();
        }
      },
      moduleGroups: function () {
        var groups = {};
        this.modulesForTab().forEach(function (item) {
          if (!groups[item.group]) {
            groups[item.group] = {
              id: item.group,
              label: item.groupLabel || item.group,
              icon: item.groupIcon || 'ri-folder-3-line'
            };
          }
        });
        return Object.keys(groups).map(function (key) { return groups[key]; });
      },
      // 功能：可构建的页面清单。字段传了 pages 就是多页面模式，
      // 顶栏出现页面下拉，每个页面各有自己的 slots 与预览地址。
      pages: function () {
        var pages = Array.isArray(this.field.pages) ? this.field.pages : [];
        return pages.map(function (page, index) {
          return {
            id: String(page.id || index),
            label: page.label || page.title || page.id || ('Page ' + (index + 1)),
            icon: page.icon || 'ri-file-list-3-line',
            preview_url: page.preview_url || '',
            slots: Array.isArray(page.slots) ? page.slots : []
          };
        });
      },
      // 功能：当前正在编辑的页面；未选择时取第一个。
      currentPage: function () {
        var pages = this.pages();
        if (!pages.length) { return null; }
        for (var i = 0; i < pages.length; i++) {
          if (pages[i].id === this.activePage) { return pages[i]; }
        }
        return pages[0];
      },
      // 功能：切换页面，同时把 slot 与选中项复位。
      switchPage: function (id) {
        this.previewReady = false;
        this.activePage = id;
        this.activeSlot = '';
        this.selectedUid = '';
        this.selectedStructureId = '';
        this.pageMenuOpen = false;
        this.queuePreview(0);
      },
      // 功能：Builder 可编辑的 hook slot 清单（多页面模式下取当前页面的）。
      slots: function () {
        var page = this.currentPage();
        var slots = page ? page.slots : (Array.isArray(this.field.slots) ? this.field.slots : []);
        if (!slots.length) {
          slots = [{ id: 'main', label: '页面内容' }];
        }
        return slots.map(function (slot, index) {
          return {
            id: String(slot.id || slot.key || index || 'main'),
            label: slot.label || slot.title || slot.id || slot.key || ('Slot ' + (index + 1))
          };
        });
      },
      // 功能：当前正在编辑的 hook slot。
      currentSlotId: function () {
        var slots = this.slots();
        if (!this.activeSlot && slots.length) {
          this.activeSlot = slots[0].id;
        }
        return this.activeSlot || 'main';
      },
      // 功能：判断当前字段是否启用 slots 保存结构。
      usesSlots: function () {
        if (Array.isArray(this.field.pages) && this.field.pages.length) { return true; }
        return Array.isArray(this.field.slots) && this.field.slots.length > 0;
      },
      // 功能：把旧数组或新 slots 值统一成 slots 对象。
      builderValue: function () {
        var slots = {};
        this.slots().forEach(function (slot) { slots[slot.id] = []; });
        if (this.modelValue && typeof this.modelValue === 'object' && !Array.isArray(this.modelValue) && this.modelValue.slots) {
          Object.keys(this.modelValue.slots || {}).forEach(function (slot) {
            slots[slot] = Array.isArray(this.modelValue.slots[slot]) ? this.modelValue.slots[slot] : [];
          }, this);
        } else if (Array.isArray(this.modelValue)) {
          slots[this.currentSlotId()] = this.modelValue;
        }
        return { slots: slots };
      },
      // 功能：左侧模块清单。
      moduleList: function () {
        var reg = this.registry();
        var allowed = this.field && Array.isArray(this.field.module_types)
          ? this.field.module_types.map(String)
          : null;
        var excludedGroups = this.field && Array.isArray(this.field.module_exclude_groups)
          ? this.field.module_exclude_groups.map(String)
          : [];
        return Object.keys(reg).filter(function (key) {
          var group = reg[key].group || 'default';
          var groupNames = typeof group === 'object'
            ? [group.id, group.key, group.label, group.title]
            : [group];
          var excluded = groupNames.some(function (name) {
            return name !== undefined && name !== null && excludedGroups.indexOf(String(name)) !== -1;
          });
          return !excluded && (allowed === null || allowed.indexOf(key) !== -1);
        }).map(function (key) {
          var group = reg[key].group || 'default';
          var groupId = typeof group === 'object' ? (group.id || group.key || 'default') : group;
          return {
            type: key,
            label: reg[key].label || key,
            icon: reg[key].icon || 'ri-layout-line',
            group: String(groupId),
            groupLabel: typeof group === 'object' ? (group.label || group.title || groupId) : (groupId === 'default' ? '未分类' : groupId),
            groupIcon: typeof group === 'object' ? (group.icon || '') : ''
          };
        });
      },
      // 功能：取指定分组下的模块。
      modulesByGroup: function (group) {
        return this.modulesForTab().filter(function (item) { return item.group === group; });
      },
      // 功能：判断组件分组是否展开。
      isGroupOpen: function (group) {
        return this.collapsedGroups[group] !== true;
      },
      // 功能：折叠或展开组件分组。
      toggleGroup: function (group) {
        this.collapsedGroups[group] = !this.collapsedGroups[group];
      },
      // 功能：分组展开前设置初始动画状态。
      beforeGroupEnter: function (el) {
        el.style.height = '0px';
        el.style.opacity = '0';
        el.style.overflow = 'hidden';
        el.style.transform = 'translateY(-6px)';
      },
      // 功能：使用 GSAP 展开组件分组。
      enterGroup: function (el, done) {
        loadGsap().then(function (gsap) {
          gsap.killTweensOf(el);
          gsap.to(el, {
            height: 'auto',
            opacity: 1,
            y: 0,
            duration: 0.32,
            ease: 'expo.out',
            clearProps: 'height,opacity,transform,overflow',
            onComplete: done
          });
        }).catch(function () {
          el.style.transition = 'height 260ms ease, opacity 220ms ease, transform 260ms ease';
          el.style.height = el.scrollHeight + 'px';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          window.setTimeout(done, 280);
        });
      },
      // 功能：使用 GSAP 收起组件分组。
      leaveGroup: function (el, done) {
        el.style.height = el.offsetHeight + 'px';
        el.style.overflow = 'hidden';
        loadGsap().then(function (gsap) {
          gsap.killTweensOf(el);
          gsap.to(el, {
            height: 0,
            opacity: 0,
            y: -6,
            duration: 0.24,
            ease: 'sine.inOut',
            clearProps: 'height,opacity,transform,overflow',
            onComplete: done
          });
        }).catch(function () {
          el.style.transition = 'height 240ms ease, opacity 200ms ease, transform 240ms ease';
          window.requestAnimationFrame(function () {
            el.style.height = '0px';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-6px)';
          });
          window.setTimeout(done, 260);
        });
      },
      // 功能：分组动画结束后清理原生兜底样式。
      afterGroupAnimation: function (el) {
        el.style.transition = '';
        el.style.height = '';
        el.style.opacity = '';
        el.style.transform = '';
        el.style.overflow = '';
      },
      // 功能：模块展示名 / 图标。
      moduleLabel: function (type) {
        var reg = this.registry();
        return reg[type] && reg[type].label ? reg[type].label : type;
      },
      moduleIcon: function (type) {
        var reg = this.registry();
        return reg[type] && reg[type].icon ? reg[type].icon : 'ri-layout-line';
      },
      // 功能：当前页面实例数组（读取用，保持响应式）。
      items: function () {
        if (!this.usesSlots()) {
          return Array.isArray(this.modelValue) ? this.modelValue : [];
        }
        var value = this.builderValue();
        var slot = this.currentSlotId();
        return Array.isArray(value.slots[slot]) ? value.slots[slot] : [];
      },
      // 功能：发出更新。
      emitItems: function (next) {
        if (!this.usesSlots()) {
          this.$emit('update:modelValue', next);
          return;
        }
        var value = this.builderValue();
        value.slots[this.currentSlotId()] = next;
        this.previewSeq += 1;
        this.postPreviewHtml(this.optimisticSlotsFromValue(value));
        this.$emit('update:modelValue', value);
      },
      // 功能：按模块定义生成默认值。
      defaultsFor: function (type) {
        var reg = this.registry();
        var module = reg[type] || {};
        var fields = Array.isArray(module.fields) ? module.fields.slice() : [];
        (Array.isArray(module.tabs) ? module.tabs : []).forEach(function (tab) {
          if (tab && Array.isArray(tab.fields)) { fields = fields.concat(tab.fields); }
        });
        var values = {};
        fields.forEach(function (f) {
          if (!f || !f.id) { return; }
          values[f.id] = f.default !== undefined ? clone(f.default) : '';
        });
        return values;
      },
      // 功能：从左侧加入一个模块实例。
      addModule: function (type) {
        this.selectedStructureId = '';
        var next = clone(this.items());
        var uid = genUid();
        next.push({ uid: uid, type: type, values: this.defaultsFor(type) });
        this.emitItems(next);
        this.selectedUid = uid;
      },
      // 功能：按指定位置插入模块实例。
      addModuleAt: function (type, index) {
        this.selectedStructureId = '';
        var next = clone(this.items());
        var uid = genUid();
        var at = Math.max(0, Math.min(index, next.length));
        next.splice(at, 0, { uid: uid, type: type, values: this.defaultsFor(type) });
        this.emitItems(next);
        this.selectedUid = uid;
      },
      // 功能：开始从左侧模块库拖拽模块。
      onModuleDragStart: function (event, type) {
        this.draggingMenuLocation = '';
        this.draggingModule = type;
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'copy';
          event.dataTransfer.setData('text/plain', type);
          event.dataTransfer.setData('application/x-eva-module', type);
        }
      },
      // 功能：拖拽结束后清理拖拽状态。
      onModuleDragEnd: function () {
        this.draggingMenuLocation = '';
        this.draggingModule = '';
        this.sendPreviewDragState(false);
      },
      // 功能：拖入画布时标记为复制操作。
      onCanvasDragOver: function (event) {
        if (this.draggingWidget) {
          if (event.dataTransfer) { event.dataTransfer.dropEffect = this.draggingWidget.operation === 'add' ? 'copy' : 'move'; }
          var area = this.previewWidgetAreaAt(event);
          if (area !== this.draggingWidgetArea) { this.draggingWidgetArea = area; this.sendPreviewDragState(true); }
          return;
        }
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
        var location = this.draggingModule === 'wp_menu' ? this.previewMenuLocationAt(event) : '';
        if (location !== this.draggingMenuLocation) {
          this.draggingMenuLocation = location;
          this.sendPreviewDragState(!!this.draggingModule);
        }
      },
      // 功能：读取拖拽中的模块类型。
      draggedModuleType: function (event) {
        if (event && event.dataTransfer) {
          return event.dataTransfer.getData('application/x-eva-module') || event.dataTransfer.getData('text/plain') || this.draggingModule;
        }
        return this.draggingModule;
      },
      // 功能：拖入实际命中的区域；无 iframe 的画布仍加入当前列表。
      onCanvasDrop: function (event) {
        if (this.draggingWidget) { this.dropWidget(this.previewWidgetAreaAt(event)); return; }
        var type = this.draggedModuleType(event);
        if (!type) { return; }
        var location = type === 'wp_menu' ? this.previewMenuLocationAt(event) : '';
        if (location) {
          this.selectPreviewMenuLocation(location);
          this.onModuleDragEnd();
          return;
        }
        if (this.usesSlots()) {
          var target = this.previewModuleTargetAt(event);
          if (target) {
            this.activeSlot = target.slot;
            this.addModuleAt(type, target.index);
          }
        } else {
          this.addModule(type);
        }
        this.onModuleDragEnd();
      },
      // 功能：把左侧模块拖到指定插入点。
      onInsertDrop: function (event, index) {
        if (this.draggingWidget) { this.onWidgetDragEnd(); return; }
        var type = this.draggedModuleType(event);
        if (!type) { return; }
        this.addModuleAt(type, index);
        this.onModuleDragEnd();
      },
      // 功能：开始拖拽左右面板的尺寸分隔线或折叠图标。
      beginPanelResize: function (event, side, source) {
        if (!event || (event.button !== undefined && event.button !== 0)) { return; }
        this.resizingPanel = side;
        this.resizeSource = source || 'handle';
        this.resizeMoved = false;
        this.resizeStartX = event.clientX;
        this.resizeStartWidth = side === 'left' ? this.leftWidth : this.rightWidth;
        document.body.classList.add('eva-pb-resizing');
        if (event.currentTarget && event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch (e) {}
        }
        if (this.resizeSource === 'handle') {
          event.preventDefault();
        }
      },
      // 功能：开始拖拽独立分隔线。
      startPanelResize: function (event, side) {
        this.beginPanelResize(event, side, 'handle');
      },
      // 功能：按住折叠图标时也进入面板宽度拖拽模式。
      startPanelToggleDrag: function (event, side) {
        this.beginPanelResize(event, side, 'toggle');
      },
      // 功能：根据指针横向移动调整面板宽度，限制在可用范围内。
      onPanelResizeMove: function (event) {
        if (!this.resizingPanel || !event) { return; }
        var delta = event.clientX - this.resizeStartX;
        if (Math.abs(delta) < 5) { return; }
        this.resizeMoved = true;
        if (this.resizingPanel === 'left') {
          var leftTarget = Math.max(0, Math.min(820, this.resizeStartWidth + delta));
          // 拖到边缘时吸附为完全折叠；保留 leftWidth，之后可点击或反向拖出恢复。
          if (leftTarget <= 48) {
            this.leftCollapsed = true;
            return;
          }
          if (this.leftCollapsed) {
            // 已折叠状态下只能向右拖动左图标来展开。
            if (delta <= 5) { return; }
            this.leftCollapsed = false;
          }
          this.leftWidth = Math.max(64, leftTarget);
        } else {
          var rightTarget = Math.max(0, Math.min(860, this.resizeStartWidth - delta));
          // 拖到边缘时吸附为完全折叠；保留 rightWidth，之后可点击或反向拖出恢复。
          if (rightTarget <= 48) {
            this.rightCollapsed = true;
            return;
          }
          if (this.rightCollapsed) {
            // 已折叠状态下只能向左拖动右图标来展开。
            if (delta >= -5) { return; }
            this.rightCollapsed = false;
          }
          this.rightWidth = Math.max(64, rightTarget);
        }
      },
      // 功能：结束面板尺寸拖拽并恢复页面光标状态。
      stopPanelResize: function () {
        if (!this.resizingPanel) { return; }
        var source = this.resizeSource;
        var moved = this.resizeMoved;
        this.resizingPanel = '';
        this.resizeSource = '';
        this.resizeMoved = false;
        document.body.classList.remove('eva-pb-resizing');
        if (source === 'toggle') {
          this.suppressToggleClick = moved;
        }
      },
      // 功能：图标轻点时保留原有折叠/展开行为；拖动结束后的 click 则忽略。
      finishPanelToggleClick: function (side) {
        if (this.suppressToggleClick) {
          this.suppressToggleClick = false;
          return;
        }
        if (side === 'left') {
          this.leftCollapsed = !this.leftCollapsed;
        } else {
          this.rightCollapsed = !this.rightCollapsed;
        }
      },
      // 功能：选中某实例。
      select: function (uid) {
        this.selectedStructureId = '';
        this.selectedUid = uid;
        this.queuePreview(0);
      },
      // 固定结构来自字段配置，不是模块实例；只允许选中和修改设置。
      fixedStructures: function () {
        var page = this.currentPage();
        var nodes = Array.isArray(this.field.fixed_structure) ? this.field.fixed_structure : [];
        return nodes.filter(function (node) { return node && node.id && (!node.page || (page && page.id === node.page)); });
      },
      selectedStructure: function () {
        return this.fixedStructures().filter(function (node) { return node.id === this.selectedStructureId; }, this)[0] || null;
      },
      selectStructure: function (id) {
        if (!this.fixedStructures().some(function (node) { return node.id === id; })) { return; }
        this.selectedUid = '';
        this.selectedStructureId = id;
        this.rightTab = 'component';
        this.postPreviewHtml({});
      },
      structureFields: function () {
        var node = this.selectedStructure();
        return node && Array.isArray(node.fields) ? this.visibleFields(node.fields, this.field.structure_values || {}) : [];
      },
      structureValue: function (field) {
        var values = this.field.structure_values || {};
        return Object.prototype.hasOwnProperty.call(values, field.id) ? values[field.id] : (field.default !== undefined ? field.default : '');
      },
      structureValues: function () {
        var values = {};
        this.fixedStructures().forEach(function (node) {
          (node.fields || []).forEach(function (field) { if (field.id) { values[field.id] = this.structureValue(field); } }, this);
        }, this);
        return values;
      },
      updateStructure: function (field, value) {
        if (!this.structureFields().some(function (entry) { return entry.id === field.id; })) { return; }
        this.updateGlobal(field, value);
      },
      // 功能：选中实例对象。
      selectedItem: function () {
        var uid = this.selectedUid;
        return this.items().filter(function (it) { return it.uid === uid; })[0] || null;
      },
      // 功能：按 slot 汇总页面上的模块，供右侧组件设置顶部展示。
      slotGroups: function () {
        var value = this.usesSlots() ? this.builderValue() : { slots: { main: this.items() } };
        return this.slots().map(function (slot) {
          return {
            id: slot.id,
            label: slot.label,
            items: Array.isArray(value.slots[slot.id]) ? value.slots[slot.id] : []
          };
        });
      },
      // 功能：选中实例的字段定义。
      selectedFields: function () {
        var it = this.selectedItem();
        if (!it) { return []; }
        var reg = this.registry();
        var fields = (reg[it.type] && Array.isArray(reg[it.type].fields)) ? reg[it.type].fields : [];
        return this.visibleFields(fields, it.values || {});
      },
      // 功能：读取当前模块声明的扩展 Tab。
      selectedModuleTabs: function () {
        var it = this.selectedItem();
        if (!it) { return []; }
        var reg = this.registry();
        var tabs = reg[it.type] && Array.isArray(reg[it.type].tabs) ? reg[it.type].tabs : [];
        return tabs.filter(function (tab) { return tab && tab.id && Array.isArray(tab.fields); });
      },
      // 功能：将自定义 Tab 映射成不会和前两个固定 Tab 冲突的 key。
      customTabKey: function (tab) {
        return 'custom:' + String(tab && tab.id ? tab.id : '');
      },
      selectedCustomTab: function () {
        var key = String(this.rightTab || '');
        if (key.indexOf('custom:') !== 0) { return null; }
        var id = key.slice(7);
        return this.selectedModuleTabs().filter(function (tab) { return String(tab.id) === id; })[0] || null;
      },
      customTabFields: function () {
        var tab = this.selectedCustomTab();
        var it = this.selectedItem();
        return tab && it ? this.visibleFields(tab.fields, it.values || {}) : [];
      },
      globalFields: function () {
        return Array.isArray(this.field && this.field.global_fields) ? this.field.global_fields : [];
      },
      globalValue: function (field) {
        var values = this.field && this.field.global_values;
        if (values && Object.prototype.hasOwnProperty.call(values, field.id)) { return values[field.id]; }
        return field && field.default !== undefined ? field.default : '';
      },
      updateGlobal: function (field, value) {
        if (!field || !field.id) { return; }
        this.$emit('update:global', { id: field.id, value: value });
      },
      containerFields: function () {
        return Array.isArray(this.field && this.field.container_fields) ? this.field.container_fields : [];
      },
      containerTabs: function () {
        var tabs = Array.isArray(this.field && this.field.container_tabs) ? this.field.container_tabs : [];
        if (!tabs.length && this.containerFields().length) {
          tabs = [{ id: 'default', label: this.field.container_label || '容器设置', fields: this.containerFields() }];
        }
        return tabs.filter(function (tab) { return tab && tab.id && Array.isArray(tab.fields); });
      },
      containerTabFields: function () {
        var tabs = this.containerTabs();
        var active = this.containerTab || (tabs[0] && tabs[0].id) || '';
        var tab = tabs.filter(function (item) { return String(item.id) === String(active); })[0] || tabs[0];
        return tab && Array.isArray(tab.fields) ? tab.fields : [];
      },
      containerTabLabel: function () {
        var tabs = this.containerTabs();
        var active = this.containerTab || (tabs[0] && tabs[0].id) || '';
        var tab = tabs.filter(function (item) { return String(item.id) === String(active); })[0] || tabs[0];
        return tab ? (tab.label || tab.title || tab.id) : '容器设置';
      },
      containerTabActive: function (tab) {
        var tabs = this.containerTabs();
        var active = this.containerTab || (tabs[0] && tabs[0].id) || '';
        return tab && String(tab.id) === String(active);
      },
      containerValues: function () {
        return this.field && this.field.container_values ? this.field.container_values : {};
      },
      containerValue: function (field) {
        var values = this.containerValues();
        if (field && field.id && Object.prototype.hasOwnProperty.call(values, field.id)) {
          return values[field.id];
        }
        return field && field.default !== undefined ? field.default : '';
      },
      containerVisibleFields: function () {
        var device = this.device === 'mobile' ? 'mobile' : 'desktop';
        return this.visibleFields(this.containerTabFields(), this.containerValues()).filter(function (field) {
          return !field.container_device || field.container_device === device;
        });
      },
      updateContainer: function (field, value) {
        if (!field || !field.id) { return; }
        this.$emit('update:container', { id: field.id, value: value });
      },
      visibleFields: function (fields, values) {
        return (Array.isArray(fields) ? fields : []).filter(function (field) {
          return dependencyVisible(field, values || {});
        });
      },
      // 功能：取选中实例某字段值。
      childValue: function (f) {
        var it = this.selectedItem();
        if (!it || !it.values) { return f.default !== undefined ? f.default : ''; }
        return hasOwn(it.values, f.id) ? it.values[f.id] : (f.default !== undefined ? f.default : '');
      },
      // 功能：更新选中实例某字段值。
      updateChild: function (f, value) {
        var uid = this.selectedUid;
        var next = clone(this.items());
        for (var i = 0; i < next.length; i++) {
          if (next[i].uid === uid) {
            next[i].values = next[i].values || {};
            next[i].values[f.id] = value;
            break;
          }
        }
        this.emitItems(next);
      },
      // 功能：删除实例。
      removeItem: function (uid) {
        var next = this.items().filter(function (it) { return it.uid !== uid; });
        this.emitItems(clone(next));
        if (this.selectedUid === uid) {
          this.selectedUid = '';
          this.rightTab = 'page';
        }
      },
      // 功能：上移 / 下移实例（dir = -1 / 1）。
      moveItem: function (uid, dir) {
        var next = clone(this.items());
        var idx = -1;
        for (var i = 0; i < next.length; i++) { if (next[i].uid === uid) { idx = i; break; } }
        var target = idx + dir;
        if (idx < 0 || target < 0 || target >= next.length) { return; }
        var tmp = next[idx];
        next[idx] = next[target];
        next[target] = tmp;
        this.emitItems(next);
      },
      // 功能：复制实例。
      duplicateItem: function (uid) {
        var next = clone(this.items());
        var idx = -1;
        for (var i = 0; i < next.length; i++) { if (next[i].uid === uid) { idx = i; break; } }
        if (idx < 0) { return; }
        var copy = clone(next[idx]);
        copy.uid = genUid();
        next.splice(idx + 1, 0, copy);
        this.emitItems(next);
        this.selectedUid = copy.uid;
      },
      // 功能：渲染实例预览 HTML。
      renderHtml: function (item) {
        var reg = this.registry();
        var m = reg[item.type];
        if (m && typeof m.render === 'function') {
          try {
            return m.render(item.values || {});
          } catch (e) {
            return '<div class="eva-pb-render-error">' + this.t('pb_render_error') + item.type + ' — ' + (e && e.message ? e.message : e) + '</div>';
          }
        }
        return '<div style="opacity:.5;font-size:12px">' + this.t('pb_missing_render') + item.type + '</div>';
      },
      // 功能：同步浏览器全屏状态到组件状态。
      syncFullscreenState: function () {
        this.fullScreen = document.fullscreenElement === this.$refs.pbRoot;
      },
      // 功能：切换页面构建器全屏编辑模式。
      toggleFullscreen: function () {
        var el = this.$refs.pbRoot;
        if (!el) { return; }
        if (document.fullscreenElement === el || this.fullScreen) {
          if (document.fullscreenElement === el && document.exitFullscreen) {
            document.exitFullscreen();
          }
          this.fullScreen = false;
          return;
        }
        this.fullScreen = true;
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(function () {});
        }
      }
    },
    template: [
'<div ref="pbRoot" class="eva-pb" :class="{ \'is-fullscreen\': fullScreen }">',
      '  <header class="eva-pb-topbar">',
      '    <div class="eva-pb-brand"><span><i class="ri-book-open-fill"></i></span><strong>{{ tv(brandName()) }}</strong><em>{{ brandVersion() }}</em></div>',
      '    <div class="eva-pb-center">',
      '      <div v-if="pages().length" class="eva-pb-page-picker">',
      '        <button type="button" class="eva-pb-page-select is-menu" @click="pageMenuOpen = !pageMenuOpen"><i :class="currentPage().icon"></i><span>{{ tv(previewLabel()) }}</span><i class="ri-arrow-down-s-line"></i></button>',
      '        <div v-if="pageMenuOpen" class="eva-pb-page-backdrop" @click="pageMenuOpen = false"></div>',
      '        <div v-if="pageMenuOpen" class="eva-pb-page-menu">',
      '          <button v-for="p in pages()" :key="p.id" type="button" :class="{ \'is-active\': currentPage().id === p.id }" @click="switchPage(p.id)"><i :class="p.icon"></i><span>{{ tv(p.label) }}</span></button>',
      '        </div>',
      '      </div>',
      '      <span v-else class="eva-pb-page-select"><i class="ri-file-list-3-line"></i><span>{{ tv(previewLabel()) }}</span></span>',
      '      <div v-if="previewRoleOptions.length" class="eva-pb-role-picker" role="group" aria-label="预览身份">',
      '        <i class="ri-user-settings-line" aria-hidden="true"></i>',
      '        <span class="eva-pb-sr-only">预览身份</span>',
      '        <eva-select class="eva-pb-role-select" :options="previewRoleOptions" :searchable="false" :model-value="previewRole" @update:model-value="setPreviewRole"></eva-select>',
      '      </div>',
      '      <span class="eva-pb-divider"></span>',
      '      <div class="eva-pb-devices">',
      '        <button type="button" :class="{ \'is-active\': device === \'desktop\' }" @click="device = \'desktop\'"><i class="ri-computer-line"></i></button>',
      '        <button type="button" :class="{ \'is-active\': device === \'tablet\' }" @click="device = \'tablet\'"><i class="ri-tablet-line"></i></button>',
      '        <button type="button" :class="{ \'is-active\': device === \'mobile\' }" @click="device = \'mobile\'"><i class="ri-smartphone-line"></i></button>',
      '      </div>',
      '      <div class="eva-pb-opacity" role="group" :aria-label="t(\'panel_opacity\')" :title="t(\'panel_opacity\')">',
      '        <i class="ri-contrast-drop-line" aria-hidden="true"></i>',
      '        <span class="eva-pb-sr-only">{{ t(\'panel_opacity\') }}</span>',
      '        <eva-select class="eva-pb-opacity-select" :options="panelOpacityOptions" :searchable="false" :model-value="panelOpacity" @update:model-value="setPanelOpacity"></eva-select>',
      '      </div>',
      '    </div>',
      "<div class=\"eva-pb-actions\" role=\"group\" aria-label=\"构建器工具\">",
      "<button v-if=\"historyOptionId\" ref=\"historyTrigger\" type=\"button\" class=\"eva-pb-shell-action\" :class=\"{ 'is-active': historyOpen }\" title=\"保存历史\" aria-label=\"保存历史\" aria-haspopup=\"dialog\" :aria-expanded=\"historyOpen\" :aria-controls=\"menuAddId + '-history'\" @click=\"historyOpen ? closeSaveHistory() : openSaveHistory()\"><i class=\"ri-history-line\" aria-hidden=\"true\"></i></button>",
      "  <button v-if=\"shellControls\" type=\"button\" class=\"eva-pb-shell-action\" :class=\"{ 'is-active': shellControls.sidebarCollapsed }\" :title=\"shellControls.sidebarCollapsed ? t('expand_sidebar') : t('collapse_sidebar')\" :aria-label=\"shellControls.sidebarCollapsed ? t('expand_sidebar') : t('collapse_sidebar')\" :aria-expanded=\"!shellControls.sidebarCollapsed\" @click=\"shellControls.toggleSidebar()\"><i :class=\"shellControls.sidebarCollapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'\" aria-hidden=\"true\"></i></button>",
      "  <button v-if=\"shellControls\" type=\"button\" class=\"eva-pb-shell-action\" :class=\"{ 'is-active': shellControls.settingsOpen }\" :title=\"t('settings')\" :aria-label=\"t('settings')\" aria-haspopup=\"dialog\" :aria-expanded=\"shellControls.settingsOpen\" aria-controls=\"eva-settings-drawer\" @click=\"shellControls.toggleSettings()\"><i class=\"ri-settings-3-line\" aria-hidden=\"true\"></i></button>",
      "  <span v-if=\"shellControls\" class=\"eva-pb-actions-separator\" aria-hidden=\"true\"></span>",
      "  <button type=\"button\" :class=\"{ 'is-active': fullScreen }\" :title=\"fullScreen ? t('pb_exit_fullscreen') : t('pb_fullscreen')\" :aria-label=\"fullScreen ? t('pb_exit_fullscreen') : t('pb_fullscreen')\" :aria-pressed=\"fullScreen\" @click=\"toggleFullscreen\"><i :class=\"fullScreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'\" aria-hidden=\"true\"></i></button>",
      "</div>",
      '  </header>',
      '  <div class="eva-pb-body" :class="{ \'is-left-collapsed\': leftCollapsed, \'is-right-collapsed\': rightCollapsed, \'is-resizing-left\': resizingPanel === \'left\', \'is-resizing-right\': resizingPanel === \'right\' }" :style="{ \'--eva-pb-left-width\': leftWidth + \'px\', \'--eva-pb-right-width\': rightWidth + \'px\' }">',
      '    <button type="button" class="eva-pb-side-toggle eva-pb-side-toggle--left" :title="leftCollapsed ? t(\'pb_expand_left\') : t(\'pb_collapse_left\')" @pointerdown.stop="startPanelToggleDrag($event, \'left\')" @click.stop="finishPanelToggleClick(\'left\')"><i :class="leftCollapsed ? \'ri-layout-left-2-line\' : \'ri-side-bar-line\'"></i></button>',
      '    <button type="button" class="eva-pb-side-toggle eva-pb-side-toggle--right" :title="rightCollapsed ? t(\'pb_expand_right\') : t(\'pb_collapse_right\')" @pointerdown.stop="startPanelToggleDrag($event, \'right\')" @click.stop="finishPanelToggleClick(\'right\')"><i :class="rightCollapsed ? \'ri-layout-right-2-line\' : \'ri-sidebar-fold-line\'"></i></button>',
      '    <div v-show="!leftCollapsed" class="eva-pb-resize-handle eva-pb-resize-handle--left" role="separator" :aria-label="t(\'pb_resize_left\')" @pointerdown.prevent="startPanelResize($event, \'left\')"></div>',
      '    <div v-show="!rightCollapsed" class="eva-pb-resize-handle eva-pb-resize-handle--right" role="separator" :aria-label="t(\'pb_resize_right\')" @pointerdown.prevent="startPanelResize($event, \'right\')"></div>',
      '    <aside class="eva-pb-left">',
      "      <div ref=\"moduleTabRail\" class=\"eva-pb-module-tabs\" role=\"tablist\" aria-label=\"模块类型\">",
      "<span ref=\"moduleTabIndicator\" class=\"eva-pb-module-tab-indicator\" aria-hidden=\"true\"></span>",
      "        <button v-for=\"tab in moduleTabs()\" :key=\"tab.id\" :data-module-tab=\"tab.id\" :id=\"menuAddId + '-module-tab-' + tab.id\" :aria-controls=\"menuAddId + '-module-panel-' + tab.id\" :tabindex=\"moduleTab === tab.id ? 0 : -1\" type=\"button\" role=\"tab\" class=\"eva-pb-module-tab\" :class=\"{ 'is-active': moduleTab === tab.id }\" :aria-selected=\"moduleTab === tab.id ? 'true' : 'false'\" @click=\"selectModuleTab(tab.id)\" @keydown.right.prevent=\"moveModuleTab(1)\" @keydown.left.prevent=\"moveModuleTab(-1)\" @keydown.home.prevent=\"moveModuleTab('first')\" @keydown.end.prevent=\"moveModuleTab('last')\"><i :class=\"tab.icon\"></i><span>{{ tv(tab.label) }}</span></button>",
      '      </div>',
      "<div class=\"eva-pb-tab-viewport\" :class=\"{ 'is-switching': moduleTabAnimating, 'is-menu-loading': moduleTab === 'menu' && menuEditorLoading }\">",
      "<transition v-bind=\"moduleTabMotionProps\">",
      "<div :key=\"moduleTab\" class=\"eva-pb-tab-content\" :data-module-panel=\"moduleTab\" role=\"tabpanel\" :id=\"menuAddId + '-module-panel-' + moduleTab\" :aria-labelledby=\"menuAddId + '-module-tab-' + moduleTab\">",
      '      <div v-if="moduleTab === \'menu\'" class="eva-pb-menu-location-card">',
      '        <div class="eva-pb-menu-location-head"><i class="ri-menu-4-line"></i><div><strong>菜单管理</strong><span>拖拽排序，添加和编辑菜单项。</span></div></div>',
      "        <div class=\"eva-pb-menu-location-select-wrap\"><eva-select :motion=\"menuDropdownMotionProps\" class=\"eva-pb-menu-location-select\" :options=\"menuLocationOptions()\" :model-value=\"menuLocation\" @update:model-value=\"setMenuLocation\"></eva-select></div>",
      '        <p class="eva-pb-menu-location-subtitle">您的主题可在 {{ menuLocationCount() }} 个位置显示菜单，当前已应用 {{ menuLocationAssignedCount() }} 个。</p>',
      '        <div v-if="menuLocation" class="eva-pb-menu-editor">',
      "          <div v-if=\"menuEditorLoading\" key=\"loading\" role=\"status\" class=\"eva-pb-menu-loading\" aria-live=\"polite\" aria-atomic=\"true\"><span class=\"eva-pb-menu-loading-spinner\" aria-hidden=\"true\"></span><span>正在读取菜单…</span></div>",
      "          <div v-else-if=\"menuEditorError\" key=\"error\" role=\"alert\" class=\"eva-pb-menu-editor-error\">{{ menuEditorError }}</div>",
      "<div v-else-if=\"menuEditor && menuEditor.menu_id\" :key=\"'menu-data-' + menuEditor.menu_id\" class=\"eva-pb-menu-motion-data\">",
      '            <label class="eva-pb-menu-editor-field eva-pb-menu-name-field">菜单名称<input type="text" v-model="menuEditor.menu_name" @input="markMenuEditorDirty"></label>',
      "            <div class=\"eva-pb-menu-editor-list-head\"><div class=\"eva-pb-menu-scope-heading\"><button v-if=\"menuEditorScopeParent\" type=\"button\" @click=\"leaveMenuEditorScope\" aria-label=\"返回上一级菜单\"><i class=\"ri-arrow-left-s-line\"></i></button><strong :title=\"menuEditorScopeParent ? menuEditorScopeParent.title : '菜单项配置'\">{{ menuEditorScopeParent ? menuEditorScopeParent.title + ' / 子菜单' : '菜单项配置' }}</strong></div><div class=\"eva-pb-menu-toolbar-actions\"><button ref=\"menuLocationsTrigger\" type=\"button\" class=\"eva-pb-menu-locations-trigger\" :class=\"{ 'is-active': menuLocationsOpen }\" aria-haspopup=\"dialog\" :aria-expanded=\"menuLocationsOpen\" :aria-controls=\"menuAddId + '-locations'\" @click=\"toggleMenuLocations\"><i class=\"ri-map-pin-2-line\" aria-hidden=\"true\"></i>菜单位置</button><button ref=\"menuAddTrigger\" type=\"button\" class=\"eva-pb-menu-editor-add\" :aria-expanded=\"menuAddOpen\" @click=\"toggleMenuAddPanel\"><i class=\"ri-add-line\"></i>{{ menuEditorScopeParent ? '添加子菜单' : '添加项目' }}</button></div></div>",
      '            <div ref="menuEditorList" class="eva-pb-menu-editor-list">',
      "<transition-group v-bind=\"menuListMotionProps\" appear>",
      "              <div v-for=\"(item, index) in menuEditorVisibleItems\" :key=\"menuEditorItemKey(item, index)\" :data-menu-key=\"menuEditorItemKey(item, index)\" :style=\"{ '--eva-menu-row-delay': Math.min(index, 11) * 28 + 'ms' }\" data-menu-motion-row class=\"eva-pb-menu-editor-item\" :class=\"{ 'is-active': menuEditorSelectedItem === menuEditorItemKey(item, index), 'is-submenu-open': menuSubmenuOpen && menuSubmenuAnchorKey === menuEditorItemKey(item, index), 'is-actions-open': menuActionKey === menuEditorItemKey(item, index), 'is-dragging': menuEditorDraggingKey === menuEditorItemKey(item, index), 'is-drop-before': menuEditorDropKey === menuEditorItemKey(item, index) && menuEditorDropSide === 'before', 'is-drop-after': menuEditorDropKey === menuEditorItemKey(item, index) && menuEditorDropSide === 'after', 'is-drop-inside': menuEditorDropKey === menuEditorItemKey(item, index) && menuEditorDropSide === 'inside' }\">",
      "                <div class=\"eva-pb-menu-editor-row\">",
      "                  <button type=\"button\" class=\"eva-pb-menu-editor-grip\" :disabled=\"menuEditorSaving\" :aria-label=\"'拖拽排序：' + item.title\" title=\"拖拽排序\" @pointerdown=\"startMenuEditorDrag($event, item, index)\" @keydown.up.prevent=\"keyboardMenuEditorMove(item, -1)\" @keydown.down.prevent=\"keyboardMenuEditorMove(item, 1)\"><i class=\"ri-draggable\"></i></button>",
      "                  <button type=\"button\" class=\"eva-pb-menu-item-open\" :title=\"item.title\" @click=\"Number(item.id || 0) > 0 ? openMenuSubmenu(item, $event) : selectMenuEditorItem(item, index)\">",
      "                    <svg v-if=\"menuEditorIconSymbol(item)\" class=\"eva-pb-menu-editor-icon\" aria-hidden=\"true\"><use :href=\"menuEditorIconSymbol(item)\"></use></svg><i v-else class=\"eva-pb-menu-editor-icon\" :class=\"menuEditorIcon(item)\" aria-hidden=\"true\"></i>",
      "                    <span class=\"eva-pb-menu-editor-item-title\">{{ item.title || \"未命名菜单项\" }}</span><span v-if=\"menuEditorItemChildCount(item)\" class=\"eva-pb-menu-child-count\">{{ menuEditorItemChildCount(item) }}</span>",
      "                  </button>",
      "                  <small class=\"eva-pb-menu-item-type\">{{ menuEditorItemType(item) }}</small>",
      "                  <div class=\"eva-pb-menu-item-tools\">",
      "                    <button type=\"button\" class=\"eva-pb-menu-editor-delete\" @click=\"removeMenuEditorItem(menuEditor.items.indexOf(item))\" :aria-label=\"'移入回收站：' + item.title\" title=\"移入回收站\"><i class=\"ri-delete-bin-line\"></i></button>",
      "                    <button type=\"button\" class=\"eva-pb-menu-editor-more\" :class=\"{ 'is-active': menuActionKey === menuEditorItemKey(item, index) }\" aria-haspopup=\"menu\" :aria-expanded=\"menuActionKey === menuEditorItemKey(item, index)\" :aria-controls=\"menuAddId + '-actions'\" :aria-label=\"'更多操作：' + item.title\" title=\"更多操作\" @click=\"toggleMenuActions(item, $event)\"><i class=\"ri-more-2-fill\"></i></button>",
      "                  </div>",
      "                </div>",
      '              </div>',
      "              <div v-if=\"!menuEditorVisibleItems.length\" key=\"empty\" class=\"eva-pb-menu-editor-empty\">{{ menuEditorScopeParent ? '还没有子菜单。' : '此菜单还没有菜单项。' }}</div>",
      "</transition-group>",
      '            </div>',
      "</div>",
      "          <div v-else-if=\"menuEditor\" key=\"unassigned\" class=\"eva-pb-menu-create\">",
      "            <p class=\"eva-pb-menu-editor-unassigned\">这个位置还没有分配菜单，可选择已有菜单或新建菜单。</p>",
      "            <form class=\"eva-pb-menu-create\" @submit.prevent=\"assignExistingMenu\">",
      "              <label class=\"eva-pb-menu-editor-field\"><span>已有菜单</span><eva-select :motion=\"menuDropdownMotionProps\" :options=\"existingMenuOptions()\" :model-value=\"menuExistingId\" :disabled=\"menuAssigning || menuCreating\" placeholder=\"选择未使用的菜单\" empty-message=\"还没有已创建的菜单\" @update:model-value=\"selectExistingMenu\"></eva-select></label>",
      "              <p class=\"eva-pb-menu-existing-hint\">已使用的菜单仅供查看，不能重复绑定。</p>",
      "              <p v-if=\"menuAssignError\" class=\"eva-pb-menu-editor-error\" role=\"alert\">{{ menuAssignError }}</p>",
      "              <button type=\"submit\" class=\"eva-pb-menu-editor-add\" :disabled=\"!menuExistingId || menuAssigning || menuCreating\">{{ menuAssigning ? \"正在绑定…\" : \"绑定已有菜单到当前位置\" }}</button>",
      "              <button type=\"button\" class=\"eva-pb-menu-refresh\" :disabled=\"menuAssigning || menuCreating\" @click=\"refreshMenuChoices\">刷新菜单列表</button>",
      "            </form>",
      "            <div class=\"eva-pb-menu-create-divider\"><span>或新建菜单</span></div>",
      "            <form class=\"eva-pb-menu-create\" @submit.prevent=\"createMenu\">",
      "              <label class=\"eva-pb-menu-editor-field\">新菜单名称<input type=\"text\" v-model=\"menuCreateName\" :disabled=\"menuCreating || menuAssigning\" autocomplete=\"off\" placeholder=\"例如：顶部导航\"></label>",
      "              <p v-if=\"menuCreateError\" class=\"eva-pb-menu-editor-error\" role=\"alert\">{{ menuCreateError }}</p>",
      "              <button type=\"submit\" class=\"eva-pb-menu-editor-add\" :disabled=\"menuCreating || menuAssigning\">{{ menuCreating ? \"正在创建…\" : \"创建菜单并绑定当前位置\" }}</button>",
      "            </form>",
      "          </div>",
      '        </div>',
      '      </div>',
      "      <section v-if=\"moduleTab === 'widgets'\" class=\"eva-pb-widgets-panel\" aria-label=\"小工具管理\">",
      '        <div class="eva-pb-menu-location-head"><i class="ri-layout-grid-line"></i><div><strong>小工具管理</strong><span>拖入右侧预览区域，或选择区域后添加。</span></div></div>',
      '        <div class="eva-pb-widgets-actions"><button type="button" :disabled="widgetsLoading || widgetsSaving" @click="loadWidgets">刷新内容</button><a v-if="widgetAreas.length && widgetsEditorUrl" :href="widgetsEditorUrl" target="_blank" rel="noopener">编辑小工具内容 ↗</a></div>',
      '        <p v-if="widgetsStatus" role="status">{{ widgetsStatus }}</p>',
      '        <p v-if="widgetsLoading" role="status">正在读取小工具…</p>',
      '        <p v-else-if="widgetsError" role="alert">{{ widgetsError }}</p>',
      '        <template v-else-if="widgetsLoaded">',
      '          <p>当前主题有 {{ widgetAreas.length }} 个小工具区域。</p>',
      '          <eva-select v-if="widgetAreas.length" :options="widgetAreaOptions()" :model-value="widgetArea" @update:model-value="widgetArea = $event"></eva-select>',
      '          <section v-if="selectedWidgetArea()" class="eva-pb-widget-area" aria-label="区域内容" @dragover.prevent @drop.stop.prevent="dropWidget(widgetArea)">',
      '            <p v-if="selectedWidgetArea().description">{{ selectedWidgetArea().description }}</p>',
      '            <h4>已添加的小工具（{{ selectedWidgetArea().items.length }}）</h4>',
      '            <ul v-if="selectedWidgetArea().items.length" class="eva-pb-widget-items"><li v-for="(item, index) in selectedWidgetArea().items" :key="item.id" :draggable="!widgetsSaving" @dragstart="onWidgetDragStart($event, \'move\', item.id)" @dragend="onWidgetDragEnd" @dragover.prevent @drop.stop.prevent="dropWidget(widgetArea, item.id)"><div><strong>{{ item.title || item.name }}</strong><small>{{ item.name }}</small></div><div class="eva-pb-widget-item-tools"><button type="button" aria-label="上移小工具" :disabled="widgetsSaving || widgetsLoading || index === 0" @click="moveWidget(item, -1)"><i class="ri-arrow-up-line"></i></button><button type="button" aria-label="下移小工具" :disabled="widgetsSaving || widgetsLoading || index === selectedWidgetArea().items.length - 1" @click="moveWidget(item, 1)"><i class="ri-arrow-down-line"></i></button><button type="button" class="eva-pb-widget-remove" aria-label="删除小工具" title="从当前区域删除小工具" :disabled="widgetsSaving || widgetsLoading" @click.stop="changeWidget(\'remove\', item.id, widgetArea)"><i class="ri-delete-bin-line" aria-hidden="true"></i>删除</button></div></li></ul>',
      '            <p v-else>这个区域还没有添加小工具。</p>',
      '          </section>',
      '          <p v-else class="eva-pb-widgets-empty">当前主题尚未注册小工具区域。注册区域后，可在这里查看其中的内容。</p>',
      '          <h4>可用小工具（{{ availableWidgets.length }}）</h4>',
      '          <ul class="eva-pb-widget-types"><li v-for="widget in availableWidgets" :key="widget.id"><button type="button" :disabled="widgetsSaving || !widgetAreas.length" :draggable="!widgetsSaving && !!widgetAreas.length" @dragstart="onWidgetDragStart($event, \'add\', widget.id)" @dragend="onWidgetDragEnd" @click="changeWidget(\'add\', widget.id, widgetArea)"><i class="ri-drag-move-2-line" aria-hidden="true"></i>{{ widget.name }}</button></li></ul>',
      '          <p v-if="!availableWidgets.length">暂无已注册的小工具。</p>',
      '        </template>',
      '      </section>',
      '      <div v-else-if="moduleTab === \'container\'" class="eva-pb-container-settings">',
      '        <div class="eva-pb-container-tabs" role="tablist" aria-label="容器设置分类">',
      '          <button v-for="tab in containerTabs()" :key="tab.id" type="button" role="tab" :class="{ \'is-active\': containerTabActive(tab) }" :aria-selected="containerTabActive(tab) ? \'true\' : \'false\'" @click="containerTab = tab.id"><i v-if="tab.icon" :class="tab.icon"></i><span>{{ tv(tab.label || tab.title || tab.id) }}</span></button>',
      '        </div>',
      '        <div class="eva-pb-container-head"><i class="ri-layout-masonry-line"></i><strong>{{ tv(containerTabLabel()) }}</strong><span>自定义设置</span></div>',
      '        <div class="eva-pb-fields eva-pb-fields--container">',
      '          <div class="eva-pb-field" v-for="(f, fi) in containerVisibleFields()" :key="f.id || (\'container-\' + fi)">',
      '            <label v-if="(f.title || f.id) && !f.hide_label" class="eva-pb-field-label">{{ tv(f.title || f.id) }}</label>',
      '            <eva-field :field="f" :model-value="containerValue(f)" @update:model-value="updateContainer(f, $event)"></eva-field>',
      '          </div>',
      '        </div>',
      '      </div>',
      '      <div v-if="moduleTab === \'components\'" class="eva-pb-modules">',
      '        <div v-for="group in moduleGroups()" :key="group.id" class="eva-pb-mod-group">',
      '          <h4 @click="toggleGroup(group.id)"><span>{{ tv(group.label) }}</span><i :class="isGroupOpen(group.id) ? \'ri-arrow-up-s-line\' : \'ri-arrow-down-s-line\'"></i></h4>',
      '          <div v-show="isGroupOpen(group.id)" class="eva-pb-mod-grid">',
      '            <button v-for="module in modulesByGroup(group.id)" :key="module.type" type="button" class="eva-pb-mod" draggable="true" @click="addModule(module.type)" @dragstart="onModuleDragStart($event, module.type)" @dragend="onModuleDragEnd"><i :class="module.icon"></i><span>{{ tv(module.label) }}</span></button>',
      '          </div>',
      '        </div>',
      '      </div>',
      "</div>",
      "</transition>",
      "</div>",
      '    </aside>',
      "<transition v-bind=\"menuPopoverMotionProps\">",
      "    <div v-if=\"moduleTab === 'menu' && menuActionItem && !leftCollapsed\" class=\"eva-pb-menu-popover-anchor\" :class=\"{ 'is-anchored': menuActionPosition.ready && menuActionPosition.side !== 'overlay', 'is-left': menuActionPosition.side === 'left' }\" :style=\"menuActionsStyle()\" aria-hidden=\"true\"></div>",
      "</transition>",
      "<transition v-bind=\"menuPopoverMotionProps\">",
      "    <aside v-if=\"moduleTab === 'menu' && menuActionItem && !leftCollapsed\" :key=\"menuActionKey\" ref=\"menuActionsPanel\" class=\"eva-pb-menu-actions-popover\" :style=\"menuActionsStyle()\" role=\"menu\" :id=\"menuAddId + '-actions'\" :aria-label=\"menuActionItem.title + '的操作'\">",
      "      <header><span>菜单项操作</span><strong>{{ menuActionItem.title || \"未命名菜单项\" }}</strong></header>",
      "      <div class=\"eva-pb-menu-action-group\">",
      "        <button type=\"button\" role=\"menuitem\" tabindex=\"-1\" :disabled=\"!Number(menuActionItem.id)\" @click=\"runMenuAction('children')\"><i class=\"ri-folder-open-line is-amber\"></i><span>查看子菜单</span><i class=\"ri-arrow-right-s-line eva-pb-menu-action-arrow\"></i></button>",
      "        <a v-if=\"menuActionUrl(menuActionItem)\" role=\"menuitem\" tabindex=\"-1\" :href=\"menuActionUrl(menuActionItem)\" target=\"_blank\" rel=\"noopener noreferrer\" @click=\"closeMenuActions(false)\"><i class=\"ri-external-link-line\"></i><span>在新标签页打开</span></a>",
      "        <button v-else type=\"button\" role=\"menuitem\" tabindex=\"-1\" disabled><i class=\"ri-external-link-line\"></i><span>在新标签页打开</span></button>",
      "        <button type=\"button\" role=\"menuitem\" tabindex=\"-1\" :disabled=\"!menuActionUrl(menuActionItem)\" @click=\"runMenuAction('copy')\"><i class=\"ri-link\"></i><span>复制链接</span></button>",
      "      </div>",
      "      <div v-for=\"(settings, groupIndex) in [menuEditorSettings().slice(0, 3), menuEditorSettings().slice(3)]\" :key=\"'menu-settings-' + groupIndex\" class=\"eva-pb-menu-action-group\">",
      "        <button v-for=\"setting in settings\" :key=\"setting.id\" :data-menu-setting=\"setting.id\" type=\"button\" role=\"menuitem\" tabindex=\"-1\" class=\"eva-pb-menu-action-edit\" :class=\"{ 'is-active': menuEditOpen && menuEditSetting === setting.id }\" aria-haspopup=\"dialog\" :aria-expanded=\"menuEditOpen && menuEditSetting === setting.id\" :aria-controls=\"menuAddId + '-edit'\" @click=\"openMenuEditorSetting(setting.id, $event)\" @keydown.right.prevent=\"openMenuEditorSetting(setting.id, $event)\"><i :class=\"setting.icon\" class=\"is-blue\"></i><span>{{ setting.label }}</span><i class=\"ri-arrow-right-s-line eva-pb-menu-action-arrow\"></i></button>",
      "      </div>",
      "      <div class=\"eva-pb-menu-action-group is-danger\"><button type=\"button\" role=\"menuitem\" tabindex=\"-1\" @click=\"runMenuAction('delete')\"><i class=\"ri-delete-bin-line\"></i><span>移入回收站</span></button></div>",
      "      <p v-if=\"menuActionStatus\" class=\"eva-pb-menu-action-status\" role=\"status\">{{ menuActionStatus }}</p>",
      "    </aside>",
      "</transition>",
      "<transition v-bind=\"menuPopoverMotionProps\">",
      "    <div v-if=\"moduleTab === 'menu' && menuEditOpen && menuEditorActiveItem && !leftCollapsed\" class=\"eva-pb-menu-popover-anchor is-editor\" :class=\"{ 'is-anchored': menuEditPosition.ready && menuEditPosition.side !== 'overlay', 'is-left': menuEditPosition.side === 'left' }\" :style=\"menuItemEditorStyle()\" aria-hidden=\"true\"></div>",
      "</transition>",
      "<transition v-bind=\"menuPopoverMotionProps\">",
      "    <aside v-if=\"moduleTab === 'menu' && menuEditOpen && menuEditorActiveItem && !leftCollapsed\" :key=\"menuEditorItemKey(menuEditorActiveItem) + '-' + menuEditSetting\" ref=\"menuItemEditor\" class=\"eva-pb-menu-edit-popover\" :style=\"menuItemEditorStyle()\" role=\"dialog\" :id=\"menuAddId + '-edit'\" :aria-labelledby=\"menuAddId + '-edit-title'\">",
      "      <header class=\"eva-pb-menu-editor-details-head\"><div><small>{{ menuEditorActiveItem.title || '新菜单项' }}</small><strong :id=\"menuAddId + '-edit-title'\">{{ menuEditorSettingLabel() }}</strong></div><button type=\"button\" class=\"eva-pb-menu-editor-close\" aria-label=\"关闭菜单项编辑\" @click=\"closeMenuItemEditor\"><i class=\"ri-close-line\"></i></button></header>",
      "      <div class=\"eva-pb-menu-edit-body\">",
      "        <label v-if=\"menuEditSetting === 'title'\" class=\"eva-pb-menu-editor-field\">导航标签<input ref=\"menuItemTitle\" type=\"text\" v-model=\"menuEditorActiveItem.title\" @input=\"markMenuEditorDirty\" placeholder=\"输入导航标签\"></label>",
      "        <label v-else-if=\"menuEditSetting === 'parent'\" class=\"eva-pb-menu-editor-field\">菜单父级<select class=\"eva-pb-menu-wp-select\" :value=\"String(menuEditorActiveItem.parent || 0)\" :disabled=\"menuEditorSaving\" @change=\"setMenuEditorParent(menuEditorActiveItem, $event.target.value)\"><option v-for=\"option in menuEditorParentOptions(menuEditorActiveItem)\" :key=\"option.value\" :value=\"option.value\">{{ option.label }}</option></select></label>",
      "        <label v-else-if=\"menuEditSetting === 'order'\" class=\"eva-pb-menu-editor-field\">菜单排序<select class=\"eva-pb-menu-wp-select\" :value=\"menuEditorOrderValue(menuEditorActiveItem)\" :disabled=\"menuEditorSaving\" @change=\"setMenuEditorOrder(menuEditorActiveItem, $event.target.value)\"><option v-for=\"option in menuEditorOrderOptions(menuEditorActiveItem)\" :key=\"option.value\" :value=\"option.value\">{{ option.label }}</option></select></label>",
      "<div v-else-if=\"menuEditorCustomSetting()\" class=\"eva-pb-menu-editor-field eva-pb-menu-registered-field\"><label>{{ menuEditorSettingLabel() }}</label><eva-field :field=\"menuEditorCustomField(menuEditorCustomSetting())\" :model-value=\"menuEditorCustomValue(menuEditorActiveItem, menuEditorCustomSetting())\" @update:model-value=\"setMenuEditorCustomValue(menuEditorActiveItem, menuEditorCustomSetting(), $event)\"></eva-field><span v-if=\"menuEditorCustomSetting().field.desc\" class=\"eva-pb-menu-editor-hint\" v-html=\"tv(menuEditorCustomSetting().field.desc)\"></span></div>",
      "<label v-else-if=\"menuEditSetting === 'url' && menuEditorActiveItem.type === 'custom'\" class=\"eva-pb-menu-editor-field\">URL<input type=\"url\" v-model=\"menuEditorActiveItem.url\" @input=\"markMenuEditorDirty\"></label>",
      "        <label v-else-if=\"menuEditSetting === 'target'\" class=\"eva-pb-menu-wp-checkbox\"><input type=\"checkbox\" :checked=\"menuEditorActiveItem.target === '_blank'\" @change=\"menuEditorActiveItem.target = $event.target.checked ? '_blank' : ''; markMenuEditorDirty()\">在新标签页打开链接</label>",
      "        <label v-else-if=\"menuEditSetting === 'rel'\" class=\"eva-pb-menu-editor-field\">链接关系（XFN）<input type=\"text\" v-model=\"menuEditorActiveItem.rel\" @input=\"markMenuEditorDirty\" placeholder=\"nofollow noopener\"></label>",
      "<label v-else-if=\"menuEditSetting === 'attr_title'\" class=\"eva-pb-menu-editor-field\">标题属性<input type=\"text\" v-model=\"menuEditorActiveItem.attr_title\" @input=\"markMenuEditorDirty\"></label>",
      "<label v-else-if=\"menuEditSetting === 'classes'\" class=\"eva-pb-menu-editor-field\">CSS 类（可选）<input type=\"text\" v-model=\"menuEditorActiveItem.classes\" @input=\"markMenuEditorDirty\"></label>",
      "<label v-else-if=\"menuEditSetting === 'description'\" class=\"eva-pb-menu-editor-field\">描述<textarea v-model=\"menuEditorActiveItem.description\" rows=\"4\" @input=\"markMenuEditorDirty\"></textarea></label>",
      "      </div>",
      "      <footer><span role=\"status\">{{ menuEditorStatus || '修改后请点击左下角保存' }}</span><button type=\"button\" @click=\"closeMenuItemEditor\">完成</button></footer>",
      "    </aside>",
      "</transition>",
      "<transition v-bind=\"menuPopoverMotionProps\">",
      "    <aside v-if=\"moduleTab === 'menu' && menuSubmenuOpen && menuSubmenuParent && !leftCollapsed\" :key=\"menuSubmenuPath.join('/')\" ref=\"menuSubmenuPanel\" class=\"eva-pb-menu-add-panel eva-pb-menu-submenu-panel\" :class=\"{ 'is-anchored': menuSubmenuPosition.side !== 'overlay', 'is-left': menuSubmenuPosition.side === 'left' }\" :style=\"menuSubmenuPanelStyle()\" role=\"dialog\" :aria-labelledby=\"menuAddId + '-submenu-title'\">",
      "      <header class=\"eva-pb-menu-add-head\">",
      "        <button v-if=\"menuSubmenuPath.length > 1\" type=\"button\" class=\"eva-pb-menu-submenu-back\" @click=\"backMenuSubmenu\" aria-label=\"返回上一级子菜单\"><i class=\"ri-arrow-left-s-line\"></i></button>",
      "        <span v-else class=\"eva-pb-menu-add-head-icon\"><i class=\"ri-folder-add-line\" aria-hidden=\"true\"></i></span>",
      "        <div class=\"eva-pb-menu-add-heading\"><strong :id=\"menuAddId + '-submenu-title'\" :title=\"menuSubmenuParent.title\">{{ menuSubmenuParent.title }} / 子菜单</strong><p :title=\"'管理「' + menuSubmenuParent.title + '」的下级菜单项'\">管理「{{ menuSubmenuParent.title }}」的下级菜单项</p></div>",
      "        <button type=\"button\" @click=\"closeMenuSubmenu\" aria-label=\"关闭子菜单面板\"><i class=\"ri-close-line\"></i></button>",
      "      </header>",
      "      <div class=\"eva-pb-menu-submenu-body\">",
      "        <label class=\"eva-pb-menu-add-search\"><i class=\"ri-search-line\" aria-hidden=\"true\"></i><input ref=\"menuSubmenuSearch\" v-model=\"menuSubmenuQuery\" placeholder=\"搜索子菜单…\" aria-label=\"搜索当前层级子菜单\"></label>",
      "        <div class=\"eva-pb-menu-submenu-list\" role=\"list\">",
      "<transition-group v-bind=\"menuMotionProps\" appear>",
      "          <div v-for=\"child in menuSubmenuItems\" :key=\"menuEditorItemKey(child)\" data-menu-motion-row class=\"eva-pb-menu-submenu-row\" :data-submenu-key=\"menuEditorItemKey(child)\" role=\"listitem\">",
      "            <svg v-if=\"menuEditorIconSymbol(child)\" class=\"eva-pb-menu-editor-icon\" aria-hidden=\"true\"><use :href=\"menuEditorIconSymbol(child)\"></use></svg><i v-else class=\"eva-pb-menu-editor-icon\" :class=\"menuEditorIcon(child)\" aria-hidden=\"true\"></i>",
      "            <button type=\"button\" class=\"eva-pb-menu-submenu-label\" :title=\"child.title\" @click=\"editMenuSubmenuItem(child)\">{{ child.title || '未命名菜单项' }}</button>",
      "            <button v-if=\"Number(child.id || 0) > 0\" type=\"button\" class=\"eva-pb-menu-submenu-next\" @click=\"enterMenuSubmenu(child)\" :aria-label=\"'查看' + child.title + '的子菜单'\" title=\"进入下一级\"><i class=\"ri-arrow-right-s-line\"></i></button>",
      "          </div>",
      "          <p v-if=\"!menuSubmenuItems.length\" key=\"empty\" class=\"eva-pb-menu-submenu-empty\">{{ menuSubmenuQuery.trim() ? '没有匹配的子菜单。' : '还没有子菜单，可在下方添加。' }}</p>",
      "</transition-group>",
      "        </div>",
      "      </div>",
      "      <footer class=\"eva-pb-menu-submenu-footer\"><button type=\"button\" @click=\"manageMenuSubmenu\"><i class=\"ri-settings-3-line\"></i>管理子菜单</button><button type=\"button\" class=\"is-primary\" @click=\"openMenuAddPanel(menuSubmenuParent)\"><i class=\"ri-add-line\"></i>添加子菜单</button></footer>",
      "    </aside>",
      "</transition>",
      "<transition v-bind=\"menuPopoverMotionProps\">",
      "<aside v-if=\"moduleTab === 'menu' && menuLocationsOpen && menuEditor && menuEditor.menu_id && !leftCollapsed\" ref=\"menuLocationsPanel\" class=\"eva-pb-menu-add-panel eva-pb-menu-locations-panel\" :class=\"{ 'is-anchored': menuLocationsPosition.side !== 'overlay', 'is-left': menuLocationsPosition.side === 'left' }\" :style=\"menuLocationsStyle()\" role=\"dialog\" :id=\"menuAddId + '-locations'\" :aria-labelledby=\"menuAddId + '-locations-title'\">",
      "  <header class=\"eva-pb-menu-add-head\">",
      "    <span class=\"eva-pb-menu-add-head-icon\"><i class=\"ri-map-pin-2-line\" aria-hidden=\"true\"></i></span>",
      "    <div class=\"eva-pb-menu-add-heading\"><strong :id=\"menuAddId + '-locations-title'\">菜单位置</strong><p :title=\"menuEditor.menu_name\">设置「{{ menuEditor.menu_name }}」的显示位置</p></div>",
      "    <button type=\"button\" aria-label=\"关闭菜单位置面板\" @click=\"closeMenuLocations\"><i class=\"ri-close-line\"></i></button>",
      "  </header>",
      "  <div class=\"eva-pb-menu-locations-body\">",
      "    <div class=\"eva-pb-menu-locations-summary\"><span>可用显示位置</span><em>已选 {{ menuLocationsSelectedCount }} / {{ menuEditor.locations.length }}</em></div>",
      "    <label v-for=\"location in menuEditor.locations\" :key=\"location.id\" class=\"eva-pb-menu-position-option\" :class=\"{ 'is-selected': location.checked }\">",
      "      <span class=\"eva-pb-menu-position-icon\"><i class=\"ri-layout-line\" aria-hidden=\"true\"></i></span>",
      "      <span class=\"eva-pb-menu-position-copy\"><strong>{{ location.label }}</strong><small v-if=\"location.assigned_menu_id && location.assigned_menu_id !== menuEditor.menu_id\">当前使用：{{ location.assigned_menu_name }}，保存后将替换</small><small v-else>{{ location.checked ? '此菜单将在这里显示' : '尚未选用此位置' }}</small></span>",
      "      <input type=\"checkbox\" v-model=\"location.checked\" :aria-label=\"location.label\" @change=\"markMenuEditorDirty\">",
      "    </label>",
      "    <p v-if=\"!menuEditor.locations.length\" class=\"eva-pb-menu-editor-hint\">主题尚未注册菜单位置。</p>",
      "  </div>",
      "  <footer class=\"eva-pb-menu-add-footer eva-pb-menu-locations-footer\"><span><i class=\"ri-information-line\" aria-hidden=\"true\"></i>修改后请点击左下角保存</span><button type=\"button\" @click=\"closeMenuLocations\">完成</button></footer>",
      "</aside>",
      "</transition>",
      "<transition v-bind=\"menuPopoverMotionProps\">",
      '    <aside v-if="moduleTab === \'menu\' && menuAddOpen && !leftCollapsed" :key="menuAddParentKey" ref="menuAddPanel" class="eva-pb-menu-add-panel" :class="{ \'is-compact\': menuAddPosition.width < 520, \'is-anchored\': menuAddPosition.side !== \'overlay\', \'is-left\': menuAddPosition.side === \'left\' }" :style="menuAddPanelStyle()" role="dialog" :aria-labelledby="menuAddId + \'-title\'">',
      '      <header class="eva-pb-menu-add-head">',
      '        <span class="eva-pb-menu-add-head-icon"><i class="ri-folder-add-line" aria-hidden="true"></i></span>',
      '        <div class="eva-pb-menu-add-heading"><strong :id="menuAddId + \'-title\'">{{ menuAddParent ? \'添加子菜单\' : \'添加菜单项目\' }}</strong><p>{{ menuAddParent ? \'添加到「\' + menuAddParent.title + \'」的子菜单\' : \'选择类型并配置，添加到左侧菜单\' }}</p></div>',
      '        <span class="eva-pb-menu-add-mode">悬浮编辑</span>',
      '        <button type="button" @click="closeMenuAddPanel" aria-label="关闭添加面板"><i class="ri-close-line"></i></button>',
      '      </header>',
      '      <div class="eva-pb-menu-add-layout">',
      '        <nav class="eva-pb-menu-add-nav" aria-label="菜单项目类型">',
      '          <label class="eva-pb-menu-add-search"><i class="ri-search-line" aria-hidden="true"></i><input ref="menuAddSearch" v-model="menuAddTypeSearch" placeholder="搜索添加类型…" aria-label="搜索添加类型"></label>',
      '          <p class="eva-pb-menu-add-caption">菜单项目类型 · {{ menuAddGroups().length }}</p>',
      '          <div class="eva-pb-menu-add-types" role="tablist" aria-orientation="vertical">',
      '            <button v-for="group in menuAddFilteredGroups" :key="group.id" type="button" class="eva-pb-menu-add-type" :class="[ \'is-\' + group.id, { \'is-active\': menuAddType === group.id } ]" :id="menuAddId + \'-tab-\' + group.id" :data-menu-type="group.id" role="tab" :aria-selected="menuAddType === group.id" :aria-controls="menuAddId + \'-content\'" :tabindex="menuAddTabIndex(group.id)" @click="selectMenuAddType(group.id)" @keydown.down.prevent="moveMenuAddType(1)" @keydown.up.prevent="moveMenuAddType(-1)" @keydown.right.prevent="moveMenuAddType(1)" @keydown.left.prevent="moveMenuAddType(-1)">',
      '              <span class="eva-pb-menu-add-type-icon"><i :class="group.icon" aria-hidden="true"></i></span><strong>{{ group.label }}</strong><i class="ri-arrow-right-s-line eva-pb-menu-add-type-arrow" aria-hidden="true"></i>',
      '            </button>',
      '          </div>',
      '          <p v-if="!menuAddFilteredGroups.length" class="eva-pb-menu-editor-hint">没有匹配的类型。</p>',
      '          <small class="eva-pb-menu-add-nav-note">点击类型即可切换编辑内容</small>',
      '        </nav>',
      '        <main class="eva-pb-menu-add-editor" :id="menuAddId + \'-content\'" role="tabpanel" :aria-labelledby="menuAddId + \'-content-title\'">',
      '          <div class="eva-pb-menu-add-group-title">',
      '            <span class="eva-pb-menu-add-type-icon" :class="\'is-\' + menuAddType"><i :class="menuAddActiveGroup.icon" aria-hidden="true"></i></span>',
      '            <div><h3 :id="menuAddId + \'-content-title\'">{{ menuAddActiveGroup.label }}</h3><p>{{ menuAddDescription(menuAddType) }}</p></div>',
      '            <small class="eva-pb-menu-add-availability"><span></span>{{ menuAddType === \'custom\' ? \'可添加\' : ((menuAddSelected[menuAddType] || []).length ? \'已选 \' + menuAddSelected[menuAddType].length + \' 项\' : \'可选择\') }}</small>',
      '          </div>',
      "<transition v-bind=\"menuMotionProps\">",
      "          <div :key=\"menuAddType\" class=\"eva-pb-menu-add-group-body\">",
      '            <template v-if="menuAddType === \'custom\'">',
      '              <div class="eva-pb-menu-editor-link-field"><eva-field :field="menuAddCustomField()" :model-value="menuAddCustom" @update:model-value="menuAddCustom = $event"></eva-field></div>',
      '              <p v-if="menuAddErrors.custom" class="eva-pb-menu-editor-error" role="alert">{{ menuAddErrors.custom }}</p>',
      '              <p class="eva-pb-menu-add-tip"><span></span>菜单项添加后，可以直接在左侧拖拽排序</p>',
      '              <button type="button" class="eva-pb-menu-add-submit" @click="addMenuCustomLink"><i class="ri-add-line"></i>添加到菜单</button>',
      '            </template>',
      '            <template v-else>',
      '              <label class="eva-pb-menu-add-search"><i class="ri-search-line" aria-hidden="true"></i><input v-model="menuAddQueries[menuAddType]" :placeholder="\'搜索\' + menuAddActiveGroup.label + \'…\'" :aria-label="\'搜索\' + menuAddActiveGroup.label" @input="queueMenuAddSearch(menuAddType)"></label>',
      '              <p v-if="menuAddLoading[menuAddType]" class="eva-pb-menu-editor-hint" role="status">正在读取…</p><p v-else-if="menuAddErrors[menuAddType]" class="eva-pb-menu-editor-error" role="alert">{{ menuAddErrors[menuAddType] }}</p>',
      "<div v-else key=\"results\" class=\"eva-pb-menu-motion-results\">",
      '                <label v-if="(menuAddItems[menuAddType] || []).length" class="eva-pb-menu-add-resource is-all"><input type="checkbox" :checked="menuAddAllSelected(menuAddType)" @change="toggleMenuAddAll(menuAddType, $event.target.checked)"><span>全选</span></label>',
      "                <div class=\"eva-pb-menu-add-resource-list\"><transition-group v-bind=\"menuMotionProps\" appear><label v-for=\"resource in menuAddItems[menuAddType] || []\" :key=\"resource.value\" data-menu-motion-row class=\"eva-pb-menu-add-resource\"><input type=\"checkbox\" :checked=\"menuAddIsSelected(menuAddType, resource)\" @change=\"toggleMenuAddSelected(menuAddType, resource, $event.target.checked)\"><span :title=\"resource.label\">{{ resource.label }}</span><small>{{ menuAddResourceMeta(resource) }}</small></label></transition-group></div>",
      '                <p v-if="!(menuAddItems[menuAddType] || []).length" class="eva-pb-menu-editor-hint">没有匹配的{{ menuAddActiveGroup.label }}。</p>',
      "</div>",
      '              <button type="button" class="eva-pb-menu-add-submit" :disabled="!(menuAddSelected[menuAddType] || []).length" @click="addMenuResources(menuAddType)"><i class="ri-add-line"></i>添加选中的{{ menuAddActiveGroup.label }}<small v-if="(menuAddSelected[menuAddType] || []).length">{{ menuAddSelected[menuAddType].length }}</small></button>',
      '            </template>',
      '          </div>',
      "</transition>",
      '        </main>',
      '      </div>',
      '      <footer class="eva-pb-menu-add-footer"><span><i class="ri-information-line" aria-hidden="true"></i>添加后请点击左下角保存</span><span><kbd>Esc</kbd>关闭<b>·</b>点击外部收起</span></footer>',
      '    </aside>',
      "</transition>",
      '    <main class="eva-pb-stage">',
      '      <div class="eva-pb-pagebar"><div class="eva-pb-slot-tabs"><button v-for="slot in slots()" :key="slot.id" type="button" :class="{ \'is-active\': currentSlotId() === slot.id }" @click="activeSlot = slot.id; selectedUid = \'\'">{{ tv(slot.label) }}</button></div></div>',
      '      <section class="eva-pb-canvas" :class="[\'is-\' + device, { \'is-preview\': usesSlots() }]" @click.self="selectedUid = \'\'" @dragover.prevent="onCanvasDragOver" @drop.prevent="onCanvasDrop">',
      '        <div v-if="usesSlots()" class="eva-pb-iframe-shell" :class="{ \'is-dragging\': draggingModule || draggingWidget }">',
      '          <iframe ref="previewFrame" class="eva-pb-iframe" :src="previewUrl()" @load="queuePreview(0)"></iframe>',
      '        </div>',
      '        <template v-else>',
      '          <div v-if="!items().length" class="eva-pb-dropzone"><i class="ri-drag-drop-line"></i><span>{{ t(\'pb_drop_here\') }}</span></div>',
      '          <template v-for="(item, idx) in items()" :key="item.uid">',
      '            <div v-if="idx === 0" class="eva-pb-insert eva-pb-insert--before" :class="{ \'is-dragging\': draggingModule }" @dragover.prevent="onCanvasDragOver" @drop.stop.prevent="onInsertDrop($event, 0)"><span></span></div>',
      '            <div class="eva-pb-item" :class="{ \'is-active\': item.uid === selectedUid }" @click="select(item.uid)">',
      '              <div class="eva-pb-item-tag"><span>{{ tv(moduleLabel(item.type)) }}</span></div>',
      '              <div class="eva-pb-item-tools">',
      '                <button type="button" @click.stop="moveItem(item.uid, -1)" :disabled="idx === 0" :title="t(\'pb_move_up\')"><i class="ri-arrow-up-line"></i></button>',
      '                <button type="button" @click.stop="moveItem(item.uid, 1)" :disabled="idx === items().length - 1" :title="t(\'pb_move_down\')"><i class="ri-arrow-down-line"></i></button>',
      '                <button type="button" @click.stop="duplicateItem(item.uid)" :title="t(\'pb_duplicate\')"><i class="ri-file-copy-line"></i></button>',
      '                <button type="button" @click.stop="removeItem(item.uid)" :title="t(\'pb_delete\')"><i class="ri-delete-bin-line"></i></button>',
      '              </div>',
      '              <div class="eva-pb-render" v-html="renderHtml(item)"></div>',
      '            </div>',
      '            <div class="eva-pb-insert" :class="{ \'is-dragging\': draggingModule }" @dragover.prevent="onCanvasDragOver" @drop.stop.prevent="onInsertDrop($event, idx + 1)"><span></span></div>',
      '          </template>',
      '        </template>',
      '      </section>',
      '    </main>',
      '    <aside class="eva-pb-right">',
      '      <div class="eva-pb-right-tabs"><button type="button" :class="{ \'is-active\': rightTab === \'page\' }" @click="rightTab = \'page\'">{{ t(\'pb_structure\') }}</button><button type="button" :class="{ \'is-active\': rightTab === \'component\' }" @click="rightTab = \'component\'">{{ selectedStructure() ? \'结构设置\' : t(\'pb_component_settings\') }}</button><button v-if="globalFields().length" type="button" :class="{ \'is-active\': rightTab === \'global\' }" @click="rightTab = \'global\'">{{ tv(field.global_label || \'布局设置\') }}</button><template v-if="selectedItem()"><button v-for="tab in selectedModuleTabs()" :key="customTabKey(tab)" type="button" :class="{ \'is-active\': rightTab === customTabKey(tab) }" @click="rightTab = customTabKey(tab)"><i v-if="tab.icon" :class="tab.icon"></i>{{ tv(tab.label || tab.id) }}</button></template></div>',
      '      <template v-if="rightTab === \'page\'">',
      '        <div v-if="fixedStructures().length" class="eva-pb-panel"><h4>固定结构</h4><div class="eva-pb-tree"><button v-for="node in fixedStructures()" :key="node.id" type="button" class="eva-pb-tree-row eva-pb-fixed-row" :class="{ \'is-active\': node.id === selectedStructureId }" @click="selectStructure(node.id)"><i :class="node.icon || \'ri-layout-line\'"></i><span>{{ tv(node.label || node.id) }}</span><i class="ri-lock-line" aria-label="固定结构"></i></button></div></div>',
      '        <div class="eva-pb-panel"><h4>{{ t(\'pb_slot_structure\') }}</h4><div class="eva-pb-tree"><div v-for="item in items()" :key="item.uid" class="eva-pb-tree-row" :class="{ \'is-active\': item.uid === selectedUid }" @click="select(item.uid)"><i :class="moduleIcon(item.type)"></i><span>{{ tv(moduleLabel(item.type)) }}</span></div><p v-if="!items().length" class="eva-pb-empty-sm">{{ t(\'pb_slot_empty\') }}</p></div></div>',
      '      </template>',
      '      <template v-else-if="rightTab === \'global\'">',
      '        <div class="eva-pb-fields eva-pb-fields--global">',
      '          <div class="eva-pb-field" v-for="f in globalFields()" :key="f.id">',
      '            <label v-if="f.title || f.id" class="eva-pb-field-label">{{ tv(f.title || f.id) }}</label>',
      '            <eva-field :field="f" :model-value="globalValue(f)" @update:model-value="updateGlobal(f, $event)"></eva-field>',
      '          </div>',
      '        </div>',
      '      </template>',
      '      <template v-else-if="selectedStructure()">',
      '        <div class="eva-pb-right-head"><i :class="selectedStructure().icon || \'ri-layout-line\'"></i><span>{{ tv(selectedStructure().label || selectedStructure().id) }}</span><i class="ri-lock-line" aria-label="固定结构"></i></div>',
      '        <div class="eva-pb-fields"><div class="eva-pb-field" v-for="f in structureFields()" :key="f.id"><label v-if="f.title || f.id" class="eva-pb-field-label">{{ tv(f.title || f.id) }}</label><eva-field :field="f" :model-value="structureValue(f)" @update:model-value="updateStructure(f, $event)"></eva-field></div></div>',
      '      </template>',
      '      <template v-else>',
      '        <div class="eva-pb-panel eva-pb-panel--blocks" :class="{ \'is-collapsed\': pageBlocksCollapsed }">',
      '          <button type="button" class="eva-pb-panel-toggle" :class="{ \'is-expanded\': !pageBlocksCollapsed }" :aria-expanded="pageBlocksCollapsed ? \'false\' : \'true\'" @click="pageBlocksCollapsed = !pageBlocksCollapsed">',
      '            <span>{{ t(\'pb_page_blocks\') }}</span><i class="ri-arrow-down-s-line" aria-hidden="true"></i>',
      '          </button>',
      '          <transition :css="false" @before-enter="beforeGroupEnter" @enter="enterGroup" @leave="leaveGroup" @after-enter="afterGroupAnimation" @after-leave="afterGroupAnimation">',
      '            <div v-show="!pageBlocksCollapsed" class="eva-pb-tree"><template v-for="group in slotGroups()" :key="group.id"><div class="eva-pb-tree-slot">{{ tv(group.label) }}</div><div v-for="item in group.items" :key="group.id + \'-\' + item.uid" class="eva-pb-tree-row" :class="{ \'is-active\': item.uid === selectedUid }" @click="activeSlot = group.id; select(item.uid)"><i :class="moduleIcon(item.type)"></i><span>{{ tv(moduleLabel(item.type)) }}</span></div><p v-if="!group.items.length" class="eva-pb-empty-sm">{{ t(\'pb_no_blocks\') }}</p></template></div>',
      '          </transition>',
      '        </div>',
      '        <div class="eva-pb-right-sep"></div>',
      '        <template v-if="selectedItem()">',
      '          <div class="eva-pb-right-head"><i :class="moduleIcon(selectedItem().type)"></i><span>{{ tv(moduleLabel(selectedItem().type)) }}</span></div>',
      '          <template v-if="rightTab === \'component\'">',
      '            <div class="eva-pb-fields">',
      '              <div :class="[\'eva-pb-field\', f.class || \'\']" v-for="f in selectedFields()" :key="f.id">',
      '                <label v-if="f.title || f.id" class="eva-pb-field-label">{{ tv(f.title || f.id) }}</label>',
      '                <eva-field :field="f" :model-value="childValue(f)" @update:model-value="updateChild(f, $event)"></eva-field>',
      '              </div>',
      '              <p v-if="!selectedFields().length" class="eva-pb-empty-sm">{{ t(\'pb_no_fields\') }}</p>',
      '            </div>',
      '          </template>',
      '          <template v-else>',
      '            <div class="eva-pb-fields">',
      '              <div :class="[\'eva-pb-field\', f.class || \'\']" v-for="f in customTabFields()" :key="f.id">',
      '                <label v-if="f.title || f.id" class="eva-pb-field-label">{{ tv(f.title || f.id) }}</label>',
      '                <eva-field :field="f" :model-value="childValue(f)" @update:model-value="updateChild(f, $event)"></eva-field>',
      '              </div>',
      '              <p v-if="!customTabFields().length" class="eva-pb-empty-sm">{{ t(\'pb_no_fields\') }}</p>',
      '            </div>',
      '          </template>',
      '        </template>',
      '        <div v-else class="eva-pb-empty-sm"><i class="ri-cursor-line"></i> {{ t(\'pb_select_hint\') }}</div>',
      '      </template>',
      '    </aside>',
      '  </div>',
      "<eva-confirm :motion=\"menuMotionProps\" :model-value=\"!!menuDeleteRequest\" title=\"移入回收站\" :message=\"menuDeleteRequest ? '将“' + menuDeleteRequest.title + '”移入回收站并从菜单中移除？之后可以恢复。' : ''\" :danger=\"true\" confirm-text=\"移入回收站\" @update:model-value=\"!$event && (menuDeleteRequest = null)\" @confirm=\"confirmMenuEditorRemoval\"></eva-confirm>",
      '<div v-if="!menuSaveRegistry && menuEditorDirty" class="eva-pb-menu-save-fallback"><button type="button" class="eva-savefab" :disabled="menuEditorSaving" @click="saveMenuEditor().catch(() => {})"><i class="ri-save-3-line"></i><span>{{ menuEditorSaving ? \'保存中…\' : \'保存\' }}</span></button></div>',
      "<transition name=\"eva-pb-history\">",
      "  <div v-if=\"historyOpen\" class=\"eva-pb-history-layer\" @click.self=\"closeSaveHistory()\">",
      "    <section ref=\"historyPanel\" class=\"eva-pb-history-panel\" role=\"dialog\" aria-modal=\"true\" :id=\"menuAddId + '-history'\" :aria-labelledby=\"menuAddId + '-history-title'\" tabindex=\"-1\">",
      "      <header><div><i class=\"ri-history-line\" aria-hidden=\"true\"></i><strong :id=\"menuAddId + '-history-title'\">保存历史</strong><span>最近 30 条</span></div><button type=\"button\" aria-label=\"关闭保存历史\" @click=\"closeSaveHistory()\"><i class=\"ri-close-line\" aria-hidden=\"true\"></i></button></header>",
      "      <div v-if=\"historyError\" class=\"eva-pb-history-error\" role=\"alert\">{{ historyError }}<button type=\"button\" @click=\"loadSaveHistory(historySelectedId)\">重试</button></div>",
      "      <p v-if=\"historyNotice\" class=\"eva-pb-history-notice\" role=\"status\">{{ historyNotice }}</p>",
      "      <div v-if=\"historyLoading\" class=\"eva-pb-history-empty\" role=\"status\"><span class=\"eva-pb-menu-loading-spinner\"></span><span>正在读取保存历史…</span></div>",
      "      <div v-else-if=\"!historyEntries.length\" class=\"eva-pb-history-empty\"><i class=\"ri-history-line\"></i><strong>还没有保存记录</strong><span>从下一次成功保存开始记录，首次保存前的状态也会保留。</span><button type=\"button\" @click=\"loadSaveHistory()\">刷新</button></div>",
      "      <div v-else class=\"eva-pb-history-content\">",
      "        <nav class=\"eva-pb-history-list\" aria-label=\"保存版本\"><div class=\"eva-pb-history-list-head\"><span>{{ historyEntries.length }} 条记录</span><button type=\"button\" aria-label=\"刷新保存历史\" @click=\"loadSaveHistory()\"><i class=\"ri-refresh-line\"></i></button></div>",
      "          <button v-for=\"entry in historyEntries\" :key=\"entry.id\" type=\"button\" class=\"eva-pb-history-entry\" :class=\"{ 'is-active': historySelectedId === entry.id }\" :aria-pressed=\"historySelectedId === entry.id\" @click=\"loadSaveHistory(entry.id)\"><span class=\"eva-pb-history-entry-top\"><i :class=\"entry.kind === 'menu' ? 'ri-menu-line' : 'ri-layout-line'\"></i><strong>{{ entry.title }}</strong><em v-if=\"entry.initial\">初始</em></span><time>{{ historyTime(entry) }}</time><small>{{ entry.user }} · {{ entry.summary }}</small></button>",
      "        </nav>",
      "        <div class=\"eva-pb-history-detail\"><div v-if=\"historyDetailLoading\" class=\"eva-pb-history-empty\" role=\"status\"><span class=\"eva-pb-menu-loading-spinner\"></span><span>正在读取版本…</span></div><template v-else-if=\"historyDetail\"><div class=\"eva-pb-history-detail-head\"><span>{{ historyDetail.kind === 'menu' ? '菜单快照' : '页面与布局快照' }}</span><h3>{{ historyDetail.title }}</h3><p>由 {{ historyDetail.user }} 保存</p></div><div class=\"eva-pb-history-preview\"><div v-for=\"(row, index) in historyPreviewRows()\" :key=\"index\"><span>{{ row.label }}</span><small>{{ row.value }}</small></div></div><p v-if=\"historyDetail.kind === 'menu' && historyDetail.payload.items.length > 12\" class=\"eva-pb-history-more\">共 {{ historyDetail.payload.items.length }} 个菜单项，以上展示前 12 项。</p></template><div v-else class=\"eva-pb-history-empty\"><i class=\"ri-time-line\"></i><span>选择一条记录查看详情</span></div></div>",
      "      </div>",
      "      <footer><span><i class=\"ri-information-line\"></i>恢复后请点击左下角保存</span><button type=\"button\" class=\"eva-pb-history-restore\" :disabled=\"!historyDetail || historyDetailLoading || menuEditorSaving\" @click=\"historyRestoreConfirm = true\">恢复到编辑器</button></footer>",
      "    </section>",
      "  </div>",
      "</transition>",
      "<eva-confirm :model-value=\"historyRestoreConfirm\" title=\"恢复历史版本\" message=\"将用所选版本替换编辑器中对应的页面布局或菜单修改。恢复后仍需点击左下角保存，网站才会更新。\" confirm-text=\"恢复到编辑器\" @update:model-value=\"historyRestoreConfirm = $event\" @confirm=\"restoreSaveHistory\"></eva-confirm>",
      '</div>'
    ].join('\n')
  };
})();
