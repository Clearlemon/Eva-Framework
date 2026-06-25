/**
 * Eva UI 库 · eva-tree（树形选择）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：分类树/层级数据的展示与选择（展开折叠、单选/多选/勾选）。
 * 约定：挂到 window.EvaUI.Tree 供 Vue 全局注册；样式见同目录 eva-tree.css。
 * 现状：占位骨架，逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Tree) { app.component('eva-tree', window.EvaUI.Tree); }
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现树（递归节点、展开/折叠、单选/多选 checkbox、半选态、键盘可达）。
  window.EvaUI.Tree = {
    props: {
      modelValue: { type: [Array, String, Number], default: function () { return []; } },
      nodes: { type: Array, default: function () { return []; } }, // [{ id, label, children }]
      multiple: { type: Boolean, default: false }
    },
    emits: ['update:modelValue'],
    template: '<div class="eva-tree eva-tree-placeholder">eva-tree 占位：树形选择待实现</div>'
  };
})();
