<?php
/**
 * Plugin Name:       Eva Framework
 * Description:       Eva —— 轻量、现代、好看的 WordPress 后台设置框架（CSF 替代方案）。
 * Version:           1.4.0
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

define('EVA_FW_VERSION', '1.4.0');
define('EVA_FW_FILE', __FILE__);
define('EVA_FW_DIR', plugin_dir_path(__FILE__));
define('EVA_FW_URL', plugin_dir_url(__FILE__));

// 开发期热刷新（live reload）开关：上线请在 wp-config.php 设 define('EVA_FW_DEV', false);
if (! defined('EVA_FW_DEV')) {
    define('EVA_FW_DEV', true);
}

// 门面：对外注册 API（注册表，置于 includes/ 根）
require_once EVA_FW_DIR . 'includes/class-eva.php';
// 字段后端处理器：与 Fields/<name>/<name>.js 对应，集中承载字段清洗与字段专属 AJAX。
foreach (glob(EVA_FW_DIR . 'includes/admin/Fields/class-eva-field-*.php') as $eva_fw_field_file) {
    require_once $eva_fw_field_file;
}
// 数据选择字段：统一文章、术语、用户、菜单和侧边栏的安全 AJAX 搜索。
add_action('wp_ajax_eva_fw_search_data', ['Eva\\Framework\\Admin\\Fields\\Data_Selector', 'ajax_search']);
add_action('wp_ajax_eva_fw_search_posts', ['Eva\\Framework\\Admin\\Fields\\Data_Selector', 'ajax_search_posts']);
add_action('wp_ajax_eva_fw_import_media_urls', ['Eva\\Framework\\Admin\\Fields\\Media', 'ajax_import_urls']);
// 开发期热刷新的指纹接口：浏览器每轮只问这一个地址，不再逐个 HEAD 近百个资源文件。
if (EVA_FW_DEV) {
    add_action('wp_ajax_eva_fw_dev_stamp', ['Eva', 'ajax_dev_stamp']);
}
// 字段依赖规则处理器：兼容 CSF dependency，并扩展 Eva 的跨来源依赖。
require_once EVA_FW_DIR . 'includes/admin/class-eva-dependency.php';
// CSF 兼容层：注册期归一化 CSF 写法、解析字符串数据源、读写时转换存值格式
require_once EVA_FW_DIR . 'includes/core/class-eva-csf-compat.php';
require_once EVA_FW_DIR . 'includes/core/class-eva-csf-shapes.php';
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
// 区块容器（Eva 独有）：值存在文章内容的区块属性里，由 render 回调渲染前台。
require_once EVA_FW_DIR . 'includes/containers/class-eva-block.php';

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
new \Eva\Framework\Block();

// save_defaults：从没保存过的设置页，把字段默认值写进库（挂在 init 靠后，等分类法 / 文章类型注册完）。
add_action('init', ['Eva', 'maybe_save_defaults'], 99);
// 排版字段选了 Google 字体时，到前台加载对应的字体样式（enqueue_webfont => false 可关）。
add_action('wp_enqueue_scripts', ['Eva', 'enqueue_webfonts'], 20);
// 字段 output/output_mode：把设置值自动输出为前台 CSS。
add_action('wp_enqueue_scripts', ['Eva', 'enqueue_builder_frontend_assets']);
add_action('wp_head', ['Eva', 'output_css'], 99);
add_action('template_redirect', ['Eva', 'builder_preview_bootstrap'], 1);
add_action('wp_head', ['Eva', 'builder_preview_head'], 999);
add_action('wp_footer', ['Eva', 'builder_preview_script'], 99);
add_action('wp_ajax_eva_fw_render_builder_preview', ['Eva', 'ajax_render_builder_preview']);

// 插件激活时刷新伪静态规则（规则由 Standalone 在 init 依据注册表动态生成；
// 主题内嵌等无激活钩子的场景由 Standalone 的「规则签名」机制兜底 flush）
register_activation_hook(__FILE__, static function () {
    flush_rewrite_rules();
});

// 框架就绪（对应 CSF 的 csf_init）：注册表与各容器都已挂好，主题 / 扩展可以在这里开始 create*。
do_action('eva_loaded');

// 内置演示设置页（可删除此 require 与 includes/demo-options.php）
require_once EVA_FW_DIR . 'includes/demo-options.php';
