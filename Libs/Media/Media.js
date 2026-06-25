/**
 * Eva UI 库 · eva-media（媒体选择 / 上传）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：支撑 upload / gallery / image_select 三类字段（封装 WP 媒体框架 wp.media + 预览）。
 * 约定：挂到 window.EvaUI.Media 供 Vue 全局注册；样式见同目录 eva-media.css。
 * 现状：占位骨架，组件逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.Media) { app.component('eva-media', window.EvaUI.Media); }
 * 注意：依赖 WP 媒体库（wp.media），需在加载页 wp_enqueue_media()。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现媒体选择（单/多选、wp.media frame、缩略图预览、移除/排序）。
  window.EvaUI.Media = {
    props: {
      modelValue: { type: [String, Number, Array], default: '' }, // 附件 id 或 url（多选为数组）
      multiple: { type: Boolean, default: false }, // 是否多选（gallery）
      mime: { type: String, default: 'image' }     // 限定媒体类型
    },
    emits: ['update:modelValue'],
    template: '<div class="eva-media eva-media-placeholder">eva-media 占位：媒体选择/上传待实现</div>'
  };
})();
