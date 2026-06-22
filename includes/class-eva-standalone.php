<?php

namespace Eva\Framework;

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva Framework 独立页路由：依据已注册设置页「动态」生成前台伪静态 URL
 * /{base}/{path}（默认 /eva/<menu_slug>），整页输出、脱离 /wp-admin/。
 */
class Standalone
{
    public function __construct()
    {
        add_action('init', [$this, 'add_rewrite']);
        add_filter('query_vars', [$this, 'query_vars']);
        add_action('template_redirect', [$this, 'maybe_render']);
    }

    /** 独立页 URL 的公共前缀，可用过滤器 eva_fw_url_base 修改（默认 eva）。 */
    public static function base()
    {
        return trim((string) apply_filters('eva_fw_url_base', 'eva'), '/');
    }

    /** 某设置页的独立访问 URL：/{base}/{path|menu_slug}。 */
    public static function url($slug)
    {
        $opt  = \Eva::get_by_slug($slug);
        $path = ($opt && ! empty($opt['path'])) ? $opt['path'] : $slug;
        $base = self::base();
        return home_url('/' . ($base !== '' ? $base . '/' : '') . $path);
    }

    /** 依据已注册设置页动态生成 rewrite 规则（每页一条，而非写死的单条通配）。 */
    public function add_rewrite()
    {
        $base  = self::base();
        $rules = [];

        foreach (\Eva::get_options() as $opt) {
            if (($opt['standalone'] ?? true) !== true) {
                continue;
            }
            $path  = ! empty($opt['path']) ? $opt['path'] : $opt['menu_slug'];
            $regex = '^' . ($base !== '' ? preg_quote($base) . '/' : '') . preg_quote($path) . '/?$';
            add_rewrite_rule($regex, 'index.php?eva_app=' . $opt['menu_slug'], 'top');
            $rules[] = $regex . '=' . $opt['menu_slug'];
        }

        $this->maybe_flush($rules);
    }

    public function query_vars($vars)
    {
        $vars[] = 'eva_app';
        return $vars;
    }

    /** 规则集合变化（新增页 / 改 path / 改前缀）时自动 flush 一次。 */
    private function maybe_flush(array $rules)
    {
        $sig = md5(implode('|', $rules));
        if (get_option('eva_fw_rw_sig') !== $sig) {
            flush_rewrite_rules(false);
            update_option('eva_fw_rw_sig', $sig);
        }
    }

    public function maybe_render()
    {
        $slug = get_query_var('eva_app');
        if (! $slug && ! empty($_GET['eva_app'])) {
            $slug = wp_unslash($_GET['eva_app']);
        }
        $slug = sanitize_key($slug);
        if (! $slug) {
            return;
        }

        $opt = \Eva::get_by_slug($slug);

        // 不是启用独立模式的 Eva 页：放行正常前台流程
        if (! $opt || ($opt['standalone'] ?? true) !== true) {
            return;
        }

        if (! is_user_logged_in()) {
            auth_redirect(); // 跳登录并回跳本页
        }

        if (! current_user_can($opt['capability'])) {
            wp_die('当前账号无权访问该页面。', '403 Forbidden', ['response' => 403]);
        }

        $this->render($opt);
    }

    private function render($opt)
    {
        if (ob_get_length()) {
            @ob_end_clean();
        }
        nocache_headers();

        $data = [
            'version'    => EVA_FW_VERSION,
            'adminUrl'   => admin_url(),
            'standalone' => true,
            'config'     => array_merge([
                'user'       => \Eva::current_user(),
                'brand'      => $opt['brand'] ?: $opt['menu_title'],
                'title'    => $opt['menu_title'],
                'subtitle' => $opt['subtitle'],
                'menu'     => array_values($opt['menu']),
                'sections' => \Eva::prepare_sections($opt['sections']),
                'optionId' => $opt['option_id'],
                'values'   => \Eva::get_values($opt['option_id']),
            ], \Eva::runtime()),
        ];

        $json = wp_json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
        $vue  = 'https://cdn.jsdelivr.net/npm/vue@3.4.38/dist/vue.global.prod.js';
        $css  = EVA_FW_URL . 'assets/eva.css?ver=' . \Eva::asset_ver('assets/eva.css');
        $js   = EVA_FW_URL . 'assets/eva-app.js?ver=' . \Eva::asset_ver('assets/eva-app.js');

        echo '<!DOCTYPE html>';
        echo '<html ' . get_language_attributes() . '>';
        echo '<head>';
        echo '<meta charset="' . esc_attr(get_bloginfo('charset')) . '">';
        echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
        echo '<meta name="robots" content="noindex,nofollow">';
        echo '<title>' . esc_html($opt['menu_title']) . '</title>';
        echo '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.css">';
        echo '<link rel="stylesheet" href="' . esc_url(includes_url('css/dashicons.min.css')) . '?ver=' . EVA_FW_VERSION . '">';
        echo '<link rel="stylesheet" href="' . esc_url($css) . '">';
        // UI 库 CSS（assets/libs/<name>/）
        foreach (\Eva::lib_assets() as $lib_name => $lib) {
            if ($lib['css']) {
                echo '<link rel="stylesheet" href="' . esc_url($lib['css'] . '?ver=' . \Eva::asset_ver($lib['cssRel'])) . '">';
            }
        }
        echo '</head>';
        echo '<body class="eva-standalone">';
        echo '<div id="eva-app" class="eva-root"><div class="eva-boot">Eva Framework 正在加载…</div></div>';
        echo '<script>window.EvaFW = ' . $json . ';</script>';
        echo '<script src="' . esc_url($vue) . '"></script>';
        // UI 库脚本（assets/libs/<name>/，先于字段与外壳）
        foreach (\Eva::lib_assets() as $lib_name => $lib) {
            if ($lib['js']) {
                echo '<script src="' . esc_url($lib['js'] . '?ver=' . \Eva::asset_ver($lib['jsRel'])) . '"></script>';
            }
        }
        // 字段脚本：一字段一文件，扫描 assets/fields/ 逐个加载（在 eva-app.js 之前）
        foreach (\Eva::field_scripts() as $field_name => $field_url) {
            echo '<script src="' . esc_url($field_url . '?ver=' . \Eva::asset_ver('assets/fields/' . $field_name . '.js')) . '"></script>';
        }
        echo '<script src="' . esc_url($js) . '"></script>';

        // 开发期热刷新（可删；或 wp-config 设 EVA_FW_DEV=false 关闭）
        if (defined('EVA_FW_DEV') && EVA_FW_DEV) {
            $lr = EVA_FW_URL . 'assets/eva-livereload.js?ver=' . EVA_FW_VERSION;
            $devcfg = wp_json_encode([
                'enabled' => true,
                'assets'  => [
                    EVA_FW_URL . 'assets/eva.css',
                    EVA_FW_URL . 'assets/eva-app.js',
                ],
            ], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
            echo '<script>window.EvaFWDev = ' . $devcfg . ';</script>';
            echo '<script src="' . esc_url($lr) . '"></script>';
        }

        // Eva 独立页是自渲染整页、不走 wp_footer，这里手动注入后台悬浮窗
        Floating::markup();

        echo '</body></html>';
        exit;
    }
}
