/** 面板偏好、尺寸调整与全屏操作。 */
(function (runtime) {
  'use strict';

  var previewRoleOptions = runtime.previewRoleOptions;
  runtime.shell = {

    // 功能：i18n 兜底取值。
    tv: function (value) {
      return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(value) : value || '';
    },

    // 功能：取词条。外壳文案走 Languages/*.php 的 pb_* 键。
    t: function (key) {
      return window.EvaI18n && window.EvaI18n.t ? window.EvaI18n.t(key) : key;
    },

    // 功能：更新构建器两侧浮动面板透明度。
    setPanelOpacity: function (value) {
      var next = Math.max(40, Math.min(100, parseInt(value, 10) || 88));
      this.panelOpacity = next;
      document.documentElement.style.setProperty('--eva-pb-panel-opacity', String(next) + '%');
      try {
        window.localStorage.setItem('eva_fw_panel_opacity', String(next));
      } catch (e) {}
    },

    // 功能：切换构建器 iframe 的临时预览身份，不改变真实登录状态。
    setPreviewRole: function (value) {
      var next = String(value || 'current');
      if (!this.previewRoleOptions.some(function (role) {
        return String(role.value) === next;
      })) {
        next = 'current';
      }
      this.previewRole = next;
      try {
        window.localStorage.setItem('eva_fw_builder_preview_role', next);
      } catch (e) {}
      this.queuePreview(0);
    },

    // 功能：顶栏品牌名。字段可用 brand 指定，让构建器显示宿主主题/插件的名字，
    // 不传才回落到框架自己的标识。
    brandName: function () {
      return this.field && this.field.brand || 'EVA Framework';
    },

    // 功能：顶栏品牌版本号，同样可由字段的 brand_version 指定。
    brandVersion: function () {
      return this.field && this.field.brand_version || 'v1.0.0';
    },

    // 功能：模块注册表。
    registry: function () {
      return window.EvaModules || {};
    },

    // 功能：开始拖拽左右面板的尺寸分隔线或折叠图标。
    beginPanelResize: function (event, side, source) {
      if (!event || event.button !== undefined && event.button !== 0) {
        return;
      }
      this.resizingPanel = side;
      this.resizeSource = source || 'handle';
      this.resizeMoved = false;
      this.resizeStartX = event.clientX;
      this.resizeStartWidth = side === 'left' ? this.leftWidth : this.rightWidth;
      document.body.classList.add('eva-pb-resizing');
      if (event.currentTarget && event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch (e) {}
      }
      if (this.resizeSource === 'handle') {
        event.preventDefault();
      }
    },

    // 功能：开始拖拽独立分隔线。
    startPanelResize: function (event, side) {
      this.beginPanelResize(event, side, 'handle');
    },

    // 功能：按住折叠图标时也进入面板宽度拖拽模式。
    startPanelToggleDrag: function (event, side) {
      this.beginPanelResize(event, side, 'toggle');
    },

    // 功能：根据指针横向移动调整面板宽度，限制在可用范围内。
    onPanelResizeMove: function (event) {
      if (!this.resizingPanel || !event) {
        return;
      }
      var delta = event.clientX - this.resizeStartX;
      if (Math.abs(delta) < 5) {
        return;
      }
      this.resizeMoved = true;
      if (this.resizingPanel === 'left') {
        var leftTarget = Math.max(0, Math.min(820, this.resizeStartWidth + delta));
        // 拖到边缘时吸附为完全折叠；保留 leftWidth，之后可点击或反向拖出恢复。
        if (leftTarget <= 48) {
          this.leftCollapsed = true;
          return;
        }
        if (this.leftCollapsed) {
          // 已折叠状态下只能向右拖动左图标来展开。
          if (delta <= 5) {
            return;
          }
          this.leftCollapsed = false;
        }
        this.leftWidth = Math.max(64, leftTarget);
      } else {
        var rightTarget = Math.max(0, Math.min(860, this.resizeStartWidth - delta));
        // 拖到边缘时吸附为完全折叠；保留 rightWidth，之后可点击或反向拖出恢复。
        if (rightTarget <= 48) {
          this.rightCollapsed = true;
          return;
        }
        if (this.rightCollapsed) {
          // 已折叠状态下只能向左拖动右图标来展开。
          if (delta >= -5) {
            return;
          }
          this.rightCollapsed = false;
        }
        this.rightWidth = Math.max(64, rightTarget);
      }
    },

    // 功能：结束面板尺寸拖拽并恢复页面光标状态。
    stopPanelResize: function () {
      if (!this.resizingPanel) {
        return;
      }
      var source = this.resizeSource;
      var moved = this.resizeMoved;
      this.resizingPanel = '';
      this.resizeSource = '';
      this.resizeMoved = false;
      document.body.classList.remove('eva-pb-resizing');
      if (source === 'toggle') {
        this.suppressToggleClick = moved;
      }
    },

    // 功能：图标轻点时保留原有折叠/展开行为；拖动结束后的 click 则忽略。
    finishPanelToggleClick: function (side) {
      if (this.suppressToggleClick) {
        this.suppressToggleClick = false;
        return;
      }
      if (side === 'left') {
        this.leftCollapsed = !this.leftCollapsed;
      } else {
        this.rightCollapsed = !this.rightCollapsed;
      }
    },

    // 功能：同步浏览器全屏状态到组件状态。
    syncFullscreenState: function () {
      this.fullScreen = document.fullscreenElement === this.$refs.pbRoot;
    },

    // 功能：切换页面构建器全屏编辑模式。
    toggleFullscreen: function () {
      var el = this.$refs.pbRoot;
      if (!el) {
        return;
      }
      if (document.fullscreenElement === el || this.fullScreen) {
        if (document.fullscreenElement === el && document.exitFullscreen) {
          document.exitFullscreen();
        }
        this.fullScreen = false;
        return;
      }
      this.fullScreen = true;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(function () {});
      }
    },

    /** 为面板调整和菜单拖动保留稳定的事件处理函数。 */initPointerHandlers: function () {
      this._resizeMoveHandler = this.onPanelResizeMove.bind(this);
      this._resizeEndHandler = this.stopPanelResize.bind(this);
      this._menuDragMoveHandler = this.onMenuEditorPointerMove.bind(this);
      this._menuDragEndHandler = this.onMenuEditorPointerUp.bind(this);
      this._menuDragCancelHandler = this.cancelMenuEditorDrag.bind(this);
    },

    /** 统一绑定全屏、指针与鼠标操作。 */bindPointerEvents: function () {
      document.addEventListener('fullscreenchange', this.syncFullscreenState);
      document.addEventListener('pointermove', this._resizeMoveHandler);
      document.addEventListener('pointerup', this._resizeEndHandler);
      document.addEventListener('pointercancel', this._resizeEndHandler);
      document.addEventListener('pointermove', this._menuDragMoveHandler);
      document.addEventListener('pointerup', this._menuDragEndHandler);
      document.addEventListener('pointercancel', this._menuDragCancelHandler);
      document.addEventListener('mousemove', this._resizeMoveHandler);
      document.addEventListener('mouseup', this._resizeEndHandler);
    },

    /** 停止菜单交互并解绑指针操作。 */unbindPointerEvents: function () {
      this.stopMenuAddTracking();
      this.cancelMenuEditorDrag();
      document.removeEventListener('fullscreenchange', this.syncFullscreenState);
      document.removeEventListener('pointermove', this._resizeMoveHandler || this.onPanelResizeMove);
      document.removeEventListener('pointerup', this._resizeEndHandler || this.stopPanelResize);
      document.removeEventListener('pointercancel', this._resizeEndHandler || this.stopPanelResize);
      document.removeEventListener('pointermove', this._menuDragMoveHandler);
      document.removeEventListener('pointerup', this._menuDragEndHandler);
      document.removeEventListener('pointercancel', this._menuDragCancelHandler);
    },

    /** 解绑面板调整的兼容鼠标事件。 */unbindMouseEvents: function () {
      document.removeEventListener('mousemove', this._resizeMoveHandler || this.onPanelResizeMove);
      document.removeEventListener('mouseup', this._resizeEndHandler || this.stopPanelResize);
    }
  };
})(window.EvaBuilder);
