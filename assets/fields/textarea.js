/* Eva 字段：textarea（多行文本） */
(function () {
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.textarea = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    template:
      '<textarea class="eva-f-input eva-f-textarea" rows="4" :value="modelValue"' +
      ' :placeholder="field.placeholder || \'\'"' +
      ' @input="$emit(\'update:modelValue\', $event.target.value)"></textarea>'
  };
})();
