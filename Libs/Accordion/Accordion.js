/**
 * Eva UI 库 · eva-accordion（手风琴 / 折叠面板）。
 *
 * 只负责折叠状态与面板外壳，具体内容通过 scoped slot 交给字段层渲染。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  var gsapPromise = null;
  // 功能：加载 Load Gsap 需要的数据或资源。
  function Load_Gsap() {
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

  window.EvaUI.Accordion = {
    props: {
      panels: { type: Array, default: function () { return []; } },
      multiple: { type: Boolean, default: true },
      defaultOpen: { type: [Array, String, Number, Boolean], default: function () { return []; } },
      closedIcon: { type: String, default: 'ri-arrow-down-s-line' },
      openIcon: { type: String, default: 'ri-arrow-up-s-line' },
      disabled: { type: Boolean, default: false },
      sortable: { type: Boolean, default: true },
      toolbar: { type: Boolean, default: false },
      modeSwitch: { type: Boolean, default: true },
      bulkActions: { type: Boolean, default: true },
      storageKey: { type: String, default: '' }
    },
    emits: ['change', 'reorder', 'body-open'],
    // 功能：初始化组件响应式状态与对外数据。
    data: function () {
      return {
        openKeys: this.initialOpenKeys(),
        multipleMode: this.multiple,
        gsapReady: !!window.gsap,
        dragKey: '',
        overKey: ''
      };
    },
    // 功能：组件挂载后执行初始化和事件绑定。
    mounted: function () {
      var self = this;
      // 展开偏好只保存在当前浏览器，不写入业务配置。
      if (this.storageKey) {
        try {
          var saved = JSON.parse(window.localStorage.getItem(this.storageKey));
          if (saved && Array.isArray(saved.openKeys)) {
            this.multipleMode = typeof saved.multiple === 'boolean' ? saved.multiple : this.multiple;
            this.openKeys = saved.openKeys.map(String);
            if (!this.multipleMode) { this.openKeys = this.openKeys.slice(0, 1); }
          }
        } catch (e) { /* 浏览器禁止存储时沿用默认状态。 */ }
      }
      Load_Gsap().then(function () {
        self.gsapReady = true;
      }).catch(function () {
        self.gsapReady = false;
      });
    },
    watch: {
      // 功能：处理 panels 相关逻辑。
      multiple: function (value) { this.setMode(value); }
    },
    methods: {
      // 功能：处理 initial Open Keys 相关逻辑。
      initialOpenKeys: function () {
        if (this.defaultOpen === false) { return []; }
        var keys = Array.isArray(this.defaultOpen) ? this.defaultOpen : (this.defaultOpen !== '' ? [this.defaultOpen] : []);
        if (!keys.length && this.panels.length) {
          keys = [this.panelKey(this.panels[0], 0)];
        }
        return this.multiple ? keys.map(String) : keys.slice(0, 1).map(String);
      },
      persist: function () {
        if (this.storageKey) {
          try { window.localStorage.setItem(this.storageKey, JSON.stringify({ openKeys: this.openKeys, multiple: this.multipleMode })); } catch (e) {}
        }
        this.$emit('change', this.openKeys.slice());
      },
      setMode: function (multiple) {
        this.multipleMode = !!multiple;
        if (!this.multipleMode) { this.openKeys = this.openKeys.slice(0, 1); }
        this.persist();
      },
      // 搜索和校验可临时展开多个目标；不覆盖用户保存的展开偏好。
      reveal: function (keys, all) {
        keys = keys.map(String);
        if (all && keys.length > 1) { this.multipleMode = true; }
        this.openKeys = this.multipleMode ? Array.from(new Set(this.openKeys.concat(keys))) : keys.slice(0, 1);
      },
      expandAll: function () {
        if (this.disabled) { return; }
        this.multipleMode = true;
        this.openKeys = this.panels.filter(function (panel) { return !panel.disabled; }).map(this.panelKey);
        this.persist();
      },
      collapseAll: function () {
        if (this.disabled) { return; }
        this.openKeys = [];
        this.persist();
      },
      panelDomId: function (panel, index) {
        return 'eva-acc-' + this.$.uid + '-' + encodeURIComponent(this.panelKey(panel, index));
      },
      // 功能：处理 panel Key 相关逻辑。
      panelKey: function (panel, index) {
        return String(panel && (panel.id || panel.key) ? (panel.id || panel.key) : index);
      },
      // 功能：判断 is Open 状态。
      isOpen: function (panel, index) {
        return this.openKeys.indexOf(this.panelKey(panel, index)) !== -1;
      },
      // 功能：处理 panel Toggle Icon 相关逻辑。
      panelToggleIcon: function (panel, index) {
        if (this.isOpen(panel, index)) {
          return panel.open_icon || panel.openIcon || this.openIcon;
        }
        return panel.closed_icon || panel.closedIcon || panel.icon_closed || panel.iconClosed || this.closedIcon;
      },
      // 功能：从右侧拖拽手柄开始面板排序。
      dragStart: function (panel, index, event) {
        if (!this.sortable || this.disabled || (panel && panel.disabled)) { return; }
        this.dragKey = this.panelKey(panel, index);
        this.overKey = this.dragKey;
        if (event && event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', this.dragKey);
        }
      },
      dragOver: function (panel, index, event) {
        if (!this.dragKey) { return; }
        if (event && event.dataTransfer) { event.dataTransfer.dropEffect = 'move'; }
        this.overKey = this.panelKey(panel, index);
      },
      dropPanel: function (panel, index) {
        if (!this.dragKey) { return; }
        var targetKey = this.panelKey(panel, index);
        var self = this;
        var order = this.panels.map(function (item, itemIndex) { return self.panelKey(item, itemIndex); });
        var from = order.indexOf(this.dragKey);
        var to = order.indexOf(targetKey);
        if (from >= 0 && to >= 0 && from !== to) {
          var moved = order.splice(from, 1)[0];
          order.splice(to, 0, moved);
          this.$emit('reorder', order);
        }
        this.dragEnd();
      },
      dragEnd: function () {
        this.dragKey = '';
        this.overKey = '';
      },
      // 功能：切换 toggle 状态。
      toggle: function (panel, index) {
        if (this.disabled || (panel && panel.disabled)) { return; }
        var key = this.panelKey(panel, index);
        var next;
        if (this.multipleMode) {
          next = this.openKeys.slice();
          var i = next.indexOf(key);
          if (i >= 0) { next.splice(i, 1); } else { next.push(key); }
        } else {
          next = this.isOpen(panel, index) ? [] : [key];
        }
        this.openKeys = next;
        this.persist();
      },
      // 功能：重置 reset Tween 相关状态。
      resetTween: function (el) {
        if (window.gsap) { window.gsap.killTweensOf(el); }
        el.style.overflow = 'hidden';
      },
      // 功能：处理 before Enter Body 相关逻辑。
      beforeEnterBody: function (el) {
        this.resetTween(el);
        var inner = el.querySelector('.eva-acc-inner');
        el.style.height = '0px';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-8px)';
        if (inner) {
          inner.style.opacity = '0';
          inner.style.transform = 'translateY(-6px)';
        }
      },
      // 功能：处理 enter Body 相关逻辑。
      enterBody: function (el, done) {
        var inner = el.querySelector('.eva-acc-inner');
        if (window.gsap) {
          var tl = window.gsap.timeline({
            defaults: { ease: 'expo.out' },
            // 功能：在动画完成后执行收尾逻辑。
            onComplete: function () {
              done();
            }
          });
          tl.fromTo(el, {
            height: 0,
            autoAlpha: 0,
            y: -8,
            force3D: true
          }, {
            height: 'auto',
            autoAlpha: 1,
            y: 0,
            duration: 0.38,
            clearProps: 'height,opacity,visibility,transform,overflow'
          }, 0);
          if (inner) {
            tl.fromTo(inner, {
              autoAlpha: 0,
              y: -6,
              force3D: true
            }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.28,
              clearProps: 'opacity,visibility,transform'
            }, 0.05);
          }
          return;
        }
        this.nativeTween(el, { height: el.scrollHeight + 'px', opacity: '1', transform: 'translateY(0)' }, done, 360);
      },
      // 功能：处理 leave Body 相关逻辑。
      leaveBody: function (el, done) {
        this.resetTween(el);
        var inner = el.querySelector('.eva-acc-inner');
        el.style.height = el.offsetHeight + 'px';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        if (window.gsap) {
          var tl = window.gsap.timeline({
            defaults: { ease: 'sine.inOut' },
            // 功能：在动画完成后执行收尾逻辑。
            onComplete: function () {
              done();
            }
          });
          if (inner) {
            tl.to(inner, {
              autoAlpha: 0,
              y: -4,
              duration: 0.16,
              force3D: true
            }, 0);
          }
          tl.fromTo(el, {
            height: el.offsetHeight,
            opacity: 1,
            force3D: true
          }, {
            height: 0,
            opacity: 0.98,
            duration: 0.34,
            clearProps: 'height,opacity,visibility,transform,overflow'
          }, 0.04);
          return;
        }
        this.nativeTween(el, { height: '0px', opacity: '0.98', transform: 'translateY(0)' }, done, 340);
      },
      // 功能：处理 after Body 相关逻辑。
      afterBody: function (el) {
        var inner = el.querySelector('.eva-acc-inner');
        el.style.height = '';
        el.style.opacity = '';
        el.style.transform = '';
        el.style.overflow = '';
        if (inner) {
          inner.style.opacity = '';
          inner.style.transform = '';
          inner.style.visibility = '';
        }
        if (el.style.display !== 'none') { this.$emit('body-open'); }
      },
      // 功能：处理 native Tween 相关逻辑。
      nativeTween: function (el, styles, done, duration) {
        duration = duration || 320;
        window.requestAnimationFrame(function () {
          el.style.transition = 'height ' + duration + 'ms cubic-bezier(0.22, 1, 0.36, 1), opacity ' + Math.max(180, duration - 90) + 'ms ease, transform ' + duration + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
          Object.keys(styles).forEach(function (key) { el.style[key] = styles[key]; });
          window.setTimeout(function () {
            el.style.transition = '';
            done();
          }, duration + 20);
        });
      }
    },
    template: [
      '<div class="eva-accordion">',
      '  <div v-if="toolbar" class="eva-acc-toolbar"><slot name="toolbar"></slot><div v-if="modeSwitch || bulkActions" class="eva-acc-tools"><template v-if="modeSwitch"><button type="button" :disabled="disabled" :aria-pressed="!multipleMode" @click="setMode(false)">单开</button><button type="button" :disabled="disabled" :aria-pressed="multipleMode" @click="setMode(true)">多开</button></template><template v-if="bulkActions"><button type="button" :disabled="disabled" @click="expandAll">展开全部</button><button type="button" :disabled="disabled" @click="collapseAll">折叠全部</button></template></div></div>',
      '  <div v-for="(panel, index) in panels" :key="panelKey(panel, index)" class="eva-acc-panel" :class="{ \'is-open\': isOpen(panel, index), \'is-disabled\': disabled || panel.disabled, \'is-dragging\': dragKey === panelKey(panel, index), \'is-over\': overKey === panelKey(panel, index) && dragKey !== panelKey(panel, index) }" @dragover.prevent="dragOver(panel, index, $event)" @drop.prevent="dropPanel(panel, index)">',
      '    <div class="eva-acc-header">',
      '    <button type="button" class="eva-acc-head" :id="panelDomId(panel, index) + \'-head\'" :aria-expanded="isOpen(panel, index)" :aria-controls="panelDomId(panel, index)" :disabled="disabled || panel.disabled" @click="toggle(panel, index)">',
      '      <span v-if="panel.icon" class="eva-acc-icon"><i :class="panel.icon"></i></span>',
      '      <slot name="title" :panel="panel" :index="index"><span class="eva-acc-title">{{ panel.title || panel.label || panel.id || panel.key || (index + 1) }}</span></slot>',
      '      <span v-if="panel.badge" class="eva-acc-badge">{{ panel.badge }}</span>',
      '      <span v-if="panel.disabled" class="eva-acc-lock"><i class="ri-lock-line"></i></span>',
      '      <span class="eva-acc-toggle"><i :class="panelToggleIcon(panel, index)"></i></span>',
      '      <span v-if="sortable" class="eva-acc-more eva-acc-drag" :draggable="!disabled && !panel.disabled" title="拖拽排序" @click.stop.prevent @dragstart.stop="dragStart(panel, index, $event)" @dragend.stop="dragEnd"><i class="ri-drag-move-2-line"></i></span>',
      '    </button>',
      '    <slot name="actions" :panel="panel" :index="index"></slot>',
      '    </div>',
      '    <slot name="notice" :panel="panel" :index="index"></slot>',
      '    <transition :css="false" @before-enter="beforeEnterBody" @enter="enterBody" @leave="leaveBody" @after-enter="afterBody" @after-leave="afterBody">',
      '      <div v-show="isOpen(panel, index)" class="eva-acc-body" :id="panelDomId(panel, index)" role="region" :aria-labelledby="panelDomId(panel, index) + \'-head\'">',
      '        <div class="eva-acc-inner"><slot :panel="panel" :index="index" :open="isOpen(panel, index)"></slot></div>',
      '      </div>',
      '    </transition>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
})();
