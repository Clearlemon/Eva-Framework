<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 区块容器（对应 Eva::createBlock，CSF 没有同类 API）。
 *
 * 和其它容器最大的不同：区块的值不进数据库，而是作为区块属性写在文章内容里。
 * 所以这里没有 save()，取而代之的是一条服务端渲染回调：
 *
 * - 注册：init 上按注册表逐个 register_block_type()，全部声明为动态区块
 *   （save 返回 null，前台每次由 PHP 现渲染），字段值统一收在一个对象属性 `eva` 里。
 * - 编辑器：enqueue_block_editor_assets 送出 Eva 运行时 + assets/eva-blocks.js，
 *   后者把每个区块注册成 React 区块，并在右侧栏挂一个 Eva 字段面板（Vue 挂在 React 里，
 *   靠 eva-embed.js 暴露的 EvaEmbed.mount/unmount/setValues 三个口子桥接）。
 * - 渲染：优先调用容器配置里的 render（callable($values, $content, $block)），
 *   没有则回退到 filter eva_block_{区块名}，与短代码容器的 eva_shortcode_{tag} 同一套路子。
 *
 * 为什么把所有字段塞进一个 `eva` 属性而不是逐字段一个属性：区块属性带类型校验，
 * Eva 有四十来种字段、值形态从标量到嵌套数组都有，逐字段映射既易错、又会在作者改字段
 * 类型时让文章里已有的区块失效。统一一个 object 属性没有这个问题，渲染回调拿到的
 * 仍然是拍平后的 [field_id => value]。
 *
 * @package Eva\Framework
 */
class Block
{
    /**
     * 能搬进区块工具栏的字段类型。
     *
     * 工具栏放的是一排紧凑的图标/文字按钮，只有「离散选项」类的字段塞得进去；
     * 文本、颜色、媒体这些标了 toolbar 也会被忽略，老实留在右侧栏。
     */
    const TOOLBAR_TYPES = ['button_set', 'radio', 'select', 'switcher'];

    /**
     * 挂载区块注册、区块分类与编辑器资源钩子。
     */
    public function __construct()
    {
        // 前后台都要注册：前台靠它渲染，后台靠它提供 REST 预览端点。
        // 优先级 20，给主题/扩展留出在 init 早段调用 createBlock 的余地。
        add_action('init', [$this, 'register_blocks'], 20);
        // 区块配置里写了未注册的分类时，自动补一个，省得作者再手写一遍 block_categories_all。
        add_filter('block_categories_all', [$this, 'register_categories'], 20, 2);
        // 编辑器资源：Eva 运行时 + 区块注册脚本。
        add_action('enqueue_block_editor_assets', [$this, 'enqueue']);
        // placement=content 的区块要把字段画进画布，而画布是 iframe，样式得另外送进去。
        add_filter('block_editor_settings_all', [$this, 'canvas_styles'], 20);
    }

    /**
     * 按注册表逐个注册区块（全部为动态区块）。
     *
     * @return void
     */
    public function register_blocks()
    {
        foreach (\Eva::get_blocks() as $name => $cfg) {
            // 已被别处注册过（主题自己写过同名区块）就让开，不覆盖。
            if (\WP_Block_Type_Registry::get_instance()->is_registered($name)) {
                continue;
            }

            $args = [
                // 字段值统一收在一个对象属性里，详见类注释。
                'attributes' => [
                    'eva' => ['type' => 'object'],
                ],
                // html=false：不允许「编辑为 HTML」，避免用户手改出对不上字段的属性。
                'supports'   => array_merge(['html' => false], (array) $cfg['supports']),
            ];

            // example 既接受 WP 原生的 ['attributes' => [...]]，也接受直接写字段值的简写。
            if (! empty($cfg['example']) && is_array($cfg['example'])) {
                $args['example'] = isset($cfg['example']['attributes'])
                    ? $cfg['example']
                    : ['attributes' => ['eva' => $cfg['example']]];
            }

            $args['render_callback'] = function ($attributes, $content = '', $block = null) use ($name, $cfg) {
                return self::render($name, $cfg, $attributes, $content, $block);
            };

            register_block_type($name, $args);
        }
    }

    /**
     * 渲染一个区块：属性 → 合默认值 → 清洗 → 交给 render / filter。
     *
     * @param string     $name       区块名。
     * @param array      $cfg        容器配置。
     * @param array      $attributes 区块属性（字段值在 $attributes['eva']）。
     * @param string     $content    InnerBlocks 的内容（未开启嵌套时为空串）。
     * @param mixed      $block      WP_Block 实例（WP 传入）。
     * @return string                前台 HTML。
     */
    public static function render($name, $cfg, $attributes, $content = '', $block = null)
    {
        $raw    = (is_array($attributes) && isset($attributes['eva']) && is_array($attributes['eva']))
            ? $attributes['eva']
            : [];
        $values = self::resolve_values($cfg, $raw);

        // 配置里给了渲染回调就用它。
        if (! empty($cfg['render']) && is_callable($cfg['render'])) {
            return (string) call_user_func($cfg['render'], $values, $content, $block);
        }
        // 否则交给 filter，与短代码容器的 eva_shortcode_{tag} 同一套路子。
        return (string) apply_filters('eva_block_' . $name, '', $values, $content, $block);
    }

    /**
     * 区块属性 → 渲染回调拿到的字段值。
     *
     * 属性里只存用户动过的字段，先用默认值补齐再整体过一遍字段清洗——
     * 清洗顺带把值规整成各容器统一的存值形态（开了 csf_compat 的容器即 CSF 形态），
     * 于是主题里读区块值和读设置项的写法是一样的。区块属性来自文章内容、可被手工改写，
     * 这一步也是必要的兜底。
     *
     * @param array $cfg 容器配置。
     * @param array $raw 区块属性里的原始字段值。
     * @return array     [field_id => value]
     */
    public static function resolve_values($cfg, $raw)
    {
        $sections = isset($cfg['sections']) && is_array($cfg['sections']) ? $cfg['sections'] : [];
        $raw      = array_merge(\Eva::default_values($sections), is_array($raw) ? $raw : []);
        return Data::sanitize_by_sections($sections, $raw);
    }

    /**
     * 区块配置里写了未注册的分类时自动补上。
     *
     * @param array $categories 现有区块分类。
     * @param mixed $context    编辑器上下文（WP 传入，未使用）。
     * @return array
     */
    public function register_categories($categories, $context = null)
    {
        $existing = wp_list_pluck((array) $categories, 'slug');
        foreach (\Eva::get_blocks() as $cfg) {
            $slug = isset($cfg['category']) ? (string) $cfg['category'] : '';
            if ($slug === '' || in_array($slug, $existing, true)) {
                continue;
            }
            $categories[] = [
                'slug'  => $slug,
                'title' => ! empty($cfg['category_title']) ? self::plain_text($cfg['category_title']) : $slug,
                'icon'  => null,
            ];
            $existing[] = $slug;
        }
        return $categories;
    }

    /**
     * 把标了 toolbar 的字段从分区里摘出来。
     *
     * 摘出去的字段不再进 Vue 面板（否则侧栏和工具栏会出现两个控件），
     * 改由 eva-blocks.js 渲染成原生工具栏控件；两边写的是同一个区块属性，值天然同步。
     * 类型不在 TOOLBAR_TYPES 里的忽略这个标记，留在侧栏——总比悄悄丢掉一个字段强。
     *
     * @param array $sections 已 prepare 过的分区。
     * @return array{0: array, 1: array} [留在侧栏的分区, 搬进工具栏的字段]
     */
    private static function split_toolbar_fields($sections)
    {
        $toolbar = [];
        $rest    = [];

        foreach ((array) $sections as $section) {
            $fields = isset($section['fields']) && is_array($section['fields']) ? $section['fields'] : [];
            $keep   = [];

            foreach ($fields as $field) {
                $type = \Eva::normalizeFieldType(isset($field['type']) ? $field['type'] : 'text');
                if (! empty($field['toolbar']) && ! empty($field['id']) && in_array($type, self::TOOLBAR_TYPES, true)) {
                    $field['type'] = $type;
                    $toolbar[]     = $field;
                    continue;
                }
                $keep[] = $field;
            }

            // 一整组字段都搬走了就别再往前端送这个分区，免得侧栏多出一个空标题。
            if ($keep || empty($fields)) {
                $section['fields'] = $keep;
                $rest[] = $section;
            }
        }

        return [array_values($rest), array_values($toolbar)];
    }

    /**
     * 把可能是多语言对象的文案拍平成一个字符串。
     *
     * Eva 的配置文案允许写成 ['zh' => '…', 'en' => '…']，通常由前端 tv() 按当前编辑语言取值；
     * 区块分类标题要在 PHP 侧交给 WordPress，这里按站点语言挑一个，挑不到就退到中/英/第一个。
     *
     * @param mixed $value 字符串或多语言数组。
     * @return string
     */
    private static function plain_text($value)
    {
        if (! is_array($value)) {
            return (string) $value;
        }
        // 站点语言 zh_CN → zh；命中就用它。
        $lang = strtolower(substr((string) get_locale(), 0, 2));
        foreach ([$lang, 'zh', 'en'] as $code) {
            if ($code !== '' && ! empty($value[$code])) {
                return (string) $value[$code];
            }
        }
        $first = reset($value);
        return is_scalar($first) ? (string) $first : '';
    }

    /**
     * 编辑器资源：Eva 运行时（Vue + 字段组件 + eva-embed）+ 区块注册脚本。
     *
     * @return void
     */
    public function enqueue()
    {
        $payload = self::editor_payload();
        // 当前用户一个区块都用不了就什么都不加载。
        if (empty($payload)) {
            return;
        }
        // 字段组件、样式与 eva-embed 桥接口都来自这里。
        \Eva::enqueue_runtime();

        wp_enqueue_script(
            'eva-blocks',
            EVA_FW_URL . 'assets/eva-blocks.js',
            ['eva-embed', 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-data', 'wp-server-side-render'],
            \Eva::asset_ver('assets/eva-blocks.js'),
            true
        );
        wp_add_inline_script(
            'eva-blocks',
            'window.EvaBlocks = ' . wp_json_encode($payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';',
            'before'
        );
    }

    /**
     * 把 Eva 的样式送进区块编辑器画布。
     *
     * WP 6.3 起画布是一个 iframe，enqueue_block_editor_assets 的样式只进外层文档，
     * 因此 placement=content（字段直接画在区块里）的字段在画布里会完全没有样式。
     * block_editor_settings_all 的 styles 会被注入 iframe，这里借它补上。
     *
     * 注入的是一串 @import 而不是样式正文：Eva 的全套 CSS 有近 400KB，内联进编辑器设置
     * 会把编辑器页面撑大一圈，@import 则走正常的 HTTP 缓存。只有真的存在 placement=content
     * 的区块时才注入，其余站点一个字节都不多加。
     *
     * @param array $settings 区块编辑器设置。
     * @return array
     */
    public function canvas_styles($settings)
    {
        $urls = self::canvas_style_urls();
        if (empty($urls)) {
            return $settings;
        }

        $imports = [];
        foreach ($urls as $url) {
            $imports[] = '@import url("' . esc_url_raw($url) . '");';
        }
        if (! isset($settings['styles']) || ! is_array($settings['styles'])) {
            $settings['styles'] = [];
        }
        $settings['styles'][] = ['css' => implode("\n", $imports)];

        // 主题色/用户主题色的令牌覆盖是内联的，没有对应的文件可 import，单独追一条。
        $tokens = \Eva::theme_color_css();
        if ($tokens !== '') {
            $settings['styles'][] = ['css' => $tokens];
        }
        return $settings;
    }

    /**
     * 画布需要的样式表 URL（框架样式 + UI 库 + 字段样式 + 图标字体）。
     *
     * 没有 placement=content 的区块时返回空数组——画布里不会出现 Eva 字段，不必注入。
     *
     * @return string[]
     */
    private static function canvas_style_urls()
    {
        $needed = false;
        foreach (\Eva::get_blocks() as $cfg) {
            if (isset($cfg['placement']) && $cfg['placement'] === 'content') {
                $needed = true;
                break;
            }
        }
        if (! $needed) {
            return [];
        }

        // 顺序与 Eva::enqueue_runtime 一致：图标字体 → 框架样式 → UI 库 → 字段样式。
        $urls = ['https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.css'];
        $urls[] = EVA_FW_URL . 'assets/eva.css?ver=' . \Eva::asset_ver('assets/eva.css');
        foreach (\Eva::lib_assets() as $lib) {
            if (! empty($lib['css'])) {
                $urls[] = $lib['css'] . '?ver=' . \Eva::asset_ver($lib['cssRel']);
            }
        }
        foreach (\Eva::field_styles() as $name => $url) {
            $urls[] = $url . '?ver=' . \Eva::asset_ver(\Eva::field_asset_rel($name, 'css'));
        }
        return $urls;
    }

    /**
     * 组装注入编辑器的区块清单。
     *
     * 注意 capability 只在这里生效：区块本身始终注册（否则文章里已有的区块前台就没了），
     * 权限不足的用户只是拿不到编辑器端的注册，插入器里看不到它。默认值 edit_posts
     * 是能打开编辑器的人都有的，真要限制得往上调（如 edit_theme_options）。
     *
     * @return array[] 每个区块一条，供 assets/eva-blocks.js 逐个 registerBlockType。
     */
    public static function editor_payload()
    {
        $out = [];
        foreach (\Eva::get_blocks() as $name => $cfg) {
            // 权限不足：不往编辑器里送这个区块。
            if (! empty($cfg['capability']) && ! current_user_can($cfg['capability'])) {
                continue;
            }

            $registered = isset($cfg['sections']) ? $cfg['sections'] : [];
            $sections   = \Eva::prepare_sections($registered);
            // 标了 'toolbar' => true 的字段搬去区块工具栏：那边由 eva-blocks.js 用 WordPress
            // 原生工具栏控件渲染（Vue 组件塞进工具栏又重又不像原生），所以要先从分区里摘出来。
            list($sections, $toolbar) = self::split_toolbar_fields($sections);
            // 没写 render 也没人挂 filter 的区块画布里没得预览，只好显示占位卡片。
            $renderable = (! empty($cfg['render']) && is_callable($cfg['render']))
                || has_filter('eva_block_' . $name);
            // preview 没显式指定时跟随「是否渲染得出来」。
            $preview = ($cfg['preview'] === null) ? $renderable : (bool) $cfg['preview'];

            $out[] = [
                'name'        => $name,
                // title / description 可能是 {zh,en,ja} 多语言对象，和其它配置文案一样交给前端 tv() 拍平。
                'title'       => $cfg['title'],
                'description' => $cfg['description'],
                'icon'        => $cfg['icon'],
                'category'    => $cfg['category'],
                'keywords'    => array_values((array) $cfg['keywords']),
                'supports'    => array_merge(['html' => false], (array) $cfg['supports']),
                'placement'   => in_array($cfg['placement'], ['inspector', 'content'], true) ? $cfg['placement'] : 'inspector',
                'innerBlocks' => ! empty($cfg['inner_blocks']),
                // 嵌套区块的画布要留给 InnerBlocks，服务端预览和它互斥。
                'preview'     => $preview && empty($cfg['inner_blocks']),
                'renderable'  => $renderable,
                'sections'    => $sections,
                'toolbar'     => $toolbar,
                'dependencySources' => \Eva\Framework\Admin\Dependency::dependency_sources($sections),
                // 新插入的区块用这份默认值开局；存过的属性会覆盖同名键。
                'defaults'    => Csf_Compat::values_to_eva($registered, \Eva::default_values($registered)),
            ];
        }
        return $out;
    }
}
