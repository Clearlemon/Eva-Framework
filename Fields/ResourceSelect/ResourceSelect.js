/** Eva remote WordPress resource selector: posts, terms, users, menus and sidebars. */
(function () {
  'use strict';
  window.EvaFields = window.EvaFields || {};
  function cfg() { return (window.EvaFW && window.EvaFW.config) || {}; }
  function text(value) { return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(value) : (value || ''); }
  function resourceOf(field) {
    var type = String(field.resource || field.source || field.type || 'post_selector').toLowerCase();
    if (type === 'taxonomy' || type === 'term') { return 'terms'; }
    if (type === 'user') { return 'users'; }
    if (type === 'menu' || type === 'nav') { return 'menus'; }
    if (type === 'sidebars' || type === 'sidebar') { return 'sidebars'; }
    return type === 'users' || type === 'terms' || type === 'menus' || type === 'sidebars' ? type : 'posts';
  }
  function listValue(value) {
    return Array.isArray(value) ? value.map(String) : (value === '' || value === null || typeof value === 'undefined' ? [] : [String(value)]);
  }
  function normalizeTypes(value) {
    if (Array.isArray(value)) { return value.join(','); }
    return value || 'post,page';
  }

  var ResourceSelect = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    data: function () { return { open: false, query: '', loading: false, items: [], selected: [], error: '', timer: null, dragIndex: null }; },
    computed: {
      resource: function () { return resourceOf(this.field); },
      returnItem: function () { return this.field.return_item === true || this.field.returnItem === true || this.field.return_item === 'object' || this.field.returnItem === 'object'; },
      isMultiple: function () { return this.field.multiple === true || this.field.multiple === 'true' || this.field.type === 'relationship'; },
      values: function () {
        if (this.returnItem && this.modelValue && typeof this.modelValue === 'object') {
          var value = this.modelValue.value !== undefined ? this.modelValue.value : this.modelValue.id;
          return value === undefined || value === null || value === '' ? [] : [String(value)];
        }
        return listValue(this.modelValue);
      },
      maxItems: function () { return Math.max(0, parseInt(this.field.max_items || this.field.max || 0, 10) || 0); },
      limitReached: function () { return this.isMultiple && this.maxItems > 0 && this.values.length >= this.maxItems; },
      minChars: function () { var fallback = this.resource === 'menus' || this.resource === 'sidebars' ? 0 : 2; return Math.max(0, parseInt(this.field.min_chars || this.field.minChars || fallback, 10) || 0); },
      canSort: function () { return this.isMultiple && this.field.sortable !== false; },
      triggerLabel: function () { if (this.isMultiple) { return this.selected.length ? '' : text(this.field.placeholder || '请选择'); } return this.selected[0] ? this.selected[0].label : (this.values.length ? '#' + this.values[0] : text(this.field.placeholder || '请选择')); }
    },
    mounted: function () { document.addEventListener('mousedown', this.onDocDown, true); if (this.values.length) { this.fetchItems('', this.values.join(',')); } },
    beforeUnmount: function () { document.removeEventListener('mousedown', this.onDocDown, true); if (this.timer) { clearTimeout(this.timer); } },
    methods: {
      text: text,
      onDocDown: function (event) { if (this.open && this.$el && !this.$el.contains(event.target)) { this.close(); } },
      openMenu: function () { if (this.field.disabled) { return; } this.open = true; this.error = ''; var self = this; this.$nextTick(function () { if (self.$refs.search && self.$refs.search.focus) { self.$refs.search.focus(); } }); this.fetchItems('', this.values.join(',')); },
      close: function () { this.open = false; this.query = ''; this.items = []; this.error = ''; },
      clear: function () { if (this.field.disabled) { return; } this.selected = []; this.$emit('update:modelValue', this.returnItem ? null : (this.isMultiple ? [] : '')); },
      onInput: function () { var self = this; if (this.timer) { clearTimeout(this.timer); } this.timer = setTimeout(function () { self.fetchItems(self.query, ''); }, 220); },
      fetchItems: function (query, include) {
        var q = String(query || '').trim();
        if (!include && q.length < this.minChars) { this.items = []; this.loading = false; return; }
        var url = cfg().ajaxUrl || ((window.EvaFW && window.EvaFW.adminUrl) ? window.EvaFW.adminUrl + 'admin-ajax.php' : '/wp-admin/admin-ajax.php');
        var params = new URLSearchParams(); params.set('action', 'eva_fw_search_data'); params.set('nonce', cfg().nonce || ''); params.set('resource', this.resource); params.set('limit', this.field.limit || 20);
        if (this.field.post_type || this.field.postType) { params.set('post_type', normalizeTypes(this.field.post_type || this.field.postType)); }
        if (this.field.taxonomy) { params.set('taxonomy', normalizeTypes(this.field.taxonomy)); }
        if (this.field.role) { params.set('role', Array.isArray(this.field.role) ? this.field.role.join(',') : this.field.role); }
        if (include) { params.set('include', include); } else { params.set('q', q); }
        var self = this; this.loading = true; this.error = '';
        fetch(url + '?' + params.toString(), { credentials: 'same-origin' }).then(function (response) { return response.json(); }).then(function (result) {
          var found = result && result.success && result.data && Array.isArray(result.data.items) ? result.data.items : [];
          if (include) { self.selected = self.sortItems(found, self.values); } else { self.items = found; }
        }).catch(function () { self.error = '搜索失败'; }).then(function () { self.loading = false; });
      },
      sortItems: function (items, values) { return values.map(function (value) { return items.filter(function (item) { return String(item.value) === String(value); })[0] || null; }).filter(Boolean); },
      isSelected: function (item) { return this.values.indexOf(String(item.value)) !== -1; },
      pick: function (item) {
        if (this.isMultiple) { var values = this.values.slice(); var value = String(item.value); var index = values.indexOf(value); if (index === -1) { if (this.limitReached) { return; } values.push(value); this.selected.push(item); } else { values.splice(index, 1); this.selected = this.selected.filter(function (entry) { return String(entry.value) !== value; }); } this.$emit('update:modelValue', values); return; }
        this.selected = [item]; this.$emit('update:modelValue', this.returnItem ? item : item.value); this.close();
      },
      removeValue: function (value) { var target = String(value); this.selected = this.selected.filter(function (item) { return String(item.value) !== target; }); this.$emit('update:modelValue', this.values.filter(function (item) { return item !== target; })); },
      dragStart: function (index) { if (this.canSort) { this.dragIndex = index; } },
      dropValue: function (index) { if (!this.canSort || this.dragIndex === null || this.dragIndex === index) { this.dragIndex = null; return; } var values = this.values.slice(); var selected = this.selected.slice(); var value = values.splice(this.dragIndex, 1)[0]; var item = selected.splice(this.dragIndex, 1)[0]; values.splice(index, 0, value); selected.splice(index, 0, item); this.dragIndex = null; this.selected = selected; this.$emit('update:modelValue', values); }
    },
    template: [
      '<div class="eva-resource-select" :class="{\'is-open\':open,\'is-disabled\':field.disabled,\'is-multiple\':isMultiple}">',
      '<div class="eva-resource-trigger-wrap"><button type="button" class="eva-resource-trigger" :disabled="field.disabled" @click="openMenu">',
      '<span v-if="!isMultiple" :class="{\'is-placeholder\':!selected.length && !values.length}">{{triggerLabel}}</span>',
      '<span v-else-if="!selected.length" class="is-placeholder">{{triggerLabel}}</span>',
      '<span v-else class="eva-resource-tags"><span v-for="(item,index) in selected" :key="item.value" class="eva-resource-tag" :draggable="canSort" @click.stop @dragstart="dragStart(index)" @dragover.prevent @drop.stop="dropValue(index)"><span>{{item.label}}</span><i class="ri-close-line" @click.stop="removeValue(item.value)"></i></span></span>',
      '<i class="ri-search-line"></i></button><button v-if="values.length && !field.disabled" type="button" class="eva-resource-clear" aria-label="清空" @click="clear"><i class="ri-close-line"></i></button></div>',
      '<div v-show="open" class="eva-resource-panel"><div class="eva-resource-search"><i class="ri-search-line"></i><input ref="search" type="text" v-model="query" :placeholder="text(field.search_placeholder || field.searchPlaceholder || \'输入关键词搜索…\')" @input="onInput"></div>',
      '<div v-if="query.trim().length < minChars && !items.length" class="eva-resource-empty">至少输入 {{minChars}} 个字符</div><div v-else-if="loading" class="eva-resource-empty">搜索中…</div><div v-else-if="error" class="eva-resource-empty">{{error}}</div>',
      '<ul v-else-if="items.length" class="eva-resource-list"><li v-for="item in items" :key="item.value" :class="{\'is-selected\':isSelected(item)}" @click="pick(item)"><strong>{{item.label}}</strong><span>{{item.meta || item.type || resource}}</span></li></ul><div v-else class="eva-resource-empty">没有匹配结果</div></div></div>'
    ].join('')
  };

  window.EvaFields.resource_select = ResourceSelect;
  window.EvaFields.post_selector = ResourceSelect;
  window.EvaFields.post = ResourceSelect;
  window.EvaFields.term_selector = ResourceSelect;
  window.EvaFields.term = ResourceSelect;
  window.EvaFields.taxonomy = ResourceSelect;
  window.EvaFields.user_selector = ResourceSelect;
  window.EvaFields.user = ResourceSelect;
  window.EvaFields.nav_menu = ResourceSelect;
  window.EvaFields.menu = ResourceSelect;
  window.EvaFields.sidebar = ResourceSelect;
  window.EvaFields.sidebars = ResourceSelect;
})();
