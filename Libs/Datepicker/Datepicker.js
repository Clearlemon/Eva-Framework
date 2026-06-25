/**
 * Eva UI 库 · eva-datepicker（日期 / 时间选择）。【骨架 / 占位 —— 待实现】
 *
 * 规划用途：支撑 date / datetime / time 字段（日历面板 + 可选时间）。
 * 约定：挂到 window.EvaUI.DatePicker 供 Vue 全局注册；样式见同目录 eva-datepicker.css。
 * 现状：占位骨架，逻辑待补。实现后需在 eva-app.js 注册：
 *   if (window.EvaUI && window.EvaUI.DatePicker) { app.component('eva-datepicker', window.EvaUI.DatePicker); }
 * 设计：零依赖、自写日历（不引第三方日期库）。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // TODO: 实现日期选择（月历翻页、选中态、mode=date/datetime/time、format 格式化、弹出面板）。
  window.EvaUI.DatePicker = {
    props: {
      modelValue: { type: String, default: '' },
      mode: { type: String, default: 'date' }, // date | datetime | time
      format: { type: String, default: '' }
    },
    emits: ['update:modelValue'],
    template: '<div class="eva-datepicker eva-datepicker-placeholder">eva-datepicker 占位：日期选择待实现</div>'
  };
})();
