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
 * - 后台：在经典编辑器 media_buttons 处放「生成器」入口 + 隐藏的嵌入式挂载点弹窗，
 *         前端用 Eva 字段拼出短代码插入编辑器（前端联调）。
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
        // 经典编辑器：在媒体按钮区放生成器入口。
        add_action('media_buttons', [$this, 'editor_button']);
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
     * @param string $editor_id 当前编辑器实例 id（由 media_buttons 传入）。
     * @return void
     */
    public function editor_button($editor_id)
    {
        // 无短代码容器则不输出任何入口。
        if (empty(\Eva::get_shortcoders())) {
            return;
        }
        // 1) 逐容器输出「打开生成器」按钮（带 data-* 供前端识别目标弹窗）。
        foreach (\Eva::get_shortcoders() as $id => $cfg) {
            $tag = isset($cfg['shortcode']) ? $cfg['shortcode'] : $id;
            printf(
                '<button type="button" class="button eva-shortcoder-open" data-eva-shortcode="%s" data-eva-id="%s">%s</button> ',
                esc_attr($tag),
                esc_attr($id),
                esc_html(isset($cfg['title']) ? $cfg['title'] : $tag)
            );
        }
        // 2) 逐容器输出隐藏的弹窗容器（内含 Eva 挂载点，点开后由前端渲染字段）。
        foreach (\Eva::get_shortcoders() as $id => $cfg) {
            echo '<div class="eva-shortcoder-dialog" data-eva-id="' . esc_attr($id) . '" style="display:none">';
            echo \Eva::embed_markup('shortcoder', $cfg, []); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo '</div>';
        }
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
