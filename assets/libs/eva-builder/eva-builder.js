/* Eva UI 库 · eva-builder：自写拖拽式布局构建器（12 栅格画布，零依赖、免构建）
 * 全局 <eva-builder>，v-model 绑定布局数组：[{ id, type, col(1-12), props:{...} }]。
 * 能力：所见即所得画布（标题/文本/图片/按钮/分隔/间距）、添加/删除/复制、拖动排序、
 *      拖拽改列宽、点选后属性面板（内容 + 通用样式）、撤销/重做历史。
 * 复用全局 <eva-select> 做下拉属性。样式见同目录 eva-builder.css。 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  var UID = 0;
  var PALETTE = [
    { type: 'heading', label: '标题', icon: 'ri-heading' },
    { type: 'text', label: '文本', icon: 'ri-text' },
    { type: 'image', label: '图片', icon: 'ri-image-line' },
    { type: 'button', label: '按钮', icon: 'ri-cursor-line' },
    { type: 'divider', label: '分隔线', icon: 'ri-separator' },
    { type: 'spacer', label: '间距', icon: 'ri-space' }
  ];
  var PAD_OPTS = { '0': '无', '8': '小', '16': '中', '24': '大' };
  var LEVEL_OPTS = { h1: '特大', h2: '大', h3: '中', h4: '小' };
  var BTN_OPTS = { primary: '主色', ghost: '描边' };
  var COL_OPTS = { '3': '1/4', '4': '1/3', '6': '1/2', '8': '2/3', '9': '3/4', '12': '整行' };

  window.EvaUI.Builder = {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    data: function () {
      return {
        palette: PALETTE, padOpts: PAD_OPTS, levelOpts: LEVEL_OPTS, btnOpts: BTN_OPTS, colOpts: COL_OPTS,
        selId: null, dragId: null, overId: null, history: [], hptr: -1
      };
    },
    mounted: function () {
      this.history = [this.clone(this.blocks)];
      this.hptr = 0;
    },
    computed: {
      blocks: function () { return Array.isArray(this.modelValue) ? this.modelValue : []; },
      selected: function () { var id = this.selId; return this.blocks.filter(function (b) { return b.id === id; })[0] || null; },
      canUndo: function () { return this.hptr > 0; },
      canRedo: function () { return this.hptr < this.history.length - 1; }
    },
    methods: {
      clone: function (x) { try { return JSON.parse(JSON.stringify(x || [])); } catch (e) { return []; } },
      // 直接更新（不记历史，用于拖拽过程中的连续变化）
      live: function (a) { this.$emit('update:modelValue', a); },
      // 提交一次离散改动并入历史栈（截断 redo 分支）
      commit: function (a) {
        this.history = this.history.slice(0, this.hptr + 1);
        this.history.push(this.clone(a));
        this.hptr = this.history.length - 1;
        this.$emit('update:modelValue', a);
      },
      undo: function () { if (this.hptr > 0) { this.hptr--; this.$emit('update:modelValue', this.clone(this.history[this.hptr])); } },
      redo: function () { if (this.hptr < this.history.length - 1) { this.hptr++; this.$emit('update:modelValue', this.clone(this.history[this.hptr])); } },
      uid: function () { return 'b' + Date.now().toString(36) + '_' + (UID++); },
      labelOf: function (t) { var p = this.palette.filter(function (x) { return x.type === t; })[0]; return p ? p.label : t; },
      add: function (t) {
        var a = this.blocks.slice();
        var nb = { id: this.uid(), type: t, col: 12, props: {} };
        a.push(nb); this.commit(a); this.selId = nb.id;
      },
      remove: function (id) {
        this.commit(this.blocks.filter(function (b) { return b.id !== id; }));
        if (this.selId === id) { this.selId = null; }
      },
      duplicate: function (b) {
        var a = this.blocks.slice();
        var i = a.findIndex(function (x) { return x.id === b.id; });
        var nb = this.clone(b); nb.id = this.uid();
        a.splice(i + 1, 0, nb); this.commit(a); this.selId = nb.id;
      },
      select: function (id) { this.selId = id; },
      setProp: function (b, k, v) {
        this.commit(this.blocks.map(function (x) {
          if (x.id !== b.id) { return x; }
          var np = Object.assign({}, x.props); np[k] = v;
          return Object.assign({}, x, { props: np });
        }));
      },
      setCol: function (id, c) {
        c = Math.max(1, Math.min(12, parseInt(c, 10) || 12));
        this.commit(this.blocks.map(function (x) { return x.id === id ? Object.assign({}, x, { col: c }) : x; }));
      },
      onDragStart: function (b, e) { this.dragId = b.id; if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; } },
      onDragOver: function (b, e) { e.preventDefault(); this.overId = b.id; },
      onDrop: function (b) {
        var f = this.dragId, t = b.id; this.dragId = null; this.overId = null;
        if (!f || f === t) { return; }
        var a = this.blocks.slice();
        var fi = a.findIndex(function (x) { return x.id === f; });
        var ti = a.findIndex(function (x) { return x.id === t; });
        if (fi < 0 || ti < 0) { return; }
        a.splice(ti, 0, a.splice(fi, 1)[0]); this.commit(a);
      },
      onDragEnd: function () { this.dragId = null; this.overId = null; },
      onResize: function (b, e) {
        e.preventDefault(); e.stopPropagation();
        var self = this; var g = this.$refs.canvas; if (!g) { return; }
        var cw = g.clientWidth / 12; var sx = e.clientX, sc = b.col || 12, last = sc;
        function build(col) { return self.blocks.map(function (x) { return x.id === b.id ? Object.assign({}, x, { col: col }) : x; }); }
        function mv(ev) {
          var c = Math.max(1, Math.min(12, sc + Math.round((ev.clientX - sx) / (cw || 1))));
          if (c !== last) { last = c; self.live(build(c)); }
        }
        function up() {
          document.removeEventListener('pointermove', mv);
          document.removeEventListener('pointerup', up);
          if (last !== sc) { self.commit(self.blocks); }
        }
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
      },
      blockStyle: function (b) {
        var p = b.props || {}; var s = {};
        if (p.align) { s.textAlign = p.align; }
        if (p.pad) { s.padding = p.pad + 'px'; }
        if (p.bg) { s.background = p.bg; }
        if (p.color) { s.color = p.color; }
        return s;
      },
      headingSize: function (b) { return ({ h1: '24px', h2: '20px', h3: '17px', h4: '14px' })[(b.props && b.props.level) || 'h3']; }
    },
    template: [
      '<div class="eva-builder">',
      '  <div class="eva-builder-bar">',
      '    <span class="eva-builder-bar-label">添加区块</span>',
      '    <button v-for="p in palette" :key="p.type" type="button" class="eva-builder-add" @click="add(p.type)"><i :class="p.icon"></i><span>{{ p.label }}</span></button>',
      '    <span class="eva-builder-bar-sp"></span>',
      '    <button type="button" class="eva-builder-add eva-builder-icobtn" :disabled="!canUndo" title="撤销" @click="undo"><i class="ri-arrow-go-back-line"></i></button>',
      '    <button type="button" class="eva-builder-add eva-builder-icobtn" :disabled="!canRedo" title="重做" @click="redo"><i class="ri-arrow-go-forward-line"></i></button>',
      '  </div>',
      '  <div ref="canvas" class="eva-builder-canvas">',
      '    <div v-for="b in blocks" :key="b.id" class="eva-builder-block" :class="[\'eva-col-\' + b.col, { \'is-over\': overId === b.id, \'is-drag\': dragId === b.id, \'is-sel\': selId === b.id }]"',
      '         draggable="true" @click="select(b.id)" @dragstart="onDragStart(b, $event)" @dragover="onDragOver(b, $event)" @drop="onDrop(b)" @dragend="onDragEnd">',
      '      <div class="eva-builder-toolbar">',
      '        <i class="eva-builder-grip ri-drag-move-2-line"></i>',
      '        <span class="eva-builder-type">{{ labelOf(b.type) }} · {{ b.col }}/12</span>',
      '        <button type="button" class="eva-builder-mini" title="复制" @click.stop="duplicate(b)"><i class="ri-file-copy-line"></i></button>',
      '        <button type="button" class="eva-builder-mini" title="删除" @click.stop="remove(b.id)"><i class="ri-delete-bin-line"></i></button>',
      '      </div>',
      '      <div class="eva-builder-preview" :style="blockStyle(b)">',
      '        <div v-if="b.type === \'heading\'" class="eva-bk-heading" :style="{ fontSize: headingSize(b) }">{{ b.props.text || \'标题文字\' }}</div>',
      '        <div v-else-if="b.type === \'text\'" class="eva-bk-text">{{ b.props.text || \'正文内容…\' }}</div>',
      '        <img v-else-if="b.type === \'image\' && b.props.url" class="eva-bk-image" :src="b.props.url" :alt="b.props.alt || \'\'" :style="{ borderRadius: (b.props.radius || 0) + \'px\' }">',
      '        <div v-else-if="b.type === \'image\'" class="eva-bk-ph"><i class="ri-image-line"></i><span>图片占位</span></div>',
      '        <span v-else-if="b.type === \'button\'" class="eva-bk-btn" :class="\'is-\' + (b.props.variant || \'primary\')">{{ b.props.text || \'按钮\' }}</span>',
      '        <div v-else-if="b.type === \'divider\'" class="eva-bk-hr"></div>',
      '        <div v-else-if="b.type === \'spacer\'" class="eva-bk-spacer" :style="{ height: (b.props.height || 24) + \'px\' }"><span>间距 {{ b.props.height || 24 }}px</span></div>',
      '      </div>',
      '      <span class="eva-builder-resize" title="拖拽改列宽" @pointerdown="onResize(b, $event)"></span>',
      '    </div>',
      '    <div v-if="!blocks.length" class="eva-builder-empty">点上方「添加区块」开始拼布局；点卡片在下方编辑内容与样式，拖动排序、拖右下角改列宽。</div>',
      '  </div>',
      '  <div v-if="selected" class="eva-builder-panel">',
      '    <div class="eva-builder-panel-head"><i class="ri-settings-4-line"></i><span>区块设置 · {{ labelOf(selected.type) }}</span><button type="button" class="eva-builder-mini" title="收起" @click="selId = null"><i class="ri-close-line"></i></button></div>',
      '    <div class="eva-builder-grid">',
      '      <label v-if="selected.type === \'heading\'" class="eva-builder-f"><span>标题文字</span><input class="eva-f-input" :value="selected.props.text" @input="setProp(selected, \'text\', $event.target.value)"></label>',
      '      <label v-if="selected.type === \'heading\'" class="eva-builder-f"><span>字号</span><eva-select :options="levelOpts" :model-value="selected.props.level || \'h3\'" @update:model-value="setProp(selected, \'level\', $event)"></eva-select></label>',
      '      <label v-if="selected.type === \'text\'" class="eva-builder-f eva-builder-f--full"><span>内容</span><textarea class="eva-f-input" rows="3" :value="selected.props.text" @input="setProp(selected, \'text\', $event.target.value)"></textarea></label>',
      '      <label v-if="selected.type === \'image\'" class="eva-builder-f"><span>图片 URL</span><input class="eva-f-input" :value="selected.props.url" @input="setProp(selected, \'url\', $event.target.value)"></label>',
      '      <label v-if="selected.type === \'image\'" class="eva-builder-f"><span>Alt 文本</span><input class="eva-f-input" :value="selected.props.alt" @input="setProp(selected, \'alt\', $event.target.value)"></label>',
      '      <label v-if="selected.type === \'image\'" class="eva-builder-f"><span>圆角(px)</span><input type="number" class="eva-f-input" :value="selected.props.radius" @input="setProp(selected, \'radius\', $event.target.value)"></label>',
      '      <label v-if="selected.type === \'button\'" class="eva-builder-f"><span>按钮文字</span><input class="eva-f-input" :value="selected.props.text" @input="setProp(selected, \'text\', $event.target.value)"></label>',
      '      <label v-if="selected.type === \'button\'" class="eva-builder-f"><span>链接 URL</span><input class="eva-f-input" :value="selected.props.url" @input="setProp(selected, \'url\', $event.target.value)"></label>',
      '      <label v-if="selected.type === \'button\'" class="eva-builder-f"><span>样式</span><eva-select :options="btnOpts" :model-value="selected.props.variant || \'primary\'" @update:model-value="setProp(selected, \'variant\', $event)"></eva-select></label>',
      '      <label v-if="selected.type === \'spacer\'" class="eva-builder-f"><span>高度(px)</span><input type="number" class="eva-f-input" :value="selected.props.height" @input="setProp(selected, \'height\', $event.target.value)"></label>',
      '      <label class="eva-builder-f"><span>列宽</span><eva-select :options="colOpts" :model-value="String(selected.col)" @update:model-value="setCol(selected.id, $event)"></eva-select></label>',
      '      <div class="eva-builder-f"><span>对齐</span><div class="eva-builder-seg">',
      '        <button type="button" :class="{ \'is-on\': (selected.props.align || \'left\') === \'left\' }" @click="setProp(selected, \'align\', \'left\')"><i class="ri-align-left"></i></button>',
      '        <button type="button" :class="{ \'is-on\': selected.props.align === \'center\' }" @click="setProp(selected, \'align\', \'center\')"><i class="ri-align-center"></i></button>',
      '        <button type="button" :class="{ \'is-on\': selected.props.align === \'right\' }" @click="setProp(selected, \'align\', \'right\')"><i class="ri-align-right"></i></button>',
      '      </div></div>',
      '      <label class="eva-builder-f"><span>内边距</span><eva-select :options="padOpts" :model-value="String(selected.props.pad || 0)" @update:model-value="setProp(selected, \'pad\', $event)"></eva-select></label>',
      '      <label class="eva-builder-f"><span>背景色</span><input class="eva-f-input" :value="selected.props.bg" @input="setProp(selected, \'bg\', $event.target.value)" placeholder="留空=无 / #fff"></label>',
      '      <label class="eva-builder-f"><span>文字色</span><input class="eva-f-input" :value="selected.props.color" @input="setProp(selected, \'color\', $event.target.value)" placeholder="留空=默认 / #333"></label>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
})();
