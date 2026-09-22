/**
 * Eva 字段：select。
 *
 * 用途：
 * - 渲染单选下拉字段，外观与交互委托给通用 UI 库 `<eva-select>`。
 * - 只负责把 Eva 字段 schema 转换成 eva-select 所需 props，并转发 v-model 更新事件。
 *
 * 字段配置：
 * - `options`：选项表，支持数组、键值对象、分组对象。
 * - `placeholder`：未选择时的占位文案。
 * - `searchable`：是否启用下拉内搜索；未指定时由 eva-select 根据选项数量自动判断。
 * - `empty_message`：搜索无结果时显示的空状态文案。
 * - `multiple`：是否多选；`sortable`：多选值是否允许拖拽排序。
 * - `ajax`：true 时启用远程查找；配合 `source` 可选择 posts / terms / users / menus / sidebars。
 * - `variant`：设为 relationship 时使用左右双栏选择界面，并自动启用 multiple。
 * - 旧的 ajax_select / post_selector / term_selector / user_selector / relationship / nav_menu / sidebar
 *   会在这里转换为 select 配置，仅作为向后兼容入口。
 */
(function () {
  function legacySource(type) {
    var sources = {
      ajax_select: 'posts',
      post_selector: 'posts',
      post: 'posts',
      term_selector: 'terms',
      term: 'terms',
      taxonomy: 'terms',
      user_selector: 'users',
      user: 'users',
      nav_menu: 'menus',
      menu: 'menus',
      sidebar: 'sidebars',
      sidebars: 'sidebars'
    };
    return sources[type] || '';
  }

  function normalizedField(field) {
    field = field || {};
    var next = Object.assign({}, field);
    var type = String(field.type || 'select').toLowerCase();
    var source = field.source || field.data_source || legacySource(type);
    var relationship = type === 'relationship' || String(field.variant || '').toLowerCase() === 'relationship';

    next.type = 'select';
    if (source) {
      next.source = source;
      next.ajax = true;
    }
    if (relationship) {
      next.variant = 'relationship';
      next.source = field.source || field.data_source || field.resource || 'posts';
      next.ajax = true;
      next.multiple = true;
      if (typeof field.sortable === 'undefined') { next.sortable = true; }
    }
    return next;
  }

  window.EvaFields = window.EvaFields || {};
  window.EvaFields.select = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    computed: {
      normalizedField: function () {
        return normalizedField(this.field);
      },
      isRelationship: function () {
        return this.normalizedField.variant === 'relationship';
      },
      // 普通远程数据使用 ResourceSelect；双栏模式复用 Relationship。
      remoteComponent: function () {
        var fields = window.EvaFields || {};
        if (this.isRelationship) { return fields.relationship || null; }
        var source = this.normalizedField.source;
        if (source && fields.resource_select) { return fields.resource_select; }
        return fields.ajax_select || null;
      },
      isRemote: function () {
        var field = this.normalizedField;
        return !!(field.ajax || field.source || field.data_source || this.isRelationship);
      }
    },
    methods: { t: function (k) { return window.EvaI18n.t(k); } },
    template: [
      '<component v-if="isRemote && remoteComponent" :is="remoteComponent" :field="normalizedField" :model-value="modelValue" @update:model-value="$emit(\'update:modelValue\', $event)"></component>',
      '<eva-select v-else :options="normalizedField.options" :placeholder="normalizedField.placeholder || t(\'please_select\')"',
      ' v-bind="normalizedField.attributes || {}"',
      ' :searchable="normalizedField.searchable"',
      ' :empty-message="normalizedField.empty_message"',
      ' :multiple="normalizedField.multiple"',
      ' :sortable="normalizedField.sortable"',
      ' :model-value="modelValue"',
      ' @update:model-value="$emit(\'update:modelValue\', $event)"></eva-select>'
    ].join('\n')
  };
})();
