/**
 * Eva 字段：icon。
 *
 * 用途：
 * - 渲染图标选择字段，返回图标名称字符串。
 * - 选择器交互委托给通用 UI 库 `<eva-icon-picker>`。
 *
 * 字段配置：
 * - `library`：图标库，支持 fa / remix / dashicons / svg(iconfont symbol)。
 * - `default`：恢复默认值。
 * - `placeholder`：输入框占位提示。
 */
(function () {
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.icon = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    template:
      '<eva-icon-picker :model-value="modelValue"' +
      ' :library="field.library || field.set || \'remix\'"' +
      ' :placeholder="field.placeholder || \'请选择一个图标\'"' +
      ' :default-value="field.default || \'\'"' +
      ' :disabled="!!field.disabled"' +
      ' :readonly="!!field.readonly"' +
      ' :clearable="field.clearable !== false"' +
      ' :show-reset="field.show_reset !== false"' +
      ' :allow-input="field.allow_input !== false"' +
      ' :searchable="field.searchable !== false"' +
      ' @update:model-value="$emit(\'update:modelValue\', $event)"></eva-icon-picker>'
  };
})();
