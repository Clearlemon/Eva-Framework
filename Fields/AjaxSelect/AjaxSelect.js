/**
 * Eva 字段：ajax_select（也作为 select[ajax=true] 的内部实现）。
 *
 * 用途：
 * - CSF 风格的远程文章 / 页面查找字段，推荐通过 `type => select, ajax => true` 使用。
 * - 用户输入关键词后通过 admin-ajax 搜索 post/page 等 post type，保存值为文章 ID。
 *
 * 字段配置：
 * - `post_type`：字符串或数组，默认 ['post', 'page']。
 * - `placeholder`：未选择时的按钮文案。
 * - `search_placeholder`：搜索框占位文案。
 * - `min_chars`：至少输入多少字符后搜索，默认 2。
 * - `limit`：最多返回多少条，默认 20，后端上限 30。
 * - `multiple`：是否多选；`sortable`：多选值是否允许拖拽排序。
 */
(function () {
  window.EvaFields = window.EvaFields || {};

  // 功能：处理 Cfg 相关逻辑。
  function Cfg() {
    return (window.EvaFW && window.EvaFW.config) || {};
  }

  // 功能：处理 Tv 相关逻辑。
  function Tv(value) {
    return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(value) : (value || '');
  }

  // 功能：处理 Post Type Param 相关逻辑。
  function Post_Type_Param(postType) {
    if (Array.isArray(postType)) {
      return postType.join(',');
    }
    return postType || 'post,page';
  }

  window.EvaFields.ajax_select = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    // 功能：初始化组件响应式状态与对外数据。
    data: function () {
      return {
        open: false,
        query: '',
        loading: false,
        items: [],
        selected: [],
        error: '',
        timer: null,
        dragIndex: null
      };
    },
    computed: {
      // 功能：处理 min Chars 相关逻辑。
      minChars: function () {
        return Math.max(0, parseInt(this.field.min_chars || this.field.minChars || 2, 10) || 0);
      },
      // 功能：处理 value Label 相关逻辑。
      valueLabel: function () {
        if (this.isMultiple) {
          return this.selected.length ? '' : Tv(this.field.placeholder || '请选择');
        }
        if (this.selected[0] && this.selected[0].label) {
          return this.selected[0].label;
        }
        return this.modelValue ? ('#' + this.modelValue) : Tv(this.field.placeholder || '请选择');
      },
      // 功能：判断 is Placeholder 状态。
      isPlaceholder: function () {
        return this.isMultiple ? !this.values.length : !this.modelValue;
      },
      // 功能：判断 is Multiple 状态。
      isMultiple: function () {
        return this.field.multiple === true || this.field.multiple === 'true';
      },
      // 功能：判断 can Sort 状态。
      canSort: function () {
        return this.isMultiple && (this.field.sortable === true || this.field.sortable === 'true');
      },
      // 功能：处理 values 相关逻辑。
      values: function () {
        if (this.isMultiple) {
          return Array.isArray(this.modelValue) ? this.modelValue.map(String) : [];
        }
        return this.modelValue ? [String(this.modelValue)] : [];
      }
    },
    // 功能：组件挂载后执行初始化和事件绑定。
    mounted: function () {
      document.addEventListener('mousedown', this.onDocDown, true);
      if (this.values.length) {
        this.fetchItems('', this.values.join(','));
      }
    },
    // 功能：组件销毁前清理事件、计时器或临时状态。
    beforeUnmount: function () {
      document.removeEventListener('mousedown', this.onDocDown, true);
      if (this.timer) {
        clearTimeout(this.timer);
      }
    },
    methods: {
      Tv: Tv,
      // 功能：处理 on Doc Down 相关逻辑。
      onDocDown: function (e) {
        if (this.open && this.$el && !this.$el.contains(e.target)) {
          this.close();
        }
      },
      // 功能：打开 open Menu 相关界面或状态。
      openMenu: function () {
        if (this.field.disabled) { return; }
        this.open = true;
        this.error = '';
        var self = this;
        this.$nextTick(function () {
          if (self.$refs.search && self.$refs.search.focus) {
            self.$refs.search.focus();
          }
        });
      },
      // 功能：关闭 close 相关界面或状态。
      close: function () {
        this.open = false;
        this.query = '';
        this.items = [];
        this.error = '';
      },
      // 功能：清空 clear 相关状态。
      clear: function () {
        if (this.field.disabled) { return; }
        this.selected = [];
        this.$emit('update:modelValue', this.isMultiple ? [] : '');
      },
      // 功能：处理 on Input 相关逻辑。
      onInput: function () {
        var self = this;
        if (this.timer) {
          clearTimeout(this.timer);
        }
        this.timer = setTimeout(function () {
          self.fetchItems(self.query, 0);
        }, 220);
      },
      // 功能：处理 fetch Items 相关逻辑。
      fetchItems: function (query, includeId) {
        var q = (query || '').trim();
        if (!includeId && q.length < this.minChars) {
          this.items = [];
          this.loading = false;
          return;
        }

        var ajaxUrl = Cfg().ajaxUrl || ((window.EvaFW && window.EvaFW.adminUrl) ? window.EvaFW.adminUrl + 'admin-ajax.php' : '/wp-admin/admin-ajax.php');
        var params = new URLSearchParams();
        params.set('action', 'eva_fw_search_posts');
        params.set('nonce', Cfg().nonce || '');
        params.set('post_type', Post_Type_Param(this.field.post_type || this.field.postType));
        params.set('limit', this.field.limit || 20);
        if (includeId) {
          params.set('include', includeId);
        } else {
          params.set('q', q);
        }

        var self = this;
        this.loading = true;
        this.error = '';
        fetch(ajaxUrl + '?' + params.toString(), { credentials: 'same-origin' })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            var items = (res && res.success && res.data && Array.isArray(res.data.items)) ? res.data.items : [];
            if (includeId) {
              self.selected = self.sortItemsByValues(items, String(includeId).split(','));
            } else {
              self.items = items;
            }
          })
          .catch(function () {
            self.error = '搜索失败';
          })
          .then(function () {
            self.loading = false;
          });
      },
      // 功能：处理 pick 相关逻辑。
      pick: function (item) {
        if (this.isMultiple) {
          var values = this.values.slice();
          var value = String(item.value);
          var index = values.indexOf(value);
          if (index === -1) {
            values.push(value);
            this.selected.push(item);
          } else {
            values.splice(index, 1);
            this.selected = this.selected.filter(function (selected) { return String(selected.value) !== value; });
          }
          this.$emit('update:modelValue', values);
          return;
        }
        this.selected = [item];
        this.$emit('update:modelValue', item.value);
        this.close();
      },
      // 功能：判断 is Selected 状态。
      isSelected: function (item) {
        return this.values.indexOf(String(item.value)) !== -1;
      },
      // 功能：移除 remove Value 对应条目。
      removeValue: function (value) {
        var stringValue = String(value);
        var values = this.values.filter(function (item) { return item !== stringValue; });
        this.selected = this.selected.filter(function (item) { return String(item.value) !== stringValue; });
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
        var values = this.values.slice();
        var selected = this.selected.slice();
        var value = values.splice(this.dragIndex, 1)[0];
        var item = selected.splice(this.dragIndex, 1)[0];
        values.splice(index, 0, value);
        selected.splice(index, 0, item);
        this.dragIndex = null;
        this.selected = selected;
        this.$emit('update:modelValue', values);
      },
      // 功能：处理 sort Items By Values 相关逻辑。
      sortItemsByValues: function (items, values) {
        return values.map(function (value) {
          return items.filter(function (item) { return String(item.value) === String(value); })[0] || null;
        }).filter(function (item) { return !!item; });
      }
    },
    template: [
      '<div class="eva-ajax-select" :class="{ \'is-open\': open, \'is-disabled\': field.disabled, \'is-multiple\': isMultiple }">',
      '  <div class="eva-ajax-trigger-wrap">',
      '    <button type="button" class="eva-ajax-trigger" :disabled="field.disabled" @click="openMenu">',
      '      <span v-if="!isMultiple" :class="{ \'is-placeholder\': isPlaceholder }">{{ valueLabel }}</span>',
      '      <span v-else-if="!selected.length" class="is-placeholder">{{ valueLabel }}</span>',
      '      <span v-else class="eva-ajax-tags">',
      '        <span v-for="(item, index) in selected" :key="item.value" class="eva-ajax-tag" :class="{ \'is-dragging\': dragIndex === index }" :draggable="canSort" @click.stop @dragstart="dragStart(index)" @dragover.prevent @drop.stop="dropValue(index)">',
      '          <span>{{ item.label }}</span><i class="ri-close-line" @click.stop="removeValue(item.value)"></i>',
      '        </span>',
      '      </span>',
      '      <i class="ri-search-line"></i>',
      '    </button>',
      '    <button v-if="values.length && !field.disabled" type="button" class="eva-ajax-clear" aria-label="清空" @click="clear"><i class="ri-close-line"></i></button>',
      '  </div>',
      '  <div v-show="open" class="eva-ajax-panel">',
      '    <div class="eva-ajax-search">',
      '      <i class="ri-search-line"></i>',
      '      <input ref="search" type="text" v-model="query" :placeholder="Tv(field.search_placeholder || field.searchPlaceholder || \'输入关键词搜索…\')" @input="onInput">',
      '    </div>',
      '    <div v-if="query.trim().length < minChars" class="eva-ajax-empty">至少输入 {{ minChars }} 个字符</div>',
      '    <div v-else-if="loading" class="eva-ajax-empty">搜索中…</div>',
      '    <div v-else-if="error" class="eva-ajax-empty">{{ error }}</div>',
      '    <ul v-else-if="items.length" class="eva-ajax-list">',
      '      <li v-for="item in items" :key="item.value" :class="{ \'is-selected\': isSelected(item) }" @click="pick(item)">',
      '        <strong>{{ item.label }}</strong>',
      '        <span>#{{ item.value }} · {{ item.type }} · {{ item.status }}</span>',
      '      </li>',
      '    </ul>',
      '    <div v-else class="eva-ajax-empty">没有匹配结果</div>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
})();
