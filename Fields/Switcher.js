/**
 * Eva 字段：switcher。
 *
 * 用途：
 * - 渲染布尔开关字段，常用于启用/关闭某项功能。
 * - 对外通过 `update:modelValue` 输出 `1` 或 `0`，方便后端按整数保存。
 *
 * 值兼容：
 * - 后端或旧数据可能传入 true / 1 / '1'，这里统一视为开启。
 * - 其它值都视为关闭，避免字符串 '0' 被误判为 truthy。
 */
(function () {
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.switcher = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    computed: {
      // 将不同来源的布尔表示归一化为 UI 所需的开启状态。
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
