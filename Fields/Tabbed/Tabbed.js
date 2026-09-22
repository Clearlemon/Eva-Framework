/**
 * Eva 字段：tabbed（对应 CSF 的 tabbed）。
 *
 * 用途：
 * - 把一组子字段分到几个标签页里，适合「同一个设置项下有几类参数」的场景。
 * - 返回值为对象 { child_id: value }：所有标签页的子字段值平铺在同一层（与 CSF 一致），
 *   标签页只是展示上的分组。因此同一个 tabbed 里的子字段 id 不能重复。
 *
 * 字段配置：
 * - `tabs`：标签页数组，每项支持 title / icon / fields / badge / disabled。
 * - `default_tab`：默认打开第几个标签页（从 0 开始），默认 0。
 * - `disabled`：整体只读。
 */
(function () {
  'use strict';
  window.EvaFields = window.EvaFields || {};

  window.EvaFields.tabbed = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    // 功能：初始化组件响应式状态与对外数据。
    data: function () {
      return { active: '' };
    },
    computed: {
      // 功能：把字段配置里的 tabs 转成 <eva-tabs> 需要的结构。
      tabs: function () {
        var self = this;
        return (Array.isArray(this.field.tabs) ? this.field.tabs : []).map(function (tab, index) {
          tab = tab || {};
          return {
            key: String(index),
            label: tab.title || tab.label || ('Tab ' + (index + 1)),
            icon: self.iconOf(tab.icon),
            badge: tab.badge,
            disabled: !!tab.disabled,
            fields: Array.isArray(tab.fields) ? tab.fields : []
          };
        });
      },
      // 功能：当前值（始终按对象处理）。
      value: function () {
        return window.EvaAdvanced.object(this.modelValue);
      }
    },
    // 功能：组件创建时定位默认标签页。
    created: function () {
      var index = Number(this.field.default_tab || this.field.defaultTab || 0);
      this.active = String(isFinite(index) && index >= 0 ? Math.floor(index) : 0);
    },
    methods: {
      // 功能：处理 tv 相关逻辑。
      tv: function (value) { return window.EvaI18n.tv(value); },
      // 功能：外壳只加载了 Remix 与 Dashicons 字体；CSF 写法里的 Font Awesome 类名画不出来，干脆不显示。
      iconOf: function (icon) {
        icon = String(icon || '').trim();
        return /^(ri-|dashicons)/.test(icon) ? icon : '';
      },
      // 功能：取子字段当前值，没存过时用它自己的 default。
      valueFor: function (child) { return window.EvaAdvanced.value(this.value, child); },
      // 功能：更新子字段值并整体回传。
      updateChild: function (child, value) {
        var next = Object.assign({}, this.value);
        next[child.id] = value;
        this.$emit('update:modelValue', next);
      },
      col: window.EvaAdvanced.width
    },
    template: [
      // 外观沿用 group / repeater 的卡片与 12 栅格（AdvancedFields.css），不另起一套样式。
      '<div class="eva-advanced-card eva-tabbed-field" :class="{ \'is-disabled\': field.disabled }">',
      '  <eva-tabs :tabs="tabs" v-model="active" :disabled="!!field.disabled">',
      '    <template #default="{ tab }">',
      '      <div class="eva-advanced-grid">',
      '        <div v-for="child in tab.fields" :key="child.id" class="eva-advanced-child" :class="col(child)">',
      '          <div v-if="tv(child.title) || tv(child.desc)" class="eva-advanced-meta"><span>{{ tv(child.title) }}</span><small v-if="tv(child.desc)">{{ tv(child.desc) }}</small></div>',
      '          <eva-field :field="Object.assign({}, child, { disabled: field.disabled || child.disabled })" :model-value="valueFor(child)" @update:model-value="updateChild(child, $event)"></eva-field>',
      '        </div>',
      '      </div>',
      '    </template>',
      '  </eva-tabs>',
      '</div>'
    ].join('\n')
  };
})();
