/* Eva 字段：text（单行文本） */
(function () {
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.text = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input type="text" class="eva-f-input" :value="modelValue"' +
      ' :placeholder="field.placeholder || \'\'"' +
      ' @input="$emit(\'update:modelValue\', $event.target.value)">'
  };
})();
