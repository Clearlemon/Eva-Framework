/**
 * Eva field: upload. Single or multiple upload based on the shared eva-media component.
 */
(function () {
  'use strict';
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.upload = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    template: [
      '<eva-media',
      ' :model-value="modelValue"',
      ' :multiple="!!field.multiple"',
      ' :mime="field.library || field.mime || \'image\'"',
      ' :library="field.library || field.mime || \'image\'"',
      ' :title="field.title || \'选择图片\'"',
      ' :button-title="field.button_title || \'选择图片\'"',
      ' :placeholder="field.placeholder || \'点击或拖拽图片到此处\'"',
      ' :return-type="field.return_type || field.returnType || \'url\'"',
      ' :max-size="field.max_size || field.maxSize || 5"',
      ' :max-items="field.max_items || field.max || field.limit || 0"',
      ' :allowed-types="field.allowed_types || field.mime_types || []"',
      ' :preview="field.preview !== false"',
      ' :show-drop="field.show_drop !== false && field.showDrop !== false"',
      ' @update:model-value="$emit(\'update:modelValue\', $event)"',
      '></eva-media>'
    ].join('')
  };
})();
