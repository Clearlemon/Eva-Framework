/* Eva UI 库 · eva-select：自写无障碍下拉（替代原生 <select>，零依赖、免构建）
 * 复刻 Headless UI Listbox 的可达性：role=listbox/option、aria-selected/expanded、
 * 键盘上下/回车/空格/Esc、点击外部关闭；并支持「下拉内搜索 / 选项分组 / 空状态文案」。
 * 样式见同目录 eva-select.css。由 eva-app.js 全局注册为 <eva-select>，供 fields/select.js 调用。 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // 把一段 options 归一化为 [{value,label}]：支持数组、{值:文案} 对象、[{value,label}] 三种写法。
  function normalizeList(obj) {
    var its = [];
    if (Array.isArray(obj)) {
      obj.forEach(function (x) {
        if (x && typeof x === 'object') { its.push({ value: x.value, label: x.label }); }
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
    props: ['modelValue', 'options', 'placeholder', 'searchable', 'emptyMessage'],
    emits: ['update:modelValue'],
    data: function () {
      return { open: false, active: -1, query: '' };
    },
    computed: {
      // 归一化为分组：[{ label: 组名|null, items: [{value,label}] }]。
      // 当某项的值本身是对象/数组时视为一个分组（兼容 CSF 的 optgroup 写法）。
      groups: function () {
        var o = this.options || {};
        var out = [];
        if (Array.isArray(o)) {
          out.push({ label: null, items: normalizeList(o) });
          return out;
        }
        if (o && typeof o === 'object') {
          var flat = {};
          var hasFlat = false;
          for (var k in o) {
            if (!Object.prototype.hasOwnProperty.call(o, k)) { continue; }
            var v = o[k];
            if (v && typeof v === 'object') {
              out.push({ label: k, items: normalizeList(v) });
            } else {
              flat[k] = v; hasFlat = true;
            }
          }
          if (hasFlat) { out.push({ label: null, items: normalizeList(flat) }); }
        }
        return out;
      },
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
            its.push({ value: it.value, label: it.label, i: idx });
            idx++;
          });
          if (its.length) { out.push({ label: g.label, items: its }); }
        });
        return out;
      },
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
      ph: function () { return this.placeholder || '请选择'; },
      emptyMsg: function () { return this.emptyMessage || '无匹配项'; },
      currentLabel: function () {
        var self = this;
        var hit = this.allItems.filter(function (it) { return String(it.value) === String(self.modelValue); })[0];
        return hit ? hit.label : this.ph;
      },
      isPlaceholder: function () {
        var self = this;
        return !this.allItems.some(function (it) { return String(it.value) === String(self.modelValue); });
      }
    },
    watch: {
      query: function () {
        this.active = this.flatItems.length ? 0 : -1;
      },
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
      toggle: function () { this.open ? this.close() : this.openMenu(); },
      openMenu: function () {
        this.open = true;
        this.query = '';
        var self = this;
        this.active = this.allItems.findIndex(function (it) { return String(it.value) === String(self.modelValue); });
        if (this.active < 0) { this.active = this.allItems.length ? 0 : -1; }
        document.addEventListener('mousedown', this.onDocDown, true);
        this.$nextTick(function () {
          if (self.showSearch && self.$refs.search && self.$refs.search.focus) { self.$refs.search.focus(); }
        });
      },
      close: function () {
        this.open = false;
        this.query = '';
        document.removeEventListener('mousedown', this.onDocDown, true);
      },
      focusTrigger: function () {
        var self = this;
        this.$nextTick(function () {
          if (self.$refs.trigger && self.$refs.trigger.focus) { self.$refs.trigger.focus(); }
        });
      },
      onDocDown: function (e) {
        if (this.$el && !this.$el.contains(e.target)) { this.close(); }
      },
      pick: function (it) {
        this.$emit('update:modelValue', it.value);
        this.close();
        this.focusTrigger();
      },
      onKey: function (e) {
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
    beforeUnmount: function () {
      document.removeEventListener('mousedown', this.onDocDown, true);
    },
    template: [
      '<div class="eva-select" :class="{ \'is-open\': open }">',
      '  <button type="button" ref="trigger" class="eva-select-trigger" aria-haspopup="listbox"',
      '          :aria-expanded="open ? \'true\' : \'false\'" @click="toggle" @keydown="onKey">',
      '    <span class="eva-select-value" :class="{ \'is-placeholder\': isPlaceholder }">{{ currentLabel }}</span>',
      '    <i class="eva-select-arrow ri-arrow-down-s-line"></i>',
      '  </button>',
      '  <div v-show="open" class="eva-select-panel">',
      '    <div v-if="showSearch" class="eva-select-search">',
      '      <i class="ri-search-line"></i>',
      '      <input ref="search" type="text" class="eva-select-search-input" v-model="query"',
      '             placeholder="搜索…" @keydown="onKey">',
      '    </div>',
      '    <ul class="eva-select-menu" role="listbox" tabindex="-1">',
      '      <template v-for="(g, gi) in filteredGroups" :key="\'g\' + gi">',
      '        <li v-if="g.label" class="eva-select-group" role="presentation">{{ g.label }}</li>',
      '        <li v-for="it in g.items" :key="it.value" class="eva-select-option" role="option"',
      '            :class="{ \'is-selected\': String(it.value) === String(modelValue), \'is-active\': it.i === active }"',
      '            :aria-selected="String(it.value) === String(modelValue) ? \'true\' : \'false\'"',
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
