/** 原生小工具读取、分配与预览拖放。 */
(function (runtime) {
  'use strict';
  var cfg = runtime.config;

  runtime.widgets = {
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
      if (this.widgetsSaving || this.widgetsLoading || !cfg.restActions || !this.widgetAreas.some(function (entry) { return entry.id === area; })) { return Promise.resolve(); }
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
      return window.EvaApi.action(fd).then(function (json) {
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
      if (!cfg.restActions) { this.widgetsError = '小工具读取接口不可用。'; return; }
      var controller = new AbortController();
      this._widgetsController = controller;
      this.widgetsLoading = true;
      this.widgetsError = '';
      var fd = new FormData();
      fd.append('action', 'eva_fw_builder_widgets_get');
      fd.append('nonce', cfg.nonce || '');
      window.EvaApi.action(fd, { signal: controller.signal }).then(function (json) {
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
    }
  };
})(window.EvaBuilder);
