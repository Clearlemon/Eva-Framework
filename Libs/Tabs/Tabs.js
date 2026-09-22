/**
 * Eva UI 库 · eva-tabs（标签页）。
 *
 * 只负责标签条与激活态，面板内容通过 scoped slot 交给使用方渲染；支撑 tabbed 容器字段。
 * 约定：挂到 window.EvaUI.Tabs，两个外壳（eva-app.js / eva-embed.js）里注册为 <eva-tabs>。
 *
 * 用法：
 *   <eva-tabs :tabs="[{ key, label, icon, badge, disabled }]" v-model="activeKey">
 *     <template #default="{ tab, index }">…该标签页的内容…</template>
 *   </eva-tabs>
 *
 * - 不传 v-model 时组件自己记住激活项（默认第一个可用标签）。
 * - 所有面板都保持挂载、用 v-show 切换：面板里的字段组件（编辑器、上传等）切走再切回不会丢状态。
 * - 键盘：← → 在标签间移动，Home / End 跳到首尾。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  var uid = 0;

  window.EvaUI.Tabs = {
    props: {
      tabs: { type: Array, default: function () { return []; } }, // [{ key, label, icon, badge, disabled }]
      modelValue: { type: [String, Number], default: '' },        // 当前激活 tab 的 key；留空由组件自管
      disabled: { type: Boolean, default: false }
    },
    emits: ['update:modelValue', 'change'],
    // 功能：初始化组件响应式状态与对外数据。
    data: function () {
      uid += 1;
      return { innerKey: '', baseId: 'eva-tabs-' + uid };
    },
    computed: {
      // 功能：补齐每个标签的 key，得到渲染用列表。
      items: function () {
        var self = this;
        return (this.tabs || []).map(function (tab, index) {
          return { tab: tab || {}, index: index, key: self.tabKey(tab, index) };
        });
      },
      // 功能：当前激活 key；外部传入的优先，失效（标签被移除 / 被禁用）时回落到第一个可用标签。
      activeKey: function () {
        var wanted = String(this.modelValue !== '' && this.modelValue != null ? this.modelValue : this.innerKey);
        var usable = this.items.filter(function (item) { return !item.tab.disabled; });
        var hit = usable.filter(function (item) { return item.key === wanted; })[0];
        return hit ? hit.key : (usable[0] ? usable[0].key : '');
      }
    },
    methods: {
      // 功能：多语言对象与普通字符串都取当前语言的值。
      tv: function (value) {
        return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(value) : (value == null ? '' : String(value));
      },
      // 功能：取标签的稳定 key。
      tabKey: function (tab, index) {
        tab = tab || {};
        var key = tab.key != null && tab.key !== '' ? tab.key : (tab.id != null && tab.id !== '' ? tab.id : index);
        return String(key);
      },
      // 功能：切换激活标签。
      select: function (item) {
        if (this.disabled || !item || item.tab.disabled || item.key === this.activeKey) { return; }
        this.innerKey = item.key;
        this.$emit('update:modelValue', item.key);
        this.$emit('change', item.key);
      },
      // 功能：方向键在可用标签间移动，并把焦点带过去。
      onKeydown: function (event) {
        var usable = this.items.filter(function (item) { return !item.tab.disabled; });
        if (!usable.length) { return; }
        var keys = usable.map(function (item) { return item.key; });
        var at = keys.indexOf(this.activeKey);
        var next = at;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { next = (at + 1) % usable.length; }
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { next = (at - 1 + usable.length) % usable.length; }
        else if (event.key === 'Home') { next = 0; }
        else if (event.key === 'End') { next = usable.length - 1; }
        else { return; }
        event.preventDefault();
        this.select(usable[next]);
        var self = this;
        this.$nextTick(function () {
          var button = self.$el && self.$el.querySelector ? self.$el.querySelector('#' + self.baseId + '-tab-' + usable[next].index) : null;
          if (button) { button.focus(); }
        });
      }
    },
    template: [
      '<div class="eva-tabset" :class="{ \'is-disabled\': disabled }">',
      '  <div class="eva-tabset-nav" role="tablist" @keydown="onKeydown">',
      '    <button v-for="item in items" :key="item.key" type="button" role="tab" class="eva-tabset-tab"',
      '            :id="baseId + \'-tab-\' + item.index" :aria-controls="baseId + \'-panel-\' + item.index"',
      '            :class="{ \'is-active\': item.key === activeKey }" :aria-selected="item.key === activeKey ? \'true\' : \'false\'"',
      '            :tabindex="item.key === activeKey ? 0 : -1" :disabled="disabled || item.tab.disabled" @click="select(item)">',
      '      <i v-if="item.tab.icon" class="eva-tabset-icon" :class="item.tab.icon" aria-hidden="true"></i>',
      '      <span>{{ tv(item.tab.label || item.tab.title) }}</span>',
      '      <em v-if="item.tab.badge !== undefined && item.tab.badge !== \'\'" class="eva-tabset-badge">{{ item.tab.badge }}</em>',
      '    </button>',
      '  </div>',
      '  <div v-for="item in items" v-show="item.key === activeKey" :key="item.key" class="eva-tabset-panel" role="tabpanel"',
      '       :id="baseId + \'-panel-\' + item.index" :aria-labelledby="baseId + \'-tab-\' + item.index">',
      '    <slot :tab="item.tab" :index="item.index" :active="item.key === activeKey"></slot>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
})();
