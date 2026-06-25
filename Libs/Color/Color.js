/**
 * Eva UI 库 · eva-color（颜色选择器）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：支撑 color / color_group / palette 三类字段（hex/rgba + 透明度 + 预设色板）。
 * 约定：挂到 window.EvaUI.Color 供 Vue 全局注册；样式见同目录 eva-color.css。
 * 现状：占位骨架，组件逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Color) { app.component('eva-color', window.EvaUI.Color); }
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现颜色选择逻辑（色相/饱和度面板、hex/rgba 输入、透明度、预设 swatches）。
  window.EvaUI.Color = {
    props: {
      modelValue: { type: String, default: '' }, // 颜色值（hex 或 rgba 字符串）
      alpha: { type: Boolean, default: true },    // 是否允许透明度
      presets: { type: Array, default: function () { return []; } } // 预设色板
    },
    emits: ['update:modelValue'],
    template: '<div class="eva-color eva-color-placeholder">eva-color 占位：颜色选择器待实现</div>'
  };
})();
