/** 菜单项字段、层级、顺序与删除确认。 */
(function (runtime) {
  'use strict';
  var hasOwn = runtime.hasOwn;

  runtime.menuItems = {
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
      return native.concat(advanced, this.menuEditorCustomSettings(item));
    },
    menuEditorSettingGroups: function () {
      var groups = [[], []];
      this.menuEditorSettings().forEach(function (setting) { groups[setting.field ? 1 : 0].push(setting); });
      return groups.filter(function (group) { return group.length; });
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
    }
  };
})(window.EvaBuilder);
