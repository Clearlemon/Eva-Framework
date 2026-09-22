/**
 * Eva 字段：palette（对应 CSF 的 palette）。
 *
 * 用途：
 * - 从几套预设配色里单选一套，返回选中那一套的键（字符串）。
 *
 * 字段配置：
 * - `options`：{ 键: ['#色1', '#色2', …] }；也可写成 { 键: { colors: [...], label: '名称' } } 给每套配色起名。
 * - `default`：默认选中的键。
 * - `clearable`：允许再点一次取消选择，默认 false（与 CSF 的单选行为一致）。
 * - `disabled`：只读。
 */
(function () {
  'use strict';
  window.EvaFields = window.EvaFields || {};

  window.EvaFields.palette = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    computed: {
      // 功能：把两种 options 写法统一成 [{ key, colors, label }]。
      items: function () {
        var options = this.field.options && typeof this.field.options === 'object' ? this.field.options : {};
        return Object.keys(options).map(function (key) {
          var option = options[key];
          var isList = Array.isArray(option);
          var colors = isList ? option : (option && Array.isArray(option.colors) ? option.colors : []);
          return {
            key: String(key),
            label: isList || !option ? '' : (option.label || option.title || ''),
            colors: colors.filter(function (color) { return typeof color === 'string' && color !== ''; })
          };
        });
      },
      current: function () {
        return this.modelValue == null ? '' : String(this.modelValue);
      }
    },
    methods: {
      // 功能：处理 tv 相关逻辑。
      tv: function (value) { return window.EvaI18n.tv(value); },
      // 功能：选中一套配色；clearable 时再点一次取消。
      pick: function (item) {
        if (this.field.disabled) { return; }
        if (item.key === this.current) {
          if (this.field.clearable === true) { this.$emit('update:modelValue', ''); }
          return;
        }
        this.$emit('update:modelValue', item.key);
      }
    },
    template: [
      '<div class="eva-palette" :class="{ \'is-disabled\': field.disabled }" role="radiogroup">',
      '  <button v-for="item in items" :key="item.key" type="button" class="eva-palette-item" role="radio"',
      '          :class="{ \'is-active\': item.key === current }" :aria-checked="item.key === current ? \'true\' : \'false\'"',
      '          :disabled="!!field.disabled" :title="tv(item.label) || item.key" @click="pick(item)">',
      '    <span class="eva-palette-colors"><span v-for="(color, index) in item.colors" :key="index" :style="{ background: color }"></span></span>',
      '    <span v-if="tv(item.label)" class="eva-palette-label">{{ tv(item.label) }}</span>',
      '    <i class="eva-palette-check ri-check-line" aria-hidden="true"></i>',
      '  </button>',
      '</div>'
    ].join('\n')
  };
})();
