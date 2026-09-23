<?php

/**
 * 区块演示（仅作示例，可整文件删除，不影响框架本体）。
 *
 * 作用：用 \Eva::createBlock 演示区块容器的四种形态，每个区块对应一种，编辑器里插上就能玩：
 *       - eva/demo-notice  —— 字段在右侧栏 + 画布里是服务端渲染的真实效果（最常用的一种）；
 *       - eva/demo-card    —— placement=content，字段直接画在区块里，不用选中就能改；
 *       - eva/demo-section —— inner_blocks=true，画布留给嵌套子区块，字段只在右侧栏；
 *       - eva/demo-cta     —— 不写 render，输出交给过滤器 eva_block_{区块名}。
 *
 * 四个区块都归在「Eva 演示区块」分类下（分类由 category_title 自动注册）。
 *
 * 删除方式：删掉本文件，并去掉 eva-framework.php 里对应的 require。
 * 区块的值存在文章内容里，删掉之后文章里插过的这些区块会变成空区块（不会留下坏 HTML）。
 */

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

// 四个演示区块共用的分类配置，省得每个都抄一遍。
$eva_demo_block_category = [
    'category'       => 'eva-demo',
    'category_title' => 'Eva 演示区块',
];

/* ── 一、字段在侧栏 + 画布服务端预览 ────────────────────────────────────────
 * 最常用的一种：字段收在右侧栏，画布里直接调 render 显示前台真实效果。 */
\Eva::createBlock('eva/demo-notice', array_merge($eva_demo_block_category, [
    'title'       => '提示框',
    'description' => '四种颜色的提示框，字段在右侧栏，画布里是前台真实效果。',
    'icon'        => 'info',
    'keywords'    => ['notice', '提示', 'eva'],
    'fields'      => [
        [
            'id'      => 'style',
            'type'    => 'button_set',
            'title'   => '样式',
            'options' => ['info' => '信息', 'success' => '成功', 'warning' => '警告', 'danger' => '危险'],
            'default' => 'info',
            // 搬到区块工具栏：选中区块就能直接切，不用开右侧栏。
            'toolbar' => true,
        ],
        [
            'id'          => 'title',
            'type'        => 'text',
            'title'       => '标题',
            'placeholder' => '留空则不显示标题',
        ],
        [
            'id'      => 'content',
            'type'    => 'textarea',
            'title'   => '内容',
            'default' => '这是一段提示文字。',
        ],
        [
            'id'      => 'icon',
            'type'    => 'icon',
            'title'   => '图标',
            'default' => 'ri-information-line',
            'desc'    => '留空则只显示标题文字。',
        ],
        [
            'id'           => 'rounded',
            'type'         => 'switcher',
            'title'        => '圆角',
            'label'        => '给提示框加圆角',
            'default'      => 1,
            // 开关在工具栏上是一个按下态的图标按钮，图标用 dashicon 名。
            'toolbar'      => true,
            'toolbar_icon' => 'align-center',
        ],
    ],
    // 渲染回调拿到的是「补齐默认值并清洗过」的 [field_id => value]。
    'render'      => 'eva_demo_render_notice',
]));

/* ── 二、字段直接画在区块里 ────────────────────────────────────────────────
 * placement=content：不用选中区块就能改字段，代价是画布里看不到前台效果。
 * 这类区块的字段画在编辑器画布的 iframe 里，Eva 会自动把样式注入进去。 */
\Eva::createBlock('eva/demo-card', array_merge($eva_demo_block_category, [
    'title'       => '资料卡',
    'description' => '字段直接画在区块里，不用选中就能改。',
    'icon'        => 'id-alt',
    'keywords'    => ['card', '卡片'],
    'placement'   => 'content',
    'fields'      => [
        [
            'id'    => 'name',
            'type'  => 'text',
            'title' => '姓名',
            'width' => '1/2',
        ],
        [
            'id'    => 'role',
            'type'  => 'text',
            'title' => '头衔',
            'width' => '1/2',
        ],
        [
            'id'    => 'avatar',
            'type'  => 'media',
            'title' => '头像',
        ],
        [
            'id'      => 'bio',
            'type'    => 'textarea',
            'title'   => '简介',
            'default' => '这个人很懒，什么都没留下。',
        ],
    ],
    'render'      => 'eva_demo_render_card',
]));

/* ── 三、嵌套容器 ──────────────────────────────────────────────────────────
 * inner_blocks=true：画布留给 InnerBlocks（可以往里拖任意区块），字段只在右侧栏。
 * 此时服务端预览自动关闭——预览和嵌套编辑抢同一块地方。 */
\Eva::createBlock('eva/demo-section', array_merge($eva_demo_block_category, [
    'title'        => '分区容器',
    'description'  => '可以往里拖任意区块，外层的底色、内边距用 Eva 字段配置。',
    'icon'         => 'editor-insertmore',
    'keywords'     => ['container', '容器', '分区'],
    'inner_blocks' => true,
    'fields'       => [
        [
            'id'      => 'bg',
            'type'    => 'color',
            'title'   => '背景色',
            'default' => '#f5f6f8',
        ],
        [
            'id'      => 'padding',
            'type'    => 'slider',
            'title'   => '内边距',
            'min'     => 0,
            'max'     => 80,
            'step'    => 4,
            'unit'    => 'px',
            'default' => 24,
        ],
        [
            'id'      => 'radius',
            'type'    => 'switcher',
            'title'   => '圆角',
            'label'   => '给容器加圆角',
            'default' => 1,
        ],
    ],
    'render'       => 'eva_demo_render_section',
]));

/* ── 四、输出交给过滤器 ────────────────────────────────────────────────────
 * 不写 render 时回退到 filter eva_block_{区块名}，和短代码容器的
 * eva_shortcode_{tag} 是同一套路子。主题里区块声明和渲染想分开放时用这种写法。 */
\Eva::createBlock('eva/demo-cta', array_merge($eva_demo_block_category, [
    'title'       => '行动号召',
    'description' => '不写 render，输出由过滤器 eva_block_eva/demo-cta 提供。',
    'icon'        => 'megaphone',
    'keywords'    => ['cta', '按钮'],
    'fields'      => [
        [
            'id'      => 'text',
            'type'    => 'text',
            'title'   => '按钮文字',
            'default' => '了解更多',
        ],
        [
            'id'          => 'url',
            'type'        => 'text',
            'title'       => '链接地址',
            'placeholder' => 'https://',
        ],
        [
            'id'      => 'align',
            'type'    => 'button_set',
            'title'   => '对齐',
            // 选项写成 ['label' => …, 'icon' => …] 时工具栏只显示图标，文字进 tooltip。
            'options' => [
                'left'   => ['label' => '左', 'icon' => 'editor-alignleft'],
                'center' => ['label' => '居中', 'icon' => 'editor-aligncenter'],
                'right'  => ['label' => '右', 'icon' => 'editor-alignright'],
            ],
            'default' => 'center',
            'toolbar' => true,
        ],
    ],
]));

// 上面这个区块没写 render，输出在这里补上。
add_filter('eva_block_eva/demo-cta', 'eva_demo_render_cta', 10, 4);

if (! function_exists('eva_demo_block_palette')) {
    /**
     * 演示区块共用的一组配色。
     *
     * @return array<string,string> 样式名 => 主色。
     */
    function eva_demo_block_palette()
    {
        return [
            'info'    => '#2b6cb0',
            'success' => '#1f9d57',
            'warning' => '#c9820c',
            'danger'  => '#b42318',
        ];
    }
}

if (! function_exists('eva_demo_render_notice')) {
    /**
     * 提示框区块的前台渲染。
     *
     * @param array  $values  字段值（已补默认值、已清洗）。
     * @param string $content InnerBlocks 内容（本区块未开启嵌套，恒为空串）。
     * @param mixed  $block   WP_Block 实例。
     * @return string         前台 HTML。
     */
    function eva_demo_render_notice($values, $content = '', $block = null)
    {
        $palette = eva_demo_block_palette();
        // 样式值来自文章内容，可能被手工改坏，取不到就回落到 info。
        $style = isset($palette[$values['style']]) ? $values['style'] : 'info';
        $color = $palette[$style];

        $css = sprintf(
            'border-left:4px solid %1$s;background:color-mix(in srgb, %1$s 8%%, #fff);padding:14px 16px;%2$s',
            $color,
            ! empty($values['rounded']) ? 'border-radius:6px;' : ''
        );

        $html = '<div class="eva-demo-notice is-' . esc_attr($style) . '" style="' . esc_attr($css) . '">';
        if (! empty($values['title'])) {
            $html .= '<strong style="display:block;margin-bottom:6px;color:' . esc_attr($color) . '">';
            if (! empty($values['icon'])) {
                $html .= '<i class="' . esc_attr($values['icon']) . '" style="margin-right:6px"></i>';
            }
            $html .= esc_html($values['title']) . '</strong>';
        }
        $html .= '<div>' . wp_kses_post(wpautop($values['content'])) . '</div>';
        return $html . '</div>';
    }
}

if (! function_exists('eva_demo_render_card')) {
    /**
     * 资料卡区块的前台渲染。
     *
     * @param array  $values  字段值。
     * @param string $content InnerBlocks 内容（未开启嵌套，恒为空串）。
     * @param mixed  $block   WP_Block 实例。
     * @return string         前台 HTML。
     */
    function eva_demo_render_card($values, $content = '', $block = null)
    {
        // media 字段存的是 [url, id, …] 结构，取 url 即可。
        $avatar = '';
        if (! empty($values['avatar'])) {
            $avatar = is_array($values['avatar'])
                ? (isset($values['avatar']['url']) ? $values['avatar']['url'] : '')
                : (string) $values['avatar'];
        }

        $html = '<div class="eva-demo-card" style="display:flex;gap:14px;align-items:flex-start;'
            . 'border:1px solid #ecedf1;border-radius:8px;padding:16px">';
        if ($avatar !== '') {
            $html .= '<img src="' . esc_url($avatar) . '" alt="" width="56" height="56"'
                . ' style="width:56px;height:56px;border-radius:50%;object-fit:cover;flex:0 0 56px">';
        }
        $html .= '<div>';
        $html .= '<strong>' . esc_html($values['name']) . '</strong>';
        if (! empty($values['role'])) {
            $html .= ' <span style="color:#8a91a0">· ' . esc_html($values['role']) . '</span>';
        }
        $html .= '<div style="margin-top:4px;color:#4a5160">' . esc_html($values['bio']) . '</div>';
        return $html . '</div></div>';
    }
}

if (! function_exists('eva_demo_render_section')) {
    /**
     * 分区容器区块的前台渲染：$content 就是嵌套进来的子区块。
     *
     * @param array  $values  字段值。
     * @param string $content 子区块渲染后的 HTML。
     * @param mixed  $block   WP_Block 实例。
     * @return string         前台 HTML。
     */
    function eva_demo_render_section($values, $content = '', $block = null)
    {
        // slider 字段可能存成带单位的字符串，取数字部分即可。
        $padding = (int) preg_replace('/[^0-9]/', '', (string) $values['padding']);
        $css = sprintf(
            'background:%s;padding:%dpx;%s',
            $values['bg'] !== '' ? $values['bg'] : 'transparent',
            $padding,
            ! empty($values['radius']) ? 'border-radius:8px;' : ''
        );
        return '<div class="eva-demo-section" style="' . esc_attr($css) . '">' . $content . '</div>';
    }
}

if (! function_exists('eva_demo_render_cta')) {
    /**
     * 行动号召区块的前台渲染（挂在 filter eva_block_eva/demo-cta 上）。
     *
     * 过滤器的第一个参数是「上一个回调给出的 HTML」，这里直接覆盖即可。
     *
     * @param string $html    默认输出（空串）。
     * @param array  $values  字段值。
     * @param string $content InnerBlocks 内容（未开启嵌套，恒为空串）。
     * @param mixed  $block   WP_Block 实例。
     * @return string         前台 HTML。
     */
    function eva_demo_render_cta($html, $values, $content = '', $block = null)
    {
        $align = in_array($values['align'], ['left', 'center', 'right'], true) ? $values['align'] : 'center';
        $url   = $values['url'] !== '' ? $values['url'] : '#';

        return '<p class="eva-demo-cta" style="text-align:' . esc_attr($align) . '">'
            . '<a href="' . esc_url($url) . '" style="display:inline-block;padding:10px 22px;'
            . 'border-radius:999px;background:#ff758c;color:#fff;text-decoration:none">'
            . esc_html($values['text']) . '</a></p>';
    }
}
