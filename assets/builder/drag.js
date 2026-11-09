/** 组件库拖入、已放置组件跨插槽移动与落点判断。 */
(function (runtime) {
  'use strict';


  runtime.drag = {

    // 功能：开始从左侧模块库拖拽模块。
    onModuleDragStart: function (event, type) {
      this.draggingUid = '';
      this.draggingMenuLocation = '';
      this.draggingSlot = '';
      this.draggingModule = type;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', type);
        event.dataTransfer.setData('application/x-eva-module', type);
      }
    },

    // 功能：拖拽结束后清理拖拽状态。
    onModuleDragEnd: function () {
      this.draggingUid = '';
      this.draggingMenuLocation = '';
      this.draggingSlot = '';
      this.draggingModule = '';
      this.sendPreviewDragState(false);
    },

    // 功能：拖入画布时标记为复制操作。
    onCanvasDragOver: function (event) {
      if (this.draggingWidget) {
        if (event.dataTransfer) { event.dataTransfer.dropEffect = this.draggingWidget.operation === 'add' ? 'copy' : 'move'; }
        var area = this.previewWidgetAreaAt(event);
        if (area !== this.draggingWidgetArea) { this.draggingWidgetArea = area; this.sendPreviewDragState(true); }
        return;
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
      var location = !this.draggingUid && this.draggingModule === 'wp_menu' ? this.previewMenuLocationAt(event) : '';
      var target = this.draggingModule && !location ? this.previewModuleTargetAt(event) : null;
      var slot = target ? target.slot : '';
      if (location !== this.draggingMenuLocation || slot !== this.draggingSlot) {
        this.draggingMenuLocation = location;
        this.draggingSlot = slot;
        this.sendPreviewDragState(!!this.draggingModule);
      }
    },

    // 离开画布时立即清除投放高亮，避免取消或跨面板拖动残留目标。
    onCanvasDragLeave: function (event) {
      if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) { return; }
      this.draggingSlot = '';
      this.draggingMenuLocation = '';
      this.draggingWidgetArea = '';
      this.sendPreviewDragState(!!this.draggingModule);
    },

    // 预览中的独立手柄使用指针捕获，跨 iframe 拖动也不会落到组件按钮上。
    handleModulePointerDrag: function (data) {
      if (data.phase === 'start') {
        var value = this.builderValue();
        var item;
        this.slots().some(function (slot) {
          item = (value.slots[slot.id] || []).find(function (entry) { return entry.uid === data.uid; });
          return !!item;
        });
        if (!item || this.draggingWidget) { return; }
        // 手柄捕获期间不替换源节点；结束后再恢复未完成的实时预览。
        this.previewSeq += 1;
        if (this._previewController) { this._previewController.abort(); }
        if (this.previewTimer) { clearTimeout(this.previewTimer); this.previewTimer = null; }
        this.draggingUid = item.uid;
        this.draggingModule = item.type;
        this.draggingMenuLocation = '';
        this.sendPreviewDragState(true);
      }
      if (!this.draggingUid || data.uid !== this.draggingUid) { return; }
      var frame = this.$refs.previewFrame;
      var point = null;
      if (frame && Number.isFinite(data.x) && Number.isFinite(data.y) && frame.clientWidth && frame.clientHeight) {
        var rect = frame.getBoundingClientRect();
        point = { clientX: rect.left + data.x * rect.width / frame.clientWidth, clientY: rect.top + data.y * rect.height / frame.clientHeight };
      }
      if (data.phase === 'start' || data.phase === 'move') {
        if (point) { this.onCanvasDragOver(point); }
        return;
      }
      var uid = this.draggingUid;
      var target = data.phase === 'drop' && point ? this.previewModuleTargetAt(point) : null;
      this._previewDragClickUntil = Date.now() + 500;
      this.onModuleDragEnd();
      var moved = target && this.moveModuleToSlot(uid, target);
      if (!moved) { this.queuePreview(); }
    },

    cancelPreviewModuleDrag: function (event) {
      if (!this.draggingUid || (event.type === 'keydown' && event.key !== 'Escape')) { return; }
      if (event.type === 'keydown') { event.preventDefault(); }
      this._previewDragClickUntil = Date.now() + 500;
      this.onModuleDragEnd();
      this.queuePreview();
    },

    suppressPreviewDragClick: function (event) {
      if (Date.now() < (this._previewDragClickUntil || 0)) { event.preventDefault(); event.stopPropagation(); }
    },

    // 一次性更新源区域和目标区域；移动保留原 uid、类型及全部配置。
    moveModuleToSlot: function (uid, target) {
      if (!target || !this.slots().some(function (slot) { return slot.id === target.slot; })) { return; }
      var value = this.builderValue();
      var source = this.slots().find(function (slot) { return (value.slots[slot.id] || []).some(function (item) { return item.uid === uid; }); });
      if (!source) { return; }
      var from = value.slots[source.id].slice();
      var index = from.findIndex(function (item) { return item.uid === uid; });
      var into = source.id === target.slot ? from : (value.slots[target.slot] || []).slice();
      var at = Math.max(0, Math.min(target.index, into.length));
      if (!Number.isFinite(at)) { return; }
      var item = from.splice(index, 1)[0];
      if (source.id === target.slot && index < at) { at -= 1; }
      if (source.id === target.slot && index === at) { return; }
      into.splice(at, 0, item);
      value.slots[source.id] = from;
      value.slots[target.slot] = into;
      this.activeSlot = target.slot;
      this.selectedUid = uid;
      this.selectedStructureId = '';
      this.rightTab = 'component';
      this.previewSeq += 1;
      var frame = this.$refs.previewFrame;
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'eva-builder-module-move', uid: uid, slot: target.slot, index: at }, window.location.origin);
      }
      this.$emit('update:modelValue', value);
      return true;
    },

    // 功能：读取拖拽中的模块类型。
    draggedModuleType: function (event) {
      if (event && event.dataTransfer) {
        return event.dataTransfer.getData('application/x-eva-module') || event.dataTransfer.getData('text/plain') || this.draggingModule;
      }
      return this.draggingModule;
    },

    // 功能：拖入实际命中的区域；无 iframe 的画布仍加入当前列表。
    onCanvasDrop: function (event) {
      if (this.draggingWidget) { this.dropWidget(this.previewWidgetAreaAt(event)); return; }
      var type = this.draggedModuleType(event);
      if (!type) { return; }
      var location = type === 'wp_menu' ? this.previewMenuLocationAt(event) : '';
      if (location) {
        this.selectPreviewMenuLocation(location);
        this.onModuleDragEnd();
        return;
      }
      if (this.usesSlots()) {
        var target = this.previewModuleTargetAt(event);
        if (target) {
          this.activeSlot = target.slot;
          this.addModuleAt(type, target.index);
        }
      } else {
        this.addModule(type);
      }
      this.onModuleDragEnd();
    },

    // 功能：把左侧模块拖到指定插入点。
    onInsertDrop: function (event, index) {
      if (this.draggingWidget) { this.onWidgetDragEnd(); return; }
      var type = this.draggedModuleType(event);
      if (!type) { return; }
      this.addModuleAt(type, index);
      this.onModuleDragEnd();
    }
  };
})(window.EvaBuilder);
