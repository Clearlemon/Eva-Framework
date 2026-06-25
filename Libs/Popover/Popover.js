/**
 * Eva UI 库 · eva-popover（点击浮层）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：点击/hover 触发的浮层，可放小菜单、小表单、说明（比 tooltip 强，能容纳交互内容）。
 * 约定：挂到 window.EvaUI.Popover 供 Vue 全局注册；样式见同目录 eva-popover.css。
 * 现状：占位骨架，逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Popover) { app.component('eva-popover', window.EvaUI.Popover); }
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现浮层（trigger 插槽 + content 插槽、点击外部关闭、方向自适应、箭头）。
  window.EvaUI.Popover = {
    props: {
      modelValue: { type: Boolean, default: false },
      placement: { type: String, default: 'bottom' },
      trigger: { type: String, default: 'click' } // click | hover
    },
    emits: ['update:modelValue'],
    template: '<span class="eva-popover eva-popover-placeholder">eva-popover 占位：浮层待实现</span>'
  };
})();
