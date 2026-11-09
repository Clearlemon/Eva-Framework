/** 菜单项操作浮层及键盘操作。 */
(function (runtime) {
  'use strict';


  runtime.menuActions = {
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
      this.menuSubmenuReturn = null;
      this._menuSubmenuReturnAnchor = null;
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
      if (this.menuSubmenuReturn && (event.key === 'Escape' || event.key === 'ArrowLeft')) { event.preventDefault(); event.stopPropagation(); this.returnToMenuSubmenu(); return; }
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
    }
  };
})(window.EvaBuilder);
