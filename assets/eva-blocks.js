/**
 * Eva Framework —— 区块编辑器区块。
 *
 * Block::enqueue 输出 window.EvaBlocks（每个 Eva::createBlock 一条），这里逐个注册成区块。
 * 区块全部是动态区块：save 返回 null，前台由 PHP 的 render_callback 现渲染；
 * 字段值统一收在一个对象属性 eva 里。
 *
 * 关键点是「Vue 字段面板挂在 React 区块里」：Eva 的字段组件是 Vue 3 的，区块编辑器是 React 的，
 * 所以这里只渲染一个空 div 交给 Vue 全权接管，再靠 eva-embed.js 暴露的三个口子通消息——
 * 挂载 EvaEmbed.mount、收值听 eva:change 事件、外部改动（撤销/重做）用 EvaEmbed.setValues 推回去。
 * 区块取消选中时侧栏会被 React 卸掉，务必跟着 EvaEmbed.unmount，否则反复选区块会漏 Vue 实例。
 *
 * 值的流向要留意：字段面板那块 DOM 归 Vue 管，React 只持有一个空的宿主 div，
 * 所以 React 重渲染对面板里的值没有任何作用——真正要更新的是 Vue 的响应式模型。
 * 因此外部改动（撤销/重做、工具栏、代码编辑器）不走 props，而是 wp.data.subscribe
 * 订阅区块属性，变了直接 EvaEmbed.setValues 推给 Vue；反向则听 eva:change 事件写回属性。
 * 工具栏那半边是纯 React 控件，就照常用 useSelect。
 */
(function (wp) {
  'use strict';

  if (!wp || !wp.blocks || !wp.element || !wp.blockEditor || !wp.data) { return; }

  var configs = Array.isArray(window.EvaBlocks) ? window.EvaBlocks : [];
  if (!configs.length) { return; }

  var el = wp.element.createElement;
  var Fragment = wp.element.Fragment;
  var useRef = wp.element.useRef;
  var useSelect = wp.data.useSelect;
  var useEffect = wp.element.useEffect;
  var InspectorControls = wp.blockEditor.InspectorControls;
  var InnerBlocks = wp.blockEditor.InnerBlocks;
  var useBlockProps = wp.blockEditor.useBlockProps;
  var BlockControls = wp.blockEditor.BlockControls;
  var PanelBody = wp.components && wp.components.PanelBody;
  var ToolbarGroup = wp.components && wp.components.ToolbarGroup;
  var ToolbarButton = wp.components && wp.components.ToolbarButton;
  var ToolbarDropdownMenu = wp.components && wp.components.ToolbarDropdownMenu;
  var Placeholder = wp.components && wp.components.Placeholder;
  var ServerSideRender = wp.serverSideRender;

  // 文案走 Eva 自己的 i18n（eva-embed.js 在没有全屏外壳时提供兜底词表）。
  function t(key) {
    return (window.EvaI18n && window.EvaI18n.t) ? window.EvaI18n.t(key) : key;
  }
  function tv(value) {
    return (window.EvaI18n && window.EvaI18n.tv)
      ? window.EvaI18n.tv(value)
      : (value == null ? '' : String(value));
  }

  /**
   * 从区块属性算出完整的字段值：类型空值 → 作者默认值 → 已存属性，逐层盖上去。
   *
   * 三层缺一不可：EvaEmbed.defaults 保证每个字段都有键（没写 default 的按类型给空值），
   * config.defaults 是 PHP 侧转换过形态的作者默认值，属性里存的是用户真正动过的部分。
   * 少了第一层，撤销退回空属性时那些没写 default 的字段就没人覆盖，面板里会留着上一次的值。
   *
   * @param {Object} config     区块配置。
   * @param {Object} attributes 区块属性。
   * @return {Object}           [field_id => value]
   */
  function blockValues(config, attributes) {
    var saved = attributes && attributes.eva;
    // 属性可能缺失、或被手工改成了别的形状，一律当对象处理。
    var stored = (saved && typeof saved === 'object' && !Array.isArray(saved)) ? saved : {};
    // 工具栏字段已经被 PHP 从 sections 里摘走了，算空值时要把它们补回来，
    // 否则撤销退回空属性时工具栏上的字段没人覆盖，会留着上一次的值。
    var groups = (config.sections || []).concat(
      (config.toolbar && config.toolbar.length) ? [{ fields: config.toolbar }] : []
    );
    var blank = (window.EvaEmbed && window.EvaEmbed.defaults) ? window.EvaEmbed.defaults(groups) : {};
    return Object.assign({}, blank, config.defaults || {}, stored);
  }

  /**
   * 把字段的 options 归一成 [{value, label, icon}]。
   *
   * Eva / CSF 的 options 可能是 {键: 文案} 映射，也可能是 [{value, label}] 列表，
   * 还可能是纯字符串数组（值即文案）。
   *
   * @param {*} options 字段的 options。
   * @return {Array} 归一后的选项列表。
   */
  function toolbarOptions(options) {
    if (!options) { return []; }
    if (Array.isArray(options)) {
      return options.map(function (opt) {
        if (opt && typeof opt === 'object') {
          return { value: opt.value != null ? opt.value : opt.key, label: opt.label != null ? opt.label : opt.value, icon: opt.icon };
        }
        return { value: opt, label: opt };
      });
    }
    return Object.keys(options).map(function (key) {
      var opt = options[key];
      if (opt && typeof opt === 'object' && !Array.isArray(opt)) {
        return { value: key, label: opt.label != null ? opt.label : key, icon: opt.icon };
      }
      return { value: key, label: opt };
    });
  }

  /**
   * 把一个 Eva 字段渲染成工具栏控件。
   *
   * 这里刻意不用 Eva 自己的 Vue 组件：工具栏是一排紧凑的原生按钮，塞个 Vue 应用进去
   * 既重、又和周围的 WordPress 控件长得不一样。用 wp.components 的工具栏控件，
   * 读写的仍是同一个区块属性，和右侧栏的字段天然同步。
   *
   * @param {Object}   field 字段 schema。
   * @param {*}        value 当前值。
   * @param {Function} onSet 写回新值。
   * @return {*} React 元素或元素数组。
   */
  function toolbarControl(field, value, onSet) {
    var type = String(field.type || '').toLowerCase();
    var title = tv(field.title) || field.id;

    // 开关：一个按下态的图标按钮。
    if (type === 'switcher') {
      var on = !!Number(value);
      return el(ToolbarButton, {
        icon: field.toolbar_icon || 'admin-generic',
        label: title,
        isActive: on,
        onClick: function () { onSet(on ? 0 : 1); }
      });
    }

    var options = toolbarOptions(field.options);

    // 下拉：选项多的时候摊开会把工具栏撑爆，收进一个下拉菜单。
    if (type === 'select') {
      return el(ToolbarDropdownMenu, {
        icon: field.toolbar_icon || 'arrow-down-alt2',
        label: title,
        controls: options.map(function (opt) {
          return {
            title: tv(opt.label),
            isActive: String(value) === String(opt.value),
            onClick: function () { onSet(opt.value); }
          };
        })
      });
    }

    // 按钮组 / 单选：每个选项一个按钮，写了 icon 就只显示图标（文字进 tooltip）。
    return options.map(function (opt) {
      return el(ToolbarButton, {
        key: String(opt.value),
        icon: opt.icon || undefined,
        label: title + '：' + tv(opt.label),
        isActive: String(value) === String(opt.value),
        onClick: function () { onSet(opt.value); }
      }, opt.icon ? null : tv(opt.label));
    });
  }

  /**
   * 区块工具栏：渲染标了 'toolbar' => true 的字段。
   *
   * props: config（区块配置）、clientId（区块实例 id）
   */
  function EvaBlockToolbar(props) {
    var config = props.config;
    var clientId = props.clientId;

    var attributes = useSelect(function (select) {
      return select('core/block-editor').getBlockAttributes(clientId);
    }, [clientId]);
    var values = blockValues(config, attributes);

    function setField(id, value) {
      var next = Object.assign({}, values);
      next[id] = value;
      wp.data.dispatch('core/block-editor').updateBlockAttributes(clientId, { eva: next });
    }

    // 一个字段一组，工具栏里自带分隔线。
    return el(BlockControls, { group: 'block' },
      config.toolbar.map(function (field) {
        return el(ToolbarGroup, { key: field.id },
          toolbarControl(field, values[field.id], function (value) { setField(field.id, value); })
        );
      })
    );
  }

  /**
   * Eva 字段面板：造一个 .eva-embed-root 交给 eva-embed.js 挂载 Vue，React 侧只持有宿主节点。
   *
   * 值不走 props：面板内容由 Vue 渲染，React 重渲染推不动它（原因见文件头注释），
   * 所以自己订阅区块属性、用 EvaEmbed.setValues 推给 Vue，再听 eva:change 写回去。
   *
   * props: config（区块配置）、clientId（区块实例 id）、context（inspector|content）
   */
  function EvaFieldPanel(props) {
    var config = props.config;
    var clientId = props.clientId;
    var hostRef = useRef(null);

    useEffect(function () {
      var host = hostRef.current;
      if (!host || !window.EvaEmbed) { return; }

      // placement=content 时宿主节点在画布 iframe 里，节点要用它自己的 document 造。
      var doc = host.ownerDocument || document;
      var store = wp.data.select('core/block-editor');
      var current = blockValues(config, store.getBlockAttributes(clientId));
      // 上一次见到的原始属性，用作订阅里的快速短路（引用没变就一定没改）。
      var lastRaw = (store.getBlockAttributes(clientId) || {}).eva;

      // eva-embed.js 认的那套结构：根节点 + 内联 JSON + 挂载点。
      var root = doc.createElement('div');
      root.className = 'eva-embed-root eva-block-root';
      root.setAttribute('data-eva-embed', 'block');
      // 右侧栏只有 ~280px 宽，复用 metabox 侧栏那套窄栏样式；画在区块里时用常规宽度。
      root.setAttribute('data-eva-context', props.context === 'content' ? 'normal' : 'side');

      var data = doc.createElement('script');
      data.type = 'application/json';
      data.className = 'eva-embed-data';
      data.textContent = JSON.stringify({
        container: 'block',
        id: config.name,
        // 区块不提交表单，隐藏域只是陪跑；前缀给一个不会和后台表单撞车的名字。
        namePrefix: 'eva_block',
        sections: config.sections || [],
        dependencySources: config.dependencySources || {},
        values: current
      });

      var mount = doc.createElement('div');
      mount.className = 'eva-embed-mount';
      root.appendChild(data);
      root.appendChild(mount);
      host.appendChild(root);

      // 字段改了 → 写回区块属性。
      function onFieldChange(event) {
        var detail = event.detail && event.detail.values;
        if (!detail) { return; }
        // 面板里只有非工具栏字段，回传的也只有这些；合并而不是替换，否则工具栏字段会被抹掉。
        var next = Object.assign({}, current, detail);
        // 值没真的变就别写属性，免得刚选中区块就把文章标记成「有未保存的修改」。
        if (JSON.stringify(next) === JSON.stringify(current)) { return; }
        current = next;
        wp.data.dispatch('core/block-editor').updateBlockAttributes(clientId, { eva: next });
        lastRaw = (store.getBlockAttributes(clientId) || {}).eva;
      }
      root.addEventListener('eva:change', onFieldChange);
      window.EvaEmbed.mount(root);

      // 属性被别处改了（撤销/重做、工具栏、代码编辑器）→ 推回 Vue 的字段模型。
      // subscribe 是全局的、每次仓库变动都会调，所以先用属性引用短路掉绝大多数调用。
      var unsubscribe = wp.data.subscribe(function () {
        var attrs = store.getBlockAttributes(clientId);
        // 区块已被删除：等着 React 卸载即可。
        if (!attrs || attrs.eva === lastRaw) { return; }
        lastRaw = attrs.eva;
        var next = blockValues(config, attrs);
        if (JSON.stringify(next) === JSON.stringify(current)) { return; }
        current = next;
        window.EvaEmbed.setValues(root, next);
      }, 'core/block-editor');

      return function () {
        unsubscribe();
        root.removeEventListener('eva:change', onFieldChange);
        window.EvaEmbed.unmount(root);
        if (root.parentNode) { root.parentNode.removeChild(root); }
      };
    }, [clientId]);

    return el('div', { className: 'eva-block-fields', ref: hostRef });
  }

  /**
   * 注册单个区块。
   *
   * @param {Object} config Block::editor_payload 里的一条。
   */
  function registerBlock(config) {
    if (!config || !config.name || wp.blocks.getBlockType(config.name)) { return; }

    var title = tv(config.title) || config.name;

    wp.blocks.registerBlockType(config.name, {
      apiVersion: 2,
      title: title,
      description: tv(config.description),
      icon: config.icon || 'screenoptions',
      category: config.category || 'widgets',
      keywords: (config.keywords || []).map(tv),
      supports: config.supports || {},
      // 所有字段值收在一个对象属性里（缘由见 class-eva-block.php 的类注释）。
      attributes: { eva: { type: 'object' } },

      edit: function (props) {
        var blockProps = useBlockProps
          ? useBlockProps({ className: 'eva-block' })
          : { className: 'eva-block' };

        var panel = el(EvaFieldPanel, {
          config: config,
          clientId: props.clientId,
          context: config.placement
        });

        var body;
        var panelInBody = false;

        if (config.placement === 'content') {
          // 字段直接画在区块里：预览和字段抢同一块地方，让位给字段。
          panelInBody = true;
          body = config.innerBlocks
            ? el('div', { className: 'eva-block-content' }, panel, el('div', { className: 'eva-block-inner' }, el(InnerBlocks, null)))
            : el('div', { className: 'eva-block-content' }, panel);
        } else if (config.innerBlocks) {
          body = el(InnerBlocks, null);
        } else if (config.preview && ServerSideRender) {
          // 服务端预览：直接调 render_callback，画布里看到的就是前台的样子。
          body = el(ServerSideRender, { block: config.name, attributes: props.attributes });
        } else if (Placeholder) {
          body = el(Placeholder, { icon: config.icon, label: title },
            el('p', null, config.renderable ? t('block_settings') : t('block_no_render')));
        } else {
          body = el('p', null, title);
        }

        var hasToolbar = config.toolbar && config.toolbar.length && BlockControls && ToolbarGroup;

        return el(Fragment, null,
          hasToolbar ? el(EvaBlockToolbar, { config: config, clientId: props.clientId }) : null,
          panelInBody || !InspectorControls || !PanelBody
            ? null
            : el(InspectorControls, null, el(PanelBody, { title: t('block_settings'), initialOpen: true }, panel)),
          el('div', blockProps, body)
        );
      },

      // 动态区块：前台每次由 PHP 渲染，这里只保留嵌套子区块的内容。
      save: config.innerBlocks
        ? function () { return el(InnerBlocks.Content, null); }
        : function () { return null; }
    });
  }

  configs.forEach(registerBlock);
})(window.wp);
