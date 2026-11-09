/** 保存历史：列表、详情与恢复到编辑器。 */
(function (runtime) {
  'use strict';
  var cfg = runtime.config;
  var clone = runtime.clone;

  runtime.history = {

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
      if (!cfg.restActions || !this.historyOptionId) { this.historyError = '当前构建器不支持保存历史。'; return; }
      if (this._historyController) { this._historyController.abort(); }
      var controller = new AbortController(), seq = this._historySeq = (this._historySeq || 0) + 1;
      this._historyController = controller; this.historyError = ''; this.historyNotice = '';
      this.historySelectedId = id || ''; this.historyDetail = null;
      this.historyLoading = !id; this.historyDetailLoading = !!id;
      var fd = new FormData();
      fd.append('action', 'eva_fw_builder_history'); fd.append('nonce', cfg.nonce || '');
      fd.append('option_id', this.historyOptionId); fd.append('field_id', this.field.id || '');
      if (id) { fd.append('history_id', id); }
      return window.EvaApi.action(fd, { signal: controller.signal }).then(function (json) {
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

  };
})(window.EvaBuilder);
