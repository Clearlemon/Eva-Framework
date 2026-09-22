/**
 * Eva Framework —— 嵌入式容器运行时。
 *
 * 用户资料、文章 metabox、分类法和导航菜单不使用全屏 Admin Console，
 * 而是把同一套字段组件挂到 PHP 输出的 .eva-embed-root 中。
 */
(function () {
  'use strict';

  if (typeof Vue === 'undefined') {
    return;
  }

  // 已挂载的根节点 → 它的表单值；短代码生成器插入时从这里取值，也用来识别「克隆来的、看着挂载过其实没有」的节点。
  var rootModels = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  // 已挂载的根节点 → 把它的值恢复成初始值的函数；供外部在表单被清空后调用。
  var rootResets = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  // 已挂载的根节点 → Vue 应用实例与挂载期登记的清理函数；供 EvaEmbed.unmount 收尾。
  // 常驻后台页挂上就不卸了，但区块编辑器里字段面板随「区块选中/取消选中」反复挂卸，不收干净会漏。
  var rootApps = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  var rootCleanups = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  // eva-app.js 在没有 #eva-app 的资料页不会执行 setup，因此嵌入式运行时自己提供最小 i18n。
  window.EvaI18n = window.EvaI18n || {
    t: function (key) {
      var dict = {
        please_select: '请选择',
        color_clear: '清除',
        color_apply: '应用',
        color_default: '默认',
        block_settings: '区块设置',
        block_no_render: '这个区块还没有渲染函数，前台不会输出内容。',
        load_failed: '加载失败',
        wgf_all: '全部',
        wgf_eva: 'Eva',
        wgf_native: '原生',
        wgf_label: '按来源筛选小工具'
      };
      return dict[key] || key;
    },
    tv: function (value) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value.zh != null ? value.zh : (value.en != null ? value.en : (Object.values(value)[0] || ''));
      }
      return value == null ? '' : String(value);
    }
  };

  function tv(value) {
    return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(value) : (value == null ? '' : String(value));
  }

  function clone(value) {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(clone);
    }
    var output = {};
    Object.keys(value).forEach(function (key) { output[key] = clone(value[key]); });
    return output;
  }

  function defaultValue(field) {
    if (Object.prototype.hasOwnProperty.call(field, 'default')) {
      return clone(field.default);
    }
    var type = String(field.type || 'text').toLowerCase();
    if (['checkbox', 'button_set', 'gallery', 'media', 'repeater', 'color_group', 'relationship'].indexOf(type) !== -1) {
      return [];
    }
    if (['switcher'].indexOf(type) !== -1) {
      return 0;
    }
    if (['group', 'fieldset', 'tabbed', 'color_set', 'accordion', 'typography', 'spacing', 'dimensions', 'border', 'background', 'link'].indexOf(type) !== -1) {
      return {};
    }
    return '';
  }

  function isEmptyObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
  }

  function registerComponents(app) {
    if (window.EvaUI && window.EvaUI.Select) {
      app.component('eva-select', window.EvaUI.Select);
    }
    if (window.EvaUI && window.EvaUI.Color) {
      app.component('eva-color', window.EvaUI.Color);
    }
    if (window.EvaUI && window.EvaUI.IconPicker) {
      app.component('eva-icon-picker', window.EvaUI.IconPicker);
    }
    if (window.EvaUI && window.EvaUI.Media) {
      app.component('eva-media', window.EvaUI.Media);
    }
    if (window.EvaUI && window.EvaUI.Accordion) {
      app.component('eva-accordion', window.EvaUI.Accordion);
    }
    if (window.EvaUI && window.EvaUI.DatePicker) {
      app.component('eva-datepicker', window.EvaUI.DatePicker);
    }
    if (window.EvaUI && window.EvaUI.Slider) {
      app.component('eva-slider', window.EvaUI.Slider);
    }
    if (window.EvaUI && window.EvaUI.Tabs) {
      app.component('eva-tabs', window.EvaUI.Tabs);
    }

    // 与全屏外壳同口径：'icon-xxx' 这种不带 # 的 symbol id，页面里有同名 <symbol> 才按 symbol 渲染。
    app.component('eva-icon', {
      inheritAttrs: false,
      props: { icon: { type: String, default: '' } },
      data: function () { return { symbolTick: 0 }; },
      mounted: function () { window.addEventListener('eva:iconfont-loaded', this.On_Iconfont_Loaded); },
      beforeUnmount: function () { window.removeEventListener('eva:iconfont-loaded', this.On_Iconfont_Loaded); },
      methods: {
        On_Iconfont_Loaded: function () { this.symbolTick++; }
      },
      computed: {
        kind: function () {
          var value = (this.icon || '').trim();
          if (!value) return 'empty';
          if (value.charAt(0) === '#') return 'symbol';
          if (value.slice(0, 4) === '<svg') return 'raw';
          if (/^https?:\/\//i.test(value) || value.charAt(0) === '/' || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value)) return 'img';
          this.symbolTick; // 读一下建立响应依赖：iconfont.js 晚到时触发重算
          if (/^[A-Za-z][\w-]*$/.test(value)) {
            var node = document.getElementById(value);
            if (node && String(node.tagName).toLowerCase() === 'symbol') return 'symbol';
          }
          return 'class';
        },
        symbolHref: function () {
          var value = (this.icon || '').trim();
          return value.charAt(0) === '#' ? value : '#' + value;
        }
      },
      template:
        '<i v-if="kind===\'class\'" :class="icon" v-bind="$attrs"></i>' +
        '<svg v-else-if="kind===\'symbol\'" class="eva-svg-ico" aria-hidden="true" v-bind="$attrs"><use :xlink:href="symbolHref"></use></svg>' +
        '<img v-else-if="kind===\'img\'" class="eva-img-ico" :src="icon" alt="" v-bind="$attrs">' +
        '<span v-else-if="kind===\'raw\'" class="eva-svg-ico" v-html="icon" v-bind="$attrs"></span>' +
        '<i v-else v-bind="$attrs"></i>'
    });

    // 与全屏外壳保持一致的字段分发器。
    app.component('eva-field', {
      props: ['field', 'modelValue'],
      emits: ['update:modelValue'],
      computed: {
        comp: function () {
          var reg = window.EvaFields || {};
          var type = this.field && this.field.type;
          var aliases = ['ajax_select', 'post_selector', 'post', 'term_selector', 'term', 'taxonomy', 'user_selector', 'user', 'relationship', 'nav_menu', 'menu', 'sidebar', 'sidebars'];
          if (type === 'content') type = 'html';
          if (type === 'sortable') type = 'sorter';
          if (type === 'editor') type = 'wp_editor';
          // CSF 类型名：后端归一化分区时已经换过，这里兜底不经过后端归一化的字段。
          if (type === 'fieldset') type = 'group';
          if (type === 'backup') type = 'theme_backup';
          if (aliases.indexOf(type) !== -1) type = 'select';
          return reg[type] || reg.text || null;
        }
      },
      template: '<component v-if="comp" :is="comp" :field="field" :model-value="modelValue" @update:model-value="$emit(\'update:modelValue\', $event)"></component>'
    });
  }

  function createAppForRoot(root, payload) {
    var sections = Array.isArray(payload.sections) ? payload.sections : [];
    // 小工具表单：name 前缀以外层标签属性上的为准（见 Eva_Widget_Instance::form 的说明）。
    var prefixHost = root.closest ? root.closest('[data-eva-name-prefix]') : null;
    var namePrefix = (prefixHost && prefixHost.getAttribute('data-eva-name-prefix')) || payload.namePrefix || ('eva_fields[' + (payload.id || '') + ']');
    var initial = payload.values && typeof payload.values === 'object' ? payload.values : {};
    var syncHiddenFn = function () {};
    var resetModelFn = function () {};
    // 挂载期登记到 document / window 上的监听，卸载时逐个撤掉。
    var cleanups = [];

    var app = Vue.createApp({
      setup: function () {
        var model = Vue.reactive({});
        // 把模型填回初始值：挂载时用一次，表单被 reset 时再用一次。
        function applyInitial() {
          sections.forEach(function (section) {
            (section.fields || []).forEach(function (field) {
              if (!field || !field.id) return;
              model[field.id] = Object.prototype.hasOwnProperty.call(initial, field.id)
                ? clone(initial[field.id])
                : defaultValue(field);
            });
          });
        }
        applyInitial();

        function fieldName(id) {
          return namePrefix + '[' + String(id).replace(/[^a-zA-Z0-9_-]/g, '_') + ']';
        }

        function serialize(value) {
          if (Array.isArray(value) || (value && typeof value === 'object')) {
            return JSON.stringify(value);
          }
          if (typeof value === 'boolean') {
            return value ? '1' : '0';
          }
          return value == null ? '' : String(value);
        }

        function syncHidden() {
          root.querySelectorAll('input[type="hidden"]').forEach(function (input) {
            var id = input.getAttribute('data-eva-field-id') || '';
            if (!id) {
              var nameMatch = String(input.name || '').match(/\[([^\]]+)\]$/);
              id = nameMatch ? nameMatch[1] : '';
            }
            var value = model[id];
            input.value = fieldTypeValue(id, value);
          });
        }

        function fieldTypeValue(id, value) {
          var field = null;
          sections.forEach(function (section) {
            (section.fields || []).forEach(function (candidate) {
              if (candidate && String(candidate.id) === String(id)) field = candidate;
            });
          });
          if (field && String(field.type || '').toLowerCase() === 'switcher') {
            return value ? '1' : '0';
          }
          return serialize(value);
        }

        function visible(field) {
          if (!field || field.disabled === true) {
            return true;
          }
          // 依赖字段在嵌入式表单中采用常见 CSF 语法的轻量判断。
          var dependency = field.eva_dependency && field.eva_dependency.visible;
          if (!dependency || !Array.isArray(dependency.rules) || !dependency.rules.length) {
            return true;
          }
          var checks = dependency.rules.map(function (rule) {
            // 字段源的规则键名，PHP 的 Dependency::normalize 统一归一化成 id（eva-app.js 读的也是 rule.id）。
            // 这里原先只找 key / field / path，字段源规则一律取不到值，整个嵌入式容器的依赖都不联动；
            // rule.key 在跨源规则里是 option 内的路径，不是字段 id，只能留作兜底。
            var key = rule.id || rule.key || rule.field || (rule.path || '').split('.').pop();
            var actual = model[key];
            var expected = rule.value;
            var operator = rule.operator || rule.compare || '==';
            if (Array.isArray(actual)) {
              if (operator === '!=' || operator === 'not_in') return actual.indexOf(expected) === -1;
              return actual.indexOf(expected) !== -1;
            }
            if (operator === '!=' || operator === 'not_equal') return String(actual) !== String(expected);
            if (operator === '===' || operator === '==') return String(actual) === String(expected);
            if (operator === 'in') return Array.isArray(expected) && expected.map(String).indexOf(String(actual)) !== -1;
            if (operator === 'contains') return String(actual).indexOf(String(expected)) !== -1;
            if (operator === '>') return Number(actual) > Number(expected);
            if (operator === '<') return Number(actual) < Number(expected);
            return true;
          });
          return dependency.relation === 'OR' || dependency.relation === 'or'
            ? checks.some(function (item) { return item; })
            : checks.every(function (item) { return item; });
        }

        function fieldClass(field) {
          var width = String((field && field.width) || 'full').replace('/', '-');
          // 字段的 class 参数（CSF 同名）原样加到字段行上，供主题写自定义样式。
          return 'eva-embed-field eva-embed-field--' + width + (field && field.class ? ' ' + field.class : '');
        }

        // 脏状态上报：拿当前值跟初始值比，改回原样就不再算改动（保存入口据此收放）。
        // 基线在挂载稳定后重取一次——个别字段组件初始化时会把值规整一遍（补默认、丢掉空项），
        // 那不是用户的修改，不该让保存条冒出来。
        var baseline = JSON.stringify(model);
        // 值广播：区块编辑器这类「没有表单可提交」的宿主靠它拿值（区块写进自己的属性）。
        // 与 eva:dirty 一样冒泡，宿主监听根节点即可。
        function reportChange() {
          root.dispatchEvent(new CustomEvent('eva:change', {
            bubbles: true,
            detail: { id: payload.id || '', container: payload.container || '', values: clone(model) }
          }));
        }
        function reportDirty() {
          root.dispatchEvent(new CustomEvent('eva:dirty', {
            bubbles: true,
            detail: { dirty: JSON.stringify(model) !== baseline }
          }));
        }
        window.setTimeout(function () {
          baseline = JSON.stringify(model);
          reportDirty();
        }, 400);

        // 新增分类页保存后表单留在原地、字段被恢复成初始值（见 initAddTermForm）：
        // 以恢复后的值重取基线，免得刚存完保存条又冒出来。
        function onFormSaved() {
          window.setTimeout(function () {
            baseline = JSON.stringify(model);
            reportDirty();
          }, 0);
        }
        document.addEventListener('eva:form-saved', onFormSaved);
        cleanups.push(function () { document.removeEventListener('eva:form-saved', onFormSaved); });

        Vue.watch(model, function () {
          syncHidden();
          reportDirty();
          reportChange();
        }, { deep: true });
        syncHiddenFn = syncHidden;
        resetModelFn = applyInitial;
        if (rootModels) { rootModels.set(root, model); }

        // 定制器：控件区不走表单提交，值要主动交给 wp.customize 的 setting（一个容器一个 setting，值为 [字段 id => 值]）。
        // 稍等一下再同步，连续输入时不至于每敲一个字就刷新一次预览。
        if (payload.container === 'customize' && window.wp && window.wp.customize) {
          var customizeTimer = null;
          Vue.watch(model, function () {
            window.clearTimeout(customizeTimer);
            customizeTimer = window.setTimeout(function () {
              var setting = window.wp.customize(payload.id);
              if (setting) { setting.set(clone(model)); }
            }, 250);
          }, { deep: true });
        }
        return {
          sections: sections,
          model: model,
          tv: tv,
          visible: visible,
          fieldName: fieldName,
          serialize: serialize,
          fieldClass: fieldClass,
          isEmptyObject: isEmptyObject,
          syncHidden: syncHidden
        };
      },
      template: [
        '<div class="eva-embed-form">',
        '  <section v-for="section in sections" :key="section.id || section.title" class="eva-embed-section">',
        '    <header v-if="section.title || section.description" class="eva-embed-section-head">',
        '      <h2 v-if="section.title">{{ tv(section.title) }}</h2>',
        '      <p v-if="section.description">{{ tv(section.description) }}</p>',
        '    </header>',
        '    <div class="eva-embed-grid">',
        '      <div v-for="field in (section.fields || [])" v-show="visible(field)" :key="field.id" :class="fieldClass(field)">',
        '        <div v-if="tv(field.title) || tv(field.subtitle) || tv(field.desc)" class="eva-embed-field-meta">',
        '          <label v-if="tv(field.title)" class="eva-embed-field-title">{{ tv(field.title) }}<span v-if="tv(field.help)" class="eva-field-help" tabindex="0"><i class="ri-question-line"></i><em>{{ tv(field.help) }}</em></span></label>',
        '          <small v-if="tv(field.subtitle)" v-html="tv(field.subtitle)"></small>',
        '          <small v-if="tv(field.desc)" v-html="tv(field.desc)"></small>',
        '        </div>',
        '        <div v-if="field.before" class="eva-field-before" v-html="field.before"></div>',
        '        <div class="eva-embed-field-control"><eva-field :field="field" :model-value="model[field.id]" @update:model-value="model[field.id] = $event"></eva-field></div>',
        '        <div v-if="field.after" class="eva-field-after" v-html="field.after"></div>',
        '        <input v-if="field.save !== false" type="hidden" data-eva-embed-hidden="1" :data-eva-field-id="field.id" :name="fieldName(field.id)" value="">',
        '      </div>',
        '    </div>',
        '  </section>',
        '</div>'
      ].join('\n')
    });

    registerComponents(app);
    var mount = root.querySelector('.eva-embed-mount') || root;
    app.mount(mount);
    if (rootApps) { rootApps.set(root, app); }
    if (rootCleanups) { rootCleanups.set(root, cleanups); }
    syncHiddenFn();
    Vue.nextTick(syncHiddenFn);
    window.setTimeout(syncHiddenFn, 60);
    bindSwitchInputs(root);
    bindFormReset(root, function () { resetModelFn(); });
    if (rootResets) { rootResets.set(root, function () { resetModelFn(); }); }
    root.classList.add('is-mounted');
  }

  /*
   * 把某个范围内所有已挂载字段区的值恢复成初始值。
   *
   * @param {Element} scope 包含 .eva-embed-root 的节点（通常是一个 form）。
   */
  function resetRoots(scope) {
    if (!rootResets || !scope) return;
    scope.querySelectorAll('.eva-embed-root').forEach(function (root) {
      var reset = rootResets.get(root);
      if (reset) { reset(); }
    });
  }

  /*
   * 表单被 reset 时把字段值一起归位。
   *
   * 典型场景：新增分类页（edit-tags.php）用 AJAX 提交，WP 自己的 tags.js 成功后会 form.reset()。
   * 原生 reset 只把 DOM 控件还原成 HTML 默认值，Vue 的模型不知情——界面看着清空了，
   * 提交用的隐藏域却还留着上一条的值，接着再加一条就会把旧值带过去。
   * reset 事件在默认行为之前派发，所以延后一拍再归位，避免又被浏览器还原回去。
   */
  function bindFormReset(root, onReset) {
    var form = root.closest ? root.closest('form') : null;
    if (!form) return;
    form.addEventListener('reset', function () {
      window.setTimeout(onReset, 0);
    });
  }

  /*
   * 新增分类页（edit-tags.php）：WP 的 tags.js 用 AJAX 提交，成功后不是 form.reset()，
   * 而是 jQuery 的 .val('') 清空**可见**控件——既不触发 reset 事件，也故意跳过隐藏域。
   * 结果就是界面看着清空了，提交用的隐藏域还留着上一条的值，接着再加一条会把旧值带过去。
   *
   * 这里挂 jQuery 的全局 ajaxSuccess（在 tags.js 自己的 success 回调之后触发），把 Eva 的值一起归位。
   * 加一条闸门：只有原生「名称」确实被清空了才算添加成功——名称为空之类的失败请求同样返回 200，
   * 那时 tags.js 不清空表单，我们也不能把用户填了一半的内容抹掉。
   */
  function initAddTermForm() {
    var form = document.getElementById('addtag');
    if (!form) return;

    // 「名称」是必填项，而它在 Eva 页签里是隐藏的：没填就提交的话，
    // 原生的必填提示会落在看不见的地方。这里先把页签切回 WP，用户才看得到要补什么。
    // tags.js 绑的是「添加分类」按钮的 click（不是表单的 submit），所以在 document 上用捕获阶段抢先一步；
    // 不拦截提交，交给 WP 照常报错。
    var submit = form.querySelector('#submit');
    if (submit) {
      document.addEventListener('click', function (event) {
        if (event.target !== submit) return;
        if (!document.documentElement.classList.contains('eva-addtag-tab-eva')) return;
        var name = form.querySelector('#tag-name');
        if (!name || name.value.trim() !== '') return;
        var back = document.querySelector('[data-eva-tabs="add_term"] [data-eva-tab="wp"]');
        if (back) { back.click(); }
      }, true);
    }

    if (!window.jQuery) return;
    window.jQuery(document).on('ajaxSuccess', function (event, xhr, settings) {
      if (String((settings && settings.data) || '').indexOf('action=add-tag') === -1) return;
      // 失败的新增（名称为空、分类已存在…）同样返回 200，响应里带 <wp_error>。
      // 这时 tags.js 不清空表单，我们也不能把用户填了一半的内容抹掉。
      if (String((xhr && xhr.responseText) || '').indexOf('<wp_error') !== -1) return;
      // tags.js 只清空「可见」控件；停在 Eva 页签时原生字段是隐藏的，会被它整批跳过，
      // 名称留在那儿会让下一条直接撞上「该分类已存在」。这里补清一遍，
      // 只动原生字段：Eva 自己的值要恢复成默认值而不是清空，交给 resetRoots。
      form.querySelectorAll('.form-field input[type="text"], .form-field textarea').forEach(function (el) {
        if (el.closest('.eva-embed-root')) return;
        el.value = '';
      });
      resetRoots(form);
      // 新增成功后表单留在原地，通知保存入口把「有未保存的修改」收回去。
      document.dispatchEvent(new CustomEvent('eva:form-saved'));
    });
  }

  function syncSwitchInputs(root) {
    root.querySelectorAll('.eva-embed-field').forEach(function (field) {
      var toggle = field.querySelector('[role="switch"]');
      var hidden = field.querySelector('input[type="hidden"]');
      if (!toggle || !hidden) return;
      hidden.value = toggle.getAttribute('aria-checked') === 'true' ? '1' : '0';
    });
  }

  function bindSwitchInputs(root) {
    var refresh = function () {
      window.setTimeout(function () { syncSwitchInputs(root); }, 0);
    };
    root.querySelectorAll('[role="switch"]').forEach(function (toggle) {
      toggle.addEventListener('click', refresh);
    });
    var form = root.closest('form');
    if (form) {
      form.addEventListener('submit', function () { syncSwitchInputs(root); }, true);
    }
    window.setTimeout(function () { syncSwitchInputs(root); }, 80);
  }

  /*
   * 页面标题旁的「WP 设置 / Eva 设置」切换器（用户资料页、分类编辑页共用一套）。
   *
   * 原生表单很长，Eva 字段被钩子排在它后面，用页签在两者间切换；
   * 标题（h1）旁没有可用的 PHP 钩子，标记先由容器输出在表单里（默认 hidden，无 JS 时整页保持原样），
   * 这里把它挪到标题行，再通过 <html> 上的 eva-{scope}-tab-{wp|eva} class 交给 eva.css 决定显示哪一侧。
   * 两侧同属一个表单，隐藏的一侧照常随原生的「更新」按钮提交。
   * 停留的页签记在 sessionStorage，保存后页面重载仍回到原页签（首屏恢复见各容器的 restore_tab）。
   */
  var SWITCH_TAB_SCOPES = {
    // 用户资料页：profile.php / user-edit.php，h1 自带 .wp-heading-inline。
    profile: { form: 'your-profile', storageKey: 'eva_profile_tab', htmlClass: 'eva-profile-tab-' },
    // 分类编辑页：term.php，h1 是独占一行的块级元素，得自己改成行内才能和切换器并排。
    term: { form: 'edittag', storageKey: 'eva_term_tab', htmlClass: 'eva-term-tab-', inlineHeading: true },
    // 新增分类页：edit-tags.php 左栏。页面的 h1 管的是整屏（还含右边的列表），
    // 所以锚在新增表单自己的「添加新分类」h2 上，页签的作用范围才对得上。
    // 这一栏只占页面宽度的三成多，行内摆不下，改成 h2 下方整行的分段控件。
    add_term: {
      form: 'addtag',
      storageKey: 'eva_addtag_tab',
      htmlClass: 'eva-addtag-tab-',
      heading: '#col-left .form-wrap > h2',
      block: true
    }
  };

  /**
   * 菜单项里的「WP 设置 / Eva 设置」页签（nav-menus.php）。
   *
   * 和上面那套页面级页签的区别：用户资料 / 分类页是一页一个表单，页签放在页面标题旁；
   * 菜单页一页有几十个菜单项，每项各自一组页签、就地切换，不用滚回页面顶部。
   * 因此这里不走 <html> 上的 class，改用每个 .menu-item-settings 自己的 class。
   *
   * 停留的模式记在 sessionStorage，之后展开的菜单项跟着用同一个模式。
   */
  var MENU_ITEM_TAB_KEY = 'eva_nav_item_tab';

  function menuItemTabMode() {
    try {
      return window.sessionStorage.getItem(MENU_ITEM_TAB_KEY) === 'eva' ? 'eva' : 'wp';
    } catch (e) {
      return 'wp';
    }
  }

  /**
   * 判断菜单项设置区里的某个直接子元素归哪一侧。
   *
   * @param {HTMLElement} el 直接子元素。
   * @return {string} keep = 两侧都在 / native = 只在 WP 侧 / custom = 只在 Eva 侧。
   */
  function classifyMenuItemChild(el) {
    // 隐藏的数据字段和底部的「移除 | 取消」，两个页签下都得在。
    if (el.tagName === 'INPUT' || el.classList.contains('menu-item-actions')) {
      return 'keep';
    }
    // Eva 自己的挂载点。
    if (el.classList.contains('eva-nav-fields')) {
      return 'custom';
    }
    // WP 原生的字段块：<p> 和 <fieldset>，外加它自己那两个分组 div。
    if (el.tagName === 'P' || el.tagName === 'FIELDSET'
      || el.classList.contains('description-group') || el.classList.contains('field-move-combo')) {
      return 'native';
    }
    // 其余的（主题用 CSF 注册的、别的插件加的）同样不是 WP 原生字段，跟 Eva 归一侧。
    return 'custom';
  }

  /**
   * 给一个菜单项装上页签。
   *
   * @param {HTMLElement} settings .menu-item-settings
   */
  function setupMenuItemTabs(settings) {
    // 已经装过，或这一项里没有 Eva 字段，都不必再加。
    if (settings.querySelector('.eva-mi-tabs') || !settings.querySelector('.eva-nav-fields')) {
      return;
    }

    var children = Array.prototype.slice.call(settings.children);
    for (var i = 0; i < children.length; i++) {
      var kind = classifyMenuItemChild(children[i]);
      if (kind !== 'keep') {
        children[i].classList.add(kind === 'custom' ? 'eva-mi-custom' : 'eva-mi-native');
      }
    }

    var tabs = document.createElement('div');
    tabs.className = 'eva-switch-tabs eva-switch-tabs--block eva-mi-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '设置切换');
    tabs.innerHTML = '<button type="button" class="eva-switch-tab" role="tab" data-eva-tab="wp"><i class="ri-wordpress-fill"></i><span>WP 设置</span></button>'
      + '<button type="button" class="eva-switch-tab" role="tab" data-eva-tab="eva"><i class="ri-sparkling-2-fill"></i><span>Eva 设置</span></button>';

    var buttons = tabs.querySelectorAll('[data-eva-tab]');

    function select(mode, remember) {
      mode = mode === 'eva' ? 'eva' : 'wp';
      settings.classList.toggle('eva-mi-eva', mode === 'eva');
      settings.classList.toggle('eva-mi-wp', mode === 'wp');
      for (var j = 0; j < buttons.length; j++) {
        var on = buttons[j].getAttribute('data-eva-tab') === mode;
        buttons[j].classList.toggle('is-active', on);
        buttons[j].setAttribute('aria-selected', on ? 'true' : 'false');
      }
      if (remember) {
        try { window.sessionStorage.setItem(MENU_ITEM_TAB_KEY, mode); } catch (e) {}
      }
    }

    for (var k = 0; k < buttons.length; k++) {
      (function (button) {
        button.addEventListener('click', function () {
          select(button.getAttribute('data-eva-tab'), true);
        });
      })(buttons[k]);
    }

    settings.insertBefore(tabs, settings.firstChild);
    select(menuItemTabMode(), false);
  }

  /**
   * 扫描并初始化菜单项页签。新增菜单项是 AJAX 插进来的，所以挂载观察器里也会再调一次。
   *
   * @param {Document|HTMLElement} root 扫描范围。
   */
  function initMenuItemTabs(root) {
    (root || document).querySelectorAll('.menu-item-settings').forEach(setupMenuItemTabs);
  }

  function initSwitchTabs() {
    document.querySelectorAll('[data-eva-tabs]').forEach(function (tabs) {
      var scope = SWITCH_TAB_SCOPES[tabs.getAttribute('data-eva-tabs')];
      if (!scope) return;
      var heading = scope.heading
        ? document.querySelector(scope.heading)
        : (document.querySelector('.wrap > .wp-heading-inline') || document.querySelector('.wrap > h1'));
      if (!document.getElementById(scope.form) || !heading) return;

      if (scope.inlineHeading) {
        heading.classList.add('eva-switch-heading');
      }
      if (scope.block) {
        tabs.classList.add('eva-switch-tabs--block');
      }

      // 放到标题行末尾：紧跟 h1 及其后的 .page-title-action（编辑他人资料时的「添加用户」），位于 hr.wp-header-end 之前。
      var anchor = heading;
      while (anchor.nextElementSibling && anchor.nextElementSibling.classList.contains('page-title-action')) {
        anchor = anchor.nextElementSibling;
      }
      anchor.parentNode.insertBefore(tabs, anchor.nextSibling);
      tabs.hidden = false;

      var docEl = document.documentElement;
      var buttons = tabs.querySelectorAll('[data-eva-tab]');

      function select(mode, remember) {
        mode = mode === 'eva' ? 'eva' : 'wp';
        docEl.classList.toggle(scope.htmlClass + 'eva', mode === 'eva');
        docEl.classList.toggle(scope.htmlClass + 'wp', mode === 'wp');
        buttons.forEach(function (button) {
          var on = button.getAttribute('data-eva-tab') === mode;
          button.classList.toggle('is-active', on);
          button.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        if (remember) {
          try { window.sessionStorage.setItem(scope.storageKey, mode); } catch (e) {}
        }
      }

      buttons.forEach(function (button) {
        button.addEventListener('click', function () {
          select(button.getAttribute('data-eva-tab'), true);
        });
      });

      // 初始页签：带锚点的链接（如 #application-passwords-section）指向原生区块，一律回到 WP；否则沿用上次停留的页签。
      var saved = '';
      try { saved = window.sessionStorage.getItem(scope.storageKey) || ''; } catch (e) {}
      select(window.location.hash ? 'wp' : saved, false);
    });
  }

  /*
   * 三个嵌入式表单页的保存入口：用户资料（profile.php / user-edit.php）、
   * 分类编辑（term.php）、新增分类和标签（edit-tags.php 左栏）。
   *
   * 这三页的原生提交按钮都排在长表单的最底部，切到 Eva 页签后表单更长，保存还得先滑到底。
   * 这里把原生按钮收起（只是不显示、不移除），换成一上一下两个入口：
   *   1. 标题行右侧一枚常驻按钮，position: sticky 跟着页面滚，停在哪儿都够得着；
   *   2. 表单一有改动就从底部升起的保存条，改完手不用离开当前位置（没改动时完全不出现）。
   * 另有 ⌘/Ctrl + S 保存，以及带着未保存改动离开页面时的浏览器提醒。
   *
   * 两个入口都只是「代点」原生按钮（native.click()），不自己接管提交：
   * 表单里按回车的隐式提交、新增分类页 tags.js 绑在 #submit 上的 AJAX 流程、
   * 插件改写过的按钮文案与 name/value 因此全都照旧；无 JS 时整页也保持原样。
   */
  var FORM_SCOPES = [
    // 用户资料页：h1 自带 .wp-heading-inline；<p class="submit"> 里只有按钮。
    { form: 'your-profile', submit: '#your-profile > p.submit input[type="submit"]' },
    // 分类/标签编辑页：h1 由切换器那段改成行内。按钮所在的那格还放着「删除」链接，故只收起按钮本身。
    { form: 'edittag', submit: '#edittag .edit-tag-actions input[type="submit"]' },
    // 新增分类/标签：锚在表单自己的「添加新分类」h2 上——页面的 h1 管的是整屏（还含右边的列表）。
    { form: 'addtag', submit: '#addtag > p.submit input[type="submit"]', heading: '#col-left .form-wrap > h2' }
  ];

  function initFormActions() {
    var scope = null;
    var form = null;
    FORM_SCOPES.forEach(function (candidate) {
      if (scope) return;
      var node = document.getElementById(candidate.form);
      if (node) { scope = candidate; form = node; }
    });
    if (!scope) return;

    var native = document.querySelector(scope.submit);
    // 这页没有 Eva 字段（该分类法没配容器之类）就不动原生界面。
    if (!native || !form.querySelector('.eva-embed-root')) return;

    // 按钮文案沿用原生按钮的 value：跟随站点语言，也跟随插件的改写。
    var label = native.value || '保存';

    function submit() {
      native.click();
    }

    function makeButton() {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'eva-submit-btn';
      button.innerHTML = '<i class="ri-save-3-line"></i><span></span>';
      // 文案来自原生按钮的 value，当文本插入，不走 innerHTML。
      button.querySelector('span').textContent = label;
      button.addEventListener('click', submit);
      return button;
    }

    // 入口一：底部保存条。挂在 body 上固定于视口底部，带上 .is-on 才升起来。
    var bar = document.createElement('div');
    bar.className = 'eva-savebar';
    bar.innerHTML = '<div class="eva-savebar-inner"><span class="eva-savebar-tip"><i class="ri-error-warning-line"></i>有未保存的修改</span></div>';
    bar.querySelector('.eva-savebar-inner').appendChild(makeButton());
    document.body.appendChild(bar);

    // 入口二：标题行的吸顶按钮。浮动插在标题「之前」，标题那一行的行盒才会给它让出右边；
    // 浮动之后补一个清除块——资料页有 hr.wp-header-end 顺手清掉，分类编辑页没有，
    // 不清的话后面的 #ajax-response 和整个表单会绕着按钮排。
    var heading = scope.heading
      ? document.querySelector(scope.heading)
      : (document.querySelector('.wrap > .wp-heading-inline') || document.querySelector('.wrap > h1'));
    if (heading) {
      var wrap = document.createElement('span');
      wrap.className = 'eva-sticky-submit';
      wrap.appendChild(makeButton());
      heading.parentNode.insertBefore(wrap, heading);

      // 清除块排在切换器之后：它和标题同属一行，也得在浮动的覆盖范围里。
      var tabs = heading.parentNode.querySelector('[data-eva-tabs]');
      var tail = tabs || heading;
      var clear = document.createElement('div');
      clear.className = 'eva-submit-clear';
      tail.parentNode.insertBefore(clear, tail.nextSibling);
    }

    native.classList.add('eva-submit-native');

    /*
     * 脏状态：决定保存条冒不冒头，也决定离开页面要不要拦一下。
     *
     * Eva 字段由各自的 .eva-embed-root 上报「当前值是否偏离初始值」（见 createAppForRoot），
     * 改回原样就不再算改动；原生字段没法逐个比对，只认用户亲手触发的 input/change（isTrusted），
     * 脚本改值——挂载时的规整、tags.js 新增成功后清空表单——都不算。
     */
    var roots = typeof Map !== 'undefined' ? new Map() : null;
    var nativeDirty = false;
    var dirty = false;

    function refresh() {
      var next = nativeDirty;
      if (roots) { roots.forEach(function (on) { if (on) { next = true; } }); }
      if (next === dirty) return;
      dirty = next;
      bar.classList.toggle('is-on', dirty);
      // 保存条是固定定位，会盖住页面最底部一条；由这个 class 给正文补出等高的下边距。
      document.documentElement.classList.toggle('eva-savebar-on', dirty);
    }

    function clearDirty() {
      nativeDirty = false;
      if (roots) { roots.clear(); }
      refresh();
    }

    form.addEventListener('eva:dirty', function (event) {
      if (!roots) return;
      roots.set(event.target, !!(event.detail && event.detail.dirty));
      refresh();
    });

    ['input', 'change'].forEach(function (type) {
      form.addEventListener(type, function (event) {
        if (!event.isTrusted || nativeDirty) return;
        if (event.target && event.target.closest && event.target.closest('.eva-embed-root')) return;
        nativeDirty = true;
        refresh();
      }, true);
    });

    // 资料页与分类编辑页提交后整页重载，这里清掉脏状态只为避开下面那道离开提醒；
    // 新增分类页走 AJAX，表单留在原地，由 initAddTermForm 在新增成功后派发 eva:form-saved。
    form.addEventListener('submit', clearDirty, true);
    document.addEventListener('eva:form-saved', clearDirty);

    window.addEventListener('beforeunload', function (event) {
      if (!dirty) return;
      event.preventDefault();
      // 老浏览器要靠 returnValue 才弹确认框；文案由浏览器自己定，给什么都一样。
      event.returnValue = '';
    });

    document.addEventListener('keydown', function (event) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (String(event.key).toLowerCase() !== 's') return;
      // 抢在浏览器的「保存网页」之前。
      event.preventDefault();
      submit();
    });
  }

  /*
   * metabox 的显示条件（对应 CSF 的 page_templates / post_formats）。
   *
   * Metabox::render 在 metabox 里输出一个 .eva-mb-conditions 标记，带着允许的页面模板 / 文章形式；
   * 这里跟随编辑器里的选择实时显隐整个 metabox（外层 .postbox）。
   * 区块编辑器从 wp.data 的 core/editor 读取并订阅变化；经典编辑器读「页面属性」里的模板下拉和「形式」单选。
   * 只控制显示：被隐藏的 metabox 里的字段照常随文章提交，切回原模板时值还在。
   */
  function initMetaboxConditions() {
    var rules = [];
    document.querySelectorAll('.eva-mb-conditions').forEach(function (node) {
      var box = node.closest('.postbox');
      if (!box) return;
      var templates = [];
      var formats = [];
      try { templates = JSON.parse(node.getAttribute('data-eva-page-templates') || '[]'); } catch (e) {}
      try { formats = JSON.parse(node.getAttribute('data-eva-post-formats') || '[]'); } catch (e) {}
      rules.push({ box: box, templates: templates, formats: formats });
    });
    if (!rules.length) return;

    // 只有区块编辑器页才注册了 core/editor；经典编辑器下直接 select 会在控制台报「store 未注册」。
    var blockEditor = document.body.classList.contains('block-editor-page') && window.wp && window.wp.data && window.wp.data.select;
    function editorAttribute(name) {
      var store = blockEditor ? window.wp.data.select('core/editor') : null;
      return store && store.getEditedPostAttribute ? store.getEditedPostAttribute(name) : undefined;
    }
    function currentTemplate() {
      var value = editorAttribute('template');
      if (value === undefined) {
        var select = document.getElementById('page_template');
        value = select ? select.value : '';
      }
      return value ? String(value) : 'default';
    }
    function currentFormat() {
      var value = editorAttribute('format');
      if (value === undefined) {
        var checked = document.querySelector('input[name="post_format"]:checked');
        value = checked ? checked.value : '';
      }
      return !value || value === '0' ? 'standard' : String(value);
    }

    var last = '';
    function apply() {
      var template = currentTemplate();
      var format = currentFormat();
      // wp.data.subscribe 在编辑器里任何状态变化都会触发，值没变就不碰 DOM。
      if (template + '|' + format === last) return;
      last = template + '|' + format;
      rules.forEach(function (rule) {
        var matched = (!rule.templates.length || rule.templates.indexOf(template) !== -1)
          && (!rule.formats.length || rule.formats.indexOf(format) !== -1);
        rule.box.classList.toggle('eva-mb-hidden', !matched);
      });
    }

    if (blockEditor && window.wp.data.subscribe) {
      window.wp.data.subscribe(apply);
    }
    document.addEventListener('change', function (event) {
      var target = event.target;
      if (target && (target.id === 'page_template' || target.name === 'post_format')) apply();
    });
    apply();
  }

  /*
   * 短代码生成器（对应 CSF 的 Shortcoder）。
   *
   * Shortcoder::render_dialogs 在页脚输出每个短代码的弹窗（内含嵌入式挂载点，字段照常由上面的流程挂载）；
   * 这里负责：打开 / 关闭弹窗、随字段值实时预览短代码、点「插入」时交给调用方。
   * 两个入口共用：经典编辑器的按钮（.eva-shortcoder-open，插入到对应的编辑器）和区块编辑器的短代码区块
   * （eva-shortcoder-blocks.js 调 window.EvaShortcoder.open(id, 回调)，把短代码写回区块）。
   *
   * 拼装规则：字段 id 即属性名；布尔值写 1 / 0；数组用逗号连接；对象类的值（字段组等）短代码属性表达不了，跳过；
   * 空值不写；id 为 content 的字段作为「包裹内容」放在开闭标签之间（与 CSF 一致）。
   */
  /**
   * 把短代码入口搬到编辑器工具条的右端（「可视化 / 代码」标签左边）。
   *
   * WP 只在行首的 media_buttons 处给了输出点，想靠右就得挪节点：
   * .wp-editor-tabs 是 float: right，入口插在它前面同样 float: right，就排在它左边；
   * 比起用绝对定位去躲标签的宽度稳得多。挪不动（结构对不上）就原地不动，不影响功能。
   */
  function relocateShortcoderEntries() {
    [].forEach.call(document.querySelectorAll('.wp-editor-tools'), function (tools) {
      var entry = tools.querySelector('.wp-media-buttons > .eva-shortcoder-open, .wp-media-buttons > .eva-shortcoder-menu');
      if (!entry) return;
      tools.insertBefore(entry, tools.querySelector('.wp-editor-tabs'));
    });
  }

  function initShortcoders() {
    var dialogs = document.querySelectorAll('.eva-shortcoder-dialog');
    if (!dialogs.length) return;
    relocateShortcoderEntries();
    var pending = null; // { dialog, done }

    function dialogFor(id) {
      for (var i = 0; i < dialogs.length; i++) {
        if (dialogs[i].getAttribute('data-eva-id') === String(id)) return dialogs[i];
      }
      return null;
    }

    function escapeAttr(value) {
      return String(value).replace(/"/g, '&quot;').replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');
    }

    function build(dialog) {
      var tag = dialog.getAttribute('data-eva-shortcode') || dialog.getAttribute('data-eva-id');
      var root = dialog.querySelector('.eva-embed-root');
      var model = (root && rootModels && rootModels.get(root)) || {};
      var attrs = '';
      var content = '';
      Object.keys(model).forEach(function (key) {
        var value = model[key];
        if (key.indexOf('_eva_') === 0 || value === '' || value == null) return;
        if (typeof value === 'boolean') { value = value ? '1' : '0'; }
        else if (Array.isArray(value)) {
          value = value.filter(function (item) { return item !== '' && item != null && typeof item !== 'object'; }).join(',');
          if (value === '') return;
        } else if (typeof value === 'object') { return; }
        if (key === 'content') { content = String(value); return; }
        attrs += ' ' + key + '="' + escapeAttr(value) + '"';
      });
      return '[' + tag + attrs + ']' + (content !== '' ? content + '[/' + tag + ']' : '');
    }

    function refresh(dialog) {
      var preview = dialog.querySelector('.eva-shortcoder-preview');
      if (preview) preview.textContent = build(dialog);
    }

    function open(id, done) {
      var dialog = dialogFor(id);
      if (!dialog) return;
      pending = { dialog: dialog, done: done };
      dialog.hidden = false;
      refresh(dialog);
      // 字段值变化时刷新预览：值在 Vue 里，最省事的办法是弹窗开着的时候定时读一下。
      dialog.__evaTimer = window.setInterval(function () { refresh(dialog); }, 400);
    }

    function close() {
      if (!pending) return;
      window.clearInterval(pending.dialog.__evaTimer);
      pending.dialog.hidden = true;
      pending = null;
    }

    // 插入经典编辑器：send_to_editor 会按 wpActiveEditor 找到对应实例，可视化 / 文本两种模式都能处理。
    function insertIntoEditor(editorId, shortcode) {
      if (editorId) { window.wpActiveEditor = editorId; }
      if (typeof window.send_to_editor === 'function') {
        window.send_to_editor(shortcode);
        return;
      }
      var area = document.getElementById(editorId || 'content');
      if (area && typeof area.value === 'string') { area.value += shortcode; }
    }

    document.addEventListener('click', function (event) {
      var target = event.target && event.target.closest ? event.target : null;
      if (!target) return;
      var opener = target.closest('.eva-shortcoder-open');
      if (opener) {
        event.preventDefault();
        // 从下拉里点进来的：弹窗开了，菜单就该收起来。
        var menu = opener.closest('details.eva-shortcoder-menu');
        if (menu) { menu.open = false; }
        var editorId = opener.getAttribute('data-eva-editor') || '';
        open(opener.getAttribute('data-eva-id'), function (shortcode) { insertIntoEditor(editorId, shortcode); });
        return;
      }
      // 点在菜单外面收起它——原生 details 不会自己关。
      var insideMenu = target.closest('details.eva-shortcoder-menu');
      [].forEach.call(document.querySelectorAll('details.eva-shortcoder-menu[open]'), function (item) {
        if (item !== insideMenu) { item.open = false; }
      });
      if (!pending) return;
      if (target.closest('.eva-shortcoder-insert')) {
        var shortcode = build(pending.dialog);
        var done = pending.done;
        close();
        if (typeof done === 'function') done(shortcode);
      } else if (target.closest('.eva-shortcoder-close, .eva-shortcoder-cancel') || target === pending.dialog) {
        // 点关闭、取消，或点在面板外面的遮罩上。
        close();
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && pending) close();
    });

    window.EvaShortcoder = { open: open, close: close };
  }

  // 挂载单个根节点；已挂载的、还只是模板的都跳过。
  function mountRoot(root) {
    if (!root || (rootModels && rootModels.has(root))) return;
    // 小工具页「可用小工具」列表里的表单是模板（编号是 __i__ 占位符），WP 添加小工具时克隆的就是这份 DOM，不能挂载。
    var prefixHost = root.closest ? root.closest('[data-eva-name-prefix]') : null;
    if (prefixHost && /__i__|%i%/.test(prefixHost.getAttribute('data-eva-name-prefix') || '')) return;
    var data = root.querySelector('.eva-embed-data');
    if (!data) return;
    var mount = root.querySelector('.eva-embed-mount');
    // 走到这里却已经带着 is-mounted：是连同渲染结果一起被克隆 / 重绘出来的节点，清掉旧的渲染结果重新挂。
    if (root.classList.contains('is-mounted') && mount) {
      mount.innerHTML = '';
      root.classList.remove('is-mounted');
    }
    try {
      createAppForRoot(root, JSON.parse(data.textContent || '{}'));
    } catch (error) {
      if (mount) mount.innerHTML = '<div class="eva-embed-error">字段加载失败，请刷新页面重试。</div>';
    }
  }

  function mountAll(scope) {
    (scope || document).querySelectorAll('.eva-embed-root').forEach(mountRoot);
  }

  // 卸载一个根节点：销毁 Vue 应用、撤掉挂载期登记的全局监听、清空三张表，
  // 使同一节点之后还能重新挂载（mountRoot 是靠 rootModels 判断「已挂载」的）。
  function unmountRoot(root) {
    if (!root) return;
    var app = rootApps && rootApps.get(root);
    if (app) {
      try { app.unmount(); } catch (error) {}
      rootApps.delete(root);
    }
    var cleanups = rootCleanups && rootCleanups.get(root);
    if (cleanups) {
      cleanups.forEach(function (fn) { try { fn(); } catch (error) {} });
      rootCleanups.delete(root);
    }
    if (rootModels) { rootModels.delete(root); }
    if (rootResets) { rootResets.delete(root); }
    root.classList.remove('is-mounted');
  }

  /*
   * 宿主接管型容器（目前是区块编辑器）用的三个口子。
   *
   * 区块的值不走表单提交，而是作为区块属性存在文章内容里，所以 eva-blocks.js 自己造挂载点、
   * 自己挂载，再通过 eva:change 事件收值、通过 setValues 把外部改动（撤销/重做、切换区块）推回来。
   * setValues 只写真正变了的键，因此不会和 eva:change 形成回环。
   */
  window.EvaEmbed = {
    mount: mountRoot,
    mountAll: mountAll,
    unmount: unmountRoot,
    // 把外部值推回已挂载的字段模型；未声明的字段键忽略。
    setValues: function (root, values) {
      var model = rootModels && rootModels.get(root);
      if (!model || !values || typeof values !== 'object') return;
      Object.keys(values).forEach(function (key) {
        if (!Object.prototype.hasOwnProperty.call(model, key)) return;
        if (JSON.stringify(model[key]) === JSON.stringify(values[key])) return;
        model[key] = clone(values[key]);
      });
    },
    /*
     * 按分区声明算出「完整」的默认值集合：写了 default 的用它，没写的按字段类型给空值。
     *
     * PHP 的 Eva::default_values 只产出显式写了 default 的字段，其余的键根本不存在；
     * 区块把它当作初始值用时，一旦撤销退回空属性，那些没有 default 的字段就没人去覆盖，
     * 面板里会留着上一次的值。这里补齐所有字段，让「属性里缺这个键」== 「该字段回默认值」。
     */
    defaults: function (sections) {
      var out = {};
      (sections || []).forEach(function (section) {
        (section.fields || []).forEach(function (field) {
          if (!field || !field.id) return;
          out[field.id] = defaultValue(field);
        });
      });
      return out;
    },
    // 读当前值的快照（普通对象，不是响应式代理）。
    getValues: function (root) {
      var model = rootModels && rootModels.get(root);
      return model ? clone(model) : null;
    }
  };

  mountAll(document);

  // 页面加载之后才出现的字段区也要挂载：菜单页新加的菜单项、小工具保存后被整段重绘的表单、区块编辑器里的旧版小工具…
  if (typeof MutationObserver !== 'undefined') {
    var mountTimer = null;
    new MutationObserver(function (records) {
      var found = false;
      for (var i = 0; i < records.length && !found; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType === 1 && ((node.matches && node.matches('.eva-embed-root')) || (node.querySelector && node.querySelector('.eva-embed-root')))) {
            found = true;
            break;
          }
        }
      }
      if (!found) return;
      // 合并同一批 DOM 变动，等 WP 自己的脚本把节点处理完（替换 __i__ 等）再挂载。
      window.clearTimeout(mountTimer);
      mountTimer = window.setTimeout(function () {
        mountAll(document);
        // 新增的菜单项是 AJAX 插进来的，页签要跟着补上。
        initMenuItemTabs();
      }, 50);
    }).observe(document.body, { childList: true, subtree: true });
  }

  // 必须在字段挂载之后：WP 页签会把 Eva 容器设为 display:none，先挂载可保证字段在可见状态下完成初始化。
  initSwitchTabs();
  initMenuItemTabs();
  initAddTermForm();
  initFormActions();
  initMetaboxConditions();
  initShortcoders();
})();
