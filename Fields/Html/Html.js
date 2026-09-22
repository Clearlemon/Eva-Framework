/**
 * Eva 字段：html。
 *
 * 用途：
 * - 展示后端传入的静态 HTML、iframe、说明内容或第三方应用挂载点。
 * - 常用于把 PHP callback 输出转换为可 JSON 注入的 `field.html`，等价于 CSF 的 callback/content 场景。
 *
 * 安全边界：
 * - 这里使用 `v-html`，因此 `field.html` 必须由可信 PHP 代码生成。
 * - 不接收用户前台输入，不在前端做二次拼接，避免扩大 XSS 面。
 */
(function () {
  window.EvaFields = window.EvaFields || {};
  // 字段组件统一注册到 window.EvaFields，由 eva-app.js 的 eva-field 分发渲染。
  window.EvaFields.html = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    template: '<div class="eva-html-field" v-html="field.html"></div>'
  };
})();
