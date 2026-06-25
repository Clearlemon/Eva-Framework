<?php
/**
 * Plugin Name:       Eva Framework
 * Description:       Eva —— 轻量、现代、好看的 WordPress 后台设置框架（CSF 替代方案）。
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      8.0
 * Author:            青柠
 * License:           GPL-2.0-or-later
 * Text Domain:       eva-framework
 */

if (! defined('ABSPATH')) {
    exit;
}

// 幂等加载：既可作为独立插件，也可被主题 / 其它插件 require 内嵌（类似 CSF）。
if (defined('EVA_FW_LOADED')) {
    return;
}
define('EVA_FW_LOADED', true);

define('EVA_FW_VERSION', '0.1.0');
define('EVA_FW_FILE', __FILE__);
define('EVA_FW_DIR', plugin_dir_path(__FILE__));
define('EVA_FW_URL', plugin_dir_url(__FILE__));

// 开发期热刷新（live reload）开关：上线请在 wp-config.php 设 define('EVA_FW_DEV', false);
if (! defined('EVA_FW_DEV')) {
    define('EVA_FW_DEV', true);
}

// 门面：对外注册 API（注册表，置于 includes/ 根）
require_once EVA_FW_DIR . 'includes/class-eva.php';
// 数据层：清洗 + 保存
require_once EVA_FW_DIR . 'includes/core/class-eva-data.php';
// 后台呈现：设置页渲染 / 独立页路由 / 后台悬浮窗
require_once EVA_FW_DIR . 'includes/admin/class-eva-admin.php';
require_once EVA_FW_DIR . 'includes/admin/class-eva-standalone.php';
require_once EVA_FW_DIR . 'includes/admin/class-eva-floating.php';
// 嵌入式容器（对齐 CSF 的 9 种容器：metabox / 分类法 / 导航菜单 / 用户资料 / 评论 / 定制器 / 短代码 / 小工具）
require_once EVA_FW_DIR . 'includes/containers/class-eva-metabox.php';
require_once EVA_FW_DIR . 'includes/containers/class-eva-taxonomy.php';
require_once EVA_FW_DIR . 'includes/containers/class-eva-nav-menu.php';
require_once EVA_FW_DIR . 'includes/containers/class-eva-profile.php';
require_once EVA_FW_DIR . 'includes/containers/class-eva-comment.php';
require_once EVA_FW_DIR . 'includes/containers/class-eva-customize.php';
require_once EVA_FW_DIR . 'includes/containers/class-eva-shortcoder.php';
require_once EVA_FW_DIR . 'includes/containers/class-eva-widget.php';

// 前后台都实例化：admin_menu / enqueue 仅后台触发，admin_bar_menu 与独立页路由前台也需挂载
new \Eva\Framework\Admin();
new \Eva\Framework\Standalone();
new \Eva\Framework\Floating();
new \Eva\Framework\Data();

// 嵌入式容器：均挂各自 WP 原生钩子（编辑页 metabox / 分类法 / 导航菜单 / 用户资料 / 评论 / 定制器 / 短代码 / 小工具）
new \Eva\Framework\Metabox();
new \Eva\Framework\Taxonomy();
new \Eva\Framework\NavMenu();
new \Eva\Framework\Profile();
new \Eva\Framework\Comment();
new \Eva\Framework\Customize();
new \Eva\Framework\Shortcoder();
new \Eva\Framework\Widget();

// 插件激活时刷新伪静态规则（规则由 Standalone 在 init 依据注册表动态生成；
// 主题内嵌等无激活钩子的场景由 Standalone 的「规则签名」机制兜底 flush）
register_activation_hook(__FILE__, static function () {
    flush_rewrite_rules();
});

// 内置演示设置页（可删除此 require 与 includes/demo-options.php）
require_once EVA_FW_DIR . 'includes/demo-options.php';
