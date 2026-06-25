/**
 * Eva UI 库 · eva-code（只读代码高亮）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：只读代码块高亮，自写正则 tokenizer、零第三方依赖、近单色配色。
 *           详细实现规格见插件根目录《eva-code 代码高亮库实现计划.md》。
 * 约定：挂到 window.EvaUI.Code 供 Vue 全局注册；样式见同目录 eva-code.css。
 * 现状：占位骨架，逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Code) { app.component('eva-code', window.EvaUI.Code); }
 * 安全：实现时务必先 HTML 转义再着色，防 XSS。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现 tokenizer（php/js/css/html/bash；先转义后着色；先注释/字符串再关键字/数字）。
  window.EvaUI.Code = {
    props: {
      code: { type: String, default: '' },
      lang: { type: String, default: '' },     // php | js | css | html | bash
      inline: { type: Boolean, default: false }
    },
    template: '<pre class="eva-code eva-code-placeholder">eva-code 占位：代码高亮待实现</pre>'
  };
})();
