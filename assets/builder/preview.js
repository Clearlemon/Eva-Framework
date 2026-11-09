/** 预览 iframe 通信、局部渲染与请求取消。 */
(function (runtime) {
  'use strict';

  var cfg = runtime.config;
  var esc = runtime.esc;
  runtime.preview = {

    // 功能：真实前台 iframe 预览地址。
    // 字段可用 preview_url 指定自己的预览目标（例如文章页画布预览一篇文章），
    // 没指定时回落到全局的首页预览地址。
    previewUrl: function () {
      var page = this.currentPage();
      var base = page && page.preview_url || this.field && this.field.preview_url || cfg.builderPreviewUrl || '/';
      try {
        var url = new URL(base, window.location.origin);
        url.searchParams.set('eva_preview_role', this.previewRole || 'current');
        return url.toString();
      } catch (e) {
        return base;
      }
    },

    // 功能：预览目标的显示名，字段可用 preview_label 指定。
    previewLabel: function () {
      var page = this.currentPage();
      if (page) {
        return page.label;
      }
      return this.field && this.field.preview_label || '首页 (Home)';
    },

    // 功能：监听 iframe 准备完成消息。
    handlePreviewMessage: function (event) {
      if (event.origin !== window.location.origin || !event.data) {
        return;
      }
      var frame = this.$refs.previewFrame;
      if (!frame || event.source !== frame.contentWindow) {
        return;
      }
      if (event.data.type === 'eva-builder-module-drag') {
        this.handleModulePointerDrag(event.data);
        return;
      }
      if (event.data.type === 'eva-builder-preview-ready') {
        this.previewReady = true;
        this.queuePreview(0);
        this.sendPreviewMenuState();
        this.sendPreviewWidgetState();
        this.sendPreviewDragState(!!this.draggingModule);
        return;
      }
      if (event.data.type === 'eva-builder-structure-select') {
        this.selectStructure(event.data.id);
        return;
      }
      if (event.data.type === 'eva-builder-widget-area-select') {
        if (this.widgetAreas.some(function (area) {
          return area.id === event.data.area;
        })) {
          this.moduleTab = 'widgets';
          this.widgetArea = event.data.area;
        }
        return;
      }
      if (event.data.type === 'eva-builder-menu-location-select') {
        this.selectPreviewMenuLocation(event.data.location);
        return;
      }
      if (event.data.type !== 'eva-builder-module-action') {
        return;
      }
      var uid = event.data.uid || '';
      var action = event.data.action || 'select';
      if (!uid) {
        return;
      }
      if (this.usesSlots()) {
        var value = this.builderValue();
        var owner = this.slots().find(function (slot) {
          return (value.slots[slot.id] || []).some(function (item) {
            return item.uid === uid;
          });
        });
        if (!owner) {
          return;
        }
        this.activeSlot = owner.id;
      }
      this.selectedUid = uid;
      this.selectedStructureId = '';
      this.rightTab = 'component';
      if (action === 'up') {
        this.moveItem(uid, -1);
      } else if (action === 'down') {
        this.moveItem(uid, 1);
      } else if (action === 'duplicate') {
        this.duplicateItem(uid);
      } else if (action === 'remove') {
        this.removeItem(uid);
      } else {
        this.queuePreview(0);
      }
    },

    // 功能：合并连续变更，延迟刷新 iframe。
    queuePreview: function (delay) {
      if (!this.usesSlots()) {
        return;
      }
      this.previewSeq += 1;
      if (this._previewController) {
        this._previewController.abort();
      }
      if (this.previewTimer) {
        clearTimeout(this.previewTimer);
      }
      if (this.previewReady) {
        this.postPreviewHtml(this.optimisticSlots());
      }
      var wait = typeof delay === 'number' ? delay : 180;
      this.previewTimer = setTimeout(this.renderPreview, wait);
    },

    // 功能：生成预览工具条 HTML，先用于本地乐观预览，随后由 PHP 真实渲染替换。
    previewToolsHtml: function () {
      return '<button type="button" class="eva-builder-preview-drag-handle" data-eva-builder-drag-handle aria-label="拖动组件到其他插槽" title="拖动组件到其他插槽（Esc 取消）">⠿</button>' + '<div class="eva-builder-preview-tools" role="group" aria-label="组件操作">' + '<button type="button" data-eva-builder-action="up">' + this.t('pb_move_up') + '</button>' + '<button type="button" data-eva-builder-action="down">' + this.t('pb_move_down') + '</button>' + '<button type="button" data-eva-builder-action="duplicate">' + this.t('pb_duplicate') + '</button>' + '<button type="button" data-eva-builder-action="remove">' + this.t('pb_delete') + '</button>' + '</div>';
    },

    // 功能：用模块的前端 render 或 preview 模板生成即时真实预览。
    renderInstantModule: function (item) {
      var reg = this.registry();
      var module = reg[item.type] || {};
      var values = item.values || {};
      if (typeof module.render === 'function') {
        try {
          return module.render(values);
        } catch (e) {}
      }
      if (typeof module.preview === 'string' && module.preview) {
        return module.preview.replace(/\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g, function (match, key) {
          return esc(values[key] === undefined ? '' : values[key]);
        });
      }
      return '';
    },

    // 功能：生成单个模块的即时占位 HTML。
    optimisticModuleHtml: function (item) {
      var uid = esc(item && item.uid ? item.uid : '');
      var type = esc(item && item.type ? item.type : '');
      var label = esc(this.tv(this.moduleLabel(item.type)));
      var instant = this.renderInstantModule(item);
      // 只有 PHP 渲染的已有模块保留当前画面，避免每次改字段都销毁并重建控件。
      if (!instant) {
        var frame = this.$refs.previewFrame;
        try {
          var current = frame && frame.contentDocument && frame.contentDocument.querySelector('[data-eva-builder-module="' + uid + '"]');
          if (current) {
            if (!current.classList.contains('eva-builder-module-moving')) {
              return current.outerHTML;
            }
            var stable = current.cloneNode(true);
            stable.classList.remove('eva-builder-module-moving');
            return stable.outerHTML;
          }
        } catch (error) {}
      }
      return '<div class="eva-builder-preview-module is-pending" data-eva-builder-module="' + uid + '" data-eva-builder-type="' + type + '">' + this.previewToolsHtml() + (instant || '<section class="eva-builder-preview-pending"><strong>' + label + '</strong><span>' + this.t('pb_rendering') + '</span></section>') + '</div>';
    },

    // 功能：把当前 Builder 值转换成 iframe 可立即显示的占位 HTML。
    optimisticSlots: function () {
      return this.optimisticSlotsFromValue(this.builderValue());
    },

    // 功能：把指定 Builder 值转换成 iframe 可立即显示的占位 HTML。
    optimisticSlotsFromValue: function (value) {
      var slots = {};
      Object.keys(value.slots || {}).forEach(function (slot) {
        var items = Array.isArray(value.slots[slot]) ? value.slots[slot] : [];
        slots[slot] = items.map(function (item) {
          return this.optimisticModuleHtml(item);
        }, this).join('');
      }, this);
      return slots;
    },

    // 功能：向 iframe 发送 HTML 更新。
    postPreviewHtml: function (slots, structures) {
      var frame = this.$refs.previewFrame;
      if (!frame || !frame.contentWindow) {
        return;
      }
      frame.contentWindow.postMessage({
        type: 'eva-builder-preview-html',
        slots: slots || {},
        slotLabels: this.slots().reduce(function (labels, slot) {
          labels[slot.id] = this.tv(slot.label);
          return labels;
        }.bind(this), {}),
        structures: structures || {},
        activeSlot: this.currentSlotId(),
        selectedUid: this.selectedUid || '',
        selectedStructure: this.selectedStructureId || ''
      }, window.location.origin);
    },

    // 功能：通知 iframe 当前是否处于拖拽投放状态。
    sendPreviewDragState: function (active) {
      var frame = this.$refs.previewFrame;
      if (!frame || !frame.contentWindow) {
        return;
      }
      frame.contentWindow.postMessage({
        type: 'eva-builder-drag-state',
        active: !!active || !!this.draggingWidget,
        moduleType: this.draggingModule || '',
        uid: this.draggingUid || '',
        slot: this.draggingSlot || '',
        menuLocation: this.draggingMenuLocation || '',
        widgetDragging: !!this.draggingWidget,
        widgetArea: this.draggingWidgetArea || ''
      }, window.location.origin);
    },

    // 功能：菜单面板与 iframe 中的真实菜单位置同步高亮。
    sendPreviewMenuState: function () {
      var frame = this.$refs.previewFrame;
      if (!frame || !frame.contentWindow) {
        return;
      }
      frame.contentWindow.postMessage({
        type: 'eva-builder-menu-state',
        active: this.moduleTab === 'menu',
        location: this.menuLocation || ''
      }, window.location.origin);
    },

    selectPreviewMenuLocation: function (location) {
      var id = String(location || '');
      if (!this.menuLocationData().some(function (item) {
        return String(item.id) === id;
      })) {
        return;
      }
      this.moduleTab = 'menu';
      this.setMenuLocation(id);
      this.sendPreviewMenuState();
    },

    // 功能：拖拽遮罩接收坐标，再映射回 iframe 真实菜单节点，兼容画布缩放。
    previewMenuLocationAt: function (event) {
      var frame = this.$refs.previewFrame;
      if (!frame || !event) {
        return '';
      }
      try {
        var rect = frame.getBoundingClientRect();
        if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
          return '';
        }
        var x = (event.clientX - rect.left) * frame.clientWidth / rect.width;
        var y = (event.clientY - rect.top) * frame.clientHeight / rect.height;
        var doc = frame.contentDocument;
        var element = doc && doc.elementFromPoint(x, y);
        var target = element && element.closest('[data-eva-menu-location]');
        var location = target ? target.getAttribute('data-eva-menu-location') : '';
        return this.menuLocationData().some(function (item) {
          return String(item.id) === location;
        }) ? location : '';
      } catch (error) {
        return '';
      }
    },

    // 拖放以鼠标所在的真实区域为准，并按模块中线确定插入位置，兼容 iframe 缩放。
    previewModuleTargetAt: function (event) {
      var frame = this.$refs.previewFrame;
      if (!frame || !event) {
        return null;
      }
      try {
        var rect = frame.getBoundingClientRect();
        if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
          return null;
        }
        var x = (event.clientX - rect.left) * frame.clientWidth / rect.width;
        var y = (event.clientY - rect.top) * frame.clientHeight / rect.height;
        var doc = frame.contentDocument;
        var node = doc && doc.elementFromPoint(x, y);
        var target = node && node.closest('[data-eva-builder-slot]');
        var slot = target ? target.getAttribute('data-eva-builder-slot') : '';
        if (!this.slots().some(function (entry) {
          return entry.id === slot;
        })) {
          return null;
        }
        var items = this.builderValue().slots[slot] || [];
        var modules = Array.from(target.querySelectorAll('[data-eva-builder-module]')).filter(function (module) {
          return module.closest('[data-eva-builder-slot]') === target;
        });
        var index = items.length;
        for (var i = 0; i < modules.length; i += 1) {
          var uid = modules[i].getAttribute('data-eva-builder-module');
          var at = items.findIndex(function (item) {
            return item.uid === uid;
          });
          var bounds = modules[i].getBoundingClientRect();
          if (at >= 0 && bounds.height && y < bounds.top + bounds.height / 2) {
            index = at;
            break;
          }
        }
        return {
          slot: slot,
          index: index
        };
      } catch (error) {
        return null;
      }
    },

    // 功能：请求 PHP 渲染未保存内容，再 postMessage 给 iframe。
    renderPreview: function () {
      if (!this.usesSlots() || !cfg.restActions || !this.previewReady) {
        return;
      }
      var frame = this.$refs.previewFrame;
      if (!frame || !frame.contentWindow) {
        return;
      }
      var seq = ++this.previewSeq;
      var current = this.builderValue();
      var slots = {};
      this.slots().forEach(function (slot) {
        slots[slot.id] = current.slots[slot.id] || [];
      });
      var serialized = JSON.stringify({
        slots: slots
      });
      var structureValues = this.structureValues();
      var key = (this.previewRole || 'current') + '|' + (this.activePage || '') + '|' + serialized + '|' + JSON.stringify(structureValues);
      this._previewCache = this._previewCache || new Map();
      if (this._previewCache.has(key)) {
        var cached = this._previewCache.get(key);
        this.postPreviewHtml(cached.slots, cached.structures);
        return;
      }
      if (this._previewController) {
        this._previewController.abort();
      }
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      this._previewController = controller;
      var fd = new FormData();
      fd.append('action', 'eva_fw_render_builder_preview');
      fd.append('nonce', cfg.nonce || '');
      fd.append('preview_role', this.previewRole || 'current');
      fd.append('value', serialized);
      fd.append('option_id', this.field.fixed_option_id || '');
      fd.append('field_id', this.field.id || '');
      fd.append('page_id', this.currentPage() ? this.currentPage().id : '');
      fd.append('structure_values', JSON.stringify(structureValues));
      window.EvaApi.action(fd, {
        signal: controller ? controller.signal : undefined
      }).then(function (json) {
        if (seq !== this.previewSeq) {
          return;
        }
        if (!json || !json.success || !json.data) {
          return;
        }
        this._previewCache.set(key, {
          slots: json.data.slots || {},
          structures: json.data.structures || {}
        });
        if (this._previewCache.size > 20) {
          this._previewCache.delete(this._previewCache.keys().next().value);
        }
        this.postPreviewHtml(json.data.slots || {}, json.data.structures || {});
      }.bind(this)).catch(function () {}).finally(function () {
        if (this._previewController === controller) {
          this._previewController = null;
        }
      }.bind(this));
    },

    /** 绑定预览通信及拖动取消事件。 */bindPreviewEvents: function () {
      window.addEventListener('message', this.handlePreviewMessage);
      document.addEventListener('keydown', this.cancelPreviewModuleDrag);
      window.addEventListener('blur', this.cancelPreviewModuleDrag);
    },

    /** 解绑预览通信并结束拖拽状态。 */unbindPreviewEvents: function () {
      window.removeEventListener('message', this.handlePreviewMessage);
      document.removeEventListener('keydown', this.cancelPreviewModuleDrag);
      window.removeEventListener('blur', this.cancelPreviewModuleDrag);
      this.onModuleDragEnd();
      document.body.classList.remove('eva-pb-resizing');
    },

    /** 清理预览防抖和未完成的渲染请求。 */cancelPreviewRequests: function () {
      if (this.previewTimer) {
        clearTimeout(this.previewTimer);
      }
      if (this._previewController) {
        this._previewController.abort();
      }
    }
  };
})(window.EvaBuilder);
