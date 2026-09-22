<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 短代码生成器容器（对应 CSF::createShortcoder）。
 *
 * - 前台：注册同名短代码，按字段默认值合并 atts；输出由 filter eva_shortcode_{tag} 决定。
 * - 后台：经典编辑器的入口是 TinyMCE 格式工具栏上的一个按钮（assets/eva-mce-shortcoder.js）；
 *         弹窗（内含嵌入式挂载点）统一在页脚输出一份，由 eva-embed.js 的 initShortcoders 负责
 *         打开、用字段值拼出短代码。放 media_buttons 的旧入口保留在 editor_button()，未挂钩子。
 * - 区块编辑器：容器写了 gutenberg 参数时注册一个同名区块，区块里同样用这个弹窗生成短代码。
 *
 * 与 CSF 同名的参数：button_title（按钮文字）、insert_title（弹窗里的插入按钮文字）、
 * show_in_editor（false = 不在经典编辑器放按钮）、gutenberg（title / description / icon / category / keywords / placeholder）。
 *
 * @package Eva\Framework
 */
class Shortcoder
{
    /**
     * 挂载短代码注册、编辑器入口、后台资源加载钩子。
     */
    public function __construct()
    {
        // 前台/全局：注册短代码。
        add_action('init', [$this, 'register_shortcodes']);
        // 经典编辑器：入口放进 TinyMCE 的格式工具栏（B / I / 列表那一排）。
        add_filter('mce_external_plugins', [$this, 'mce_external_plugins']);
        add_filter('mce_buttons', [$this, 'mce_buttons']);
        // 弹窗放页脚、整页只输出一份：编辑器可能有多个实例，跟着入口走会重复输出。
        add_action('admin_footer', [$this, 'render_dialogs']);
        // 区块编辑器：注册短代码区块。
        add_action('enqueue_block_editor_assets', [$this, 'register_blocks']);
        // 后台资源按需加载。
        add_action('admin_enqueue_scripts', [$this, 'enqueue']);
    }

    /**
     * 为每个容器注册同名短代码；输出交由 filter 决定。
     *
     * @return void
     */
    public function register_shortcodes()
    {
        foreach (\Eva::get_shortcoders() as $id => $cfg) {
            // 短代码标签默认用容器 id，可由 cfg.shortcode 覆盖。
            $tag = isset($cfg['shortcode']) ? $cfg['shortcode'] : $id;
            add_shortcode($tag, function ($atts, $content = '') use ($cfg, $tag) {
                // 用字段默认值兜底合并用户传入的 atts。
                $atts = shortcode_atts(self::field_defaults($cfg), is_array($atts) ? $atts : [], $tag);
                // 实际 HTML 输出由站点通过 filter eva_shortcode_{tag} 提供。
                return apply_filters('eva_shortcode_' . $tag, '', $atts, $content);
            });
        }
    }

    /**
     * 经典编辑器上方放每个短代码的生成器入口，并预置隐藏的嵌入式挂载点弹窗。
     *
     * @param array $plugins 现有 TinyMCE 外部插件清单。
     * @return array
     */
    public function mce_external_plugins($plugins)
    {
        // 没有容器就不往 TinyMCE 里塞东西。
        if (empty(\Eva::get_shortcoders())) {
            return $plugins;
        }
        $plugins['eva_shortcoder'] = EVA_FW_URL . 'assets/eva-mce-shortcoder.js?ver='
            . \Eva::asset_ver('assets/eva-mce-shortcoder.js');
        return $plugins;
    }

    /**
     * 把按钮排到 TinyMCE 第一行工具栏的末尾。
     *
     * @param array $buttons 现有按钮清单。
     * @return array
     */
    public function mce_buttons($buttons)
    {
        if (empty(\Eva::get_shortcoders()) || in_array('eva_shortcoder', $buttons, true)) {
            return $buttons;
        }
        $buttons[] = 'eva_shortcoder';
        return $buttons;
    }

    /**
     * 供 TinyMCE 插件读取的容器清单（id + 按钮文字）。
     *
     * @return array[] [['id' => ..., 'label' => ...], ...]
     */
    public static function editor_items()
    {
        $items = [];
        foreach (\Eva::get_shortcoders() as $id => $cfg) {
            // show_in_editor => false：这个短代码不在经典编辑器里露面（仍可用于区块编辑器）。
            if (array_key_exists('show_in_editor', $cfg) && ! $cfg['show_in_editor']) {
                continue;
            }
            $items[] = [
                'id'    => $id,
                'label' => ! empty($cfg['button_title']) ? $cfg['button_title'] : (isset($cfg['title']) ? $cfg['title'] : $id),
            ];
        }
        return $items;
    }

    /**
     * 备用入口：把生成器按钮放在 media_buttons（「添加媒体」旁）。
     *
     * 现在默认走 TinyMCE 工具栏，这个方法不再挂钩子。「代码」模式下 TinyMCE 工具栏不存在，
     * 需要在那里也能插短代码时，把 add_action('media_buttons', [$this, 'editor_button']) 加回构造函数即可。
     *
     * @param string $editor_id 当前编辑器实例 id（由 media_buttons 传入）。
     * @return void
     */
    public function editor_button($editor_id)
    {
        // 无短代码容器则不输出任何入口。
        if (empty(\Eva::get_shortcoders())) {
            return;
        }
        // 先筛出真正要在经典编辑器露面的容器。
        $items = [];
        foreach (\Eva::get_shortcoders() as $id => $cfg) {
            // show_in_editor => false：这个短代码不在经典编辑器里放按钮（仍可用于区块编辑器）。
            if (array_key_exists('show_in_editor', $cfg) && ! $cfg['show_in_editor']) {
                continue;
            }
            $items[$id] = ! empty($cfg['button_title']) ? $cfg['button_title'] : (isset($cfg['title']) ? $cfg['title'] : $id);
        }
        if (! $items) {
            return;
        }

        // data-eva-editor 记下是哪个编辑器实例点的，插入时回到它。
        // 图标用 WordPress 自带的 dashicons-shortcode：这块地方是「添加媒体」的邻居，
        // 跟着它的图标+文字形态走最不违和，也不用为一个按钮去拉 Remixicon。
        $icon = '<span class="dashicons dashicons-shortcode" aria-hidden="true"></span>';

        // 只有一个：直接给按钮，点了就开弹窗，不多套一层菜单。
        if (count($items) === 1) {
            $id = array_key_first($items);
            printf(
                '<button type="button" class="button eva-shortcoder-open" data-eva-id="%s" data-eva-editor="%s">%s%s</button> ',
                esc_attr($id),
                esc_attr($editor_id),
                $icon, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- 上面写死的标记
                esc_html($items[$id])
            );
            return;
        }

        // 多个：收进一个下拉。否则每注册一个短代码就往编辑器顶部多塞一个按钮，很快就排满一行。
        // 用原生 details/summary——折叠、键盘操作、aria-expanded 都是浏览器给的，不用自己写。
        echo '<details class="eva-shortcoder-menu">';
        echo '<summary class="button">' . $icon . '插入元素</summary>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        echo '<div class="eva-shortcoder-menu-list">';
        foreach ($items as $id => $label) {
            printf(
                '<button type="button" class="eva-shortcoder-open" data-eva-id="%s" data-eva-editor="%s">%s</button>',
                esc_attr($id),
                esc_attr($editor_id),
                esc_html($label)
            );
        }
        echo '</div></details> ';
    }

    /**
     * 在文章编辑页页脚输出各短代码的生成器弹窗（默认隐藏，内含嵌入式挂载点）。
     *
     * @return void
     */
    public function render_dialogs()
    {
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if (! $screen || $screen->base !== 'post' || empty(\Eva::get_shortcoders())) {
            return;
        }
        foreach (\Eva::get_shortcoders() as $id => $cfg) {
            $tag   = isset($cfg['shortcode']) ? $cfg['shortcode'] : $id;
            $title = isset($cfg['title']) ? $cfg['title'] : $tag;
            echo '<div class="eva-shortcoder-dialog" data-eva-id="' . esc_attr($id) . '" data-eva-shortcode="' . esc_attr($tag) . '" role="dialog" aria-modal="true" hidden>';
            echo '<div class="eva-shortcoder-panel">';
            echo '<header class="eva-shortcoder-head"><strong>' . esc_html($title) . '</strong>';
            echo '<button type="button" class="eva-shortcoder-close" aria-label="关闭">&times;</button></header>';
            echo '<div class="eva-shortcoder-body">';
            echo \Eva::embed_markup('shortcoder', $cfg, []); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo '</div>';
            echo '<footer class="eva-shortcoder-foot"><code class="eva-shortcoder-preview"></code>';
            echo '<button type="button" class="button eva-shortcoder-cancel">取消</button> ';
            echo '<button type="button" class="button button-primary eva-shortcoder-insert">' . esc_html(! empty($cfg['insert_title']) ? $cfg['insert_title'] : '插入短代码') . '</button>';
            echo '</footer></div></div>';
        }
    }

    /**
     * 区块编辑器：为写了 gutenberg 参数的短代码各注册一个区块。
     *
     * 区块很薄：编辑态是一个显示当前短代码的文本框 + 「生成短代码」按钮（打开同一个弹窗），
     * 保存的内容就是短代码文本本身，前台照常由 do_shortcode 解析。
     *
     * @return void
     */
    public function register_blocks()
    {
        $blocks = [];
        foreach (\Eva::get_shortcoders() as $id => $cfg) {
            if (empty($cfg['gutenberg']) || ! is_array($cfg['gutenberg'])) {
                continue;
            }
            $args = $cfg['gutenberg'];
            $blocks[] = [
                'id'          => (string) $id,
                'name'        => 'eva/shortcode-' . sanitize_key(str_replace('_', '-', (string) $id)),
                'title'       => isset($args['title']) ? (string) $args['title'] : (isset($cfg['title']) ? (string) $cfg['title'] : (string) $id),
                'description' => isset($args['description']) ? (string) $args['description'] : '',
                'icon'        => isset($args['icon']) ? (string) $args['icon'] : 'shortcode',
                'category'    => isset($args['category']) ? (string) $args['category'] : 'widgets',
                'keywords'    => isset($args['keywords']) && is_array($args['keywords']) ? array_values(array_map('strval', $args['keywords'])) : ['shortcode'],
                'placeholder' => isset($args['placeholder']) ? (string) $args['placeholder'] : '点「生成短代码」，或直接在这里输入…',
            ];
        }
        if (! $blocks) {
            return;
        }
        wp_enqueue_script('eva-shortcoder-blocks', EVA_FW_URL . 'assets/eva-shortcoder-blocks.js', ['wp-blocks', 'wp-element', 'wp-block-editor'], \Eva::asset_ver('assets/eva-shortcoder-blocks.js'), true);
        wp_add_inline_script('eva-shortcoder-blocks', 'window.EvaShortcoderBlocks = ' . wp_json_encode($blocks, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';', 'before');
    }

    /**
     * 仅在文章编辑页（post.php / post-new.php）且存在短代码容器时装载运行时。
     *
     * @param string $hook 当前后台页面钩子名。
     * @return void
     */
    public function enqueue($hook)
    {
        if (! in_array($hook, ['post.php', 'post-new.php'], true)) {
            return;
        }
        if (empty(\Eva::get_shortcoders())) {
            return;
        }
        \Eva::enqueue_runtime();

        // TinyMCE 插件（eva-mce-shortcoder.js）由 TinyMCE 自己加载，拿不到 PHP 数据，
        // 这里把容器清单挂到 window 上给它读。挂在 eva-embed 前面，保证编辑器初始化时已就绪。
        wp_add_inline_script(
            'eva-embed',
            'window.EvaShortcoderButtons = ' . wp_json_encode(self::editor_items()) . ';',
            'before'
        );
    }

    /**
     * 取容器各字段的默认值，用作短代码 atts 兜底。
     *
     * @param array $cfg 容器配置。
     * @return array     [field_id => default] 映射。
     */
    private static function field_defaults($cfg)
    {
        $defaults = [];
        // 遍历所有分组的所有字段，收集其 default（无则空串）。
        foreach ((isset($cfg['sections']) ? $cfg['sections'] : []) as $sec) {
            foreach ((isset($sec['fields']) ? $sec['fields'] : []) as $f) {
                if (! empty($f['id'])) {
                    $defaults[$f['id']] = isset($f['default']) ? $f['default'] : '';
                }
            }
        }
        return $defaults;
    }
}
