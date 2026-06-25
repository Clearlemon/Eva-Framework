/**
 * Eva 字段：text。
 *
 * 用途：
 * - 渲染最基础的单行文本输入。
 * - 适合标题、短描述、链接、标语等短文本字段。
 *
 * 数据流：
 * - 输入框的 value 来自 `modelValue`。
 * - 每次 input 事件都通过 `update:modelValue` 同步到 Eva 主表单 model。
 */
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
