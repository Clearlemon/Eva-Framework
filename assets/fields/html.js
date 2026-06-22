/* Eva 字段：html（展示型，输出任意 HTML / iframe / 挂载点 div；等价于 CSF 的 callback/content） */
(function () {
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.html = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    template: '<div class="eva-html-field" v-html="field.html"></div>'
  };
})();
