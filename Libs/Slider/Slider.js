/**
 * Eva UI 库 · eva-slider（滑块）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：支撑 slider 字段（拖动取值，可带刻度/数值显示，支持单值或区间）。
 * 约定：挂到 window.EvaUI.Slider 供 Vue 全局注册；样式见同目录 eva-slider.css。
 * 现状：占位骨架，逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Slider) { app.component('eva-slider', window.EvaUI.Slider); }
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现滑块（轨道+滑块拖动、min/max/step、键盘可操作、数值气泡、ARIA slider）。
  window.EvaUI.Slider = {
    props: {
      modelValue: { type: [Number, String], default: 0 },
      min: { type: Number, default: 0 },
      max: { type: Number, default: 100 },
      step: { type: Number, default: 1 }
    },
    emits: ['update:modelValue'],
    template: '<div class="eva-slider eva-slider-placeholder">eva-slider 占位：滑块待实现</div>'
  };
})();
