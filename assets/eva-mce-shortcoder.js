/**
 * TinyMCE 插件：把 Eva 的短代码生成器放进可视化编辑器的格式工具栏（B / I / 列表那一排）。
 *
 * 由 Shortcoder::mce_external_plugins 注册，按钮位置由 Shortcoder::mce_buttons 决定。
 * 弹窗本身仍是 eva-embed.js 那一套，这里只负责：按钮、下拉菜单、把生成的短代码插进编辑器。
 * 容器清单来自 PHP 注入的 window.EvaShortcoderButtons（[{ id, label }]）。
 *
 * 注意：TinyMCE 工具栏只存在于「可视化」模式；切到「代码」模式时整条工具栏都会消失，
 * 这个入口也跟着没有——这是把按钮放进工具栏的固有代价。
 */
(function () {
  if (typeof window.tinymce === 'undefined') {
    return;
  }

  window.tinymce.PluginManager.add('eva_shortcoder', function (editor) {
    var items = window.EvaShortcoderButtons || [];
    if (!items.length) {
      return;
    }

    /**
     * 打开某个短代码容器的弹窗，确认后把短代码插到当前光标处。
     *
     * @param {string} id 容器 id。
     */
    function openFor(id) {
      if (!window.EvaShortcoder || typeof window.EvaShortcoder.open !== 'function') {
        return;
      }
      window.EvaShortcoder.open(id, function (shortcode) {
        editor.insertContent(shortcode);
      });
    }

    // 只有一个短代码：按钮直接开它的弹窗，提示文字用容器自己的 button_title。
    if (items.length === 1) {
      editor.addButton('eva_shortcoder', {
        icon: 'eva-shortcoder',
        tooltip: items[0].label,
        onclick: function () {
          openFor(items[0].id);
        }
      });
      return;
    }

    // 多个：做成带下拉的 menubutton，TinyMCE 自己负责菜单的开合与键盘操作。
    editor.addButton('eva_shortcoder', {
      type: 'menubutton',
      icon: 'eva-shortcoder',
      tooltip: '插入元素',
      menu: items.map(function (item) {
        return {
          text: item.label,
          onclick: function () {
            openFor(item.id);
          }
        };
      })
    });
  });
})();
