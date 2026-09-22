/**
 * Eva UI 库 · eva-color（颜色选择器）。
 *
 * 支持 HEX / RGBA 输出、透明度、预设色板和拖拽选择。组件只负责 UI 与字符串值，
 * 字段包装层负责把 Eva field schema 转成 props。
 */
(function () {
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  // 功能：处理 Clamp 相关逻辑。
  function Clamp(n, min, max) {
    n = Number(n);
    if (Number.isNaN(n)) { n = min; }
    return Math.min(max, Math.max(min, n));
  }

  // 功能：处理 Pad Hex 相关逻辑。
  function Pad_Hex(n) {
    var s = Clamp(Math.round(n), 0, 255).toString(16).toUpperCase();
    return s.length === 1 ? '0' + s : s;
  }

  // 功能：处理 Rgb To Hex 相关逻辑。
  function Rgb_To_Hex(rgb) {
    return '#' + Pad_Hex(rgb.r) + Pad_Hex(rgb.g) + Pad_Hex(rgb.b);
  }

  // 功能：处理 Hex To Rgb 相关逻辑。
  function Hex_To_Rgb(hex) {
    var v = String(hex || '').trim().replace(/^#/, '');
    if (v.length === 3) {
      v = v.charAt(0) + v.charAt(0) + v.charAt(1) + v.charAt(1) + v.charAt(2) + v.charAt(2);
    }
    if (!/^[0-9a-fA-F]{6}$/.test(v)) { return null; }
    return {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16)
    };
  }

  // 功能：处理 Rgb To Hsv 相关逻辑。
  function Rgb_To_Hsv(rgb) {
    var r = Clamp(rgb.r, 0, 255) / 255;
    var g = Clamp(rgb.g, 0, 255) / 255;
    var b = Clamp(rgb.b, 0, 255) / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var d = max - min;
    var h = 0;
    if (d !== 0) {
      if (max === r) {
        h = ((g - b) / d) % 6;
      } else if (max === g) {
        h = (b - r) / d + 2;
      } else {
        h = (r - g) / d + 4;
      }
      h *= 60;
      if (h < 0) { h += 360; }
    }
    return { h: h, s: max === 0 ? 0 : d / max, v: max };
  }

  // 功能：处理 Hsv To Rgb 相关逻辑。
  function Hsv_To_Rgb(h, s, v) {
    h = ((Clamp(h, 0, 360) % 360) + 360) % 360;
    s = Clamp(s, 0, 1);
    v = Clamp(v, 0, 1);
    var c = v * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = v - c;
    var r = 0;
    var g = 0;
    var b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  // 功能：处理 Parse Color 相关逻辑。
  function Parse_Color(value) {
    var raw = String(value || '').trim();
    var rgb = null;
    var alpha = 1;
    var format = /^rgba/i.test(raw) ? 'rgba' : 'hex';
    var m = raw.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
    if (m) {
      rgb = {
        r: Clamp(parseFloat(m[1]), 0, 255),
        g: Clamp(parseFloat(m[2]), 0, 255),
        b: Clamp(parseFloat(m[3]), 0, 255)
      };
      alpha = m[4] === undefined ? 1 : Clamp(parseFloat(m[4]), 0, 1);
    } else {
      rgb = Hex_To_Rgb(raw);
    }
    if (!rgb) { return null; }
    var hsv = Rgb_To_Hsv(rgb);
    return { h: hsv.h, s: hsv.s, v: hsv.v, a: alpha, format: format };
  }

  // 功能：处理 Alpha Text 相关逻辑。
  function Alpha_Text(a) {
    return String(Math.round(Clamp(a, 0, 1) * 1000) / 1000).replace(/0+$/, '').replace(/\.$/, '');
  }

  window.EvaUI.Color = {
    props: {
      modelValue: { type: String, default: '' },
      alpha: { type: Boolean, default: true },
      presets: { type: Array, default: function () { return []; } },
      placeholder: { type: String, default: '' },
      defaultValue: { type: String, default: '' },
      mode: { type: String, default: 'popover' },
      size: { type: String, default: 'medium' },
      defaultFormat: { type: String, default: 'hex' },
      formats: { type: Array, default: function () { return []; } },
      showInput: { type: Boolean, default: true },
      showFormat: { type: Boolean, default: true },
      showPresets: { type: Boolean, default: true },
      clearable: { type: Boolean, default: true },
      resettable: { type: Boolean, default: true },
      disabled: { type: Boolean, default: false },
      paletteLabel: { type: String, default: '' },
      clearText: { type: String, default: '清除' },
      applyText: { type: String, default: '应用' },
      defaultText: { type: String, default: '默认' },
      popoverWidth: { type: [String, Number], default: '' },
      boardHeight: { type: [String, Number], default: '' },
      presetShape: { type: String, default: 'square' }
    },
    emits: ['update:modelValue'],
    // 功能：初始化组件响应式状态与对外数据。
    data: function () {
      return {
        open: false,
        h: 340,
        s: 0.7,
        v: 1,
        a: 1,
        format: 'hex',
        inputText: '',
        dragging: null
      };
    },
    computed: {
      // 功能：处理 rgb 相关逻辑。
      rgb: function () {
        return Hsv_To_Rgb(this.h, this.s, this.v);
      },
      // 功能：处理 draft Text 相关逻辑。
      draftText: function () {
        if (this.format === 'rgba') {
          return 'rgba(' + this.rgb.r + ', ' + this.rgb.g + ', ' + this.rgb.b + ', ' + Alpha_Text(this.a) + ')';
        }
        return Rgb_To_Hex(this.rgb);
      },
      // 功能：处理 swatch Style 相关逻辑。
      swatchStyle: function () {
        var value = this.modelValue || this.defaultValue || this.draftText;
        return { background: value || 'transparent' };
      },
      // 功能：处理 panel Style 相关逻辑。
      panelStyle: function () {
        return { background: 'hsl(' + Math.round(this.h) + ', 100%, 50%)' };
      },
      // 功能：处理 sat Pointer Style 相关逻辑。
      satPointerStyle: function () {
        return { left: (this.s * 100) + '%', top: ((1 - this.v) * 100) + '%' };
      },
      // 功能：处理 hue Pointer Style 相关逻辑。
      huePointerStyle: function () {
        return { left: (this.h / 360 * 100) + '%' };
      },
      // 功能：处理 alpha Pointer Style 相关逻辑。
      alphaPointerStyle: function () {
        return { left: (this.a * 100) + '%' };
      },
      // 功能：处理 alpha Track Style 相关逻辑。
      alphaTrackStyle: function () {
        var rgb = this.rgb;
        return {
          background: 'linear-gradient(90deg, rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 0), rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', 1))'
        };
      },
      // 功能：判断 is Inline 状态。
      isInline: function () {
        return this.mode === 'inline';
      },
      // 功能：处理 panel Open 相关逻辑。
      panelOpen: function () {
        return this.isInline || this.open;
      },
      // 功能：处理 color Class 相关逻辑。
      colorClass: function () {
        var size = ['small', 'medium', 'large'].indexOf(this.size) !== -1 ? this.size : 'medium';
        var shape = this.presetShape === 'circle' ? 'circle' : 'square';
        return {
          'is-open': this.panelOpen,
          'is-inline': this.isInline,
          'is-disabled': this.disabled,
          'is-small': size === 'small',
          'is-large': size === 'large',
          'has-circle-presets': shape === 'circle'
        };
      },
      // 功能：处理 style Vars 相关逻辑。
      styleVars: function () {
        var out = {};
        if (this.popoverWidth) {
          out['--eva-color-popover-width'] = typeof this.popoverWidth === 'number' ? this.popoverWidth + 'px' : this.popoverWidth;
        }
        if (this.boardHeight) {
          out['--eva-color-board-height'] = typeof this.boardHeight === 'number' ? this.boardHeight + 'px' : this.boardHeight;
        }
        return out;
      },
      // 功能：处理 allowed Formats 相关逻辑。
      allowedFormats: function () {
        var raw = this.formats && this.formats.length ? this.formats : [this.defaultFormat || 'hex', 'rgba'];
        var out = [];
        raw.forEach(function (item) {
          item = String(item || '').toLowerCase();
          if (item === 'hex' || item === 'rgba') { out.push(item); }
        });
        if (!this.alpha) { out = out.filter(function (item) { return item === 'hex'; }); }
        if (!out.length) { out.push('hex'); }
        return out.filter(function (item, index) { return out.indexOf(item) === index; });
      },
      // 功能：格式化 format Options 的展示值。
      formatOptions: function () {
        var out = {};
        this.allowedFormats.forEach(function (item) { out[item] = item.toUpperCase(); });
        return out;
      },
      // 功能：判断 can Select Format 状态。
      canSelectFormat: function () {
        return this.showFormat && this.allowedFormats.length > 1;
      },
      // 功能：归一化 normalized Presets 数据结构。
      normalizedPresets: function () {
        var fallback = ['#FF4D7F', '#EF4444', '#F97316', '#FACC15', '#22C55E', '#38BDF8', '#3B82F6', '#8B5CF6', '#64748B'];
        return (this.presets && this.presets.length ? this.presets : fallback).filter(function (c) {
          return !!Parse_Color(c);
        });
      }
    },
    watch: {
      modelValue: {
        immediate: true,
        // 功能：响应监听值变化并同步组件状态。
        handler: function (value) {
          this.inputText = value || '';
          this.syncDraft(value || this.defaultValue);
        }
      },
      // 功能：处理 alpha 相关逻辑。
      alpha: function (enabled) {
        if (!enabled && this.format === 'rgba') {
          this.format = 'hex';
          this.a = 1;
        }
      },
      // 功能：处理 allowed Formats 相关逻辑。
      allowedFormats: function () {
        if (this.allowedFormats.indexOf(this.format) === -1) {
          this.format = this.allowedFormats[0] || 'hex';
        }
      }
    },
    // 功能：组件挂载后执行初始化和事件绑定。
    mounted: function () {
      document.addEventListener('mousedown', this.onDocumentDown, true);
      document.addEventListener('touchstart', this.onDocumentDown, true);
    },
    // 功能：组件销毁前清理事件、计时器或临时状态。
    beforeUnmount: function () {
      this.stopDrag();
      document.removeEventListener('mousedown', this.onDocumentDown, true);
      document.removeEventListener('touchstart', this.onDocumentDown, true);
    },
    methods: {
      // 功能：处理 sync Draft 相关逻辑。
      syncDraft: function (value) {
        var parsed = Parse_Color(value);
        if (!parsed) {
          var desired = String(this.defaultFormat || this.format || 'hex').toLowerCase();
          this.format = this.allowedFormats.indexOf(desired) !== -1 ? desired : (this.allowedFormats[0] || 'hex');
          return;
        }
        this.h = parsed.h;
        this.s = parsed.s;
        this.v = parsed.v;
        this.a = this.alpha ? parsed.a : 1;
        this.format = this.allowedFormats.indexOf(parsed.format) !== -1 ? parsed.format : (this.allowedFormats[0] || 'hex');
      },
      // 功能：切换 toggle 状态。
      toggle: function () {
        if (this.disabled || this.isInline) { return; }
        this.open = !this.open;
        if (this.open) { this.syncDraft(this.modelValue || this.defaultValue); }
      },
      // 功能：关闭 close 相关界面或状态。
      close: function () {
        this.open = false;
      },
      // 功能：处理 on Document Down 相关逻辑。
      onDocumentDown: function (event) {
        if (this.isInline || !this.open || !this.$el || this.$el.contains(event.target)) { return; }
        this.close();
      },
      // 功能：处理 commit Text 相关逻辑。
      commitText: function () {
        if (this.disabled) { return; }
        var parsed = Parse_Color(this.inputText);
        if (!parsed) {
          this.inputText = this.modelValue || '';
          return;
        }
        this.syncDraft(this.inputText);
        this.apply();
      },
      // 功能：重置 reset 相关状态。
      reset: function () {
        if (this.disabled) { return; }
        var value = this.defaultValue || '';
        this.$emit('update:modelValue', value);
        this.inputText = value;
        this.syncDraft(value);
      },
      // 功能：清空 clear 相关状态。
      clear: function () {
        if (this.disabled) { return; }
        this.$emit('update:modelValue', '');
        this.inputText = '';
        if (!this.isInline) { this.close(); }
      },
      // 功能：处理 apply 相关逻辑。
      apply: function () {
        if (this.disabled) { return; }
        var value = this.draftText;
        this.$emit('update:modelValue', value);
        this.inputText = value;
        if (!this.isInline) { this.close(); }
      },
      // 功能：更新 set Format Value 对应状态。
      setFormatValue: function (value) {
        if (this.disabled) { return; }
        this.format = this.allowedFormats.indexOf(value) !== -1 ? value : (this.allowedFormats[0] || 'hex');
      },
      // 功能：更新 set Preset 对应状态。
      setPreset: function (color) {
        if (this.disabled) { return; }
        this.syncDraft(color);
      },
      // 功能：处理 point 相关逻辑。
      point: function (event, el) {
        var e = event.touches && event.touches.length ? event.touches[0] : event;
        var rect = el.getBoundingClientRect();
        return {
          x: Clamp((e.clientX - rect.left) / rect.width, 0, 1),
          y: Clamp((e.clientY - rect.top) / rect.height, 0, 1)
        };
      },
      // 功能：更新 set Sv 对应状态。
      setSv: function (event) {
        var p = this.point(event, event.currentTarget || this.dragging.el);
        this.s = p.x;
        this.v = 1 - p.y;
      },
      // 功能：更新 set Hue 对应状态。
      setHue: function (event) {
        var p = this.point(event, event.currentTarget || this.dragging.el);
        this.h = p.x * 360;
      },
      // 功能：更新 set Alpha 对应状态。
      setAlpha: function (event) {
        if (!this.alpha) { return; }
        var p = this.point(event, event.currentTarget || this.dragging.el);
        this.a = p.x;
      },
      // 功能：处理 start Drag 相关逻辑。
      startDrag: function (event, kind) {
        if (this.disabled) { return; }
        event.preventDefault();
        var el = event.currentTarget;
        var self = this;
        var move = function (e) {
          if (kind === 'sv') { self.setSvWithEl(e, el); }
          if (kind === 'hue') { self.setHueWithEl(e, el); }
          if (kind === 'alpha') { self.setAlphaWithEl(e, el); }
        };
        var up = function () { self.stopDrag(); };
        this.dragging = { move: move, up: up };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', up);
        move(event);
      },
      // 功能：更新 set Sv With El 对应状态。
      setSvWithEl: function (event, el) {
        var p = this.point(event, el);
        this.s = p.x;
        this.v = 1 - p.y;
      },
      // 功能：更新 set Hue With El 对应状态。
      setHueWithEl: function (event, el) {
        var p = this.point(event, el);
        this.h = p.x * 360;
      },
      // 功能：更新 set Alpha With El 对应状态。
      setAlphaWithEl: function (event, el) {
        if (!this.alpha) { return; }
        var p = this.point(event, el);
        this.a = p.x;
      },
      // 功能：处理 stop Drag 相关逻辑。
      stopDrag: function () {
        if (!this.dragging) { return; }
        document.removeEventListener('mousemove', this.dragging.move);
        document.removeEventListener('mouseup', this.dragging.up);
        document.removeEventListener('touchmove', this.dragging.move);
        document.removeEventListener('touchend', this.dragging.up);
        this.dragging = null;
      }
    },
    template: [
      '<div class="eva-color" :class="colorClass" :style="styleVars">',
      '  <div class="eva-color-control">',
      '    <button type="button" class="eva-color-swatch" :disabled="disabled" :style="swatchStyle" @click="toggle" aria-label="选择颜色"></button>',
      '    <input v-if="showInput" class="eva-color-input" :disabled="disabled" :placeholder="placeholder || \'#FF4D7F\'" v-model="inputText" @change="commitText" @keydown.enter.prevent="commitText">',
      '    <div v-if="canSelectFormat" class="eva-color-format"><eva-select :options="formatOptions" :searchable="false" :model-value="format" @update:model-value="setFormatValue"></eva-select></div>',
      '    <button v-if="resettable" type="button" class="eva-color-reset" :disabled="disabled" @click="reset">{{ defaultText }}</button>',
      '  </div>',
      '  <div v-show="panelOpen" class="eva-color-popover">',
      '    <div class="eva-color-pop-head">',
      '      <span class="eva-color-pop-swatch" :style="{ background: draftText }"></span>',
      '      <strong>{{ draftText }}</strong>',
      '      <span>{{ format.toUpperCase() }}</span>',
      '    </div>',
      '    <div class="eva-color-board" :style="panelStyle" @mousedown="startDrag($event, \'sv\')" @touchstart="startDrag($event, \'sv\')">',
      '      <span class="eva-color-board-white"></span>',
      '      <span class="eva-color-board-black"></span>',
      '      <span class="eva-color-pointer" :style="satPointerStyle"></span>',
      '    </div>',
      '    <div class="eva-color-slider eva-color-hue" @mousedown="startDrag($event, \'hue\')" @touchstart="startDrag($event, \'hue\')">',
      '      <span class="eva-color-slider-point" :style="huePointerStyle"></span>',
      '    </div>',
      '    <div v-if="alpha" class="eva-color-slider eva-color-alpha" @mousedown="startDrag($event, \'alpha\')" @touchstart="startDrag($event, \'alpha\')">',
      '      <span class="eva-color-alpha-bg"></span>',
      '      <span class="eva-color-alpha-fill" :style="alphaTrackStyle"></span>',
      '      <span class="eva-color-slider-point" :style="alphaPointerStyle"></span>',
      '      <em>{{ Math.round(a * 100) }}%</em>',
      '    </div>',
      '    <div v-if="showPresets" class="eva-color-presets-wrap">',
      '      <div v-if="paletteLabel" class="eva-color-presets-title">{{ paletteLabel }}</div>',
      '      <div class="eva-color-presets">',
      '      <button v-for="preset in normalizedPresets" :key="preset" type="button" :style="{ background: preset }" @click="setPreset(preset)" :aria-label="preset"></button>',
      '      </div>',
      '    </div>',
      '    <div class="eva-color-actions">',
      '      <button v-if="clearable" type="button" class="eva-color-btn" :disabled="disabled" @click="clear">{{ clearText }}</button>',
      '      <button type="button" class="eva-color-btn is-primary" :disabled="disabled" @click="apply">{{ applyText }}</button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
})();
