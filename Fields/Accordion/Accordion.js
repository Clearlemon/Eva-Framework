/**
 * Eva 字段：accordion。
 *
 * 用途：
 * - 把一组子字段按折叠面板组织，适合复杂配置分组。
 * - 返回值为对象/关联数组：{ section_id: { field_id: value } }。
 *
 * 字段配置：
 * - `sections`：面板数组，每项支持 id/title/desc/fields/disabled/badge。
 * - `multiple`：是否允许同时展开多个面板，默认 true。
 * - `default_open`：默认展开的面板 id 数组。
 * - `closed_icon/open_icon`：右侧折叠图标，可被单个 section 覆盖。
 * - `remember/toolbar/searchable/resettable/summary/dirty_mark/mode_switch/bulk_actions`：默认开启，设为 false 可关闭。
 * - section 支持 `help`、`visible_if`、`summary_fields`、`summary_switch`。
 *   分组条件相对当前 accordion 取值，例如 ['basic.advanced_mode', '==', true]。
 */
(function () {
  window.EvaFields = window.EvaFields || {};

  // 功能：处理 Clone 相关逻辑。
  function Clone(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { return {}; }
    return Object.assign({}, value);
  }

  function Copy(value) { return value === undefined ? '' : JSON.parse(JSON.stringify(value)); }
  function Path(value, path) {
    return path.split('/').reduce(function (current, key) { return current == null ? undefined : current[decodeURIComponent(key)]; }, value);
  }
  function Comparable(value) {
    if ([true, 1, '1', 'true'].indexOf(value) !== -1) { return 'true'; }
    if ([false, 0, '0', 'false', '', null, undefined].indexOf(value) !== -1) { return 'false'; }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  // 与框架依赖的比较语义一致，分组条件支持当前手风琴内的点号路径。
  function Visible(schema, values) {
    var group = schema.eva_dependency && schema.eva_dependency.visible;
    if (!group || !group.rules || !group.rules.length) { return true; }
    function match(rule) {
      var actual = Object.prototype.hasOwnProperty.call(values, rule.id) ? values[rule.id] : String(rule.id || '').split('.').reduce(function (v, key) { return v == null ? undefined : v[key]; }, values);
      var expected = rule.value;
      var op = rule.operator || '==';
      var empty = actual == null || actual === '' || actual === false || (Array.isArray(actual) && !actual.length);
      if (op === 'empty') { return empty; }
      if (op === 'not_empty' || op === 'not-empty') { return !empty; }
      if (op === 'truthy') { return Comparable(actual) === 'true'; }
      if (op === 'falsy') { return Comparable(actual) === 'false'; }
      if (['>', '>=', '<', '<='].indexOf(op) !== -1) {
        var a = Number(actual) || 0, b = Number(expected) || 0;
        return op === '>' ? a > b : op === '>=' ? a >= b : op === '<' ? a < b : a <= b;
      }
      if (['any', 'in', 'contains', 'not_any', 'not-in', 'not_in', 'not_contains'].indexOf(op) !== -1) {
        var list = function (v) { return (Array.isArray(v) ? v : String(v == null ? '' : v).split(',')).map(Comparable); };
        var hit = list(expected).some(function (v) { return list(actual).indexOf(v) !== -1; });
        return op.indexOf('not') === 0 ? !hit : hit;
      }
      return op === '!=' ? Comparable(actual) !== Comparable(expected) : Comparable(actual) === Comparable(expected);
    }
    return group.relation === 'or' || group.relation === 'any' ? group.rules.some(match) : group.rules.every(match);
  }

  window.EvaFields.accordion = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    inject: { form: { from: 'evaFormContext', default: null } },
    data: function () {
      return { query: '', initialValue: Copy(this.modelValue), resetPanel: null, resetTrigger: null, highlightedPath: '', pendingFocus: false };
    },
    computed: {
      fieldPath: function () { return this.field._eva_path || this.field.id || ''; },
      resetDialogId: function () { return 'eva-acc-reset-' + this.$.uid; },
      storageKey: function () {
        if (this.field.remember === false) { return ''; }
        return 'eva:accordion:' + window.location.pathname + ':' + (this.form ? this.form.optionId : window.location.search) + ':' + (this.field.storage_key || this.fieldPath);
      },
      errors: function () { return this.form ? this.form.errors : (this.field._errors || {}); },
      baseline: function () {
        if (!this.form) { return this.initialValue; }
        try { return Path(JSON.parse(this.form.savedSnapshot.value), this.fieldPath); } catch (e) { return this.initialValue; }
      },
      dependencyValues: function () {
        var self = this, out = {};
        (this.field.sections || []).forEach(function (section, index) { out[self.sectionId(section, index)] = self.effectiveValues(section, index, self.modelValue); });
        return out;
      },
      errorSignature: function () {
        var prefix = this.fieldPath + '/';
        return JSON.stringify(Object.keys(this.errors).filter(function (key) { return key.indexOf(prefix) === 0; }).map(function (key) { return [key, this.errors[key]]; }, this));
      }
    },
    watch: {
      query: function () { this.revealMatches(); },
      errorSignature: { immediate: true, handler: function () { this.$nextTick(this.revealErrors); } },
      'form.searchTarget.value': function (target) { this.revealTarget(target); }
    },
    mounted: function () {
      this.revealErrors();
      if (this.form) { this.revealTarget(this.form.searchTarget.value); }
    },
    beforeUnmount: function () { this.removeResetListeners(); },
    methods: {
      effectiveValues: function (section, index, source) {
        var values = Clone(Clone(source)[this.sectionId(section, index)]);
        (section.fields || []).forEach(function (child) { if (!Object.prototype.hasOwnProperty.call(values, child.id)) { values[child.id] = Copy(child.default); } });
        return values;
      },
      childPath: function (section, index, child) { return this.fieldPath + '/' + encodeURIComponent(this.sectionId(section, index)) + '/' + encodeURIComponent(child.id); },
      childError: function (section, index, child) { return this.errors[this.childPath(section, index, child)] || ''; },
      errorCount: function (section, index) {
        var prefix = this.fieldPath + '/' + encodeURIComponent(this.sectionId(section, index)) + '/';
        return Object.keys(this.errors).filter(function (key) { return key.indexOf(prefix) === 0; }).length;
      },
      isDirty: function (section, index) { return JSON.stringify(this.effectiveValues(section, index, this.modelValue)) !== JSON.stringify(this.effectiveValues(section, index, this.baseline)); },
      editable: function (section) { return !this.field.disabled && !this.field.readonly && !section.disabled; },
      renderedChild: function (section, index, child) {
        return Object.assign({}, child, { _eva_path: this.childPath(section, index, child), disabled: !this.editable(section) || child.disabled, readonly: this.field.readonly || child.readonly, _error: this.childError(section, index, child) });
      },
      visibleChildren: function (section, index) {
        var values = this.effectiveValues(section, index, this.modelValue);
        return (section.fields || []).filter(function (child) { return Visible(child, values); });
      },
      summary: function (section, index) {
        if (this.field.summary === false || section.summary === false) { return ''; }
        var self = this, values = this.effectiveValues(section, index, this.modelValue);
        var children = this.visibleChildren(section, index).filter(function (child) { return child.type !== 'html' && child.save !== false; });
        var fields = Array.isArray(section.summary_fields) ? section.summary_fields : [];
        var labels = fields.map(function (id) {
          var child = children.find(function (item) { return item.id === id; });
          if (!child) { return ''; }
          var value = values[id];
          if (child.options && !Array.isArray(value) && child.options[value] !== undefined) { value = child.options[value]; }
          return typeof value === 'object' ? '' : self.tv(value);
        }).filter(Boolean);
        if (section.summary_switch) { labels.unshift(Comparable(values[section.summary_switch]) === 'true' ? '已启用' : '未启用'); }
        labels.push(children.filter(function (child) { var value = values[child.id]; return value !== '' && value != null && (!Array.isArray(value) || value.length); }).length + ' 项配置');
        return labels.join(' · ');
      },
      childMatches: function (child) {
        var query = this.query.trim().toLowerCase();
        return !!query && [this.tv(child.title), this.tv(child.desc), child.id].join(' ').toLowerCase().indexOf(query) !== -1;
      },
      revealMatches: function () {
        var self = this;
        if (!this.query.trim() || !this.$refs.accordion) { return; }
        this.$refs.accordion.reveal(this.sections().filter(function (section, index) {
          return !section.disabled && (self.tv(section.title).toLowerCase().indexOf(self.query.trim().toLowerCase()) !== -1 || self.visibleChildren(section, index).some(self.childMatches));
        }).map(function (section, index) { return self.sectionId(section, index); }), true);
      },
      revealErrors: function () {
        var self = this;
        if (!this.$refs.accordion) { return; }
        var keys = this.sections().filter(function (section, index) { return self.errorCount(section, index) > 0; }).map(function (section, index) { return self.sectionId(section, index); });
        if (keys.length) { this.$refs.accordion.reveal(keys, true); }
      },
      revealTarget: function (target) {
        if (!target || !target.path || target.path.indexOf(this.fieldPath + '/') !== 0 || !this.$refs.accordion) { return; }
        var key = decodeURIComponent(target.path.slice(this.fieldPath.length + 1).split('/')[0]);
        var panel = this.sections().find(function (section) { return section.id === key; });
        if (!panel || panel.disabled) { return; }
        this.query = '';
        this.highlightedPath = target.reason === 'search' ? target.path : '';
        this.pendingFocus = true;
        this.$refs.accordion.reveal([key]);
        this.$nextTick(this.focusTarget);
      },
      focusTarget: function () {
        if (!this.pendingFocus) { return; }
        var target = this.form && this.form.searchTarget.value;
        if (!target || !target.path || target.path.indexOf(this.fieldPath + '/') !== 0) { return; }
        var el = Array.from(this.$el.querySelectorAll('[data-eva-field-path]')).find(function (node) { return node.dataset.evaFieldPath === target.path; });
        if (el) {
          var body = el.closest('.eva-acc-body');
          while (body) { if (body.style.height || body.style.display === 'none') { return; } body = body.parentElement.closest('.eva-acc-body'); }
          this.pendingFocus = false;
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var input = el.querySelector('input,textarea,select,button'); if (input) { input.focus({ preventScroll: true }); }
        }
      },
      isResetOpen: function (section, index) {
        return !!this.resetPanel && this.sectionId(this.resetPanel.section, this.resetPanel.index) === this.sectionId(section, index);
      },
      removeResetListeners: function () {
        document.removeEventListener('pointerdown', this.resetOutside, true);
        document.removeEventListener('keydown', this.resetKeydown, true);
      },
      closeReset: function (restoreFocus) {
        var trigger = this.resetTrigger;
        this.resetPanel = null;
        this.resetTrigger = null;
        this.removeResetListeners();
        if (trigger && restoreFocus !== false) { this.$nextTick(function () { if (trigger.isConnected) { trigger.focus({ preventScroll: true }); } }); }
      },
      resetOutside: function (event) {
        var anchor = this.$el.querySelector('.eva-acc-reset-anchor.is-open');
        if (anchor && !anchor.contains(event.target)) { this.closeReset(false); }
      },
      resetKeydown: function (event) {
        if (this.resetPanel && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.closeReset(); }
      },
      requestReset: function (section, index, event) {
        if (!this.editable(section)) { return; }
        if (this.isResetOpen(section, index)) { this.closeReset(); return; }
        this.resetTrigger = event ? event.currentTarget : null;
        this.resetPanel = { section: section, index: index };
        document.addEventListener('pointerdown', this.resetOutside, true);
        document.addEventListener('keydown', this.resetKeydown, true);
        this.$nextTick(function () { var button = this.$el.querySelector('.eva-acc-reset-confirm button'); if (button) { button.focus(); } });
      },
      confirmReset: function () {
        if (!this.resetPanel || !this.editable(this.resetPanel.section)) { return; }
        var section = this.resetPanel.section, index = this.resetPanel.index, self = this;
        var all = Clone(this.modelValue), values = Clone(all[this.sectionId(section, index)]);
        (section.fields || []).forEach(function (child) { if (child.id && child.save !== false && !child.disabled && !child.readonly && child.type !== 'html') { values[child.id] = Copy(child.default); if (self.form) { self.form.clearError(self.childPath(section, index, child), true); } } });
        all[this.sectionId(section, index)] = values;
        this.$emit('update:modelValue', all);
        this.closeReset();
      },
      // 功能：处理 tv 相关逻辑。
      tv: function (value) {
        return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(value) : (value || '');
      },
      // 功能：处理 sections 相关逻辑。
      sections: function () {
        var self = this;
        var sections = (Array.isArray(this.field.sections) ? this.field.sections : []).map(function (section, index) {
          return Object.assign({}, section, { id: self.sectionId(section, index), title: self.tv(section.title || section.label) });
        }).filter(function (section) { return Visible(section, self.dependencyValues); });
        var value = Clone(this.modelValue);
        var order = Array.isArray(value._order) ? value._order.map(String) : [];
        if (!order.length) { return sections; }
        var positions = {};
        order.forEach(function (id, index) { positions[id] = index; });
        return sections.sort(function (a, b) {
          var aId = String(a.id || a.key || '');
          var bId = String(b.id || b.key || '');
          var aPos = Object.prototype.hasOwnProperty.call(positions, aId) ? positions[aId] : 9999;
          var bPos = Object.prototype.hasOwnProperty.call(positions, bId) ? positions[bId] : 9999;
          return aPos - bPos;
        });
      },
      // 功能：处理 section Id 相关逻辑。
      sectionId: function (section, index) {
        return String(section.id != null && section.id !== '' ? section.id : (section.key != null ? section.key : index));
      },
      // 功能：处理 section Values 相关逻辑。
      sectionValues: function (section, index) {
        var all = Clone(this.modelValue);
        var id = this.sectionId(section, index);
        return all[id] && typeof all[id] === 'object' && !Array.isArray(all[id]) ? all[id] : {};
      },
      // 功能：处理 child Value 相关逻辑。
      childValue: function (section, index, child) {
        var values = this.sectionValues(section, index);
        return Object.prototype.hasOwnProperty.call(values, child.id) ? values[child.id] : (child.default !== undefined ? child.default : '');
      },
      // 功能：更新 update Child 对应状态。
      updateChild: function (section, index, child, value) {
        if (!this.editable(section) || child.disabled || child.readonly) { return; }
        var all = Clone(this.modelValue);
        var id = this.sectionId(section, index);
        var values = all[id] && typeof all[id] === 'object' && !Array.isArray(all[id]) ? Object.assign({}, all[id]) : {};
        values[child.id] = value;
        all[id] = values;
        if (this.form) { this.form.clearError(this.childPath(section, index, child)); }
        this.$emit('update:modelValue', all);
      },
      // 功能：保存面板拖拽后的顺序，刷新页面后继续沿用。
      reorderPanels: function (order) {
        if (this.field.disabled || this.field.readonly) { return; }
        var all = Clone(this.modelValue);
        var self = this, incoming = Array.isArray(order) ? order.map(String) : [];
        var full = (this.field.sections || []).map(function (section, index) { return self.sectionId(section, index); });
        var previous = (Array.isArray(all._order) ? all._order.map(String) : []).filter(function (id) { return full.indexOf(id) !== -1; });
        full.forEach(function (id) { if (previous.indexOf(id) === -1) { previous.push(id); } });
        // 隐藏分组保留原位置，只替换当前可见分组的顺序。
        var visible = incoming.slice();
        all._order = previous.map(function (id) { return visible.indexOf(id) !== -1 ? incoming.shift() : id; });
        this.$emit('update:modelValue', all);
      },
      // 功能：处理 field Col 相关逻辑。
      fieldCol: function (field) {
        var map = {
          'full': 'eva-acc-col-12', '1': 'eva-acc-col-12', '1/1': 'eva-acc-col-12',
          '3/4': 'eva-acc-col-9', '2/3': 'eva-acc-col-8', '1/2': 'eva-acc-col-6',
          '1/3': 'eva-acc-col-4', '1/4': 'eva-acc-col-3'
        };
        return map[field.width || 'full'] || 'eva-acc-col-12';
      }
    },
    template: [
      '<div class="eva-accordion-field-wrap">',
      '<eva-accordion ref="accordion" :panels="sections()" :multiple="field.multiple !== false" :storage-key="storageKey" :toolbar="field.toolbar !== false" :mode-switch="field.mode_switch !== false" :bulk-actions="field.bulk_actions !== false" :default-open="field.default_open !== undefined ? field.default_open : (field.defaultOpen || [])" :closed-icon="field.closed_icon || field.closedIcon || \'ri-arrow-down-s-line\'" :open-icon="field.open_icon || field.openIcon || \'ri-arrow-up-s-line\'" :disabled="!!field.disabled" :sortable="field.sortable !== false && !field.readonly" @reorder="reorderPanels" @body-open="focusTarget">',
      '  <template #toolbar><label v-if="field.searchable !== false" class="eva-acc-search"><i class="ri-search-line" aria-hidden="true"></i><input v-model="query" type="search" placeholder="搜索分组或设置项" aria-label="搜索手风琴设置"></label></template>',
      '  <template #title="{ panel, index }"><span class="eva-acc-title">{{ tv(panel.title) }}</span><span v-if="field.dirty_mark !== false && isDirty(panel, index)" class="eva-acc-dirty" title="此分组有未保存修改" aria-label="有未保存修改"></span><span v-if="summary(panel, index)" class="eva-acc-summary" :title="summary(panel, index)">{{ summary(panel, index) }}</span><span v-if="errorCount(panel, index)" class="eva-acc-errors" role="status">{{ errorCount(panel, index) }} 项错误</span></template>',
      '  <template #actions="{ panel, index }"><div class="eva-acc-actions"><span v-if="tv(panel.help)" class="eva-acc-help" tabindex="0" :aria-label="tv(panel.help)"><i class="ri-question-line"></i><span role="tooltip">{{ tv(panel.help) }}</span></span><div v-if="field.resettable !== false && panel.resettable !== false" class="eva-acc-reset-anchor" :class="{ \'is-open\': isResetOpen(panel, index) }"><button type="button" :disabled="!editable(panel)" :aria-label="\'恢复\' + tv(panel.title) + \'默认值\'" aria-haspopup="dialog" :aria-expanded="isResetOpen(panel, index)" :aria-controls="isResetOpen(panel, index) ? resetDialogId : undefined" @click="requestReset(panel, index, $event)"><i class="ri-restart-line" aria-hidden="true"></i>恢复默认</button><div v-if="isResetOpen(panel, index)" :id="resetDialogId" class="eva-acc-reset-confirm" role="alertdialog" :aria-labelledby="resetDialogId + \'-title\'" :aria-describedby="resetDialogId + \'-desc\'"><strong :id="resetDialogId + \'-title\'">恢复「{{ tv(panel.title) }}」默认值？</strong><p :id="resetDialogId + \'-desc\'">仅恢复当前分组内可编辑字段（含隐藏项），其他分组及排序不变。保存后生效。</p><div class="eva-acc-reset-buttons"><button type="button" class="eva-acc-reset-cancel" @click="closeReset()">取消</button><button type="button" class="eva-acc-reset-submit" @click="confirmReset">确认恢复</button></div></div></div></div></template>',
      '  <template #default="{ panel, index }">',
      '    <p v-if="tv(panel.desc)" class="eva-accordion-desc">{{ tv(panel.desc) }}</p>',
      '    <div class="eva-accordion-fields">',
      '      <div v-for="child in visibleChildren(panel, index)" :key="child.id" class="eva-accordion-field" :data-eva-field-path="childPath(panel, index, child)" :class="[fieldCol(child), { \'has-error\': childError(panel, index, child), \'is-search-match\': childMatches(child) || highlightedPath === childPath(panel, index, child) }]">',
      '        <div class="eva-accordion-meta"><span>{{ tv(child.title) }}</span><em v-if="tv(child.desc)">{{ tv(child.desc) }}</em></div>',
      '        <div class="eva-accordion-control"><eva-field :field="renderedChild(panel, index, child)" :model-value="childValue(panel, index, child)" @update:model-value="updateChild(panel, index, child, $event)"></eva-field></div>',
      '        <p v-if="childError(panel, index, child)" class="eva-acc-field-error" role="alert">{{ childError(panel, index, child) }}</p>',
      '      </div>',
      '    </div>',
      '  </template>',
      '</eva-accordion>',
      '</div>'
    ].join('\n')
  };
})();
