/**
 * Eva 字段：heading / subheading / submessage / notice（纯展示，不保存）。
 *
 * 用途：
 * - 对应 CSF 的四个同名字段：在字段之间插入分组标题、小标题和提示条。
 * - `heading`：大标题条；`subheading`：小标题条。
 * - `notice` / `submessage`：带状态色的提示条。CSF 里两者只差有没有字段外边距，这里统一成同一种外观。
 *
 * 字段配置：
 * - `content`：正文，支持 HTML。后端 Eva::prepare_sections 会把它挪到 `html` 键（外壳会把任意字段的
 *   content 输出在控件上方，不挪走就会出现两遍），组件两个键都认。
 * - `style`：success / info / warning / danger / normal（默认），只对 notice / submessage 生效。
 * - `icon`：自定义提示条图标（Remix 类名）；不写按 style 取默认图标，写 false 不显示。
 *
 * 安全边界：
 * - 与 html 字段一样使用 `v-html`，正文必须由可信 PHP 代码注册，不接收用户输入。
 */
(function () {
  'use strict';
  window.EvaFields = window.EvaFields || {};

  var STYLES = ['success', 'info', 'warning', 'danger', 'normal'];
  var ICONS = {
    success: 'ri-checkbox-circle-line',
    info: 'ri-information-line',
    warning: 'ri-alert-line',
    danger: 'ri-error-warning-line',
    normal: 'ri-chat-1-line'
  };

  // 多语言对象（{zh, en, …}）与普通字符串都交给 EvaI18n.tv 取当前语言的值。
  function Text_Of(value) {
    return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(value) : (value == null ? '' : String(value));
  }

  // 功能：取字段正文；兼容已被后端挪到 html 键和仍在 content 键两种情况。
  function Body_Of(field) {
    field = field || {};
    return Text_Of(field.html != null && field.html !== '' ? field.html : field.content);
  }

  // 功能：生成标题类组件（heading / subheading 只是 class 不同）。
  function Heading_Component(className) {
    return {
      props: ['field', 'modelValue'],
      emits: ['update:modelValue'],
      computed: {
        body: function () { return Body_Of(this.field); }
      },
      template: '<div class="' + className + '" v-html="body"></div>'
    };
  }

  var Notice = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    computed: {
      body: function () { return Body_Of(this.field); },
      style: function () {
        var style = String((this.field && this.field.style) || 'normal').toLowerCase();
        return STYLES.indexOf(style) !== -1 ? style : 'normal';
      },
      icon: function () {
        var icon = this.field ? this.field.icon : '';
        if (icon === false || icon === 'false') { return ''; }
        return icon || ICONS[this.style];
      }
    },
    template: [
      '<div v-if="body" class="eva-notice" :class="\'eva-notice--\' + style" role="note">',
      '  <i v-if="icon" class="eva-notice-icon" :class="icon" aria-hidden="true"></i>',
      '  <div class="eva-notice-body" v-html="body"></div>',
      '</div>'
    ].join('\n')
  };

  // 字段组件统一注册到 window.EvaFields，由外壳的 eva-field 按 type 分发渲染。
  window.EvaFields.heading = Heading_Component('eva-heading');
  window.EvaFields.subheading = Heading_Component('eva-subheading');
  window.EvaFields.notice = Notice;
  window.EvaFields.submessage = Notice;
})();
