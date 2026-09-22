/**
 * Eva 字段：image_select。
 *
 * 用途：
 * - 用图片缩略图表达一组选项，适合布局、风格、封面模板等视觉化配置。
 * - 单选返回 value 字符串；多选返回 value 数组。
 *
 * 字段配置：
 * - `options`：选项表，支持 `{ key: { label, url, desc, badge, badge_tone, group, disabled } }` 或 `[{ value, label, url, ... }]`。
 * - `columns`：期望列数，默认自适应；`min_width` 可控制卡片最小宽度。
 * - `columns_sm` / `columns_md` / `columns_lg`：按容器宽度响应式列数（窄屏自动减少列）。
 * - `size`（small/medium/large，别名 `card_size`）：一键设定卡片大小（固定卡片宽度，自动换行）；设置了 `columns` 或 `min_width` 时以它们为准。
 * - `aspect_ratio` / `preview_height` / `object_fit`：控制缩略图比例、高度与裁切方式。
 * - `show_label` / `show_desc` / `zoom`：控制标题、描述与放大预览。
 * - `multiple`：开启多选；`max` 限制最多可选数量（0=不限）。
 * - `clearable`：可清除——单选再点一次取消、并提供“清除”按钮。
 * - `searchable`（别名 `search`）：顶部显示搜索框，按标题/描述过滤选项。
 * - `media`（别名 `allow_upload`）：显示“媒体库”按钮，从 WordPress 媒体库挑图加入选项。
 * - `lazy`（别名 `lazy_load`）：图片懒加载并显示加载骨架。
 * - `disabled`：禁用整个字段；单个 option 也可设置 disabled。
 * - 无障碍：卡片支持方向键（←→↑↓ / Home / End）移动焦点，Enter / Space 选择。
 */
(function () {
  window.EvaFields = window.EvaFields || {};

  // 功能：处理 Tv 相关逻辑。
  function Tv(value) {
    return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(value) : (value || '');
  }

  // 功能：处理 Css Size 相关逻辑。
  function Css_Size(value) {
    if (value == null || value === '') { return ''; }
    return /^\d+$/.test(String(value)) ? String(value) + 'px' : String(value);
  }

  // 功能：处理 Css Ratio 相关逻辑。
  function Css_Ratio(value) {
    if (value == null || value === '') { return '16 / 9'; }
    return String(value).replace(':', ' / ');
  }

  // 功能：归一化 Normalize Option 数据结构。
  function Normalize_Option(key, item, index) {
    var isObject = item && typeof item === 'object' && !Array.isArray(item);
    var value = isObject
      ? (item.value != null ? item.value : (item.id != null ? item.id : key))
      : (typeof key === 'string' ? key : item);

    if (value == null || value === '') {
      value = index;
    }

    return {
      value: String(value),
      label: isObject ? (item.label || item.title || value) : (typeof key === 'string' ? key : value),
      desc: isObject ? (item.desc || item.description || '') : '',
      url: isObject ? (item.url || item.image || item.src || item.thumbnail || '') : (typeof item === 'string' ? item : ''),
      badge: isObject ? (item.badge || '') : '',
      badgeTone: isObject ? (item.badge_tone || item.badgeTone || '') : '',
      group: isObject ? (item.group || item.group_label || item.groupLabel || '') : '',
      disabled: !!(isObject && item.disabled)
    };
  }

  // 功能：归一化 Normalize List 数据结构。
  function Normalize_List(raw) {
    if (Array.isArray(raw)) {
      return raw.map(function (item, index) { return Normalize_Option(index, item, index); });
    }
    if (raw && typeof raw === 'object') {
      return Object.keys(raw).map(function (key, index) { return Normalize_Option(key, raw[key], index); });
    }
    return [];
  }

  window.EvaFields.image_select = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    // 功能：初始化组件响应式状态与对外数据。
    data: function () {
      return { zoomOption: null, query: '', loaded: {}, rootWidth: 0, extraOptions: [], ro: null };
    },
    computed: {
      // 功能：判断 is Multiple 状态。
      isMultiple: function () { return this.field.multiple === true || this.field.multiple === 'true'; },
      // 功能：处理 max Count 相关逻辑。
      maxCount: function () {
        var m = parseInt(this.field.max || this.field.max_select || this.field.maxSelect || 0, 10);
        return m > 0 ? m : 0;
      },
      // 功能：清空 clearable 相关状态。
      clearable: function () { return this.field.clearable === true || this.field.clearable === 'true'; },
      // 功能：处理 searchable 相关逻辑。
      searchable: function () { return this.field.searchable === true || this.field.search === true; },
      // 功能：处理 lazy 相关逻辑。
      lazy: function () { return this.field.lazy === true || this.field.lazy_load === true || this.field.lazyLoad === true; },
      // 功能：处理 media Enabled 相关逻辑。
      mediaEnabled: function () { return this.field.media === true || this.field.allow_upload === true || this.field.allowUpload === true; },
      // 功能：处理 show Label 相关逻辑。
      showLabel: function () { return this.field.show_label !== false && this.field.showLabel !== false; },
      // 功能：处理 show Desc 相关逻辑。
      showDesc: function () { return this.field.show_desc !== false && this.field.showDesc !== false; },
      // 功能：处理 zoom Enabled 相关逻辑。
      zoomEnabled: function () { return this.field.zoom !== false && this.field.lightbox !== false; },
      // 功能：处理 base Options 相关逻辑。
      baseOptions: function () { return Normalize_List(this.field.options || []); },
      // 功能：处理 options 相关逻辑。
      options: function () { return this.baseOptions.concat(this.extraOptions); },
      // 功能：处理 filtered Options 相关逻辑。
      filteredOptions: function () {
        var q = (this.query || '').trim().toLowerCase();
        if (!q) { return this.options; }
        return this.options.filter(function (o) {
          return (Tv(o.label) + ' ' + Tv(o.desc) + ' ' + o.value).toLowerCase().indexOf(q) !== -1;
        });
      },
      // 功能：判断 has Groups 状态。
      hasGroups: function () { return this.options.some(function (o) { return !!o.group; }); },
      // 功能：处理 grouped Options 相关逻辑。
      groupedOptions: function () {
        var groups = [];
        var map = {};
        this.filteredOptions.forEach(function (o) {
          var key = o.group || '';
          if (!map[key]) { map[key] = { label: key, options: [] }; groups.push(map[key]); }
          map[key].options.push(o);
        });
        return groups;
      },
      // 功能：处理 selected Values 相关逻辑。
      selectedValues: function () {
        var v = this.modelValue;
        if (Array.isArray(v)) { return v.map(function (x) { return String(x); }); }
        if (v == null || v === '') { return []; }
        return [String(v)];
      },
      // 功能：处理 selected Count 相关逻辑。
      selectedCount: function () { return this.selectedValues.length; },
      // 功能：判断 has Selection 状态。
      hasSelection: function () { return this.selectedCount > 0; },
      // 功能：处理 resolved Columns 相关逻辑。
      resolvedColumns: function () {
        var sm = parseInt(this.field.columns_sm || this.field.columnsSm || 0, 10);
        var md = parseInt(this.field.columns_md || this.field.columnsMd || 0, 10);
        var lg = parseInt(this.field.columns_lg || this.field.columnsLg || 0, 10);
        if (sm || md || lg) {
          var w = this.rootWidth || 0;
          if (w && w <= 420) { return sm || md || lg; }
          if (w && w <= 720) { return md || lg || sm; }
          return lg || md || sm;
        }
        return parseInt(this.field.columns || this.field.cols || 0, 10);
      },
      // 功能：处理 grid Style 相关逻辑。
      gridStyle: function () {
        var columns = this.resolvedColumns;
        var explicitMinWidth = this.field.min_width || this.field.minWidth;
        var sizeKey = String(this.field.size || this.field.card_size || this.field.cardSize || '').toLowerCase();
        var sizePresets = { small: '96px', medium: '128px', large: '176px' };
        var previewHeight = Css_Size(this.field.preview_height || this.field.previewHeight || this.field.image_height || this.field.imageHeight);
        var style = {
          '--eva-is-ratio': Css_Ratio(this.field.aspect_ratio || this.field.aspectRatio || this.field.ratio),
          '--eva-is-fit': this.field.object_fit || this.field.objectFit || this.field.fit || 'cover'
        };
        if (previewHeight) {
          style['--eva-is-height'] = previewHeight;
        }
        if (columns > 0) {
          style.gridTemplateColumns = 'repeat(' + columns + ', minmax(0, 1fr))';
          return style;
        }
        // size / card_size：按预设给出固定卡片宽度，卡片不被拉伸、自动左对齐换行（显式 min_width 优先级更高）。
        if (!explicitMinWidth && sizePresets[sizeKey]) {
          style.gridTemplateColumns = 'repeat(auto-fill, ' + sizePresets[sizeKey] + ')';
          style.justifyContent = 'start';
          return style;
        }
        style.gridTemplateColumns = 'repeat(auto-fit, minmax(' + Css_Size(explicitMinWidth || '138px') + ', 1fr))';
        return style;
      },
      // 功能：处理 show Toolbar 相关逻辑。
      showToolbar: function () { return this.searchable || this.clearable || this.mediaEnabled || this.isMultiple; }
    },
    methods: {
      Tv: Tv,
      // 功能：判断 is Selected 状态。
      isSelected: function (option) { return this.selectedValues.indexOf(option.value) !== -1; },
      // 功能：处理 at Max 相关逻辑。
      atMax: function () { return this.isMultiple && this.maxCount > 0 && this.selectedCount >= this.maxCount; },
      // 功能：处理 emit Value 相关逻辑。
      emitValue: function (val) { this.$emit('update:modelValue', val); },
      // 功能：处理 select Value 相关逻辑。
      selectValue: function (value, forceOn) {
        value = String(value);
        if (this.isMultiple) {
          var arr = this.selectedValues.slice();
          var i = arr.indexOf(value);
          if (i !== -1 && !forceOn) {
            arr.splice(i, 1);
          } else if (i === -1) {
            if (this.maxCount > 0 && arr.length >= this.maxCount) { return; }
            arr.push(value);
          }
          this.emitValue(arr);
        } else {
          if (!forceOn && this.clearable && String(this.modelValue == null ? '' : this.modelValue) === value) {
            this.emitValue('');
          } else {
            this.emitValue(value);
          }
        }
      },
      // 功能：处理 choose 相关逻辑。
      choose: function (option) {
        if (this.field.disabled || option.disabled) { return; }
        this.selectValue(option.value, false);
      },
      // 功能：清空 clear All 相关状态。
      clearAll: function () {
        if (this.field.disabled) { return; }
        this.emitValue(this.isMultiple ? [] : '');
      },
      // 功能：处理 on Img Load 相关逻辑。
      onImgLoad: function (option) { this.loaded[option.value] = true; },
      // 功能：判断 is Loaded 状态。
      isLoaded: function (option) { return !this.lazy || this.loaded[option.value] === true; },
      // 功能：打开 open Zoom 相关界面或状态。
      openZoom: function (option) { if (option.url) { this.zoomOption = option; } },
      // 功能：关闭 close Zoom 相关界面或状态。
      closeZoom: function () { this.zoomOption = null; },
      // 功能：处理 on Card Key 相关逻辑。
      onCardKey: function (e, option) {
        var k = e.key;
        if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
          e.preventDefault();
          this.choose(option);
          return;
        }
        if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(k) !== -1) {
          this.onNavKey(e);
        }
      },
      // 功能：处理 on Nav Key 相关逻辑。
      onNavKey: function (e) {
        if (!this.$el || !this.$el.querySelectorAll) { return; }
        var cards = Array.prototype.slice.call(this.$el.querySelectorAll('.eva-is-card')).filter(function (c) {
          return c.getAttribute('tabindex') !== '-1';
        });
        if (!cards.length) { return; }
        var idx = cards.indexOf(e.currentTarget);
        if (idx === -1) { return; }
        var next = idx;
        var k = e.key;
        if (k === 'ArrowRight' || k === 'ArrowDown') { next = idx + 1; }
        else if (k === 'ArrowLeft' || k === 'ArrowUp') { next = idx - 1; }
        else if (k === 'Home') { next = 0; }
        else if (k === 'End') { next = cards.length - 1; }
        if (next < 0) { next = 0; }
        if (next > cards.length - 1) { next = cards.length - 1; }
        e.preventDefault();
        if (cards[next] && cards[next].focus) { cards[next].focus(); }
      },
      // 功能：处理 pick From Media 相关逻辑。
      pickFromMedia: function () {
        var self = this;
        if (!(window.wp && window.wp.media)) {
          if (window.console) { console.warn('Eva image_select：wp.media 不可用，无法打开媒体库。'); }
          return;
        }
        var frame = window.wp.media({
          title: Tv(self.field.media_title) || '选择图片',
          library: { type: 'image' },
          multiple: self.isMultiple
        });
        frame.on('select', function () {
          var selection = frame.state().get('selection').toJSON();
          selection.forEach(function (att) {
            var val = 'media-' + att.id;
            var exists = self.options.some(function (o) { return o.value === val; });
            if (!exists) {
              var sized = att.sizes && (att.sizes.medium || att.sizes.thumbnail);
              self.extraOptions.push({
                value: val,
                label: att.title || att.filename || ('图片 ' + att.id),
                desc: '',
                url: sized ? sized.url : att.url,
                badge: '',
                badgeTone: '',
                group: '',
                disabled: false
              });
            }
            self.selectValue(val, true);
          });
        });
        frame.open();
      },
      // 功能：处理 measure 相关逻辑。
      measure: function () {
        if (this.$el && this.$el.getBoundingClientRect) {
          var w = this.$el.getBoundingClientRect().width;
          if (w) { this.rootWidth = w; }
        }
      }
    },
    // 功能：组件挂载后执行初始化和事件绑定。
    mounted: function () {
      var self = this;
      this.measure();
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(function () { self.measure(); });
        this.ro.observe(this.$el);
      } else if (typeof window !== 'undefined') {
        this._onResize = function () { self.measure(); };
        window.addEventListener('resize', this._onResize);
      }
    },
    // 功能：组件销毁前清理事件、计时器或临时状态。
    beforeUnmount: function () {
      if (this.ro) { this.ro.disconnect(); this.ro = null; }
      if (this._onResize) { window.removeEventListener('resize', this._onResize); this._onResize = null; }
    },
    template: [
      '<div class="eva-image-select-field" :class="{ \'is-disabled\': field.disabled, \'is-multiple\': isMultiple }">',
      '  <div v-if="showToolbar" class="eva-is-toolbar">',
      '    <div v-if="searchable" class="eva-is-search">',
      '      <i class="ri-search-line" aria-hidden="true"></i>',
      '      <input type="text" v-model="query" :placeholder="Tv(field.search_placeholder) || \'搜索选项…\'" :disabled="field.disabled" :aria-label="\'搜索选项\'">',
      '      <button v-if="query" type="button" class="eva-is-search-clear" aria-label="清除搜索" @click="query = \'\'"><i class="ri-close-line"></i></button>',
      '    </div>',
      '    <div class="eva-is-tools">',
      '      <span v-if="isMultiple" class="eva-is-count">已选 {{ selectedCount }}<template v-if="maxCount"> / {{ maxCount }}</template></span>',
      '      <button v-if="mediaEnabled" type="button" class="eva-is-tool-btn" :disabled="field.disabled" @click="pickFromMedia"><i class="ri-image-add-line"></i><span>{{ Tv(field.media_button) || \'媒体库\' }}</span></button>',
      '      <button v-if="clearable" type="button" class="eva-is-tool-btn" :disabled="field.disabled || !hasSelection" @click="clearAll"><i class="ri-eraser-line"></i><span>清除</span></button>',
      '    </div>',
      '  </div>',
      '  <template v-for="grp in groupedOptions" :key="\'g-\' + grp.label">',
      '    <div class="eva-is-group">',
      '      <div v-if="grp.label" class="eva-is-group-title">{{ Tv(grp.label) }}</div>',
      '      <div class="eva-image-select" :class="{ \'is-disabled\': field.disabled }" :style="gridStyle" :role="isMultiple ? \'group\' : \'radiogroup\'" :aria-label="Tv(field.title) || \'Image Select\'">',
      '        <div v-for="option in grp.options" :key="option.value" class="eva-is-card" :class="{ \'is-selected\': isSelected(option), \'is-disabled\': field.disabled || option.disabled, \'is-multiple\': isMultiple, \'is-dimmed\': atMax() && !isSelected(option) }" :role="isMultiple ? \'checkbox\' : \'radio\'" :aria-checked="isSelected(option) ? \'true\' : \'false\'" :aria-disabled="field.disabled || option.disabled ? \'true\' : \'false\'" :tabindex="field.disabled || option.disabled ? -1 : 0" @click="choose(option)" @keydown="onCardKey($event, option)">',
      '          <span class="eva-is-preview">',
      '            <span v-if="lazy && !isLoaded(option) && option.url" class="eva-is-skeleton" aria-hidden="true"></span>',
      '            <img v-if="option.url" :src="option.url" :alt="Tv(option.label)" :loading="lazy ? \'lazy\' : \'eager\'" :class="{ \'is-loading\': lazy && !isLoaded(option) }" @load="onImgLoad(option)">',
      '            <span v-else class="eva-is-placeholder"><i class="ri-image-line"></i></span>',
      '            <button v-if="option.url && zoomEnabled && !field.disabled && !option.disabled" type="button" class="eva-is-zoom" :aria-label="\'放大 \' + Tv(option.label)" @click.stop="openZoom(option)" @keydown.enter.stop.prevent="openZoom(option)" @keydown.space.stop.prevent="openZoom(option)"><i class="ri-zoom-in-line"></i></button>',
      '            <span v-if="option.badge" class="eva-is-badge" :class="option.badgeTone ? \'is-\' + option.badgeTone : \'\'">{{ Tv(option.badge) }}</span>',
      '            <i v-if="isSelected(option)" class="eva-is-check ri-check-line" aria-hidden="true"></i>',
      '          </span>',
      '          <strong v-if="showLabel">{{ Tv(option.label) }}</strong>',
      '          <em v-if="showDesc && Tv(option.desc)">{{ Tv(option.desc) }}</em>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </template>',
      '  <p v-if="!filteredOptions.length" class="eva-is-empty">{{ query ? (Tv(field.no_result_message || field.noResultMessage) || \'没有匹配的选项\') : (Tv(field.empty_message || field.emptyMessage) || \'暂无可选图片\') }}</p>',
      '  <div v-if="zoomOption" class="eva-is-lightbox" role="dialog" aria-modal="true" @click.self="closeZoom">',
      '    <div class="eva-is-lightbox-card">',
      '      <button type="button" class="eva-is-lightbox-close" aria-label="关闭预览" @click="closeZoom"><i class="ri-close-line"></i></button>',
      '      <img :src="zoomOption.url" :alt="Tv(zoomOption.label)">',
      '      <strong>{{ Tv(zoomOption.label) }}</strong>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
})();
