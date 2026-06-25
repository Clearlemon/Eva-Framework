<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva Framework 渲染器：把 \Eva 注册表里的设置页渲染成
 * 后台页面 + 入口（顶部工具栏或左侧菜单）+ 全屏沉浸的 Vue 外壳。
 *
 * 数据层（保存到 wp_options）由 \Eva\Framework\Data 经 AJAX 处理；
 * 本类只负责「入口注册 + 资源装载 + 把页面配置注入前端」，真正字段渲染在前端 eva-app。
 *
 * @package Eva\Framework
 */
class Admin
{
    /**
     * 挂载菜单/工具栏入口、资源装载、body class 及两个全局开关 AJAX。
     */
    public function __construct()
    {
        // 为每个设置页建后台页面。
        add_action('admin_menu', [$this, 'register_menus']);
        // location=admin_bar 的页面在顶部工具栏加入口（优先级 100 靠后放置）。
        add_action('admin_bar_menu', [$this, 'register_toolbar'], 100);
        // 仅当前设置页装载资源。
        add_action('admin_enqueue_scripts', [$this, 'enqueue']);
        // 当前是 Eva 设置页时给 body 加全屏 class。
        add_filter('admin_body_class', [$this, 'body_class']);
        // 全局开关：使用指南固定菜单显隐。
        add_action('wp_ajax_eva_fw_set_guide', [$this, 'ajax_set_guide']);
        // 全局开关：后台悬浮窗启用状态。
        add_action('wp_ajax_eva_fw_set_floating', [$this, 'ajax_set_floating']);
    }

    /**
     * 为每个已注册设置页建后台页面；location=admin_bar 的随即从左侧菜单移除。
     *
     * 说明：即便走顶部工具栏/独立页入口，也先注册一个 toplevel page，
     * 这样 add_menu_page 的回调与资源钩子（toplevel_page_{slug}）才成立，再按需移除左侧项。
     *
     * @return void
     */
    public function register_menus()
    {
        foreach (\Eva::get_options() as $opt) {
            $slug = $opt['menu_slug'];

            // 注册后台顶级菜单页，页面回调委托 render_page 输出 Vue 挂载点。
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

            // admin_bar 模式：仅借用页面注册，左侧菜单项移除（入口改放顶部工具栏）。
            if (($opt['location'] ?? 'admin_bar') === 'admin_bar') {
                remove_menu_page($slug);
            }
        }
    }

    /**
     * location=admin_bar 的设置页：在顶部管理工具栏加入口（前/后台均显示给有权限者）。
     *
     * @param \WP_Admin_Bar $wp_admin_bar 工具栏对象。
     * @return void
     */
    public function register_toolbar($wp_admin_bar)
    {
        foreach (\Eva::get_options() as $opt) {
            // 仅处理 admin_bar 模式的页面。
            if (($opt['location'] ?? 'admin_bar') !== 'admin_bar') {
                continue;
            }
            // 无权限者不显示入口。
            if (! current_user_can($opt['capability'])) {
                continue;
            }

            // 独立页指向前台伪静态 URL；否则指向 wp-admin 内的页面。
            $href = ($opt['standalone'] ?? true)
                ? Standalone::url($opt['menu_slug'])
                : admin_url('admin.php?page=' . $opt['menu_slug']);

            // 添加一个工具栏节点。
            $wp_admin_bar->add_node([
                'id'    => 'eva-' . $opt['menu_slug'],
                'title' => $opt['menu_title'],
                'href'  => $href,
                'meta'  => ['title' => $opt['menu_title']],
            ]);
        }
    }

    /**
     * 当前是 Eva 设置页时给 <body> 加 eva-fullscreen，触发全屏沉浸样式。
     *
     * @param string $classes 现有 body class 字符串。
     * @return string         追加后的 class 字符串。
     */
    public function body_class($classes)
    {
        // 从 URL 取当前页 slug 并反查是否为 Eva 设置页。
        $page = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : '';
        if ($page && \Eva::get_by_slug($page)) {
            $classes .= ' eva-fullscreen';
        }
        return $classes;
    }

    /**
     * 仅当前设置页加载资源，并把该页配置注入前端（EvaFW 全局对象）。
     *
     * @param string $hook 当前后台页面钩子名（形如 toplevel_page_{slug}）。
     * @return void
     */
    public function enqueue($hook)
    {
        // 反查当前 hook 对应的是哪个 Eva 设置页；不是则不加载任何资源。
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

        // 基础依赖：Vue3 运行时 + Remixicon 图标字体 + 框架样式。
        wp_enqueue_script(
            'eva-vue3',
            'https://cdn.jsdelivr.net/npm/vue@3.4.38/dist/vue.global.prod.js',
            [],
            '3.4.38',
            true
        );
        wp_enqueue_style('eva-remixicon', 'https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.css', [], '4.5.0');
        // 国旗图标（语言切换器用），跨平台显示真国旗。
        wp_enqueue_style('eva-flag-icons', 'https://cdn.jsdelivr.net/npm/flag-icons@7/css/flag-icons.min.css', [], '7');
        wp_enqueue_style('eva-framework', EVA_FW_URL . 'assets/eva.css', [], \Eva::asset_ver('assets/eva.css'));

        // UI 库（Libs/<name>/，含同名 js/css）：先于字段与外壳加载，逐个累积为 eva-app 的依赖。
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

        // 字段脚本：一字段一文件，扫描 Fields/ 逐个加载；eva-app 依赖库与它们全部。
        $field_deps = $lib_deps;
        foreach (\Eva::field_scripts() as $name => $field_url) {
            $handle = 'eva-field-' . $name;
            wp_enqueue_script($handle, $field_url, ['eva-vue3'], \Eva::asset_ver('Fields/' . $name . '.js'), true);
            $field_deps[] = $handle;
        }
        // 外壳脚本：依赖以上所有，确保库与字段先就绪。
        wp_enqueue_script('eva-framework', EVA_FW_URL . 'assets/eva-app.js', $field_deps, \Eva::asset_ver('assets/eva-app.js'), true);

        // 把当前页完整配置 + 运行时状态注入前端 window.EvaFW。
        wp_localize_script('eva-framework', 'EvaFW', [
            'version'  => EVA_FW_VERSION,
            'adminUrl' => admin_url(),
            'config'   => array_merge([
                'user'     => \Eva::current_user(),
                'brand'    => $current['brand'] ?: $current['menu_title'],
                'title'    => $current['menu_title'],
                'subtitle' => $current['subtitle'],
                'menu'     => array_values($current['menu']),
                // 序列化前预处理（执行 callback 字段、剔除闭包），保证可安全 JSON 化。
                'sections' => \Eva::prepare_sections($current['sections']),
                'optionId' => $current['option_id'],
                // 注入已存值供前端回填。
                'values'   => \Eva::get_values($current['option_id']),
            ], \Eva::runtime()),
        ]);

        // 版本计划/系统更新：自动挂载 callback 输出的 #update 挂载点（非 EvaFields 字段）。
        wp_enqueue_script('eva-update-page', EVA_FW_URL . 'assets/update-page.js', ['eva-framework'], \Eva::asset_ver('assets/update-page.js'), true);

        // 开发期热刷新（可删；或 wp-config 设 EVA_FW_DEV=false 关闭）。
        if (defined('EVA_FW_DEV') && EVA_FW_DEV) {
            wp_enqueue_script('eva-livereload', EVA_FW_URL . 'assets/eva-livereload.js', [], EVA_FW_VERSION, true);
            wp_localize_script('eva-livereload', 'EvaFWDev', [
                'enabled' => true,
                'assets'  => \Eva::dev_watch_assets(),
            ]);
        }
    }

    /**
     * 后台全屏页的页面回调：仅输出 Vue 挂载点（真正界面由 eva-app 接管）。
     *
     * @param string $slug 设置页 slug。
     * @return void
     */
    public function render_page($slug)
    {
        echo '<div id="eva-app" class="eva-root"><div class="eva-boot">Eva Framework 正在加载…</div></div>';
    }

    /**
     * AJAX：仅管理员可切换《EVA框架使用指南》固定菜单的全站显隐。
     *
     * @return void 以 JSON 响应并结束请求。
     */
    public function ajax_set_guide()
    {
        // 校验 nonce 与权限。
        if (! check_ajax_referer('eva_fw_guide', 'nonce', false)) {
            wp_send_json_error(['msg' => 'bad_nonce'], 403);
        }
        if (! current_user_can('manage_options')) {
            wp_send_json_error(['msg' => 'forbidden'], 403);
        }
        // 规整为 '1'/'0' 后持久化。
        $visible = (isset($_POST['visible']) && $_POST['visible'] === '1') ? '1' : '0';
        update_option('eva_fw_guide_visible', $visible);
        wp_send_json_success(['visible' => $visible === '1']);
    }

    /**
     * AJAX：仅管理员可切换「后台悬浮窗」的全站启用状态。
     *
     * @return void 以 JSON 响应并结束请求。
     */
    public function ajax_set_floating()
    {
        // 校验 nonce 与权限。
        if (! check_ajax_referer('eva_fw_guide', 'nonce', false)) {
            wp_send_json_error(['msg' => 'bad_nonce'], 403);
        }
        if (! current_user_can('manage_options')) {
            wp_send_json_error(['msg' => 'forbidden'], 403);
        }
        // 规整为 '1'/'0' 后持久化。
        $enabled = (isset($_POST['enabled']) && $_POST['enabled'] === '1') ? '1' : '0';
        update_option('eva_fw_floating', $enabled);
        wp_send_json_success(['enabled' => $enabled === '1']);
    }
}
