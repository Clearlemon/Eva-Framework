/**
 * Eva 字段：textarea。
 *
 * 用途：
 * - 渲染多行文本输入，适合说明、备注、长文案等字段。
 * - 使用原生 `<textarea>`，保持 WordPress 后台表单语义简单可靠。
 *
 * 字段配置：
 * - `placeholder`：占位提示。
 * - 当前固定 `rows="4"`，高度主要由 CSS 控制。
 */
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
