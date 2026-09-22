/** Eva field: Relationship selector with searchable available and selected columns. */
(function () {
  'use strict';
  window.EvaFields = window.EvaFields || {};
  function cfg() { return (window.EvaFW && window.EvaFW.config) || {}; }
  function values(value) { return Array.isArray(value) ? value.map(String) : []; }
  window.EvaFields.relationship = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    data: function () { return { query: '', items: [], selected: [], loading: false, error: '', timer: null }; },
    computed: {
      ids: function () { return values(this.modelValue); },
      resource: function () { return this.field.source || this.field.data_source || this.field.resource || 'posts'; },
      maxItems: function () { return Math.max(0, parseInt(this.field.max_items || this.field.max || 0, 10) || 0); },
      limitReached: function () { return this.maxItems > 0 && this.ids.length >= this.maxItems; }
    },
    mounted: function () { if (this.ids.length) { this.search('', this.ids.join(',')); } },
    beforeUnmount: function () { if (this.timer) { clearTimeout(this.timer); } },
    methods: {
      search: function (query, include) {
        var q = String(query || '').trim(); var min = parseInt(this.field.min_chars || 2, 10) || 0;
        if (!include && q.length < min) { this.items = []; return; }
        var url = cfg().ajaxUrl || '/wp-admin/admin-ajax.php'; var params = new URLSearchParams(); params.set('action', 'eva_fw_search_data'); params.set('nonce', cfg().nonce || ''); params.set('resource', this.resource); params.set('limit', this.field.limit || 20); params.set('q', include ? '' : q); if (include) { params.set('include', include); }
        if (this.field.post_type) { params.set('post_type', Array.isArray(this.field.post_type) ? this.field.post_type.join(',') : this.field.post_type); }
        if (this.field.taxonomy) { params.set('taxonomy', Array.isArray(this.field.taxonomy) ? this.field.taxonomy.join(',') : this.field.taxonomy); }
        if (this.field.role) { params.set('role', Array.isArray(this.field.role) ? this.field.role.join(',') : this.field.role); }
        var self = this; this.loading = true; this.error = ''; fetch(url + '?' + params.toString(), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (result) { var found = result && result.success && result.data && Array.isArray(result.data.items) ? result.data.items : []; if (include) { self.selected = self.order(found, self.ids); } else { self.items = found; } }).catch(function () { self.error = '搜索失败'; }).then(function () { self.loading = false; });
      },
      order: function (items, ids) { return ids.map(function (id) { return items.filter(function (item) { return String(item.value) === id; })[0]; }).filter(Boolean); },
      onInput: function () { var self = this; clearTimeout(this.timer); this.timer = setTimeout(function () { self.search(self.query, ''); }, 220); },
      add: function (item) { if (this.field.disabled || this.limitReached || this.ids.indexOf(String(item.value)) !== -1) { return; } var next = this.ids.concat(String(item.value)); this.selected = this.selected.concat(item); this.$emit('update:modelValue', next); },
      remove: function (item) { var id = String(item.value); this.selected = this.selected.filter(function (entry) { return String(entry.value) !== id; }); this.$emit('update:modelValue', this.ids.filter(function (value) { return value !== id; })); },
      move: function (index, delta) { var target = index + delta; if (target < 0 || target >= this.selected.length) { return; } var selected = this.selected.slice(); var ids = this.ids.slice(); var item = selected.splice(index, 1)[0]; var id = ids.splice(index, 1)[0]; selected.splice(target, 0, item); ids.splice(target, 0, id); this.selected = selected; this.$emit('update:modelValue', ids); }
    },
    template: [
      '<div class="eva-relationship" :class="{\'is-disabled\':field.disabled,\'is-limit-reached\':limitReached}"><div class="eva-relationship-column"><header><strong>{{field.available_title || \'可选内容\'}}</strong><small>{{items.length}} 项</small></header><div class="eva-relationship-search"><i class="ri-search-line"></i><input type="text" v-model="query" :placeholder="field.search_placeholder || \'搜索可选内容…\'" @input="onInput"></div><div v-if="loading" class="eva-relationship-empty">搜索中…</div><div v-else-if="error" class="eva-relationship-empty">{{error}}</div><ul v-else class="eva-relationship-list"><li v-for="item in items" :key="item.value" :class="{\'is-selected\':ids.indexOf(String(item.value))!==-1,\'is-disabled\':limitReached&&ids.indexOf(String(item.value))===-1}" @click="add(item)"><span><strong>{{item.label}}</strong><small>{{item.meta || item.type || resource}}</small></span><i class="ri-add-line"></i></li><li v-if="!items.length" class="eva-relationship-empty">{{query ? \'没有匹配结果\' : \'输入关键词开始搜索\'}}</li></ul></div><div class="eva-relationship-column"><header><strong>{{field.selected_title || \'已选择内容\'}}</strong><small>{{selected.length}}{{maxItems ? \' / \'+maxItems : \'\'}} 项</small></header><ul class="eva-relationship-list is-selected-list"><li v-for="(item,index) in selected" :key="item.value"><span><strong>{{item.label}}</strong><small>{{item.meta || item.type || resource}}</small></span><div><button type="button" title="上移" :disabled="index===0" @click="move(index,-1)"><i class="ri-arrow-up-line"></i></button><button type="button" title="下移" :disabled="index===selected.length-1" @click="move(index,1)"><i class="ri-arrow-down-line"></i></button><button type="button" title="移除" @click="remove(item)"><i class="ri-close-line"></i></button></div></li><li v-if="!selected.length" class="eva-relationship-empty">暂未选择</li></ul></div></div>'
    ].join('')
  };
})();
