/** 菜单读取、创建、绑定、草稿与保存。 */
(function (runtime) {
  'use strict';
  var cfg = runtime.config;
  var clone = runtime.clone;

  runtime.menuData = {
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
      if (!cfg.restActions || !this.menuLocation) { return; }
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
      window.EvaApi.action(fd, { signal: controller.signal }).then(function (json) {
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
      if (!cfg.restActions) { this.menuAssignError = '菜单绑定接口不可用。'; return; }
      var location = this.menuLocation;
      var fd = new FormData();
      fd.append('action', 'eva_fw_builder_menu_assign');
      fd.append('nonce', cfg.nonce || '');
      fd.append('location_id', location);
      fd.append('menu_id', option.value);
      this.menuAssigning = true;
      return window.EvaApi.action(fd).then(function (json) {
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
      if (!cfg.restActions) { this.menuCreateError = '菜单创建接口不可用。'; return; }
      var location = this.menuLocation;
      var fd = new FormData();
      fd.append('action', 'eva_fw_builder_menu_create');
      fd.append('nonce', cfg.nonce || '');
      fd.append('location_id', location);
      fd.append('menu_name', name);
      this.menuCreating = true;
      window.EvaApi.action(fd).then(function (json) {
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
      if (!cfg.restActions) { return Promise.reject(new Error('菜单保存接口不可用')); }
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
      return window.EvaApi.action(fd).then(function (json) {
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
    }
  };
})(window.EvaBuilder);
