<?php

namespace Eva\Framework;

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva Framework 渲染器：把 \Eva 注册表里的设置页渲染成
 * 后台页面 + 入口（顶部工具栏或左侧菜单）+ 全屏沉浸的 Vue 外壳。
 *
 * 数据层（保存到 wp_options）将在后续步骤接入；当前字段仅前端可交互。
 */
class Admin
{
    public function __construct()
    {
        add_action('admin_menu', [$this, 'register_menus']);
        add_action('admin_bar_menu', [$this, 'register_toolbar'], 100);
        add_action('admin_enqueue_scripts', [$this, 'enqueue']);
        add_filter('admin_body_class', [$this, 'body_class']);
        add_action('wp_ajax_eva_fw_set_guide', [$this, 'ajax_set_guide']);
        add_action('wp_ajax_eva_fw_set_floating', [$this, 'ajax_set_floating']);
    }

    /** 为每个已注册设置页建后台页面；location=admin_bar 的随即从左侧移除。 */
    public function register_menus()
    {
        foreach (\Eva::get_options() as $opt) {
            $slug = $opt['menu_slug'];

            add_menu_page(
                $opt['menu_title'],
                $opt['menu_title'],
                $opt['capability'],
                $slug,
                function () use ($slug) {
                    $this->render_page($slug);
                },
                $opt['menu_icon'],
                $opt['menu_position']
            );

            if (($opt['location'] ?? 'admin_bar') === 'admin_bar') {
                remove_menu_page($slug);
            }
        }
    }

    /** location=admin_bar 的设置页：在顶部管理工具栏加入口（前/后台均显示给有权限者）。 */
    public function register_toolbar($wp_admin_bar)
    {
        foreach (\Eva::get_options() as $opt) {
            if (($opt['location'] ?? 'admin_bar') !== 'admin_bar') {
                continue;
            }
            if (! current_user_can($opt['capability'])) {
                continue;
            }

            $href = ($opt['standalone'] ?? true)
                ? Standalone::url($opt['menu_slug'])
                : admin_url('admin.php?page=' . $opt['menu_slug']);

            $wp_admin_bar->add_node([
                'id'    => 'eva-' . $opt['menu_slug'],
                'title' => $opt['menu_title'],
                'href'  => $href,
                'meta'  => ['title' => $opt['menu_title']],
            ]);
        }
    }

    /** 当前是 Eva 设置页时给 <body> 加 eva-fullscreen，触发全屏沉浸样式。 */
    public function body_class($classes)
    {
        $page = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : '';
        if ($page && \Eva::get_by_slug($page)) {
            $classes .= ' eva-fullscreen';
        }
        return $classes;
    }

    /** 仅当前设置页加载资源，并把该页配置注入前端。 */
    public function enqueue($hook)
    {
        $current = null;
        foreach (\Eva::get_options() as $opt) {
            if ($hook === 'toplevel_page_' . $opt['menu_slug']) {
                $current = $opt;
                break;
            }
        }
        if (! $current) {
            return;
        }

        wp_enqueue_script(
            'eva-vue3',
            'https://cdn.jsdelivr.net/npm/vue@3.4.38/dist/vue.global.prod.js',
            [],
            '3.4.38',
            true
        );
        wp_enqueue_style('eva-remixicon', 'https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.css', [], '4.5.0');
        wp_enqueue_style('eva-framework', EVA_FW_URL . 'assets/eva.css', [], \Eva::asset_ver('assets/eva.css'));
        // UI 库（assets/libs/<name>/，含同名 js/css）：先于字段与外壳加载
        $lib_deps = ['eva-vue3'];
        foreach (\Eva::lib_assets() as $lib_name => $lib) {
            if ($lib['css']) {
                wp_enqueue_style('eva-lib-' . $lib_name, $lib['css'], ['eva-framework'], \Eva::asset_ver($lib['cssRel']));
            }
            if ($lib['js']) {
                $lib_handle = 'eva-lib-' . $lib_name;
                wp_enqueue_script($lib_handle, $lib['js'], ['eva-vue3'], \Eva::asset_ver($lib['jsRel']), true);
                $lib_deps[] = $lib_handle;
            }
        }
        // 字段脚本：一字段一文件，扫描 assets/fields/ 逐个加载；eva-app 依赖库与它们全部
        $field_deps = $lib_deps;
        foreach (\Eva::field_scripts() as $name => $field_url) {
            $handle = 'eva-field-' . $name;
            wp_enqueue_script($handle, $field_url, ['eva-vue3'], \Eva::asset_ver('assets/fields/' . $name . '.js'), true);
            $field_deps[] = $handle;
        }
        wp_enqueue_script('eva-framework', EVA_FW_URL . 'assets/eva-app.js', $field_deps, \Eva::asset_ver('assets/eva-app.js'), true);

        wp_localize_script('eva-framework', 'EvaFW', [
            'version'  => EVA_FW_VERSION,
            'adminUrl' => admin_url(),
            'config'   => array_merge([
                'user'     => \Eva::current_user(),
                'brand'    => $current['brand'] ?: $current['menu_title'],
                'title'    => $current['menu_title'],
                'subtitle' => $current['subtitle'],
                'menu'     => array_values($current['menu']),
                'sections' => \Eva::prepare_sections($current['sections']),
                'optionId' => $current['option_id'],
                'values'   => \Eva::get_values($current['option_id']),
            ], \Eva::runtime()),
        ]);

        // 开发期热刷新（可删；或 wp-config 设 EVA_FW_DEV=false 关闭）
        if (defined('EVA_FW_DEV') && EVA_FW_DEV) {
            wp_enqueue_script('eva-livereload', EVA_FW_URL . 'assets/eva-livereload.js', [], EVA_FW_VERSION, true);
            wp_localize_script('eva-livereload', 'EvaFWDev', [
                'enabled' => true,
                'assets'  => [
                    EVA_FW_URL . 'assets/eva.css',
                    EVA_FW_URL . 'assets/eva-app.js',
                ],
            ]);
        }
    }

    public function render_page($slug)
    {
        echo '<div id="eva-app" class="eva-root"><div class="eva-boot">Eva Framework 正在加载…</div></div>';
    }

    /** 仅管理员可切换《EVA框架使用指南》固定菜单的全站显隐。 */
    public function ajax_set_guide()
    {
        if (! check_ajax_referer('eva_fw_guide', 'nonce', false)) {
            wp_send_json_error(['msg' => 'bad_nonce'], 403);
        }
        if (! current_user_can('manage_options')) {
            wp_send_json_error(['msg' => 'forbidden'], 403);
        }
        $visible = (isset($_POST['visible']) && $_POST['visible'] === '1') ? '1' : '0';
        update_option('eva_fw_guide_visible', $visible);
        wp_send_json_success(['visible' => $visible === '1']);
    }

    /** 仅管理员可切换「后台悬浮窗」的全站启用状态。 */
    public function ajax_set_floating()
    {
        if (! check_ajax_referer('eva_fw_guide', 'nonce', false)) {
            wp_send_json_error(['msg' => 'bad_nonce'], 403);
        }
        if (! current_user_can('manage_options')) {
            wp_send_json_error(['msg' => 'forbidden'], 403);
        }
        $enabled = (isset($_POST['enabled']) && $_POST['enabled'] === '1') ? '1' : '0';
        update_option('eva_fw_floating', $enabled);
        wp_send_json_success(['enabled' => $enabled === '1']);
    }
}
