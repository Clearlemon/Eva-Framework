/** 菜单项指针拖动与键盘移动。 */
(function (runtime) {
  'use strict';


  runtime.menuDrag = {
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
    }
  };
})(window.EvaBuilder);
