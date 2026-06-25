/**
 * Eva UI 库 · eva-tooltip（提示气泡）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：字段 desc/help、图标说明等的悬浮提示气泡（hover/focus 触发，方向自适应）。
 * 约定：挂到 window.EvaUI.Tooltip 供 Vue 全局注册；样式见同目录 eva-tooltip.css。
 * 现状：占位骨架，逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Tooltip) { app.component('eva-tooltip', window.EvaUI.Tooltip); }
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现提示气泡（默认插槽=触发元素，content=提示文案；hover/focus 显示、方向自适应、ARIA）。
  window.EvaUI.Tooltip = {
    props: {
      content: { type: String, default: '' },
      placement: { type: String, default: 'top' } // top | bottom | left | right
    },
    template: '<span class="eva-tooltip eva-tooltip-placeholder">eva-tooltip 占位：提示气泡待实现</span>'
  };
})();
