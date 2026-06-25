/**
 * Eva UI 库 · eva-accordion（手风琴 / 折叠面板）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：支撑 accordion 容器字段——把若干分组折叠/展开展示。
 * 约定：挂到 window.EvaUI.Accordion 供 Vue 全局注册；样式见同目录 eva-accordion.css。
 * 现状：占位骨架，组件逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Accordion) { app.component('eva-accordion', window.EvaUI.Accordion); }
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现手风琴（面板头点击展开/收起、可配单开/多开、过渡动画）。
  window.EvaUI.Accordion = {
    props: {
      panels: { type: Array, default: function () { return []; } }, // [{ key, title }]
      multiple: { type: Boolean, default: false } // 是否允许同时展开多个
    },
    emits: ['update:modelValue'],
    template: '<div class="eva-accordion eva-accordion-placeholder">eva-accordion 占位：手风琴容器待实现</div>'
  };
})();
