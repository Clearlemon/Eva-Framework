/** 选中模块、固定结构、容器与全局参数。 */
(function (runtime) {
  'use strict';
  var clone = runtime.clone;
  var hasOwn = runtime.hasOwn;
  var dependencyVisible = runtime.dependencyVisible;

  runtime.fields = {

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
    }
  };
})(window.EvaBuilder);
