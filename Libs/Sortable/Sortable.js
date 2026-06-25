/**
 * Eva UI 库 · eva-sortable（拖拽排序）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：支撑 repeater / group / sorter 字段的条目拖拽排序（复用面最广）。
 * 约定：挂到 window.EvaUI.Sortable 供 Vue 全局注册；样式见同目录 eva-sortable.css。
 * 现状：占位骨架，组件逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Sortable) { app.component('eva-sortable', window.EvaUI.Sortable); }
 * 设计：零依赖、基于 Pointer 事件实现拖拽（不引第三方拖拽库）。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现拖拽排序（按手柄拖动、占位插入指示、释放后 emit 新顺序）。
  window.EvaUI.Sortable = {
    props: {
      modelValue: { type: Array, default: function () { return []; } }, // 条目数组
      handle: { type: String, default: '' } // 拖拽手柄选择器（空=整项可拖）
    },
    emits: ['update:modelValue'],
    template: '<div class="eva-sortable eva-sortable-placeholder">eva-sortable 占位：拖拽排序待实现</div>'
  };
})();
