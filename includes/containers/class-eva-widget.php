<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 小工具容器（对应 CSF::createWidget）。
 * 把每个注册的容器登记为一个 WP_Widget（具体实现见 Eva_Widget_Instance）。
 *
 * @package Eva\Framework
 */
class Widget
{
    /**
     * 挂载小工具注册与后台资源加载钩子。
     */
    public function __construct()
    {
        // widgets_init 时把各容器注册为 WP_Widget。
        add_action('widgets_init', [$this, 'register']);
        // 后台资源按需加载（小工具页 / 定制器）。
        add_action('admin_enqueue_scripts', [$this, 'enqueue']);
    }

    /**
     * 把每个 Eva 小工具容器注册成一个 WP_Widget 实例。
     *
     * @return void
     */
    public function register()
    {
        // 无任何小工具容器则不必加载实例类。
        if (empty(\Eva::get_widgets())) {
            return;
        }
        // 实例类继承 WP_Widget，需在 widgets_init（基类可用）时才载入。
        require_once EVA_FW_DIR . 'includes/containers/class-eva-widget-instance.php';
        if (! class_exists('\\Eva\\Framework\\Eva_Widget_Instance')) {
            return;
        }
        // 每个容器各注册一个独立 widget（id 作为 id_base）。
        foreach (\Eva::get_widgets() as $id => $cfg) {
            register_widget(new Eva_Widget_Instance($id, $cfg));
        }
    }

    /**
     * 小工具页 / 定制器都可能渲染 widget 表单，两处都装载运行时。
     *
     * @param string $hook 当前后台页面钩子名。
     * @return void
     */
    public function enqueue($hook)
    {
        if (! in_array($hook, ['widgets.php', 'customize.php'], true)) {
            return;
        }
        if (empty(\Eva::get_widgets())) {
            return;
        }
        \Eva::enqueue_runtime();

        // 「可用小工具」那个列表只有经典小工具页才有，定制器里没有，所以筛选标签也只在那边装。
        if ($hook !== 'widgets.php') {
            return;
        }

        wp_enqueue_script(
            'eva-widget-filter',
            EVA_FW_URL . 'assets/eva-widget-filter.js',
            // 依赖 eva-embed：文案要用它提供的 EvaI18n（嵌入式页面没有 EvaFW.config.messages）。
            ['eva-embed'],
            \Eva::asset_ver('assets/eva-widget-filter.js'),
            true
        );

        // 把各容器的 id_base 交给前端，用来和列表项的隐藏输入 .id_base 比对出谁是 Eva 的。
        wp_add_inline_script(
            'eva-widget-filter',
            'window.EvaWidgetFilter = ' . wp_json_encode(['bases' => array_keys(\Eva::get_widgets())]) . ';',
            'before'
        );
    }
}
