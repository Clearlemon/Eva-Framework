/**
 * Eva Framework —— 短代码区块（区块编辑器）。
 *
 * Shortcoder::register_blocks 为写了 gutenberg 参数的短代码容器输出 window.EvaShortcoderBlocks，
 * 这里逐个注册成区块。区块本身很薄：
 * - 编辑态：一个显示当前短代码的文本框 + 「生成短代码」按钮；按钮打开 eva-embed.js 里的生成器弹窗
 *   （window.EvaShortcoder.open），弹窗点「插入」后把短代码写回区块。
 * - 保存：内容就是短代码文本本身（RawHTML），前台照常由 do_shortcode 解析，停用 Eva 也不会留下坏区块。
 */
(function (wp) {
  'use strict';
  if (!wp || !wp.blocks || !wp.element) { return; }

  var el = wp.element.createElement;
  var blocks = Array.isArray(window.EvaShortcoderBlocks) ? window.EvaShortcoderBlocks : [];

  blocks.forEach(function (config) {
    if (!config || !config.name || wp.blocks.getBlockType(config.name)) { return; }

    wp.blocks.registerBlockType(config.name, {
      apiVersion: 2,
      title: config.title,
      description: config.description,
      icon: config.icon || 'shortcode',
      category: config.category || 'widgets',
      keywords: config.keywords || [],
      supports: { html: false, customClassName: false },
      attributes: {
        shortcode: { type: 'string', default: '' }
      },
      edit: function (props) {
        var blockProps = wp.blockEditor && wp.blockEditor.useBlockProps ? wp.blockEditor.useBlockProps({ className: 'eva-shortcode-block' }) : { className: 'eva-shortcode-block' };
        function openGenerator() {
          if (window.EvaShortcoder && window.EvaShortcoder.open) {
            window.EvaShortcoder.open(config.id, function (shortcode) { props.setAttributes({ shortcode: shortcode }); });
          }
        }
        return el('div', blockProps,
          el('div', { className: 'eva-shortcode-block-head' },
            el('strong', null, config.title),
            el('button', { type: 'button', className: 'components-button is-secondary is-small', onClick: openGenerator }, '生成短代码')
          ),
          el('textarea', {
            className: 'eva-shortcode-block-text',
            rows: 2,
            value: props.attributes.shortcode || '',
            placeholder: config.placeholder || '',
            onChange: function (event) { props.setAttributes({ shortcode: event.target.value }); }
          })
        );
      },
      save: function (props) {
        return el(wp.element.RawHTML, null, props.attributes.shortcode || '');
      }
    });
  });
})(window.wp);
