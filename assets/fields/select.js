/* Eva 字段：select（下拉选择，支持搜索 / 分组 / 空状态文案）
 * 字段配置可选：searchable(bool)、empty_message(string)、options 支持分组（嵌套数组/对象）。 */
(function () {
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.select = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    template:
      '<eva-select :options="field.options" :placeholder="field.placeholder || \'请选择\'"' +
      ' :searchable="field.searchable"' +
      ' :empty-message="field.empty_message"' +
      ' :model-value="modelValue"' +
      ' @update:model-value="$emit(\'update:modelValue\', $event)"></eva-select>'
  };
})();
