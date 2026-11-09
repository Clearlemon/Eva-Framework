/** 菜单资源、位置及子菜单浮层的定位与生命周期。 */
(function (runtime) {
  'use strict';


  runtime.menuPanels = {

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
      var list = this.$refs.menuSubmenuPanel && this.$refs.menuSubmenuPanel.querySelector('.eva-pb-menu-submenu-list');
      var context = { path: this.menuSubmenuPath.slice(), anchorKey: this.menuSubmenuAnchorKey, query: this.menuSubmenuQuery, scrollTop: list ? list.scrollTop : 0, focusKey: this.menuEditorItemKey(item) };
      var anchor = this._menuSubmenuAnchor;
      this.closeMenuSubmenu(false);
      this.selectMenuEditorItem(item, this.menuEditor.items.indexOf(item));
      if (this.menuActionKey) { this.menuSubmenuReturn = context; this._menuSubmenuReturnAnchor = anchor; }
    },

    returnToMenuSubmenu: function () {
      var context = this.menuSubmenuReturn, anchor = this._menuSubmenuReturnAnchor;
      if (!context) { return; }
      var path = [];
      for (var i = 0; i < context.path.length; i += 1) {
        var item = this.menuEditorFind(context.path[i]);
        if (!item || this.menuEditorItemIsRemoved(item)) { break; }
        path.push(context.path[i]);
      }
      this.closeMenuActions(false);
      if (!path.length) { return; }
      if (!anchor || !anchor.isConnected) {
        var rows = this.$refs.menuEditorList && Array.from(this.$refs.menuEditorList.querySelectorAll('[data-menu-key]'));
        var row = rows && rows.find(function (node) { return node.getAttribute('data-menu-key') === context.anchorKey; });
        anchor = row && row.querySelector('.eva-pb-menu-item-open');
      }
      if (!anchor || !anchor.isConnected) { return; }
      this.menuSubmenuPath = path;
      this.menuSubmenuAnchorKey = context.anchorKey;
      this.menuSubmenuQuery = path.length === context.path.length ? context.query : '';
      this._menuSubmenuAnchor = anchor;
      this.menuSubmenuOpen = true;
      this.menuSubmenuPosition.ready = false;
      this.$nextTick(function () {
        if (!this.menuSubmenuOpen) { return; }
        this.positionMenuSubmenuPanel(); this.startMenuAddTracking();
        this.$nextTick(function () {
          var panel = this.$refs.menuSubmenuPanel;
          if (!this.menuSubmenuOpen || !panel) { return; }
          var row = Array.from(panel.querySelectorAll('[data-submenu-key]')).find(function (node) { return node.getAttribute('data-submenu-key') === context.focusKey; });
          var focus = row && row.querySelector('.eva-pb-menu-submenu-label') || this.$refs.menuSubmenuSearch;
          if (focus) { focus.focus({ preventScroll: true }); }
          var list = panel.querySelector('.eva-pb-menu-submenu-list');
          if (list) { list.scrollTop = path.length === context.path.length ? context.scrollTop : 0; }
        });
      });
    }
  };
})(window.EvaBuilder);
