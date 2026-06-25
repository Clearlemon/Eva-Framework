/**
 * Eva UI 库 · eva-icon-picker（图标选择器）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：支撑 icon 字段——从 Remixicon / Dashicons 中带搜索地挑选图标。
 * 约定：挂到 window.EvaUI.IconPicker 供 Vue 全局注册；样式见同目录 eva-icon-picker.css。
 * 现状：占位骨架，组件逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.IconPicker) { app.component('eva-icon-picker', window.EvaUI.IconPicker); }
 * 复用：选择弹窗可直接复用 eva-modal（window.EvaUI.Modal）。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现图标选择（图标清单数据源、搜索过滤、网格选择、回填类名）。
  window.EvaUI.IconPicker = {
    props: {
      modelValue: { type: String, default: '' }, // 选中的图标类名，如 'ri-home-line'
      set: { type: String, default: 'remix' }     // 图标集：remix / dashicons
    },
    emits: ['update:modelValue'],
    template: '<div class="eva-icon-picker eva-icon-picker-placeholder">eva-icon-picker 占位：图标选择器待实现</div>'
  };
})();
