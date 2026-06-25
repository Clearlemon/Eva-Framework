/**
 * Eva UI 库 · eva-toast（轻提示 / 通知）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：保存成功/失败、操作反馈的全局轻提示（自动消失、多条堆叠；最好支持命令式调用）。
 * 约定：挂到 window.EvaUI.Toast 供 Vue 全局注册；样式见同目录 eva-toast.css。
 * 现状：占位骨架，逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Toast) { app.component('eva-toast', window.EvaUI.Toast); }
 * 注意：实现时不要 teleport 到 body（会脱离 #eva-app 令牌作用域）；留在 #eva-app 内、用 position:fixed。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现轻提示（type=success/error/info/warning、duration 自动关闭、多条堆叠；可考虑命令式 API）。
  window.EvaUI.Toast = {
    props: {
      modelValue: { type: Boolean, default: false },
      type: { type: String, default: 'info' },
      message: { type: String, default: '' },
      duration: { type: Number, default: 2400 }
    },
    emits: ['update:modelValue'],
    template: '<div class="eva-toast eva-toast-placeholder">eva-toast 占位：轻提示待实现</div>'
  };
})();
