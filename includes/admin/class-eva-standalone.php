<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva Framework 独立页路由：依据已注册设置页「动态」生成前台伪静态 URL
 * /{base}/{path}（默认 /eva/<menu_slug>），整页输出、脱离 /wp-admin/。
 *
 * @package Eva\Framework
 */
class Standalone
{
    /**
     * 挂载 rewrite 规则、query_var 与前台模板拦截钩子。
     */
    public function __construct()
    {
        // init 时按注册表生成 rewrite 规则。
        add_action('init', [$this, 'add_rewrite']);
        // 登记自定义 query var eva_app。
        add_filter('query_vars', [$this, 'query_vars']);
        // 命中独立页时接管渲染。
        add_action('template_redirect', [$this, 'maybe_render']);
    }

    /**
     * 独立页 URL 的公共前缀，可用过滤器 eva_fw_url_base 修改（默认 eva）。
     *
     * @return string 去掉首尾斜杠的前缀段。
     */
    public static function base()
    {
        return trim((string) apply_filters('eva_fw_url_base', 'eva'), '/');
    }

    /**
     * 某设置页的独立访问 URL：/{base}/{path|menu_slug}。
     *
     * @param string $slug 设置页 menu_slug。
     * @return string      完整的前台 URL。
     */
    public static function url($slug)
    {
        // 优先用配置的 path 段，否则退回 menu_slug。
        $opt  = \Eva::get_by_slug($slug);
        $path = ($opt && ! empty($opt['path'])) ? $opt['path'] : $slug;
        $base = self::base();
        // 拼成 home_url('/{base}/{path}')；前缀为空时不加多余斜杠。
        return home_url('/' . ($base !== '' ? $base . '/' : '') . $path);
    }

    /**
     * 依据已注册设置页动态生成 rewrite 规则（每页一条，而非写死的单条通配）。
     *
     * @return void
     */
    public function add_rewrite()
    {
        $base  = self::base();
        $rules = [];

        foreach (\Eva::get_options() as $opt) {
            // 仅为启用独立模式的页面建规则。
            if (($opt['standalone'] ?? true) !== true) {
                continue;
            }
            // path 段缺省用 menu_slug。
            $path  = ! empty($opt['path']) ? $opt['path'] : $opt['menu_slug'];
            // 构造正则：^{base}/{path}/?$，把请求重写到 index.php?eva_app={slug}。
            $regex = '^' . ($base !== '' ? preg_quote($base) . '/' : '') . preg_quote($path) . '/?$';
            add_rewrite_rule($regex, 'index.php?eva_app=' . $opt['menu_slug'], 'top');
            // 收集规则签名用于判断是否需要 flush。
            $rules[] = $regex . '=' . $opt['menu_slug'];
        }

        // 规则集合变化时按需 flush（见 maybe_flush）。
        $this->maybe_flush($rules);
    }

    /**
     * 登记自定义 query var，使 WP 识别 index.php?eva_app=xxx。
     *
     * @param array $vars 现有 query var 列表。
     * @return array      追加 eva_app 后的列表。
     */
    public function query_vars($vars)
    {
        $vars[] = 'eva_app';
        return $vars;
    }

    /**
     * 规则集合变化（新增页 / 改 path / 改前缀）时自动 flush 一次。
     *
     * 用「规则签名」对比避免每次请求都 flush（昂贵）；也兜底主题内嵌等无激活钩子的场景。
     *
     * @param array $rules 当前生成的规则签名集合。
     * @return void
     */
    private function maybe_flush(array $rules)
    {
        // 用规则集合的 md5 作为签名，与上次存的对比。
        $sig = md5(implode('|', $rules));
        if (get_option('eva_fw_rw_sig') !== $sig) {
            // 变了才软 flush（false=不重写 .htaccess），并记录新签名。
            flush_rewrite_rules(false);
            update_option('eva_fw_rw_sig', $sig);
        }
    }

    /**
     * template_redirect 回调：命中独立页则做登录/权限校验后整页渲染。
     *
     * @return void
     */
    public function maybe_render()
    {
        // 优先取 query var；兼容直接 ?eva_app= 访问。
        $slug = get_query_var('eva_app');
        if (! $slug && ! empty($_GET['eva_app'])) {
            $slug = wp_unslash($_GET['eva_app']);
        }
        $slug = sanitize_key($slug);
        if (! $slug) {
            return;
        }

        $opt = \Eva::get_by_slug($slug);

        // 不是启用独立模式的 Eva 页：放行正常前台流程。
        if (! $opt || ($opt['standalone'] ?? true) !== true) {
            return;
        }

        // 未登录：跳登录并回跳本页。
        if (! is_user_logged_in()) {
            auth_redirect();
        }

        // 已登录但无权限：403。
        if (! current_user_can($opt['capability'])) {
            wp_die('当前账号无权访问该页面。', '403 Forbidden', ['response' => 403]);
        }

        // 通过校验，整页输出。
        $this->render($opt);
    }

    /**
     * 整页渲染独立页：自建 HTML 文档，注入配置/资源并挂载 eva-app，最后 exit。
     *
     * @param array $opt 设置页配置。
     * @return void 输出 HTML 后直接结束请求。
     */
    private function render($opt)
    {
        // 清掉可能已有的输出缓冲，确保我们输出的是完整、干净的文档。
        if (ob_get_length()) {
            @ob_end_clean();
        }
        // 该页不应被缓存。
        nocache_headers();

        // 独立页不经过 admin_enqueue_scripts，需主动准备媒体库与原生编辑器资源。
        wp_enqueue_media();
        // 部分前台主题会改写 jQuery UI 依赖，TinyMCE/媒体库在独立页显式补齐。
        wp_enqueue_script('jquery-ui-widget');
        wp_enqueue_script('jquery-ui-position');
        if (function_exists('wp_enqueue_editor')) {
            wp_enqueue_editor();
        }
        if (function_exists('wp_enqueue_code_editor')) {
            foreach (['text/html', 'text/css', 'application/javascript', 'application/json', 'application/x-httpd-php'] as $mime_type) {
                wp_enqueue_code_editor(['type' => $mime_type]);
            }
        }

        // 应用 eva_{id}_args / eva_{id}_sections 过滤器后的配置；保存层（Data::ajax_save）用的是同一份。
        $opt = \Eva::get_resolved($opt['option_id']);

        // 组装注入前端的数据（与后台 enqueue 注入结构一致，便于复用同一前端外壳）。
        // 菜单、分区、依赖来源、已存值、表单前后 HTML 由 page_payload() 统一组装。
        $data = [
            'version'    => EVA_FW_VERSION,
            'adminUrl'   => admin_url(),
            'standalone' => true,
            'config'     => array_merge([
                'user'       => \Eva::current_user(),
                'brand'      => $opt['brand'] ?: $opt['menu_title'],
                'title'    => $opt['menu_title'],
                'subtitle' => $opt['subtitle'],
            ], \Eva::page_payload($opt), \Eva::runtime()),
        ];

        // 主题自己的后台资源（对应 CSF 的 csf_enqueue）：此时还没输出任何标签，回调里 wp_enqueue_* 的资源
        // 会随下面的 wp_print_styles() / wp_print_footer_scripts() 一起输出。
        do_action('eva_enqueue', $opt);

        // 数据用安全选项编码为 JSON；资源 URL 带版本号击穿缓存。
        $json = wp_json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
        $vue  = 'https://cdn.jsdelivr.net/npm/vue@3.4.38/dist/vue.global.prod.js';
        $css  = EVA_FW_URL . 'assets/eva.css?ver=' . \Eva::asset_ver('assets/eva.css');
        $js   = EVA_FW_URL . 'assets/eva-app.js?ver=' . \Eva::asset_ver('assets/eva-app.js');

        // ===== 文档头：meta / 标题 / 样式（图标字体 + dashicons + 框架样式 + UI 库 CSS）=====
        echo '<!DOCTYPE html>';
        echo '<html ' . get_language_attributes() . '>';
        echo '<head>';
        echo '<meta charset="' . esc_attr(get_bloginfo('charset')) . '">';
        echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
        echo '<meta name="robots" content="noindex,nofollow">';
        echo '<title>' . esc_html($opt['menu_title']) . '</title>';
        echo '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.css">';
        echo '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flag-icons@7/css/flag-icons.min.css">';
        echo '<link rel="stylesheet" href="' . esc_url(includes_url('css/dashicons.min.css')) . '?ver=' . EVA_FW_VERSION . '">';
        echo '<link rel="stylesheet" href="' . esc_url($css) . '">';
        // 主色覆盖（用户挑的主题色 > 主题品牌色）：紧跟 eva.css 之后，等同后台的 wp_add_inline_style。
        // 值全部出自 sanitize_hex_color，可直接输出。
        $theme_color_css = \Eva::theme_color_css();
        if ($theme_color_css !== '') {
            echo '<style>' . $theme_color_css . '</style>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        }
        // UI 库 CSS（Libs/<name>/）。
        foreach (\Eva::lib_assets() as $lib_name => $lib) {
            if ($lib['css']) {
                echo '<link rel="stylesheet" href="' . esc_url($lib['css'] . '?ver=' . \Eva::asset_ver($lib['cssRel'])) . '">';
            }
        }
        // 字段样式（Fields/<name>/<name>.css）。
        foreach (\Eva::field_styles() as $field_name => $field_css) {
            echo '<link rel="stylesheet" href="' . esc_url($field_css . '?ver=' . \Eva::asset_ver(\Eva::field_asset_rel($field_name, 'css'))) . '">';
        }
        // 输出 WordPress 编辑器 / CodeMirror 等通过 enqueue 注册的样式。
        if (function_exists('wp_print_styles')) {
            wp_print_styles();
        }
        echo '</head>';

        // ===== 文档体：挂载点 + 注入数据 + 脚本（Vue → UI 库 → 字段 → 外壳 → 更新页）=====
        echo '<body class="eva-standalone">';
        echo '<div id="eva-app" class="eva-root"><div class="eva-boot">Eva Framework 正在加载…</div></div>';
        echo '<script>window.EvaFW = ' . $json . ';</script>';
        // 自定义图标集（过滤器 eva_field_icon_add_icons），图标选择器首次打开时读取。
        $icon_sets = \Eva::icon_sets_script();
        if ($icon_sets !== '') {
            echo '<script>' . $icon_sets . '</script>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        }
        // 输出媒体库、TinyMCE 与 CodeMirror 的脚本和内联配置。
        if (function_exists('wp_print_footer_scripts')) {
            wp_print_footer_scripts();
        }
        echo '<script src="' . esc_url($vue) . '"></script>';
        // UI 库脚本（Libs/<name>/，先于字段与外壳）。
        foreach (\Eva::lib_assets() as $lib_name => $lib) {
            if ($lib['js']) {
                echo '<script src="' . esc_url($lib['js'] . '?ver=' . \Eva::asset_ver($lib['jsRel'])) . '"></script>';
            }
        }
        // 字段脚本：一字段一目录，递归扫描（在 eva-app.js 之前）。
        foreach (\Eva::field_scripts() as $field_name => $field_url) {
            echo '<script src="' . esc_url($field_url . '?ver=' . \Eva::asset_ver(\Eva::field_asset_rel($field_name, 'js'))) . '"></script>';
        }
        echo '<script src="' . esc_url($js) . '"></script>';
        // 外壳已就绪（Vue / UI 库 / 字段 / eva-app 都已输出）。整页型的自定义应用脚本挂这里，
        // 才拿得到 window.Vue、window.EvaUI、window.EvaI18n —— wp_print_footer_scripts()
        // 在上面更早的位置，用 wp_enqueue_script 排不到这个位置。
        do_action('eva_footer_scripts', $opt);

        // 开发期热刷新（可删；或 wp-config 设 EVA_FW_DEV=false 关闭）。
        if (defined('EVA_FW_DEV') && EVA_FW_DEV) {
            $lr = EVA_FW_URL . 'assets/eva-livereload.js?ver=' . \Eva::asset_ver('assets/eva-livereload.js');
            $devcfg = wp_json_encode(\Eva::dev_config(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
            echo '<script>window.EvaFWDev = ' . $devcfg . ';</script>';
            echo '<script src="' . esc_url($lr) . '"></script>';
        }

        // Eva 独立页是自渲染整页、不走 wp_footer，这里手动注入后台悬浮窗。
        Floating::markup();

        echo '</body></html>';
        // 整页已输出，立即结束，避免后续主题模板继续输出。
        exit;
    }
}
