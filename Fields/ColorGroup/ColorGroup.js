/**
 * Eva 字段：color_group。
 *
 * 用途：
 * - 管理一组颜色值，默认返回颜色字符串数组；开启 named 时返回 [{ color, label }] 数组。
 *
 * 字段配置：
 * - `default_color`：点击“添加颜色”时的新颜色，默认 #FF4D7F。
 * - `presets`：预设色板，渲染为可点选色块，点一下即把该色加入色组（show_presets=false 可隐藏）。
 * - `max_colors` / `min_colors`：数量上下限；到上限禁止添加、到下限禁止删除。
 * - `sortable`：拖拽排序。
 * - `required`：标题旁显示必填标记。
 * - `alpha`：支持透明度，颜色存为 8 位 HEX(#RRGGBBAA)，每个色块附带透明度滑块。
 * - `named`：为每个颜色命名，值改为 [{ color, label }] 数组。
 * - `show_hex`：每个颜色显示可编辑的 HEX 输入框。
 * - `copyable`：每个颜色提供“复制”按钮，复制色值到剪贴板。
 * - `clearable` / `resettable`：显示“清空 / 重置为默认”工具按钮。
 * - `show_count`：标题旁显示数量（配合 max_colors 显示 当前/上限）。
 * - `schemes`：整组配色方案 [{ label, colors:[...] }]，一键套用一整组颜色。
 * - `disabled`：只读展示，不可增删改。
 */
(function () {
  window.EvaFields = window.EvaFields || {};

  // 功能：处理 To Hex 2 相关逻辑。
  function To_Hex_2(n) {
    n = Math.max(0, Math.min(255, Math.round(n)));
    return ('0' + n.toString(16)).slice(-2).toUpperCase();
  }

  // 功能：处理 Valid Color 相关逻辑。
  function Valid_Color(value) {
    var v = String(value == null ? '' : value).trim();
    if (/^#([0-9a-fA-F]{8})$/.test(v)) { return v.toUpperCase(); }
    if (/^#([0-9a-fA-F]{6})$/.test(v)) { return v.toUpperCase(); }
    if (/^#([0-9a-fA-F]{3})$/.test(v)) {
      return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toUpperCase();
    }
    return '#FF4D7F';
  }

  // 功能：处理 Norm Items 相关逻辑。
  function Norm_Items(value) {
    if (!Array.isArray(value)) { return []; }
    return value.map(function (it) {
      if (it && typeof it === 'object') {
        return { color: Valid_Color(it.color != null ? it.color : it.value), label: String(it.label || it.name || '') };
      }
      return { color: Valid_Color(it), label: '' };
    });
  }

  window.EvaFields.color_group = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    // 功能：初始化组件响应式状态与对外数据。
    data: function () {
      return { dragIndex: null, copiedIndex: null };
    },
    computed: {
      // 功能：处理 items 相关逻辑。
      items: function () { return Norm_Items(this.modelValue); },
      // 功能：处理 presets 相关逻辑。
      presets: function () {
        return Array.isArray(this.field.presets) && this.field.presets.length
          ? this.field.presets
          : ['#FF4D7F', '#FF6B6B', '#FFD166', '#06D6A0', '#4D96FF', '#9B5DE5'];
      },
      // 功能：判断 has Presets 状态。
      hasPresets: function () {
        return this.field.show_presets !== false && this.field.showPresets !== false && this.presets.length > 0;
      },
      // 功能：处理 schemes 相关逻辑。
      schemes: function () { return Array.isArray(this.field.schemes) ? this.field.schemes : []; },
      // 功能：处理 max Colors 相关逻辑。
      maxColors: function () { return Math.max(0, Number(this.field.max_colors || this.field.maxColors || 0)); },
      // 功能：处理 min Colors 相关逻辑。
      minColors: function () { return Math.max(0, Number(this.field.min_colors || this.field.minColors || 0)); },
      // 功能：处理 default Color 相关逻辑。
      defaultColor: function () { return Valid_Color(this.field.default_color || this.field.defaultColor || '#FF4D7F'); },
      // 功能：判断 is Disabled 状态。
      isDisabled: function () { return this.field.disabled === true || this.field.disabled === 'true'; },
      // 功能：处理 alpha 相关逻辑。
      alpha: function () { return this.field.alpha === true || this.field.alpha === 'true'; },
      // 功能：处理 named 相关逻辑。
      named: function () { return this.field.named === true || this.field.named === 'true'; },
      // 功能：处理 show Hex 相关逻辑。
      showHex: function () { return this.field.show_hex === true || this.field.showHex === true; },
      // 功能：处理 copyable 相关逻辑。
      copyable: function () { return this.field.copyable === true || this.field.copyable === 'true'; },
      // 功能：清空 clearable 相关状态。
      clearable: function () { return this.field.clearable === true || this.field.clearable === 'true'; },
      // 功能：重置 resettable 相关状态。
      resettable: function () { return (this.field.resettable === true || this.field.resettable === 'true') && Array.isArray(this.field.default); },
      // 功能：处理 show Count 相关逻辑。
      showCount: function () { return this.field.show_count !== false && (this.maxColors > 0 || this.field.show_count === true); },
      // 功能：判断 can Add 状态。
      canAdd: function () { return !this.isDisabled && (!this.maxColors || this.items.length < this.maxColors); },
      // 功能：判断 can Remove 状态。
      canRemove: function () { return !this.isDisabled && this.items.length > this.minColors; }
    },
    methods: {
      // 功能：处理 tv 相关逻辑。
      tv: function (value) {
        return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(value) : (value || '');
      },
      // 功能：处理 title Text 相关逻辑。
      titleText: function () {
        return this.tv(this.field.group_title || this.field.groupTitle || this.field.title || '品牌色组');
      },
      // 功能：处理 desc Text 相关逻辑。
      descText: function () {
        return this.tv(this.field.group_desc || this.field.groupDesc || this.field.desc || '用于主题配色、图表颜色或模块强调色配置。');
      },
      // 功能：处理 base6 相关逻辑。
      base6: function (color) {
        var c = Valid_Color(color);
        return c.slice(0, 7);
      },
      // 功能：处理 alpha Of 相关逻辑。
      alphaOf: function (color) {
        var c = Valid_Color(color);
        if (c.length === 9) { return Math.round(parseInt(c.slice(7, 9), 16) / 255 * 100); }
        return 100;
      },
      // 功能：处理 with Alpha 相关逻辑。
      withAlpha: function (color, percent) {
        return this.base6(color) + To_Hex_2(percent / 100 * 255);
      },
      // 功能：处理 emit 相关逻辑。
      emit: function (items) {
        var named = this.named;
        this.$emit('update:modelValue', items.map(function (i) {
          return named ? { color: i.color, label: i.label } : i.color;
        }));
      },
      // 功能：处理 clone Items 相关逻辑。
      cloneItems: function () {
        return this.items.map(function (i) { return { color: i.color, label: i.label }; });
      },
      // 功能：处理 add Color 相关逻辑。
      addColor: function () {
        if (!this.canAdd) { return; }
        var next = this.cloneItems();
        next.push({ color: this.alpha ? this.withAlpha(this.defaultColor, 100) : this.base6(this.defaultColor), label: '' });
        this.emit(next);
      },
      // 功能：处理 add Preset 相关逻辑。
      addPreset: function (preset) {
        if (!this.canAdd) { return; }
        var next = this.cloneItems();
        next.push({ color: this.alpha ? (Valid_Color(preset).length === 9 ? Valid_Color(preset) : this.withAlpha(preset, 100)) : this.base6(preset), label: '' });
        this.emit(next);
      },
      // 功能：更新 update Color 对应状态。
      updateColor: function (index, value) {
        var next = this.cloneItems();
        if (!next[index]) { return; }
        next[index].color = this.alpha ? this.withAlpha(value, this.alphaOf(next[index].color)) : Valid_Color(value).slice(0, 7);
        this.emit(next);
      },
      // 功能：更新 update Hex 对应状态。
      updateHex: function (index, value) {
        var next = this.cloneItems();
        if (!next[index]) { return; }
        var c = Valid_Color(value);
        next[index].color = this.alpha ? c : c.slice(0, 7);
        this.emit(next);
      },
      // 功能：更新 update Alpha 对应状态。
      updateAlpha: function (index, percent) {
        var next = this.cloneItems();
        if (!next[index]) { return; }
        next[index].color = this.withAlpha(next[index].color, Number(percent));
        this.emit(next);
      },
      // 功能：更新 update Label 对应状态。
      updateLabel: function (index, value) {
        var next = this.cloneItems();
        if (!next[index]) { return; }
        next[index].label = String(value);
        this.emit(next);
      },
      // 功能：移除 remove Color 对应条目。
      removeColor: function (index) {
        if (!this.canRemove) { return; }
        var next = this.cloneItems();
        next.splice(index, 1);
        this.emit(next);
      },
      // 功能：清空 clear All 相关状态。
      clearAll: function () {
        if (this.isDisabled) { return; }
        this.emit([]);
      },
      // 功能：重置 reset Default 相关状态。
      resetDefault: function () {
        if (this.isDisabled) { return; }
        this.emit(Norm_Items(this.field.default));
      },
      // 功能：处理 apply Scheme 相关逻辑。
      applyScheme: function (scheme) {
        if (this.isDisabled || !scheme || !Array.isArray(scheme.colors)) { return; }
        var self = this;
        var colors = scheme.colors.map(function (c) { return { color: self.alpha ? (Valid_Color(c).length === 9 ? Valid_Color(c) : self.withAlpha(c, 100)) : self.base6(c), label: '' }; });
        if (this.maxColors) { colors = colors.slice(0, this.maxColors); }
        this.emit(colors);
      },
      // 功能：处理 copy Color 相关逻辑。
      copyColor: function (index) {
        var item = this.items[index];
        if (!item) { return; }
        var self = this;
        var done = function () { self.copiedIndex = index; setTimeout(function () { if (self.copiedIndex === index) { self.copiedIndex = null; } }, 1200); };
        if (window.navigator && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(item.color).then(done).catch(done);
        } else {
          done();
        }
      },
      // 功能：处理 drag Start 相关逻辑。
      dragStart: function (index) {
        if (!this.field.sortable || this.isDisabled) { return; }
        this.dragIndex = index;
      },
      // 功能：处理 drop Color 相关逻辑。
      dropColor: function (index) {
        if (this.dragIndex === null || this.dragIndex === index) { this.dragIndex = null; return; }
        var next = this.cloneItems();
        var item = next.splice(this.dragIndex, 1)[0];
        next.splice(index, 0, item);
        this.dragIndex = null;
        this.emit(next);
      }
    },
    template: [
      '<div class="eva-color-group" :class="{ \'is-empty\': !items.length, \'is-disabled\': isDisabled, \'is-rich\': showHex || named || alpha }">',
      '  <div class="eva-cg-head">',
      '    <strong>{{ titleText() }}<i v-if="field.required" class="eva-cg-req">*</i></strong>',
      '    <span class="eva-cg-tools">',
      '      <span v-if="showCount" class="eva-cg-count">{{ items.length }}<template v-if="maxColors"> / {{ maxColors }}</template></span>',
      '      <button v-if="resettable && !isDisabled" type="button" class="eva-cg-tool" @click="resetDefault"><i class="ri-refresh-line"></i>重置</button>',
      '      <button v-if="clearable && !isDisabled && items.length" type="button" class="eva-cg-tool" @click="clearAll"><i class="ri-eraser-line"></i>清空</button>',
      '    </span>',
      '  </div>',
      '  <div class="eva-cg-palette">',
      '    <div v-for="(item, index) in items" :key="index" class="eva-cg-chip" :class="{ \'is-dragging\': dragIndex === index }" :draggable="!!field.sortable && !isDisabled" @dragstart="dragStart(index)" @dragover.prevent @drop="dropColor(index)">',
      '      <span class="eva-cg-swatch" :style="{ background: item.color }">',
      '        <input type="color" :value="base6(item.color)" @input="updateColor(index, $event.target.value)" :disabled="isDisabled" :aria-label="item.color">',
      '      </span>',
      '      <div v-if="showHex || named || alpha" class="eva-cg-fields">',
      '        <input v-if="showHex" type="text" class="eva-cg-hex" :value="item.color" @change="updateHex(index, $event.target.value)" :disabled="isDisabled" spellcheck="false">',
      '        <input v-if="named" type="text" class="eva-cg-label" :value="item.label" @input="updateLabel(index, $event.target.value)" placeholder="命名" :disabled="isDisabled">',
      '        <label v-if="alpha" class="eva-cg-alpha"><input type="range" min="0" max="100" :value="alphaOf(item.color)" @input="updateAlpha(index, $event.target.value)" :disabled="isDisabled"><span>{{ alphaOf(item.color) }}%</span></label>',
      '      </div>',
      '      <div class="eva-cg-chip-actions">',
      '        <button v-if="copyable" type="button" class="eva-cg-copy" :class="{ \'is-done\': copiedIndex === index }" @click.stop="copyColor(index)" aria-label="复制色值"><i :class="copiedIndex === index ? \'ri-check-line\' : \'ri-file-copy-line\'"></i></button>',
      '        <button v-if="canRemove" type="button" class="eva-cg-remove" @click.stop="removeColor(index)" aria-label="删除颜色">×</button>',
      '      </div>',
      '    </div>',
      '    <button v-if="canAdd" type="button" class="eva-cg-add" @click="addColor" aria-label="添加颜色" title="添加颜色"><i class="ri-add-line"></i><span>添加颜色</span></button>',
      '  </div>',
      '  <div v-if="hasPresets && !isDisabled" class="eva-cg-presets">',
      '    <span class="eva-cg-presets-label">{{ tv(field.palette_label) || \'预设色板\' }}</span>',
      '    <div class="eva-cg-presets-list">',
      '      <button v-for="(preset, pi) in presets" :key="pi" type="button" class="eva-cg-preset" :style="{ background: preset }" :disabled="!canAdd" :title="preset" @click="addPreset(preset)"></button>',
      '    </div>',
      '  </div>',
      '  <div v-if="schemes.length && !isDisabled" class="eva-cg-schemes">',
      '    <button v-for="(scheme, si) in schemes" :key="si" type="button" class="eva-cg-scheme" @click="applyScheme(scheme)">',
      '      <span class="eva-cg-scheme-dots"><span v-for="(c, ci) in scheme.colors.slice(0, 5)" :key="ci" :style="{ background: c }"></span></span>',
      '      <span class="eva-cg-scheme-label">{{ tv(scheme.label) }}</span>',
      '    </button>',
      '  </div>',
      '  <p class="eva-cg-desc">{{ descText() }}</p>',
      '</div>'
    ].join('\n')
  };
})();
