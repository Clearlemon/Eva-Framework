/* Eva 字段：builder（拖拽式布局构建器，使用 UI 库 <eva-builder>） */
(function () {
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.builder = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    template:
      '<eva-builder :model-value="Array.isArray(modelValue) ? modelValue : []"' +
      ' @update:model-value="$emit(\'update:modelValue\', $event)"></eva-builder>'
  };
})();
