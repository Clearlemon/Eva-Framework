/** Eva UI: themed confirmation dialog with focus containment and Escape dismissal. */
(function () {
  'use strict';
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};
  var seed = 0;
  window.EvaUI.Confirm = {
    props: {
      motion: { type: Object, default: null },
      modelValue: { type: Boolean, default: false },
      title: { type: String, default: '确认操作' },
      message: { type: String, default: '' },
      danger: { type: Boolean, default: false },
      confirmText: { type: String, default: '确定' },
      cancelText: { type: String, default: '取消' }
    },
    emits: ['update:modelValue', 'confirm', 'cancel'],
    data: function () { return { dialogId: 'eva-confirm-' + (++seed) }; },
    mounted: function () { this.syncVisibility(); },
    beforeUnmount: function () {
      var dialog = this.$refs.dialog;
      this._motionSeq = (this._motionSeq || 0) + 1;
      if (this.motion && dialog) { this.motion.onEnterCancelled(dialog); }
      if (dialog && dialog.open) { dialog.close(); }
    },
    watch: { modelValue: function () { this.syncVisibility(); } },
    methods: {
      syncVisibility: function () {
        this.$nextTick(function () {
          var dialog = this.$refs.dialog;
          if (!dialog) { return; }
          var seq = this._motionSeq = (this._motionSeq || 0) + 1;
          if (this.modelValue) {
            if (!dialog.open) { dialog.showModal(); }
            if (this.motion) { this.motion.onBeforeEnter(dialog); this.motion.onEnter(dialog, function () {}); }
          } else if (dialog.open) {
            if (this.motion) { this.motion.onLeave(dialog, function () { if (seq === this._motionSeq && !this.modelValue) { dialog.close(); } }.bind(this)); }
            else { dialog.close(); }
          }
        });
      },
      cancel: function () {
        this.$emit('update:modelValue', false);
        this.$emit('cancel');
      },
      confirm: function () {
        this.$emit('confirm');
        this.$emit('update:modelValue', false);
      }
    },
    template: "<dialog ref=\"dialog\" class=\"eva-confirm\" :class=\"{ 'is-danger': danger }\" :aria-labelledby=\"dialogId + '-title'\" :aria-describedby=\"dialogId + '-message'\" @cancel.prevent=\"cancel\" @click.self=\"cancel\">\n  <div class=\"eva-confirm-content\">\n    <div class=\"eva-confirm-heading\"><span class=\"eva-confirm-icon\" aria-hidden=\"true\"><i :class=\"danger ? 'ri-delete-bin-line' : 'ri-question-line'\"></i></span><h2 :id=\"dialogId + '-title'\">{{ title }}</h2></div>\n    <p :id=\"dialogId + '-message'\" class=\"eva-confirm-message\">{{ message }}</p>\n    <div class=\"eva-confirm-actions\"><button type=\"button\" class=\"eva-confirm-cancel\" autofocus @click=\"cancel\">{{ cancelText }}</button><button type=\"button\" class=\"eva-confirm-submit\" @click=\"confirm\">{{ confirmText }}</button></div>\n  </div>\n</dialog>"
  };
}());
