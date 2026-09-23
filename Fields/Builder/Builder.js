/**
 * Eva 字段：builder（页面构建器 · 三栏外壳）。
 *
 * 布局：
 * - 左：模块库。数据源 = window.EvaModules（用户自行注册，框架内置一个 hero 示例）。
 * - 中：画布预览。遍历实例数组，调 EvaModules[type].render(values) 输出 HTML；可选中 / 上移下移 / 复制 / 删除。
 * - 右：参数面板。取选中模块的 fields，逐个用 <eva-field> 渲染（复用现有 window.EvaFields 体系）。
 *
 * 保存值（modelValue）= 模块实例数组：
 *   [ { uid: 'm1', type: 'hero', values: { 标题: '...', ... } } ]
 *
 * 扩展：用户在自己的脚本里 `window.EvaModules.xxx = { label, icon, fields, render }` 即可新增模块。
 */
(function () {
  window.EvaFields = window.EvaFields || {};
  window.EvaModules = window.EvaModules || {};

  var UID_SEED = 0;
  var cfg = (window.EvaFW && window.EvaFW.config) || {};
  var gsapPromise = null;

  // 功能：按需加载 GSAP，页面构建器折叠/展开动画复用。
  function loadGsap() {
    if (window.gsap) { return Promise.resolve(window.gsap); }
    if (gsapPromise) { return gsapPromise; }
    gsapPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';
      script.async = true;
      script.onload = function () { resolve(window.gsap); };
      script.onerror = function () { reject(new Error('GSAP load failed')); };
      document.head.appendChild(script);
    });
    return gsapPromise;
  }

  // 功能：生成模块实例唯一 id。
  function genUid() {
    UID_SEED += 1;
    return 'm' + Date.now().toString(36) + UID_SEED.toString(36);
  }

  // 功能：深拷贝纯数据（实例值均可 JSON 序列化）。
  function clone(value) {
    if (value === null || value === undefined) { return value; }
    try { return JSON.parse(JSON.stringify(value)); } catch (e) { return value; }
  }

  // 功能：判断对象自有属性。
  function hasOwn(obj, key) {
    return obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  // 功能：转义预览中的文本，避免模块预览直接拼接用户输入。
  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Builder 不再内置示例模块；模块由 PHP manifest 或用户脚本显式注册。

  var runtimeModules = cfg.builderModules || {};
  Object.keys(runtimeModules).forEach(function (key) {
    var existing = window.EvaModules[key] || {};
    window.EvaModules[key] = Object.assign({}, runtimeModules[key], existing);
  });

  window.EvaFields.builder = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    data: function () {
      return {
        selectedUid: '',
        leftTab: 'components',
        rightTab: 'page',
        device: 'desktop',
        fullScreen: false,
        activeSlot: '',
        activePage: '',
        pageMenuOpen: false,
        draggingModule: '',
        previewTimer: null,
        previewReady: false,
        previewSeq: 0,
        leftCollapsed: false,
        rightCollapsed: false,
        leftWidth: 260,
        rightWidth: 300,
        resizingPanel: '',
        resizeSource: '',
        resizeMoved: false,
        suppressToggleClick: false,
        resizeStartX: 0,
        resizeStartWidth: 0,
        collapsedGroups: {}
      };
    },
    mounted: function () {
      this._resizeMoveHandler = this.onPanelResizeMove.bind(this);
      this._resizeEndHandler = this.stopPanelResize.bind(this);
      document.addEventListener('fullscreenchange', this.syncFullscreenState);
      document.addEventListener('pointermove', this._resizeMoveHandler);
      document.addEventListener('pointerup', this._resizeEndHandler);
      document.addEventListener('pointercancel', this._resizeEndHandler);
      document.addEventListener('mousemove', this._resizeMoveHandler);
      document.addEventListener('mouseup', this._resizeEndHandler);
      window.addEventListener('message', this.handlePreviewMessage);
      this.queuePreview();
    },
    beforeUnmount: function () {
      document.removeEventListener('fullscreenchange', this.syncFullscreenState);
      document.removeEventListener('pointermove', this._resizeMoveHandler || this.onPanelResizeMove);
      document.removeEventListener('pointerup', this._resizeEndHandler || this.stopPanelResize);
      document.removeEventListener('pointercancel', this._resizeEndHandler || this.stopPanelResize);
      document.removeEventListener('mousemove', this._resizeMoveHandler || this.onPanelResizeMove);
      document.removeEventListener('mouseup', this._resizeEndHandler || this.stopPanelResize);
      window.removeEventListener('message', this.handlePreviewMessage);
      document.body.classList.remove('eva-pb-resizing');
      if (this.previewTimer) {
        clearTimeout(this.previewTimer);
      }
    },
    watch: {
      modelValue: {
        deep: true,
        handler: function () {
          this.queuePreview();
        }
      },
      activeSlot: function () {
        this.queuePreview();
      },
      draggingModule: function (value) {
        this.sendPreviewDragState(!!value);
      }
    },
    methods: {
      // 功能：i18n 兜底取值。
      tv: function (value) {
        return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(value) : (value || '');
      },
      // 功能：取词条。外壳文案走 Languages/*.php 的 pb_* 键。
      t: function (key) {
        return window.EvaI18n && window.EvaI18n.t ? window.EvaI18n.t(key) : key;
      },
      // 功能：顶栏品牌名。字段可用 brand 指定，让构建器显示宿主主题/插件的名字，
      // 不传才回落到框架自己的标识。
      brandName: function () {
        return (this.field && this.field.brand) || 'EVA Framework';
      },
      // 功能：顶栏品牌版本号，同样可由字段的 brand_version 指定。
      brandVersion: function () {
        return (this.field && this.field.brand_version) || 'v1.0.0';
      },
      // 功能：模块注册表。
      registry: function () {
        return window.EvaModules || {};
      },
      // 功能：真实前台 iframe 预览地址。
      // 字段可用 preview_url 指定自己的预览目标（例如文章页画布预览一篇文章），
      // 没指定时回落到全局的首页预览地址。
      previewUrl: function () {
        var page = this.currentPage();
        if (page && page.preview_url) { return page.preview_url; }
        return (this.field && this.field.preview_url) || cfg.builderPreviewUrl || '/';
      },
      // 功能：预览目标的显示名，字段可用 preview_label 指定。
      previewLabel: function () {
        var page = this.currentPage();
        if (page) { return page.label; }
        return (this.field && this.field.preview_label) || '首页 (Home)';
      },
      // 功能：监听 iframe 准备完成消息。
      handlePreviewMessage: function (event) {
        if (event.origin !== window.location.origin || !event.data) { return; }
        if (event.data.type === 'eva-builder-preview-ready') {
          this.previewReady = true;
          this.queuePreview(0);
          return;
        }
        if (event.data.type !== 'eva-builder-module-action') { return; }
        var uid = event.data.uid || '';
        var action = event.data.action || 'select';
        if (!uid) { return; }
        this.selectedUid = uid;
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
        if (!this.usesSlots()) { return; }
        if (this.previewTimer) {
          clearTimeout(this.previewTimer);
        }
        var wait = typeof delay === 'number' ? delay : 0;
        this.previewTimer = setTimeout(this.renderPreview, wait);
      },
      // 功能：生成预览工具条 HTML，先用于本地乐观预览，随后由 PHP 真实渲染替换。
      previewToolsHtml: function () {
        return '<div class="eva-builder-preview-tools" aria-hidden="true">'
          + '<button type="button" data-eva-builder-action="up">' + this.t('pb_move_up') + '</button>'
          + '<button type="button" data-eva-builder-action="down">' + this.t('pb_move_down') + '</button>'
          + '<button type="button" data-eva-builder-action="duplicate">' + this.t('pb_duplicate') + '</button>'
          + '<button type="button" data-eva-builder-action="remove">{{ t(\'pb_delete\') }}</button>'
          + '</div>';
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
        return '<div class="eva-builder-preview-module is-pending" data-eva-builder-module="' + uid + '" data-eva-builder-type="' + type + '">'
          + this.previewToolsHtml()
          + (instant || '<section class="eva-builder-preview-pending"><strong>' + label + '</strong><span>' + this.t('pb_rendering') + '</span></section>')
          + '</div>';
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
      postPreviewHtml: function (slots) {
        var frame = this.$refs.previewFrame;
        if (!frame || !frame.contentWindow) { return; }
        frame.contentWindow.postMessage({
          type: 'eva-builder-preview-html',
          slots: slots || {},
          activeSlot: this.currentSlotId(),
          selectedUid: this.selectedUid || ''
        }, window.location.origin);
      },
      // 功能：通知 iframe 当前是否处于拖拽投放状态。
      sendPreviewDragState: function (active) {
        var frame = this.$refs.previewFrame;
        if (!frame || !frame.contentWindow) { return; }
        frame.contentWindow.postMessage({
          type: 'eva-builder-drag-state',
          active: !!active
        }, window.location.origin);
      },
      // 功能：请求 PHP 渲染未保存内容，再 postMessage 给 iframe。
      renderPreview: function () {
        if (!this.usesSlots() || !cfg.ajaxUrl) { return; }
        var frame = this.$refs.previewFrame;
        if (!frame || !frame.contentWindow) { return; }

        var seq = ++this.previewSeq;
        this.postPreviewHtml(this.optimisticSlots());

        var fd = new FormData();
        fd.append('action', 'eva_fw_render_builder_preview');
        fd.append('nonce', cfg.nonce || '');
        fd.append('value', JSON.stringify(this.builderValue()));

        fetch(cfg.ajaxUrl, {
          method: 'POST',
          credentials: 'same-origin',
          body: fd
        }).then(function (res) {
          return res.json();
        }).then(function (json) {
          if (seq !== this.previewSeq) { return; }
          if (!json || !json.success || !json.data) { return; }
          this.postPreviewHtml(json.data.slots || {});
        }.bind(this)).catch(function () {});
      },
      // 功能：构建器模块分组。
      moduleGroups: function () {
        var groups = {};
        this.moduleList().forEach(function (item) {
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
        this.activePage = id;
        this.activeSlot = '';
        this.selectedUid = '';
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
        return Object.keys(reg).map(function (key) {
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
        return this.moduleList().filter(function (item) { return item.group === group; });
      },
      // 功能：判断组件分组是否展开。
      isGroupOpen: function (group) {
        return this.collapsedGroups[group] !== true;
      },
      // 功能：折叠或展开组件分组。
      toggleGroup: function (group) {
        this.collapsedGroups[group] = !this.collapsedGroups[group];
      },
      // 功能：分组展开前设置初始动画状态。
      beforeGroupEnter: function (el) {
        el.style.height = '0px';
        el.style.opacity = '0';
        el.style.overflow = 'hidden';
        el.style.transform = 'translateY(-6px)';
      },
      // 功能：使用 GSAP 展开组件分组。
      enterGroup: function (el, done) {
        loadGsap().then(function (gsap) {
          gsap.killTweensOf(el);
          gsap.to(el, {
            height: 'auto',
            opacity: 1,
            y: 0,
            duration: 0.32,
            ease: 'expo.out',
            clearProps: 'height,opacity,transform,overflow',
            onComplete: done
          });
        }).catch(function () {
          el.style.transition = 'height 260ms ease, opacity 220ms ease, transform 260ms ease';
          el.style.height = el.scrollHeight + 'px';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          window.setTimeout(done, 280);
        });
      },
      // 功能：使用 GSAP 收起组件分组。
      leaveGroup: function (el, done) {
        el.style.height = el.offsetHeight + 'px';
        el.style.overflow = 'hidden';
        loadGsap().then(function (gsap) {
          gsap.killTweensOf(el);
          gsap.to(el, {
            height: 0,
            opacity: 0,
            y: -6,
            duration: 0.24,
            ease: 'sine.inOut',
            clearProps: 'height,opacity,transform,overflow',
            onComplete: done
          });
        }).catch(function () {
          el.style.transition = 'height 240ms ease, opacity 200ms ease, transform 240ms ease';
          window.requestAnimationFrame(function () {
            el.style.height = '0px';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-6px)';
          });
          window.setTimeout(done, 260);
        });
      },
      // 功能：分组动画结束后清理原生兜底样式。
      afterGroupAnimation: function (el) {
        el.style.transition = '';
        el.style.height = '';
        el.style.opacity = '';
        el.style.transform = '';
        el.style.overflow = '';
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
        var fields = (reg[type] && Array.isArray(reg[type].fields)) ? reg[type].fields : [];
        var values = {};
        fields.forEach(function (f) {
          if (!f || !f.id) { return; }
          values[f.id] = f.default !== undefined ? clone(f.default) : '';
        });
        return values;
      },
      // 功能：从左侧加入一个模块实例。
      addModule: function (type) {
        var next = clone(this.items());
        var uid = genUid();
        next.push({ uid: uid, type: type, values: this.defaultsFor(type) });
        this.emitItems(next);
        this.selectedUid = uid;
      },
      // 功能：按指定位置插入模块实例。
      addModuleAt: function (type, index) {
        var next = clone(this.items());
        var uid = genUid();
        var at = Math.max(0, Math.min(index, next.length));
        next.splice(at, 0, { uid: uid, type: type, values: this.defaultsFor(type) });
        this.emitItems(next);
        this.selectedUid = uid;
      },
      // 功能：开始从左侧模块库拖拽模块。
      onModuleDragStart: function (event, type) {
        this.draggingModule = type;
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'copy';
          event.dataTransfer.setData('text/plain', type);
          event.dataTransfer.setData('application/x-eva-module', type);
        }
      },
      // 功能：拖拽结束后清理拖拽状态。
      onModuleDragEnd: function () {
        this.draggingModule = '';
      },
      // 功能：拖入画布时标记为复制操作。
      onCanvasDragOver: function (event) {
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
      },
      // 功能：读取拖拽中的模块类型。
      draggedModuleType: function (event) {
        if (event && event.dataTransfer) {
          return event.dataTransfer.getData('application/x-eva-module') || event.dataTransfer.getData('text/plain') || this.draggingModule;
        }
        return this.draggingModule;
      },
      // 功能：把左侧模块拖入画布末尾。
      onCanvasDrop: function (event) {
        var type = this.draggedModuleType(event);
        if (!type) { return; }
        this.addModule(type);
        this.draggingModule = '';
      },
      // 功能：把左侧模块拖到指定插入点。
      onInsertDrop: function (event, index) {
        var type = this.draggedModuleType(event);
        if (!type) { return; }
        this.addModuleAt(type, index);
        this.draggingModule = '';
      },
      // 功能：开始拖拽左右面板的尺寸分隔线或折叠图标。
      beginPanelResize: function (event, side, source) {
        if (!event || (event.button !== undefined && event.button !== 0)) { return; }
        this.resizingPanel = side;
        this.resizeSource = source || 'handle';
        this.resizeMoved = false;
        this.resizeStartX = event.clientX;
        this.resizeStartWidth = side === 'left' ? this.leftWidth : this.rightWidth;
        document.body.classList.add('eva-pb-resizing');
        if (event.currentTarget && event.currentTarget.setPointerCapture && event.pointerId !== undefined) {
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch (e) {}
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
        if (!this.resizingPanel || !event) { return; }
        var delta = event.clientX - this.resizeStartX;
        if (Math.abs(delta) < 5) { return; }
        this.resizeMoved = true;
        if (this.resizingPanel === 'left') {
          var leftTarget = Math.max(0, Math.min(420, this.resizeStartWidth + delta));
          // 拖到边缘时吸附为完全折叠；保留 leftWidth，之后可点击或反向拖出恢复。
          if (leftTarget <= 48) {
            this.leftCollapsed = true;
            return;
          }
          if (this.leftCollapsed) {
            // 已折叠状态下只能向右拖动左图标来展开。
            if (delta <= 5) { return; }
            this.leftCollapsed = false;
          }
          this.leftWidth = Math.max(64, leftTarget);
        } else {
          var rightTarget = Math.max(0, Math.min(440, this.resizeStartWidth - delta));
          // 拖到边缘时吸附为完全折叠；保留 rightWidth，之后可点击或反向拖出恢复。
          if (rightTarget <= 48) {
            this.rightCollapsed = true;
            return;
          }
          if (this.rightCollapsed) {
            // 已折叠状态下只能向左拖动右图标来展开。
            if (delta >= -5) { return; }
            this.rightCollapsed = false;
          }
          this.rightWidth = Math.max(64, rightTarget);
        }
      },
      // 功能：结束面板尺寸拖拽并恢复页面光标状态。
      stopPanelResize: function () {
        if (!this.resizingPanel) { return; }
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
      // 功能：选中某实例。
      select: function (uid) {
        this.selectedUid = uid;
        this.queuePreview(0);
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
        return (reg[it.type] && Array.isArray(reg[it.type].fields)) ? reg[it.type].fields : [];
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
      },
      // 功能：删除实例。
      removeItem: function (uid) {
        var next = this.items().filter(function (it) { return it.uid !== uid; });
        this.emitItems(clone(next));
        if (this.selectedUid === uid) { this.selectedUid = ''; }
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
      },
      // 功能：同步浏览器全屏状态到组件状态。
      syncFullscreenState: function () {
        this.fullScreen = document.fullscreenElement === this.$refs.pbRoot;
      },
      // 功能：切换页面构建器全屏编辑模式。
      toggleFullscreen: function () {
        var el = this.$refs.pbRoot;
        if (!el) { return; }
        if (document.fullscreenElement === el) {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          }
          this.fullScreen = false;
          return;
        }
        this.fullScreen = true;
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(function () {});
        }
      }
    },
    template: [
      '<div ref="pbRoot" class="eva-pb" :class="{ \'is-fullscreen\': fullScreen }">',
      '  <header class="eva-pb-topbar">',
      '    <div class="eva-pb-brand"><span><i class="ri-book-open-fill"></i></span><strong>{{ tv(brandName()) }}</strong><em>{{ brandVersion() }}</em></div>',
      '    <div class="eva-pb-center">',
      '      <div v-if="pages().length" class="eva-pb-page-picker">',
      '        <button type="button" class="eva-pb-page-select is-menu" @click="pageMenuOpen = !pageMenuOpen"><i :class="currentPage().icon"></i><span>{{ tv(previewLabel()) }}</span><i class="ri-arrow-down-s-line"></i></button>',
      '        <div v-if="pageMenuOpen" class="eva-pb-page-backdrop" @click="pageMenuOpen = false"></div>',
      '        <div v-if="pageMenuOpen" class="eva-pb-page-menu">',
      '          <button v-for="p in pages()" :key="p.id" type="button" :class="{ \'is-active\': currentPage().id === p.id }" @click="switchPage(p.id)"><i :class="p.icon"></i><span>{{ tv(p.label) }}</span></button>',
      '        </div>',
      '      </div>',
      '      <span v-else class="eva-pb-page-select"><i class="ri-file-list-3-line"></i><span>{{ tv(previewLabel()) }}</span></span>',
      '      <span class="eva-pb-divider"></span>',
      '      <div class="eva-pb-devices">',
      '        <button type="button" :class="{ \'is-active\': device === \'desktop\' }" @click="device = \'desktop\'"><i class="ri-computer-line"></i></button>',
      '        <button type="button" :class="{ \'is-active\': device === \'tablet\' }" @click="device = \'tablet\'"><i class="ri-tablet-line"></i></button>',
      '        <button type="button" :class="{ \'is-active\': device === \'mobile\' }" @click="device = \'mobile\'"><i class="ri-smartphone-line"></i></button>',
      '      </div>',
      '    </div>',
      '    <div class="eva-pb-actions"><button type="button" :title="fullScreen ? t(\'pb_exit_fullscreen\') : t(\'pb_fullscreen\')" :aria-label="fullScreen ? t(\'pb_exit_fullscreen\') : t(\'pb_fullscreen\')" @click="toggleFullscreen"><i :class="fullScreen ? \'ri-fullscreen-exit-line\' : \'ri-fullscreen-line\'"></i></button></div>',
      '  </header>',
      '  <div class="eva-pb-body" :class="{ \'is-left-collapsed\': leftCollapsed, \'is-right-collapsed\': rightCollapsed, \'is-resizing-left\': resizingPanel === \'left\', \'is-resizing-right\': resizingPanel === \'right\' }" :style="{ \'--eva-pb-left-width\': leftWidth + \'px\', \'--eva-pb-right-width\': rightWidth + \'px\' }">',
      '    <button type="button" class="eva-pb-side-toggle eva-pb-side-toggle--left" :title="leftCollapsed ? t(\'pb_expand_left\') : t(\'pb_collapse_left\')" @pointerdown.stop="startPanelToggleDrag($event, \'left\')" @click.stop="finishPanelToggleClick(\'left\')"><i :class="leftCollapsed ? \'ri-layout-left-2-line\' : \'ri-side-bar-line\'"></i></button>',
      '    <button type="button" class="eva-pb-side-toggle eva-pb-side-toggle--right" :title="rightCollapsed ? t(\'pb_expand_right\') : t(\'pb_collapse_right\')" @pointerdown.stop="startPanelToggleDrag($event, \'right\')" @click.stop="finishPanelToggleClick(\'right\')"><i :class="rightCollapsed ? \'ri-layout-right-2-line\' : \'ri-sidebar-fold-line\'"></i></button>',
      '    <div v-show="!leftCollapsed" class="eva-pb-resize-handle eva-pb-resize-handle--left" role="separator" :aria-label="t(\'pb_resize_left\')" @pointerdown.prevent="startPanelResize($event, \'left\')"></div>',
      '    <div v-show="!rightCollapsed" class="eva-pb-resize-handle eva-pb-resize-handle--right" role="separator" :aria-label="t(\'pb_resize_right\')" @pointerdown.prevent="startPanelResize($event, \'right\')"></div>',
      '    <aside class="eva-pb-left">',
      '      <div class="eva-pb-search"><i class="ri-search-line"></i><input type="search" :placeholder="t(\'pb_search_modules\')"><kbd>⌘K</kbd></div>',
      '      <div class="eva-pb-modules">',
      '        <section class="eva-pb-mod-group" v-for="group in moduleGroups()" :key="group.id">',
      '          <h4 @click="toggleGroup(group.id)"><span>{{ group.label }}</span><i :class="isGroupOpen(group.id) ? \'ri-arrow-down-s-line\' : \'ri-arrow-right-s-line\'"></i></h4>',
      '          <transition :css="false" @before-enter="beforeGroupEnter" @enter="enterGroup" @leave="leaveGroup" @after-enter="afterGroupAnimation" @after-leave="afterGroupAnimation">',
      '            <div v-show="isGroupOpen(group.id)" class="eva-pb-mod-grid">',
      '              <button type="button" class="eva-pb-mod" v-for="m in modulesByGroup(group.id)" :key="m.type" draggable="true" @dragstart="onModuleDragStart($event, m.type)" @dragend="onModuleDragEnd" @click="addModule(m.type)">',
      '                <i :class="m.icon"></i><span>{{ tv(m.label) }}</span>',
      '              </button>',
      '            </div>',
      '          </transition>',
      '        </section>',
      '        <p v-if="!moduleList().length" class="eva-pb-empty-sm">{{ t(\'pb_no_modules\') }}</p>',
      '      </div>',
      '    </aside>',
      '    <main class="eva-pb-stage">',
      '      <div class="eva-pb-pagebar"><div class="eva-pb-slot-tabs"><button v-for="slot in slots()" :key="slot.id" type="button" :class="{ \'is-active\': currentSlotId() === slot.id }" @click="activeSlot = slot.id; selectedUid = \'\'">{{ tv(slot.label) }}</button></div></div>',
      '      <section class="eva-pb-canvas" :class="[\'is-\' + device, { \'is-preview\': usesSlots() }]" @click.self="selectedUid = \'\'" @dragover.prevent="onCanvasDragOver" @drop.prevent="onCanvasDrop">',
      '        <div v-if="usesSlots()" class="eva-pb-iframe-shell" :class="{ \'is-dragging\': draggingModule }">',
      '          <iframe ref="previewFrame" class="eva-pb-iframe" :src="previewUrl()" @load="queuePreview(0)"></iframe>',
      '        </div>',
      '        <template v-else>',
      '          <div v-if="!items().length" class="eva-pb-dropzone"><i class="ri-drag-drop-line"></i><span>{{ t(\'pb_drop_here\') }}</span></div>',
      '          <template v-for="(item, idx) in items()" :key="item.uid">',
      '            <div v-if="idx === 0" class="eva-pb-insert eva-pb-insert--before" :class="{ \'is-dragging\': draggingModule }" @dragover.prevent="onCanvasDragOver" @drop.stop.prevent="onInsertDrop($event, 0)"><span></span></div>',
      '            <div class="eva-pb-item" :class="{ \'is-active\': item.uid === selectedUid }" @click="select(item.uid)">',
      '              <div class="eva-pb-item-tag"><span>{{ tv(moduleLabel(item.type)) }}</span></div>',
      '              <div class="eva-pb-item-tools">',
      '                <button type="button" @click.stop="moveItem(item.uid, -1)" :disabled="idx === 0" :title="t(\'pb_move_up\')"><i class="ri-arrow-up-line"></i></button>',
      '                <button type="button" @click.stop="moveItem(item.uid, 1)" :disabled="idx === items().length - 1" :title="t(\'pb_move_down\')"><i class="ri-arrow-down-line"></i></button>',
      '                <button type="button" @click.stop="duplicateItem(item.uid)" :title="t(\'pb_duplicate\')"><i class="ri-file-copy-line"></i></button>',
      '                <button type="button" @click.stop="removeItem(item.uid)" :title="t(\'pb_delete\')"><i class="ri-delete-bin-line"></i></button>',
      '              </div>',
      '              <div class="eva-pb-render" v-html="renderHtml(item)"></div>',
      '            </div>',
      '            <div class="eva-pb-insert" :class="{ \'is-dragging\': draggingModule }" @dragover.prevent="onCanvasDragOver" @drop.stop.prevent="onInsertDrop($event, idx + 1)"><span></span></div>',
      '          </template>',
      '        </template>',
      '      </section>',
      '    </main>',
      '    <aside class="eva-pb-right">',
      '      <div class="eva-pb-right-tabs"><button type="button" :class="{ \'is-active\': rightTab === \'page\' }" @click="rightTab = \'page\'">{{ t(\'pb_structure\') }}</button><button type="button" :class="{ \'is-active\': rightTab === \'component\' }" @click="rightTab = \'component\'">{{ t(\'pb_component_settings\') }}</button></div>',
      '      <template v-if="rightTab === \'page\'">',
      '        <div class="eva-pb-panel"><h4>{{ t(\'pb_slot_structure\') }}</h4><div class="eva-pb-tree"><div v-for="item in items()" :key="item.uid" class="eva-pb-tree-row" :class="{ \'is-active\': item.uid === selectedUid }" @click="select(item.uid)"><i :class="moduleIcon(item.type)"></i><span>{{ tv(moduleLabel(item.type)) }}</span></div><p v-if="!items().length" class="eva-pb-empty-sm">{{ t(\'pb_slot_empty\') }}</p></div></div>',
      '      </template>',
      '      <template v-else>',
      '        <div class="eva-pb-panel eva-pb-panel--blocks"><h4>{{ t(\'pb_page_blocks\') }}</h4><div class="eva-pb-tree"><template v-for="group in slotGroups()" :key="group.id"><div class="eva-pb-tree-slot">{{ tv(group.label) }}</div><div v-for="item in group.items" :key="group.id + \'-\' + item.uid" class="eva-pb-tree-row" :class="{ \'is-active\': item.uid === selectedUid }" @click="activeSlot = group.id; select(item.uid)"><i :class="moduleIcon(item.type)"></i><span>{{ tv(moduleLabel(item.type)) }}</span></div><p v-if="!group.items.length" class="eva-pb-empty-sm">{{ t(\'pb_no_blocks\') }}</p></template></div></div>',
      '        <div class="eva-pb-right-sep"></div>',
      '        <template v-if="selectedItem()">',
      '          <div class="eva-pb-right-head"><i :class="moduleIcon(selectedItem().type)"></i><span>{{ tv(moduleLabel(selectedItem().type)) }}</span></div>',
      '          <div class="eva-pb-fields">',
      '            <div class="eva-pb-field" v-for="f in selectedFields()" :key="f.id">',
      '              <label class="eva-pb-field-label">{{ tv(f.title || f.id) }}</label>',
      '              <eva-field :field="f" :model-value="childValue(f)" @update:model-value="updateChild(f, $event)"></eva-field>',
      '            </div>',
      '            <p v-if="!selectedFields().length" class="eva-pb-empty-sm">{{ t(\'pb_no_fields\') }}</p>',
      '          </div>',
      '        </template>',
      '        <div v-else class="eva-pb-empty-sm"><i class="ri-cursor-line"></i> {{ t(\'pb_select_hint\') }}</div>',
      '      </template>',
      '    </aside>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
})();
