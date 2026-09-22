/**
 * Eva 字段：color。
 *
 * 把字段 schema 转换为完整版 <eva-color> 参数，同时兼容旧版 alpha、透明色和翻译配置。
 */
(function () {
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.color = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    methods: {
      tv: function (value) { return window.EvaI18n.tv(value); },
      tt: function (key) { return window.EvaI18n.t(key); }
    },
    template:
      '<eva-color :model-value="modelValue == null ? \'\' : String(modelValue)"' +
      ' :alpha="field.alpha !== false && field.allow_transparent !== false"' +
      ' :presets="field.presets || []"' +
      ' :placeholder="tv(field.placeholder || \'#FF4D7F\')"' +
      ' :default-value="field.default == null ? \'\' : String(field.default)"' +
      ' :mode="field.mode || \'popover\'"' +
      ' :size="field.size || \'medium\'"' +
      ' :default-format="field.format || \'hex\'"' +
      ' :formats="field.formats || []"' +
      ' :show-input="field.show_input !== false && field.showInput !== false"' +
      ' :show-format="field.show_format !== false && field.showFormat !== false"' +
      ' :show-presets="field.show_presets !== false && field.showPresets !== false"' +
      ' :clearable="field.clearable !== false"' +
      ' :resettable="field.resettable !== false"' +
      ' :disabled="field.disabled === true || field.disabled === 1 || field.disabled === \'1\'"' +
      ' :palette-label="tv(field.palette_label || field.paletteLabel || \'\')"' +
      ' :clear-text="tv(field.clear_text || field.clearText || tt(\'color_clear\'))"' +
      ' :apply-text="tv(field.apply_text || field.applyText || tt(\'color_apply\'))"' +
      ' :default-text="tv(field.default_text || field.defaultText || tt(\'color_default\'))"' +
      ' :popover-width="field.popover_width || field.popoverWidth || \'\'"' +
      ' :board-height="field.board_height || field.boardHeight || \'\'"' +
      ' :preset-shape="field.preset_shape || field.presetShape || \'square\'"' +
      ' @update:model-value="$emit(\'update:modelValue\', $event)"></eva-color>'
  };
})();