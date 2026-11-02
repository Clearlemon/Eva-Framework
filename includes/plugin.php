<?php

// 独立插件入口，不在主题内嵌模式下加载。
if (! defined('ABSPATH')) {
    exit;
}

// 等主题和扩展完成注册，在独立页 rewrite 规则生成前补上默认演示页。
add_action('init', static function () {
    if (! isset(\Eva::get_options()['eva_demo']) && apply_filters('eva_fw_demo_enabled', true)) {
        require_once EVA_FW_DIR . 'includes/demo-options.php';
    }
}, 0);

// 插件列表直接进入实际注册的设置页，不要求用户先找到顶部工具栏。
add_filter('plugin_action_links_' . plugin_basename(EVA_FW_FILE), static function ($links) {
    $options = \Eva::get_options();
    if (isset($options['eva_demo'])) {
        $options = ['eva_demo' => $options['eva_demo']] + $options;
    }
    foreach ($options as $opt) {
        if (! current_user_can($opt['capability'])) {
            continue;
        }
        $url = ($opt['standalone'] ?? true)
            ? \Eva\Framework\Standalone::url($opt['menu_slug'])
            : admin_url('admin.php?page=' . $opt['menu_slug']);
        array_unshift($links, '<a href="' . esc_url($url) . '">' . esc_html__('Settings') . '</a>');
        break;
    }
    return $links;
});
