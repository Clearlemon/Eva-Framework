/**
 * Eva UI 库 · eva-confirm（确认框）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：删除/重置等危险操作的二次确认（标题 + 说明 + 取消/确定），可复用 eva-modal 当壳。
 * 约定：挂到 window.EvaUI.Confirm 供 Vue 全局注册；样式见同目录 eva-confirm.css。
 * 现状：占位骨架，逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Confirm) { app.component('eva-confirm', window.EvaUI.Confirm); }
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现确认框（基于 modal；danger 态、confirm/cancel 事件；可命令式 EvaUI.Confirm.open()）。
  window.EvaUI.Confirm = {
    props: {
      modelValue: { type: Boolean, default: false },
      title: { type: String, default: '确认操作' },
      message: { type: String, default: '' },
      danger: { type: Boolean, default: false },
      confirmText: { type: String, default: '确定' },
      cancelText: { type: String, default: '取消' }
    },
    emits: ['update:modelValue', 'confirm', 'cancel'],
    template: '<div class="eva-confirm eva-confirm-placeholder">eva-confirm 占位：确认框待实现</div>'
  };
})();
