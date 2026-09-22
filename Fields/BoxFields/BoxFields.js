(function () {
  'use strict';

  window.EvaFields = window.EvaFields || {};

  var DEFAULT_UNITS = ['px', 'rem', 'em', '%', 'vw', 'vh'];

  function normalizeUnits(field) {
    var configured = field && field.units;
    var source = Array.isArray(configured) && configured.length ? configured : DEFAULT_UNITS;

    if (configured && ! Array.isArray(configured) && typeof configured === 'object') {
      return Object.keys(configured).map(function (key) {
        var item = configured[key];
        return { value: String(key), label: String(item && typeof item === 'object' ? (item.label || item.title || key) : item || key) };
      });
    }

    return source.map(function (item) {
      if (item && typeof item === 'object') {
        var value = item.value !== undefined ? item.value : (item.id !== undefined ? item.id : item.label);
        return { value: String(value || 'px'), label: String(item.label || value || 'px') };
      }
      return { value: String(item || 'px'), label: String(item || 'px') };
    });
  }

  function boxField(labels, options) {
    options = options || {};

    return {
      props: ['field', 'modelValue'],
      emits: ['update:modelValue'],
      data: function () {
        return { items: labels.slice() };
      },
      computed: {
        value: function () {
          var defaults = window.EvaAdvanced.object(this.field && this.field.default);
          var current = window.EvaAdvanced.object(this.modelValue);
          return Object.assign({}, defaults, current);
        },
        units: function () {
          return normalizeUnits(this.field || {});
        },
        currentUnit: function () {
          var selected = String(this.value.unit || '');
          var exists = this.units.some(function (item) { return item.value === selected; });
          return exists ? selected : (this.units[0] ? this.units[0].value : 'px');
        },
        visibleItems: function () {
          var self = this;
          return this.items.filter(function (item) { return self.visible(item.key); });
        },
        inputStep: function () {
          return this.field && this.field.step !== undefined ? this.field.step : 0.1;
        },
        inputMin: function () {
          if (this.field && this.field.min !== undefined) { return this.field.min; }
          if (options.kind === 'dimensions') { return 0; }
          return this.field && this.field.output_mode === 'padding' ? 0 : null;
        },
        inputMax: function () {
          return this.field && this.field.max !== undefined ? this.field.max : null;
        },
        isLinked: function () {
          return options.linkable && (this.value.linked === true || this.value.linked === 1 || this.value.linked === '1');
        },
        showLink: function () {
          return !! options.linkable && this.visible('link');
        },
        rootClass: function () {
          return {
            'is-spacing': options.kind === 'spacing',
            'is-dimensions': options.kind === 'dimensions',
            'is-linked': this.isLinked
          };
        }
      },
      methods: {
        visible: function (name) {
          var snake = 'show_' + name;
          var camel = 'show' + name.split('_').map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); }).join('');
          return this.field[snake] !== false && this.field[camel] !== false;
        },
        get: function (key, fallback) {
          return this.value[key] !== undefined ? this.value[key] : fallback;
        },
        emitValue: function (next) {
          if (! options.linkable) { delete next.linked; }
          this.$emit('update:modelValue', next);
        },
        setUnit: function (unit) {
          var next = Object.assign({}, this.value, { unit: unit });
          this.emitValue(next);
        },
        setNumber: function (key, value) {
          var next = Object.assign({}, this.value);
          next[key] = value;
          if (this.isLinked) {
            labels.forEach(function (item) { next[item.key] = value; });
          }
          this.emitValue(next);
        },
        toggleLinked: function () {
          if (! options.linkable || (this.field && this.field.disabled)) { return; }
          var next = Object.assign({}, this.value);
          var enable = ! this.isLinked;
          next.linked = enable;

          if (enable) {
            var anchor = '';
            for (var i = 0; i < labels.length; i += 1) {
              var candidate = next[labels[i].key];
              if (candidate !== '' && candidate !== null && candidate !== undefined) {
                anchor = candidate;
                break;
              }
            }
            if (anchor !== '') {
              labels.forEach(function (item) { next[item.key] = anchor; });
            }
          }

          this.emitValue(next);
        }
      },
      template: [
        '<div class="eva-advanced-card eva-box-field" :class="rootClass">',
        '  <div class="eva-box-inputs">',
        '    <label v-for="item in visibleItems" :key="item.key">',
        '      <span>{{item.label}}</span>',
        '      <input type="number" inputmode="decimal" :step="inputStep" :min="inputMin" :max="inputMax" :value="get(item.key, \'\')" :disabled="field.disabled" @input="setNumber(item.key, $event.target.value)">',
        '    </label>',
        '    <label v-if="visible(\'unit\')" class="eva-box-unit">',
        '      <span>单位</span>',
        '      <eva-select :options="units" :model-value="currentUnit" :disabled="field.disabled" @update:model-value="setUnit($event)"></eva-select>',
        '    </label>',
        '    <button v-if="showLink" type="button" class="eva-box-link" :class="{\'is-active\':isLinked}" :disabled="field.disabled" :aria-pressed="isLinked ? \'true\' : \'false\'" @click="toggleLinked" :title="isLinked ? \'取消数值联动\' : \'联动四向数值\'">',
        '      <i :class="isLinked ? \'ri-link\' : \'ri-link-unlink-m\'"></i>',
        '    </button>',
        '  </div>',
        '</div>'
      ].join('')
    };
  }

  window.EvaFieldFactories = window.EvaFieldFactories || {};
  window.EvaFieldFactories.boxField = boxField;
})();

