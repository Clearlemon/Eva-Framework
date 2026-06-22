/* Eva 字段：switcher（开关） */
(function () {
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.switcher = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    computed: {
      isOn: function () {
        return this.modelValue === true || this.modelValue === 1 || this.modelValue === '1';
      }
    },
    template:
      '<button type="button" class="eva-f-switch" :class="{ \'is-on\': isOn }"' +
      ' role="switch" :aria-checked="isOn ? \'true\' : \'false\'"' +
      ' @click="$emit(\'update:modelValue\', isOn ? 0 : 1)"><span class="eva-f-switch-dot"></span></button>'
  };
})();
