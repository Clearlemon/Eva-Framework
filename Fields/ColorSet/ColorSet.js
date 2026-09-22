/**
 * Eva 字段：color_set（一组带名字的颜色，对应 CSF 的 color_group）。
 *
 * 用途：
 * - 固定的几个命名颜色（如「主色 / 悬停色 / 边框色」），返回对象 { 键: '#颜色' }。
 * - Eva 自己的 color_group 是「可增删的颜色列表」（值是没有键的数组），与 CSF 的 color_group 同名但结构不同；
 *   开启 csf_compat 的容器里，CSF 写法的 color_group 会被后端兼容层映射到这个类型，存值结构与 CSF 保持一致。
 *
 * 字段配置：
 * - `options`：{ 键: '标题' }。
 * - `default`：{ 键: '#颜色' }，每个颜色各自的默认值。
 * - 其余参数（alpha / presets / format / clearable / disabled …）原样传给每一个 color 字段。
 */
(function () {
  'use strict';
  window.EvaFields = window.EvaFields || {};

  // 不该透传给单个 color 字段的键：它们描述的是整组，而不是某一个颜色。
  var OWN_KEYS = ['id', 'type', 'title', 'desc', 'subtitle', 'help', 'options', 'default', 'dependency', 'eva_dependency', 'width', 'class', 'csf_shape'];

  window.EvaFields.color_set = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    computed: {
      // 功能：当前值（始终按对象处理；列表等其它结构视为空）。
      value: function () {
        var value = this.modelValue;
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      },
      // 功能：为每个选项合成一个 color 子字段，交给现成的 color 组件渲染。
      items: function () {
        var field = this.field || {};
        var options = field.options && typeof field.options === 'object' ? field.options : {};
        var defaults = field.default && typeof field.default === 'object' ? field.default : {};
        var shared = {};
        Object.keys(field).forEach(function (key) {
          if (OWN_KEYS.indexOf(key) === -1) { shared[key] = field[key]; }
        });
        return Object.keys(options).map(function (key) {
          return {
            key: String(key),
            label: options[key],
            // 几个取色器并排放，默认收起「格式切换」下拉省出宽度；字段上显式写 show_format => true 可以再打开。
            child: Object.assign({ show_format: false }, shared, { id: String(key), type: 'color', default: defaults[key] == null ? '' : defaults[key] })
          };
        });
      }
    },
    methods: {
      // 功能：处理 tv 相关逻辑。
      tv: function (value) { return window.EvaI18n.tv(value); },
      // 功能：取某个颜色的当前值，没存过时用它的默认值。
      valueFor: function (item) {
        return Object.prototype.hasOwnProperty.call(this.value, item.key) ? this.value[item.key] : item.child.default;
      },
      // 功能：更新一个颜色并整体回传。
      update: function (item, color) {
        var next = Object.assign({}, this.value);
        next[item.key] = color;
        this.$emit('update:modelValue', next);
      }
    },
    template: [
      '<div class="eva-color-set" :class="{ \'is-disabled\': field.disabled }">',
      '  <div v-for="item in items" :key="item.key" class="eva-color-set-item">',
      '    <span class="eva-color-set-label">{{ tv(item.label) }}</span>',
      '    <eva-field :field="item.child" :model-value="valueFor(item)" @update:model-value="update(item, $event)"></eva-field>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
})();
