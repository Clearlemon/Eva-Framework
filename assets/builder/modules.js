/** 页面与插槽数据、模块库及实例增删复制。 */
(function (runtime) {
  'use strict';
  var genUid = runtime.genUid;
  var clone = runtime.clone;

  runtime.modules = {
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
    }
  };
})(window.EvaBuilder);
