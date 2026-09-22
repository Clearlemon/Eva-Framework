/**
 * Eva UI 库 · eva-select。
 *
 * 目标：
 * - 替代原生 `<select>`，提供统一的 Eva 后台视觉样式。
 * - 保持零依赖、免构建，直接挂到 `window.EvaUI.Select` 供 Vue 全局注册。
 * - 支持键盘操作、ARIA 语义、点击外部关闭、下拉方向自适应、多选与排序。
 *
 * 可访问性：
 * - trigger 使用 `aria-haspopup="listbox"` 和 `aria-expanded`。
 * - 列表项使用 `role="option"` 与 `aria-selected`。
 * - 支持 ArrowUp / ArrowDown / Enter / Space / Escape。
 *
 * 选项格式：
 * - 数组：`['a', 'b']` 或 `[{ value: 'a', label: 'A', disabled: true }]`。
 * - 对象：`{ a: 'A', b: 'B' }`。
 * - 分组对象：`{ 分组名: { a: 'A', b: 'B' } }`，兼容 CSF optgroup 写法。
 *
 * 样式：
 * - 样式见同目录 `eva-select.css`，本文件只负责组件逻辑与模板。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // 把一段 options 归一化为 [{value,label}]，内部统一用同一种结构渲染。
  function Normalize_List(obj) {
    var its = [];
    if (Array.isArray(obj)) {
      obj.forEach(function (x) {
        if (x && typeof x === 'object') { its.push({ value: x.value, label: x.label, disabled: !!x.disabled }); }
        else { its.push({ value: x, label: x }); }
      });
    } else if (obj && typeof obj === 'object') {
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) { its.push({ value: k, label: obj[k] }); }
      }
    }
    return its;
  }

  window.EvaUI.Select = {
    props: ['modelValue', 'options', 'placeholder', 'searchable', 'emptyMessage', 'multiple', 'sortable', 'disabled'],
    emits: ['update:modelValue'],
    // 功能：初始化组件响应式状态与对外数据。
    data: function () {
      // active 是过滤后 flatItems 的全局序号；dropUp 由触发器上下可用空间动态决定。
      return { open: false, active: -1, query: '', dropUp: false, dragIndex: null };
    },
    computed: {
      // 归一化为分组：[{ label: 组名|null, items: [{value,label}] }]。
      // 当某项的值本身是对象/数组时视为一个分组（兼容 CSF 的 optgroup 写法）。
      groups: function () {
        var o = this.options || {};
        var out = [];
        if (Array.isArray(o)) {
          out.push({ label: null, items: Normalize_List(o) });
          return out;
        }
        if (o && typeof o === 'object') {
          var flat = {};
          var hasFlat = false;
          for (var k in o) {
            if (!Object.prototype.hasOwnProperty.call(o, k)) { continue; }
            var v = o[k];
            if (v && typeof v === 'object') {
              out.push({ label: k, items: Normalize_List(v) });
            } else {
              flat[k] = v; hasFlat = true;
            }
          }
          if (hasFlat) { out.push({ label: null, items: Normalize_List(flat) }); }
        }
        return out;
      },
      // 功能：处理 all Items 相关逻辑。
      allItems: function () {
        var out = [];
        this.groups.forEach(function (g) { g.items.forEach(function (it) { out.push(it); }); });
        return out;
      },
      // 按搜索词过滤后的分组，并给每个可见项标注全局序号 i（供键盘高亮定位用）。
      filteredGroups: function () {
        var q = (this.query || '').trim().toLowerCase();
        var idx = 0;
        var out = [];
        this.groups.forEach(function (g) {
          var its = [];
          g.items.forEach(function (it) {
            if (q && String(it.label).toLowerCase().indexOf(q) === -1) { return; }
            its.push({ value: it.value, label: it.label, disabled: !!it.disabled, i: idx });
            idx++;
          });
          if (its.length) { out.push({ label: g.label, items: its }); }
        });
        return out;
      },
      // 功能：处理 flat Items 相关逻辑。
      flatItems: function () {
        var out = [];
        this.filteredGroups.forEach(function (g) { g.items.forEach(function (it) { out.push(it); }); });
        return out;
      },
      // 是否显示搜索框：显式 true/false 优先，未指定则长列表（≥8 项）自动开启。
      showSearch: function () {
        if (this.searchable === true || this.searchable === 'true') { return true; }
        if (this.searchable === false || this.searchable === 'false') { return false; }
        return this.allItems.length >= 8;
      },
      // 功能：处理 ph 相关逻辑。
      ph: function () { return this.placeholder || '请选择'; },
      // 功能：处理 empty Msg 相关逻辑。
      emptyMsg: function () { return this.emptyMessage || '无匹配项'; },
      // 功能：判断 is Multiple 状态。
      isMultiple: function () {
        return this.multiple === true || this.multiple === 'true';
      },
      // 功能：判断 can Sort 状态。
      canSort: function () {
        return this.isMultiple && (this.sortable === true || this.sortable === 'true');
      },
      // 功能：处理 selected Values 相关逻辑。
      selectedValues: function () {
        if (this.isMultiple) {
          return Array.isArray(this.modelValue) ? this.modelValue.map(String) : [];
        }
        return this.modelValue == null || this.modelValue === '' ? [] : [String(this.modelValue)];
      },
      // 功能：处理 selected Items 相关逻辑。
      selectedItems: function () {
        var self = this;
        return this.selectedValues.map(function (value) {
          return self.allItems.filter(function (it) { return String(it.value) === value; })[0] || { value: value, label: value };
        });
      },
      // 功能：处理 current Label 相关逻辑。
      currentLabel: function () {
        var self = this;
        var hit = this.allItems.filter(function (it) { return String(it.value) === String(self.modelValue); })[0];
        return hit ? hit.label : this.ph;
      },
      // 当前值无法在选项表中命中时，展示 placeholder 样式。
      isPlaceholder: function () {
        var self = this;
        if (this.isMultiple) {
          return !this.selectedValues.length;
        }
        return !this.allItems.some(function (it) { return String(it.value) === String(self.modelValue); });
      }
    },
    watch: {
      // 搜索词变化后重置键盘高亮到第一项，避免 active 指向已被过滤掉的旧项。
      query: function () {
        this.active = this.flatItems.length ? 0 : -1;
      },
      // 键盘上下移动时，自动滚动到可见范围内。
      active: function () {
        var self = this;
        this.$nextTick(function () {
          if (!self.$el) { return; }
          var el = self.$el.querySelector('.eva-select-option.is-active');
          if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'nearest' }); }
        });
      }
    },
    methods: {
      // 功能：切换 toggle 状态。
      toggle: function () { if (this.disabled) { return; } this.open ? this.close() : this.openMenu(); },
      // 打开面板时同步当前选中项为 active，并绑定捕获阶段的外部点击监听。
      openMenu: function () {
        if (this.disabled) { return; }
        this.open = true;
        this.query = '';
        var self = this;
        this.active = this.allItems.findIndex(function (it) { return self.selectedValues.indexOf(String(it.value)) !== -1; });
        if (this.active < 0) { this.active = this.allItems.length ? 0 : -1; }
        document.addEventListener('mousedown', this.onDocDown, true);
        this.$nextTick(function () {
          self.placePanel();
          if (self.showSearch && self.$refs.search && self.$refs.search.focus) { self.$refs.search.focus(); }
        });
      },
      // 关闭时清理搜索词和 document 监听，避免组件销毁后仍残留事件。
      close: function () {
        this.open = false;
        this.query = '';
        document.removeEventListener('mousedown', this.onDocDown, true);
      },
      // 按 trigger 在视口中的剩余空间，自动决定面板朝上/朝下展开。
      placePanel: function () {
        var trig = this.$refs.trigger;
        var panel = this.$refs.panel;
        if (!trig || !panel) { return; }
        var r = trig.getBoundingClientRect();
        var ph = panel.offsetHeight || 0;
        var below = window.innerHeight - r.bottom;
        var above = r.top;
        this.dropUp = (below < ph + 8) && (above > below);
      },
      // 功能：处理 focus Trigger 相关逻辑。
      focusTrigger: function () {
        var self = this;
        this.$nextTick(function () {
          if (self.$refs.trigger && self.$refs.trigger.focus) { self.$refs.trigger.focus(); }
        });
      },
      // 捕获 document mousedown，用于比普通 click 更早关闭外部点击。
      onDocDown: function (e) {
        if (this.$el && !this.$el.contains(e.target)) { this.close(); }
      },
      // 选中项后向外触发 v-model 更新，并把焦点还给 trigger。
      pick: function (it) {
        if (it.disabled) { return; }
        if (this.isMultiple) {
          var values = this.selectedValues.slice();
          var value = String(it.value);
          var index = values.indexOf(value);
          if (index === -1) { values.push(value); } else { values.splice(index, 1); }
          this.$emit('update:modelValue', values);
          return;
        }
        this.$emit('update:modelValue', it.value);
        this.close();
        this.focusTrigger();
      },
      // 功能：判断 is Selected 状态。
      isSelected: function (it) {
        return this.selectedValues.indexOf(String(it.value)) !== -1;
      },
      // 功能：移除 remove Value 对应条目。
      removeValue: function (value) {
        if (!this.isMultiple) { return; }
        var values = this.selectedValues.filter(function (item) { return item !== String(value); });
        this.$emit('update:modelValue', values);
      },
      // 功能：处理 drag Start 相关逻辑。
      dragStart: function (index) {
        if (!this.canSort) { return; }
        this.dragIndex = index;
      },
      // 功能：处理 drop Value 相关逻辑。
      dropValue: function (index) {
        if (!this.canSort || this.dragIndex === null || this.dragIndex === index) {
          this.dragIndex = null;
          return;
        }
        var values = this.selectedValues.slice();
        var item = values.splice(this.dragIndex, 1)[0];
        values.splice(index, 0, item);
        this.dragIndex = null;
        this.$emit('update:modelValue', values);
      },
      // 键盘交互入口。搜索框内允许输入空格，其余位置空格用于打开面板。
      onKey: function (e) {
        if (this.disabled) { e.preventDefault(); return; }
        var inSearch = this.$refs.search && e.target === this.$refs.search;
        if (e.key === 'Escape') { this.close(); this.focusTrigger(); return; }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!this.open) { this.openMenu(); return; }
          this.active = Math.min(this.flatItems.length - 1, this.active + 1);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (this.open) { this.active = Math.max(0, this.active - 1); }
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!this.open) { this.openMenu(); return; }
          if (this.active >= 0 && this.flatItems[this.active]) { this.pick(this.flatItems[this.active]); }
          return;
        }
        // 空格：仅在非搜索框时用于打开（否则要能正常输入空格）。
        if (e.key === ' ' && !inSearch) {
          e.preventDefault();
          if (!this.open) { this.openMenu(); }
        }
      }
    },
    // 功能：组件销毁前清理事件、计时器或临时状态。
    beforeUnmount: function () {
      document.removeEventListener('mousedown', this.onDocDown, true);
    },
    template: [
      '<div class="eva-select" :class="{ \'is-open\': open, \'is-multiple\': isMultiple, \'is-disabled\': disabled }">',
      '  <button type="button" ref="trigger" class="eva-select-trigger" aria-haspopup="listbox"',
      '          :aria-expanded="open ? \'true\' : \'false\'" :disabled="disabled" @click="toggle" @keydown="onKey">',
      '    <span v-if="!isMultiple" class="eva-select-value" :class="{ \'is-placeholder\': isPlaceholder }">{{ currentLabel }}</span>',
      '    <span v-else-if="!selectedItems.length" class="eva-select-value is-placeholder">{{ ph }}</span>',
      '    <span v-else class="eva-select-tags">',
      '      <span v-for="(item, index) in selectedItems" :key="item.value" class="eva-select-tag" :class="{ \'is-dragging\': dragIndex === index }" :draggable="canSort" @click.stop @dragstart="dragStart(index)" @dragover.prevent @drop.stop="dropValue(index)">',
      '        <span>{{ item.label }}</span><i class="ri-close-line" @click.stop="removeValue(item.value)"></i>',
      '      </span>',
      '    </span>',
      '    <i class="eva-select-arrow ri-arrow-down-s-line"></i>',
      '  </button>',
      '  <div v-show="open" ref="panel" class="eva-select-panel" :class="{ \'is-up\': dropUp }">',
      '    <div v-if="showSearch" class="eva-select-search">',
      '      <i class="ri-search-line"></i>',
      '      <input ref="search" type="text" class="eva-select-search-input" v-model="query"',
      '             placeholder="搜索…" @keydown="onKey">',
      '    </div>',
      '    <ul class="eva-select-menu" role="listbox" tabindex="-1">',
      '      <template v-for="(g, gi) in filteredGroups" :key="\'g\' + gi">',
      '        <li v-if="g.label" class="eva-select-group" role="presentation">{{ g.label }}</li>',
      '        <li v-for="it in g.items" :key="it.value" class="eva-select-option" role="option"',
      '            :class="{ \'is-selected\': isSelected(it), \'is-active\': it.i === active, \'is-disabled\': it.disabled }"',
      '            :aria-selected="isSelected(it) ? \'true\' : \'false\'"',
      '            :aria-disabled="it.disabled ? \'true\' : \'false\'"',
      '            @mouseenter="active = it.i" @click="pick(it)">',
      '          <i class="eva-select-check ri-check-line"></i><span>{{ it.label }}</span>',
      '        </li>',
      '      </template>',
      '      <li v-if="!flatItems.length" class="eva-select-empty" role="presentation">{{ emptyMsg }}</li>',
      '    </ul>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
})();
