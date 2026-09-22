/**
 * Eva 字段：switcher。
 *
 * 支持默认布尔开关、旁侧 label、开关内 text_on / text_off、自定义 text_width 与禁用状态。
 * 对外继续输出 1 / 0，兼容已有保存数据。
 */
(function () {
  'use strict';
  function tv(value) { return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(value) : String(value || ''); }
  function truthy(value) { return value === true || value === 1 || value === '1'; }
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.switcher = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    computed: {
      inputId: function () {
        return 'eva-switcher-' + String(this.field.id || 'field').replace(/[^a-zA-Z0-9_-]/g, '-');
      },
      onValue: function () {
        return Object.prototype.hasOwnProperty.call(this.field, 'value_on') ? this.field.value_on : 1;
      },
      offValue: function () {
        return Object.prototype.hasOwnProperty.call(this.field, 'value_off') ? this.field.value_off : 0;
      },
      isOn: function () {
        if (!Object.prototype.hasOwnProperty.call(this.field, 'value_on')) return truthy(this.modelValue);
        return String(this.modelValue) === String(this.onValue);
      },
      isDisabled: function () {
        return truthy(this.field.disabled) || truthy(this.field.readonly) || truthy(this.field.loading);
      },
      hasText: function () {
        return this.field.text_on != null || this.field.text_off != null;
      },
      stateText: function () {
        if (! this.hasText) { return ''; }
        return tv(this.isOn ? (this.field.text_on || 'On') : (this.field.text_off || 'Off'));
      },
      labelText: function () {
        return tv(this.field.label || '');
      },
      descriptionText: function () {
        return tv(this.isOn ? (this.field.desc_on || '') : (this.field.desc_off || ''));
      },
      statusText: function () {
        return tv(this.isOn ? (this.field.status_on || this.field.text_on || '\u5df2\u5f00\u542f') : (this.field.status_off || this.field.text_off || '\u5df2\u5173\u95ed'));
      },
      stateIcon: function () {
        return this.isOn ? (this.field.icon_on || '') : (this.field.icon_off || '');
      },
      sizeClass: function () {
        var size = String(this.field.size || 'medium').toLowerCase();
        return size === 'small' || size === 'large' ? 'is-' + size : 'is-medium';
      },
      switchStyle: function () {
        var style = {};
        var width = parseFloat(this.field.text_width);
        if (this.hasText) style['--eva-switch-width'] = (width > 0 ? width : 60) + 'px';
        if (this.field.active_color) style['--eva-switch-active'] = String(this.field.active_color);
        if (this.field.inactive_color) style['--eva-switch-inactive'] = String(this.field.inactive_color);
        return style;
      },
      ariaLabel: function () {
        return this.labelText || this.stateText || this.statusText;
      }
    },
    methods: {
      tv: tv,
      toggle: function () {
        if (this.isDisabled) return;
        var nextOn = !this.isOn;
        var message = nextOn ? this.field.confirm_on : this.field.confirm_off;
        if (!message && this.field.confirm) message = this.field.confirm_message || '\u786e\u5b9a\u8981\u5207\u6362\u6b64\u8bbe\u7f6e\u5417\uff1f';
        if (message && !window.confirm(tv(message))) return;
        this.$emit('update:modelValue', nextOn ? this.onValue : this.offValue);
      }
    },
    template:
      '<div class="eva-switcher-field" :class="[{\'is-on\':isOn,\'is-disabled\':field.disabled,\'is-readonly\':field.readonly,\'is-loading\':field.loading,\'is-block\':field.layout===\'block\'},sizeClass]">' +
        '<div class="eva-f-switch-wrap">' +
        '<button :id="inputId" type="button" class="eva-f-switch" :class="{ \'is-on\': isOn, \'has-text\': hasText, \'has-icon\': stateIcon }"' +
        ' :style="switchStyle" :disabled="isDisabled" role="switch"' +
        ' :aria-checked="isOn ? \'true\' : \'false\'" :aria-label="ariaLabel" @click="toggle">' +
          '<span class="eva-f-switch-dot"><i v-if="stateIcon" :class="stateIcon"></i></span>' +
          '<span v-if="hasText" class="eva-f-switch-state">{{ stateText }}</span>' +
        '</button>' +
        '<label v-if="labelText" class="eva-f-switch-label" :for="inputId">{{ labelText }}</label>' +
        '<span v-if="field.show_status" class="eva-switcher-status" :class="isOn?\'is-on\':\'is-off\'">{{statusText}}</span>' +
        '</div>' +
        '<p v-if="descriptionText" class="eva-switcher-description"><i :class="isOn?\'ri-checkbox-circle-line\':\'ri-information-line\'"></i>{{descriptionText}}</p>' +
        '<p v-if="field.disabled_reason && isDisabled" class="eva-switcher-reason"><i class="ri-lock-line"></i>{{tv(field.disabled_reason)}}</p>' +
      '</div>'
  };
})();
