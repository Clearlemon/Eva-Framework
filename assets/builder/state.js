/** 构建器响应式状态、计算属性、监听与统一挂载/卸载。 */
(function (runtime) {
  'use strict';
  var cfg = runtime.config;
  var stopMenuMotion = runtime.stopMenuMotion;
  var storedPanelOpacity = runtime.storedPanelOpacity;
  var previewRoleOptions = runtime.previewRoleOptions;
  var storedPreviewRole = runtime.storedPreviewRole;
  var genMenuAddId = runtime.genMenuAddId;

  runtime.state = {
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
        draggingUid: '',
        draggingMenuLocation: '',
        draggingSlot: '',
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
        menuSubmenuReturn: null,
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
        menuAddId: genMenuAddId(),
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
      document.addEventListener('keydown', this.cancelPreviewModuleDrag);
      window.addEventListener('blur', this.cancelPreviewModuleDrag);
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
      document.removeEventListener('keydown', this.cancelPreviewModuleDrag);
      window.removeEventListener('blur', this.cancelPreviewModuleDrag);
      this.onModuleDragEnd();
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
    }
  };
})(window.EvaBuilder);
