/**
 * Eva UI 库 · eva-modal（弹窗 / 对话框）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：统一的后台弹窗——遮罩 + 居中对话框，标题栏 / 内容区 / footer 插槽，v-model 控开关，
 *           支持遮罩点击关闭、Esc 关闭、打开锁定背景滚动。
 * 约定：挂到 window.EvaUI.Modal 供 Vue 全局注册；样式见同目录 eva-modal.css。
 * 现状：占位骨架，组件逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Modal) { app.component('eva-modal', window.EvaUI.Modal); }
 * 注意：实现时不要 teleport 到 body，否则会脱离 #eva-app 令牌作用域导致 --eva-* 失效；
 *       留在 #eva-app 内、overlay 用 position:fixed 即可全屏覆盖。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现弹窗（遮罩 + 对话框、v-model、Esc/遮罩关闭、锁滚动、插槽 head/body/footer）。
  window.EvaUI.Modal = {
    props: {
      modelValue: { type: Boolean, default: false },
      title: { type: String, default: '' },
      width: { type: [Number, String], default: 480 },
      closable: { type: Boolean, default: true },
      closeOnOverlay: { type: Boolean, default: true }
    },
    emits: ['update:modelValue', 'open', 'close'],
    template: '<div class="eva-modal eva-modal-placeholder">eva-modal 占位：弹窗待实现</div>'
  };
})();
