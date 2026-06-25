/**
 * Eva UI 库 · eva-tabs（标签页）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：支撑 tabbed 容器字段——把若干分组以标签页切换展示。
 * 约定：挂到 window.EvaUI.Tabs 供 Vue 全局注册；样式见同目录 eva-tabs.css。
 * 现状：占位骨架，组件逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Tabs) { app.component('eva-tabs', window.EvaUI.Tabs); }
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现标签页（标签条、激活态、内容区切换；可配 tabs:[{key,label}] + 默认插槽/具名插槽）。
  window.EvaUI.Tabs = {
    props: {
      tabs: { type: Array, default: function () { return []; } }, // [{ key, label, icon }]
      modelValue: { type: [String, Number], default: '' }        // 当前激活 tab 的 key
    },
    emits: ['update:modelValue'],
    template: '<div class="eva-tabs eva-tabs-placeholder">eva-tabs 占位：标签页容器待实现</div>'
  };
})();
