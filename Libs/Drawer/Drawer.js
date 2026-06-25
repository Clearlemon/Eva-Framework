/**
 * Eva UI 库 · eva-drawer(抽屉 / 侧边栏)。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：从屏幕某一边滑出的面板——遮罩 + 贴边面板，placement=left/right/top/bottom，
 *           size 控宽（左右）或高（上下），标题 / 内容 / footer 插槽，v-model 控开关，
 *           支持遮罩点击关闭、Esc 关闭、打开锁定背景滚动、按方向滑入过渡。
 * 约定：挂到 window.EvaUI.Drawer 供 Vue 全局注册；样式见同目录 eva-drawer.css。
 * 现状：占位骨架，组件逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Drawer) { app.component('eva-drawer', window.EvaUI.Drawer); }
 * 注意：实现时不要 teleport 到 body，否则会脱离 #eva-app 令牌作用域导致 --eva-* 失效；
 *       留在 #eva-app 内、overlay 用 position:fixed 即可全屏覆盖。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现抽屉（遮罩 + 贴边面板、placement 方向、v-model、Esc/遮罩关闭、锁滚动、滑入过渡）。
  window.EvaUI.Drawer = {
    props: {
      modelValue: { type: Boolean, default: false },
      title: { type: String, default: '' },
      placement: { type: String, default: 'right' },
      size: { type: [Number, String], default: 360 },
      closable: { type: Boolean, default: true },
      closeOnOverlay: { type: Boolean, default: true }
    },
    emits: ['update:modelValue', 'open', 'close'],
    template: '<div class="eva-drawer eva-drawer-placeholder">eva-drawer 占位：抽屉待实现</div>'
  };
})();
