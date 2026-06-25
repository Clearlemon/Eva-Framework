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
 */
(function () {
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.select = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    methods: { t: function (k) { return window.EvaI18n.t(k); } },
    template:
      '<eva-select :options="field.options" :placeholder="field.placeholder || t(\'please_select\')"' +
      ' :searchable="field.searchable"' +
      ' :empty-message="field.empty_message"' +
      ' :model-value="modelValue"' +
      ' @update:model-value="$emit(\'update:modelValue\', $event)"></eva-select>'
  };
})();
