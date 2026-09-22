<?php

/**
 * CSF 兼容演示页。
 *
 * 作用：整页**按 CSF 的写法**注册（字段数组基本是从 Lentasy 的 CSF 设置里照搬的形状），
 *       只把 \CSF:: 换成 \Eva::、容器上加 'csf_compat' => true，用来验证兼容层：
 *       - 不写 menu：侧栏由分区的 title / icon / parent 自动生成；
 *       - heading / subheading / submessage / notice / fieldset / tabbed / palette 等 CSF 字段类型；
 *       - CSF 写法的 group（可增删的行）、accordion（accordions 键）、sorter（选项写在 default 里）、
 *         color_group（按键存）、gallery（ID 逗号串）、字符串数据源（'options' => 'categories'）；
 *       - eva_options_before / eva_{id}_saved 等钩子。
 *       最后一个分区「存库结果」直接打印 get_option() 的原始值，可以看到库里的结构与 CSF 完全一致。
 *
 * 删除方式：删掉本文件，并去掉 eva-framework.php 里对应的 require；数据在 wp_options 的 eva_csf_demo。
 */

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

if (! function_exists('eva_csf_demo_preview')) {
    /**
     * 生成一张纯色占位预览图（SVG data URI），给 image_select 演示用，不依赖任何图片文件。
     *
     * @param string $text  图中文字。
     * @param string $color 主色（#RRGGBB）。
     * @return string
     */
    function eva_csf_demo_preview($text, $color)
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">'
            . '<rect width="320" height="180" fill="#f5f6f8"/>'
            . '<rect x="20" y="20" width="280" height="28" rx="5" fill="' . $color . '"/>'
            . '<rect x="20" y="62" width="130" height="98" rx="5" fill="#ffffff"/>'
            . '<rect x="170" y="62" width="130" height="44" rx="5" fill="#ffffff"/>'
            . '<rect x="170" y="116" width="130" height="44" rx="5" fill="#ffffff"/>'
            . '<text x="160" y="40" font-size="14" text-anchor="middle" fill="#ffffff" font-family="sans-serif">' . esc_html($text) . '</text>'
            . '</svg>';
        return 'data:image/svg+xml;base64,' . base64_encode($svg);
    }
}

if (! function_exists('eva_csf_demo_dump_saved')) {
    /**
     * callback 字段的回调：打印 wp_options 里的原始存值，证明库里的结构就是 CSF 的结构。
     *
     * @return void
     */
    function eva_csf_demo_dump_saved()
    {
        $saved = get_option('eva_csf_demo', null);
        $when  = get_option('eva_csf_demo_saved_at', '');

        echo '<div style="display:grid;gap:10px">';
        echo '<p style="margin:0;color:#8a91a0;font-size:12.5px">';
        echo $when !== ''
            ? '最近一次保存：' . esc_html($when) . '（由 <code>eva_eva_csf_demo_saved</code> 动作记录）。改完任意字段点保存，再刷新本页查看。'
            : '还没有保存过。改动任意字段并点保存，再刷新本页，这里会显示库里的原始结构。';
        echo '</p>';
        echo '<pre style="margin:0;padding:14px 16px;overflow:auto;max-height:520px;border-radius:6px;background:#1f2330;color:#e6e8ee;font-size:12px;line-height:1.6">';
        echo esc_html($saved === null ? "get_option('eva_csf_demo') → （空）" : "get_option('eva_csf_demo') →\n" . var_export($saved, true));
        echo '</pre></div>';
    }
}

// ============================================================================
// 0) 顺序无关：这个分区写在 createOptions 之前（CSF 允许这样），兼容层会先排队、等容器出现再挂上去。
// ============================================================================
\Eva::createSection('eva_csf_demo', [
    'title'    => '存库结果',
    'icon'     => 'ri-database-2-line',
    'priority' => 900, // CSF 的 priority：数字越大越靠后
    'fields'   => [
        [
            'type'    => 'submessage',
            'style'   => 'info',
            'content' => '这个分区是在 <code>createOptions()</code> <strong>之前</strong>注册的，靠 <code>priority => 900</code> 排到侧栏最后。',
        ],
        [
            'type'     => 'callback',
            'function' => 'eva_csf_demo_dump_saved',
        ],
    ],
]);

// ============================================================================
// 1) 容器：CSF 的参数名照写（menu_capability），只多一个 csf_compat。注意没有 menu —— 侧栏由分区生成。
// ============================================================================
\Eva::createOptions('eva_csf_demo', [
    'menu_title'      => 'CSF 兼容演示',
    'menu_slug'       => 'eva-csf-demo',
    'menu_capability' => 'manage_options',
    'location'        => 'admin_bar',
    'standalone'      => true,
    'subtitle'        => '整页按 CSF 写法注册 · 不写 menu · 存值格式与 CSF 一致',
    'csf_compat'      => true,
]);

// ============================================================================
// 2) 钩子：对应 csf_options_before / csf_{id}_saved。
// ============================================================================
add_action('eva_options_before', static function ($id) {
    if ($id !== 'eva_csf_demo') {
        return;
    }
    echo '<div style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:6px;color:#fff;background:linear-gradient(120deg,#ff758c,#7280be)">';
    echo '<i class="ri-sparkling-2-fill" style="font-size:22px"></i>';
    echo '<div><strong style="display:block;font-size:14px">这块内容来自 eva_options_before 钩子</strong>';
    echo '<span style="font-size:12.5px;opacity:.9">对应 CSF 的 csf_options_before（Lentasy 用它输出欢迎面板）。Vue 渲染的页面里，PHP 回调 echo 的 HTML 会被收集后显示在表单上方。</span></div>';
    echo '</div>';
}, 10, 1);

add_action('eva_eva_csf_demo_saved', static function () {
    update_option('eva_csf_demo_saved_at', wp_date('Y-m-d H:i:s'), false);
});

// ============================================================================
// 3) 分区：顶级分区 + parent 子分区（CSF 写法，多数没写 id）。
// ============================================================================

// ---- 展示型字段 ----
\Eva::createSection('eva_csf_demo', [
    'title'  => '展示型字段',
    'icon'   => 'ri-layout-top-2-line',
    'fields' => [
        ['type' => 'heading', 'content' => 'heading · 大标题条'],
        ['type' => 'subheading', 'content' => 'subheading · 小标题条'],
        ['type' => 'submessage', 'style' => 'success', 'content' => '<strong>submessage / success</strong>：保存成功、功能已开启这类提示。'],
        ['type' => 'submessage', 'style' => 'info', 'content' => '<strong>submessage / info</strong>：Lentasy 里用得最多的字段（47 处），以前在 Eva 里会退化成一个文本输入框。'],
        ['type' => 'submessage', 'style' => 'warning', 'content' => '<strong>submessage / warning</strong>：支持 <code>HTML</code> 和<a href="#">链接</a>。'],
        ['type' => 'submessage', 'style' => 'danger', 'content' => '<strong>submessage / danger</strong>：危险操作前的警告。'],
        ['type' => 'notice', 'style' => 'normal', 'title' => 'notice 可以带标题', 'content' => 'notice 与 submessage 外观相同；这一条带了 <code>title</code>，所以上方有字段标题。'],
        ['type' => 'subheading', 'content' => '公共参数：help / subtitle / class / before / after'],
        [
            'id'       => 'demo_common_args',
            'type'     => 'text',
            'title'    => '带 help 提示的字段',
            'subtitle' => 'subtitle：标题下方的小字',
            'desc'     => 'desc：字段说明。把鼠标移到标题右边的问号上看 help。',
            'help'     => '这是 help 参数：CSF 里显示为右侧的问号提示。',
            'class'    => 'my-custom-class',
            'before'   => '<small style="color:#8a91a0">before：控件上方的 HTML</small>',
            'after'    => '<small style="color:#8a91a0">after：控件下方的 HTML</small>',
            'default'  => 'Hello Eva',
        ],
        ['type' => 'content', 'content' => '<p style="margin:0;color:#8a91a0">这一段是 <code>content</code> 字段（别名到 Eva 的 html）。</p>'],
    ],
]);

// ---- 容器字段（父分区：只有标题和图标，子分区用 parent 挂上来）----
\Eva::createSection('eva_csf_demo', [
    'id'    => 'containers',
    'title' => '容器字段',
    'icon'  => 'ri-stack-line',
]);

\Eva::createSection('eva_csf_demo', [
    'parent' => 'containers',
    'title'  => 'fieldset',
    'icon'   => 'ri-layout-grid-line',
    'fields' => [
        ['type' => 'submessage', 'style' => 'info', 'content' => 'CSF 的 <code>fieldset</code> = 固定的一组子字段，值是对象 <code>[子字段 id => 值]</code>，对应 Eva 的 group。'],
        [
            'id'     => 'demo_fieldset',
            'type'   => 'fieldset',
            'title'  => '页脚版权',
            'fields' => [
                ['type' => 'submessage', 'style' => 'normal', 'content' => '容器里面嵌套的 submessage 也能正常渲染。'],
                ['id' => 'text', 'type' => 'text', 'title' => '版权文字', 'default' => '© 2026 Lentasy'],
                ['id' => 'show_icp', 'type' => 'switcher', 'title' => '显示备案号', 'default' => true],
                ['id' => 'icp', 'type' => 'text', 'title' => '备案号'],
            ],
        ],
    ],
]);

\Eva::createSection('eva_csf_demo', [
    'parent' => 'containers',
    'title'  => 'tabbed',
    'icon'   => 'ri-folders-line',
    'fields' => [
        ['type' => 'submessage', 'style' => 'info', 'content' => 'CSF 的 <code>tabbed</code>：子字段分到几个标签页，值<strong>平铺</strong>在同一个数组里（标签页不出现在存值结构中）。'],
        [
            'id'    => 'demo_tabbed',
            'type'  => 'tabbed',
            'title' => '登录页设置',
            'tabs'  => [
                [
                    'title'  => '基础',
                    'icon'   => 'ri-settings-3-line',
                    'fields' => [
                        ['id' => 'login_title', 'type' => 'text', 'title' => '登录页标题', 'default' => '欢迎回来'],
                        ['id' => 'login_register', 'type' => 'switcher', 'title' => '允许注册', 'default' => true],
                    ],
                ],
                [
                    'title'  => '外观',
                    'icon'   => 'ri-palette-line',
                    'fields' => [
                        ['id' => 'login_bg', 'type' => 'color', 'title' => '背景色', 'default' => '#f4f5f7'],
                        ['id' => 'login_layout', 'type' => 'button_set', 'title' => '布局', 'options' => ['left' => '居左', 'center' => '居中', 'right' => '居右'], 'default' => 'center'],
                    ],
                ],
                [
                    'title'  => '高级',
                    'icon'   => 'fa fa-cog', // Font Awesome 类名：外壳没有加载 FA，兼容层会忽略它而不是留一个空白
                    'fields' => [
                        ['id' => 'login_redirect', 'type' => 'text', 'title' => '登录后跳转', 'placeholder' => '/account'],
                    ],
                ],
            ],
        ],
    ],
]);

\Eva::createSection('eva_csf_demo', [
    'parent' => 'containers',
    'title'  => 'group（可增删）',
    'icon'   => 'ri-list-unordered',
    'fields' => [
        ['type' => 'submessage', 'style' => 'warning', 'content' => '同名但语义相反：CSF 的 <code>group</code> 是<strong>可增删的行</strong>（值为数组），Eva 自己的 group 是固定对象。开了 <code>csf_compat</code> 的容器里，它按 CSF 的意思渲染成 repeater，库里仍是 CSF 的数组结构。'],
        [
            'id'                     => 'demo_group',
            'type'                   => 'group',
            'title'                  => '社交平台',
            'button_title'           => '添加社交链接',
            'accordion_title_prefix' => '平台',
            'max'                    => 5,
            'fields'                 => [
                ['id' => 'name', 'type' => 'text', 'title' => '名称'],
                ['id' => 'icon', 'type' => 'icon', 'title' => '图标', 'default' => 'ri-github-line'],
                ['id' => 'url', 'type' => 'text', 'title' => '链接', 'placeholder' => 'https://'],
            ],
            'default'                => [
                ['name' => 'GitHub', 'icon' => 'ri-github-line', 'url' => 'https://github.com'],
            ],
        ],
    ],
]);

\Eva::createSection('eva_csf_demo', [
    'parent' => 'containers',
    'title'  => 'accordion',
    'icon'   => 'ri-menu-fold-line',
    'fields' => [
        ['type' => 'submessage', 'style' => 'info', 'content' => 'CSF 用 <code>accordions</code> 键，所有面板的子字段值<strong>平铺</strong>存储；Eva 原生用 <code>sections</code>、按面板分组存。写 <code>accordions</code> 时兼容层自动按 CSF 的结构读写。'],
        [
            'id'         => 'demo_accordion',
            'type'       => 'accordion',
            'title'      => '文章页模块',
            'accordions' => [
                [
                    'title'  => '作者信息',
                    'fields' => [
                        ['id' => 'author_show', 'type' => 'switcher', 'title' => '显示作者卡片', 'default' => true],
                        ['id' => 'author_bio', 'type' => 'textarea', 'title' => '默认简介'],
                    ],
                ],
                [
                    'title'  => '相关文章',
                    'fields' => [
                        ['id' => 'related_count', 'type' => 'spinner', 'title' => '显示数量', 'default' => 4, 'min' => 0, 'max' => 12, 'unit' => '篇'],
                    ],
                ],
            ],
        ],
    ],
]);

// ---- 选项与数据源 ----
\Eva::createSection('eva_csf_demo', [
    'id'    => 'choices',
    'title' => '选项与数据源',
    'icon'  => 'ri-list-check-2',
]);

\Eva::createSection('eva_csf_demo', [
    'parent' => 'choices',
    'title'  => '字符串数据源',
    'icon'   => 'ri-database-line',
    'fields' => [
        ['type' => 'submessage', 'style' => 'info', 'content' => "CSF 的 <code>'options' => 'categories'</code> 这类写法：由后端查库展开成选项；分类按层级缩进（与 Lentasy 给 CSF 打的补丁一致）。"],
        ['id' => 'demo_cat', 'type' => 'select', 'title' => '分类（单选）', 'placeholder' => '选择一个分类', 'options' => 'categories', 'chosen' => true],
        ['id' => 'demo_cats', 'type' => 'select', 'title' => '分类（多选）', 'options' => 'categories', 'multiple' => true, 'chosen' => true, 'query_args' => ['orderby' => 'name']],
        ['id' => 'demo_page', 'type' => 'select', 'title' => '页面', 'placeholder' => '选择一个页面', 'options' => 'pages'],
        ['id' => 'demo_roles', 'type' => 'checkbox', 'title' => '用户角色（checkbox）', 'options' => 'roles', 'inline' => true],
        ['id' => 'demo_post_type', 'type' => 'radio', 'title' => '文章类型（radio）', 'options' => 'post_types', 'inline' => true, 'default' => 'post'],
    ],
]);

\Eva::createSection('eva_csf_demo', [
    'parent' => 'choices',
    'title'  => 'image_select / palette',
    'icon'   => 'ri-image-line',
    'fields' => [
        [
            'id'      => 'demo_nav_style',
            'type'    => 'image_select',
            'title'   => '菜单样式',
            'desc'    => "选项写成 ['url' => …, 'text' => …]（Lentasy 的写法），text 会显示成卡片标题。",
            'options' => [
                'value-1' => ['url' => eva_csf_demo_preview('经典下拉', '#ff758c'), 'text' => '经典下拉'],
                'value-2' => ['url' => eva_csf_demo_preview('超级菜单', '#7280be'), 'text' => '超级菜单'],
                'value-3' => ['url' => eva_csf_demo_preview('分栏菜单', '#12b5a6'), 'text' => '分栏菜单'],
            ],
            'default' => 'value-1',
        ],
        [
            'id'      => 'demo_palette',
            'type'    => 'palette',
            'title'   => '配色方案（palette）',
            'options' => [
                'set-1' => ['#ff758c', '#ff7eb3', '#ffc3a0', '#ffe0e8'],
                'set-2' => ['#1f2330', '#7280be', '#aab0bb', '#f4f5f7'],
                'set-3' => ['#12b5a6', '#1f9d57', '#c9820c', '#b42318'],
            ],
            'default' => 'set-1',
        ],
    ],
]);

\Eva::createSection('eva_csf_demo', [
    'parent' => 'choices',
    'title'  => 'sorter / color_group / gallery',
    'icon'   => 'ri-drag-move-2-line',
    'fields' => [
        ['type' => 'submessage', 'style' => 'warning', 'content' => '这三种字段在 CSF 和 Eva 里的<strong>存值格式不同</strong>。兼容层读出时转成组件要的结构，保存前再转回 CSF 的结构——到「存库结果」里可以看到。'],
        [
            'id'      => 'demo_sorter',
            'type'    => 'sorter',
            'title'   => '编辑页显示的面板（sorter）',
            'desc'    => 'CSF 写法：没有 options，选项写在 default 的 enabled / disabled 里；库里存「键 => 标题」。',
            'default' => [
                'enabled'  => ['excerpt' => '摘要', 'comment' => '评论'],
                'disabled' => ['custom-fields' => '自定义字段', 'author' => '作者', 'alias' => '别名'],
            ],
        ],
        [
            'id'      => 'demo_color_group',
            'type'    => 'color_group',
            'title'   => '导航配色（color_group）',
            'desc'    => 'CSF 写法：options 是「键 => 标题」，库里存「键 => 颜色」。',
            'options' => ['bg' => '背景色', 'text' => '文字色', 'hover' => '悬停色'],
            'default' => ['bg' => '#ffffff', 'text' => '#1f2330', 'hover' => '#ff758c'],
        ],
        [
            'id'    => 'demo_gallery',
            'type'  => 'gallery',
            'title' => '登录页轮播图（gallery）',
            'desc'  => 'CSF 写法：库里存附件 ID 的逗号串，例如 "12,15,18"。',
        ],
    ],
]);

// ---- 复合字段与其它 CSF 字段 ----
\Eva::createSection('eva_csf_demo', [
    'id'    => 'composites',
    'title' => '复合字段',
    'icon'  => 'ri-layout-masonry-line',
]);

\Eva::createSection('eva_csf_demo', [
    'parent' => 'composites',
    'title'  => '排版 / 背景 / 边框',
    'icon'   => 'ri-font-size-2',
    'fields' => [
        ['type' => 'submessage', 'style' => 'info', 'content' => '这几种字段 CSF 用 CSS 属性名做键存值（<code>font-family</code>、<code>background-color</code>…），Eva 用的是另一套键。兼容层读写时互转；CSF 独有、Eva 组件里没有对应控件的键（渐变色、<code>text-decoration</code>…）会随值带着走，保存后不丢。'],
        [
            'id'          => 'demo_typography',
            'type'        => 'typography',
            'title'       => '标题排版（typography）',
            'desc'        => 'font_style / text_align 两项按 CSF 的写法关掉了；选 Google 字体时库里存 type => google，前台会自动加载字体。',
            'font_style'  => false,
            'text_align'  => false,
            'output'      => '.site-title',
            'default'     => ['font-family' => 'Noto Sans SC', 'font-weight' => '700', 'font-size' => '24', 'line-height' => '36', 'color' => '#1f2330', 'type' => 'google', 'unit' => 'px'],
        ],
        [
            'id'      => 'demo_background',
            'type'    => 'background',
            'title'   => '页面背景（background）',
            'output'  => 'body',
            'default' => ['background-color' => '#f4f5f7', 'background-repeat' => 'no-repeat', 'background-size' => 'cover'],
        ],
        [
            'id'      => 'demo_border',
            'type'    => 'border',
            'title'   => '卡片边框（border）',
            'default' => ['top' => '1', 'right' => '1', 'bottom' => '1', 'left' => '1', 'style' => 'solid', 'color' => '#ecedf1'],
        ],
    ],
]);

\Eva::createSection('eva_csf_demo', [
    'parent' => 'composites',
    'title'  => '间距 / 尺寸 / 链接色 / 日期',
    'icon'   => 'ri-ruler-line',
    'fields' => [
        ['id' => 'demo_spacing', 'type' => 'spacing', 'title' => '内边距（spacing）', 'output_mode' => 'padding', 'default' => ['top' => '16', 'right' => '20', 'bottom' => '16', 'left' => '20', 'unit' => 'px']],
        ['id' => 'demo_dimensions', 'type' => 'dimensions', 'title' => 'Logo 尺寸（dimensions）', 'default' => ['width' => '160', 'height' => '48', 'unit' => 'px']],
        ['id' => 'demo_link_color', 'type' => 'link_color', 'title' => '链接颜色（link_color）', 'desc' => 'CSF 的默认态键名是 color（Eva 叫 normal）；visited / focus 按 CSF 的写法单独打开。', 'visited' => true, 'focus' => true, 'default' => ['color' => '#1f2330', 'hover' => '#ff758c']],
        ['id' => 'demo_date', 'type' => 'date', 'title' => '日期（date）', 'desc' => 'CSF 默认按 jQuery UI 的 mm/dd/yy 存，例如 09/21/2026。', 'default' => '09/21/2026'],
        ['id' => 'demo_date_range', 'type' => 'date', 'title' => '日期区间（from_to）', 'desc' => "settings.dateFormat = 'yy-mm-dd'，库里存 ['from' => …, 'to' => …]。", 'from_to' => true, 'settings' => ['dateFormat' => 'yy-mm-dd']],
        ['id' => 'demo_datetime', 'type' => 'datetime', 'title' => '日期时间（datetime）', 'desc' => "CSF 用 flatpickr，这里的 dateFormat = 'd.m.Y H:i'。", 'settings' => ['dateFormat' => 'd.m.Y H:i']],
    ],
]);

\Eva::createSection('eva_csf_demo', [
    'parent' => 'composites',
    'title'  => 'map / 自定义图标集',
    'icon'   => 'ri-map-pin-line',
    'fields' => [
        [
            'id'       => 'demo_map',
            'type'     => 'map',
            'title'    => '门店位置（map）',
            'desc'     => '搜索地址、点地图或拖动图钉；库里存 address / latitude / longitude / zoom，与 CSF 一致。',
            'height'   => '320px',
            'settings' => ['center' => [31.2304, 121.4737], 'zoom' => 10, 'scrollWheelZoom' => false],
        ],
        [
            'id'    => 'demo_custom_icon',
            'type'  => 'icon',
            'title' => '图标（带自定义图标集）',
            'desc'  => '打开选择器，最后一个分类「演示图标集」来自 eva_field_icon_add_icons 过滤器（对应 csf_field_icon_add_icons）。',
        ],
        ['id' => 'demo_pseudo', 'type' => 'text', 'title' => 'pseudo 字段', 'desc' => "写了 'pseudo' => true：照常渲染，但不进存值（到「存库结果」里找不到 demo_pseudo）。", 'pseudo' => true, 'default' => '只显示，不保存'],
    ],
]);

// 自定义图标集：格式与 CSF 的 csf_field_icon_add_icons 相同。
add_filter('eva_field_icon_add_icons', static function ($sets) {
    $sets[] = [
        'title' => '演示图标集',
        'icons' => ['dashicons dashicons-wordpress', 'dashicons dashicons-admin-site', 'dashicons dashicons-heart', 'dashicons dashicons-star-filled', 'dashicons dashicons-cart', 'dashicons dashicons-tickets-alt'],
    ];
    return $sets;
});

// 容器级参数：过滤器 eva_{id}_args 对应 csf_{id}_args。这里顺便演示 contextual_help / footer_text。
add_filter('eva_eva_csf_demo_args', static function ($args) {
    $args['contextual_help'] = [
        ['id' => 'overview', 'title' => '这是什么', 'content' => '<p>CSF 的 <code>contextual_help</code> 在 WP 后台是右上角的「帮助」选项卡；Eva 的页面看不到那个选项卡，所以兼容层把它放进侧栏最后的「帮助」页。</p>'],
        ['id' => 'how', 'title' => '怎么迁移', 'content' => '<p>把 <code>\CSF::</code> 换成 <code>\Eva::</code>，容器上加 <code>csf_compat =&gt; true</code>。完整对照见《迁移到主题使用指南》§10。</p>'],
    ];
    $args['contextual_help_sidebar'] = '这一段来自 <code>contextual_help_sidebar</code>。';
    $args['footer_text'] = '这一行来自 footer_text · Eva Framework CSF 兼容演示';
    return $args;
});

// ============================================================================
// 4) 其它容器：metabox / 导航菜单 / 短代码 / 定制器（都按 CSF 的写法）。
// ============================================================================

// ---- 文章 metabox：show_restore、post_formats 条件、数组类字段（验证嵌入式表单的 JSON 提交）----
\Eva::createMetabox('eva_csf_demo_meta', [
    'title'        => 'CSF 兼容演示 · Metabox',
    'post_type'    => 'post',
    'data_type'    => 'serialize',
    'show_restore' => true,
    'csf_compat'   => true,
]);
\Eva::createSection('eva_csf_demo_meta', [
    'fields' => [
        ['type' => 'submessage', 'style' => 'info', 'content' => '这个 metabox 按 CSF 写法注册。勾选下面的多选项并更新文章，值会以数组存进 post_meta（以前嵌入式表单里的数组类字段存不进去）。'],
        ['id' => 'show_toc', 'type' => 'switcher', 'title' => '显示目录', 'default' => true],
        ['id' => 'badges', 'type' => 'checkbox', 'title' => '文章角标', 'inline' => true, 'options' => ['hot' => '热门', 'new' => '最新', 'pick' => '精选']],
        ['id' => 'source', 'type' => 'fieldset', 'title' => '来源', 'fields' => [
            ['id' => 'name', 'type' => 'text', 'title' => '来源名称'],
            ['id' => 'url', 'type' => 'text', 'title' => '来源链接', 'placeholder' => 'https://'],
        ]],
    ],
]);

// ---- 侧栏 metabox（context=side）：可用宽度只有 ~250px，验证嵌入式表单的窄栏变体 ----
// 字段形状照搬主题里现有的「外链缩略图 / 文章来源」两块，data_type 用 CSF 的 unserialize 写法（Eva 自动映射成 direct）。
\Eva::createMetabox('eva_csf_demo_side', [
    'title'      => 'CSF 兼容演示 · 侧栏 Metabox',
    'post_type'  => 'post',
    'context'    => 'side',
    'data_type'  => 'unserialize',
    'csf_compat' => true,
]);
\Eva::createSection('eva_csf_demo_side', [
    'fields' => [
        ['id' => 'eva_demo_thumb', 'type' => 'upload', 'preview' => true, 'desc' => '不想使用 WordPress 默认的缩略图功能吗？<b>上传一张自定义的缩略图吧！</b>'],
        ['id' => 'eva_demo_source_type', 'type' => 'button_set', 'options' => ['original' => '原创', 'reprint' => '转载'], 'default' => 'original'],
        ['id' => 'eva_demo_source_author', 'type' => 'text', 'title' => '转载作者', 'dependency' => ['eva_demo_source_type', '==', 'reprint', '']],
        ['id' => 'eva_demo_source_url', 'type' => 'text', 'title' => '转载链接', 'dependency' => ['eva_demo_source_type', '==', 'reprint', '']],
    ],
]);

// ---- 侧栏 metabox · 合并形态：一个容器 + 多个带标题的分区（对比「每组字段各占一个 postbox」）----
\Eva::createMetabox('eva_csf_demo_side_grouped', [
    'title'      => '文章设置',
    'post_type'  => 'post',
    'context'    => 'side',
    'data_type'  => 'unserialize',
    'csf_compat' => true,
]);
\Eva::createSection('eva_csf_demo_side_grouped', [
    'title'  => '缩略图',
    'fields' => [
        ['id' => 'eva_grp_thumb', 'type' => 'upload', 'preview' => true, 'desc' => '留空则用 WordPress 的特色图片。'],
    ],
]);
\Eva::createSection('eva_csf_demo_side_grouped', [
    'title'  => '来源',
    'fields' => [
        ['id' => 'eva_grp_source_type', 'type' => 'button_set', 'options' => ['original' => '原创', 'reprint' => '转载'], 'default' => 'original'],
        ['id' => 'eva_grp_source_author', 'type' => 'text', 'title' => '转载作者', 'dependency' => ['eva_grp_source_type', '==', 'reprint', '']],
        ['id' => 'eva_grp_source_url', 'type' => 'text', 'title' => '转载链接', 'dependency' => ['eva_grp_source_type', '==', 'reprint', '']],
    ],
]);

// ---- 导航菜单：字段上的 menu 键限定层级 ----
\Eva::createNavMenuOptions('eva_csf_demo_nav', ['data_type' => 'serialize', 'csf_compat' => true]);
\Eva::createSection('eva_csf_demo_nav', [
    'fields' => [
        ['id' => 'style', 'type' => 'button_set', 'title' => '下拉样式（只在第 1 级显示）', 'menu' => '1', 'options' => ['classic' => '经典', 'mega' => '超级菜单'], 'default' => 'classic'],
        ['id' => 'badge', 'type' => 'text', 'title' => '角标文字（第 2–3 级显示）', 'menu' => '2,3'],
    ],
]);

// ---- 短代码：经典编辑器按钮 + 区块编辑器区块 ----
\Eva::createShortcoder('eva_csf_demo_button', [
    'title'        => 'Eva 按钮',
    'shortcode'    => 'eva_demo_button',
    'button_title' => '插入 Eva 按钮',
    'insert_title' => '插入到编辑器',
    'gutenberg'    => ['title' => 'Eva 按钮（短代码）', 'description' => '用 Eva 的字段生成 [eva_demo_button] 短代码。', 'icon' => 'button', 'category' => 'widgets', 'keywords' => ['eva', 'button', '按钮']],
]);
\Eva::createSection('eva_csf_demo_button', [
    'fields' => [
        ['id' => 'content', 'type' => 'text', 'title' => '按钮文字', 'default' => '了解更多'],
        ['id' => 'url', 'type' => 'text', 'title' => '链接', 'placeholder' => 'https://'],
        ['id' => 'style', 'type' => 'button_set', 'title' => '样式', 'options' => ['primary' => '主要', 'ghost' => '描边'], 'default' => 'primary'],
        ['id' => 'blank', 'type' => 'switcher', 'title' => '新窗口打开', 'default' => false],
    ],
]);
add_filter('eva_shortcode_eva_demo_button', static function ($html, $atts, $content) {
    $style = isset($atts['style']) && $atts['style'] === 'ghost'
        ? 'border:1px solid #ff758c;color:#ff758c;background:transparent'
        : 'border:1px solid #ff758c;color:#fff;background:#ff758c';
    return sprintf(
        '<a href="%s"%s style="display:inline-block;padding:8px 18px;border-radius:6px;text-decoration:none;%s">%s</a>',
        esc_url(isset($atts['url']) ? $atts['url'] : '#'),
        ! empty($atts['blank']) ? ' target="_blank" rel="noopener"' : '',
        esc_attr($style),
        esc_html($content !== '' ? $content : (isset($atts['content']) ? $atts['content'] : ''))
    );
}, 10, 3);

// ---- 定制器：database / transport / priority ----
\Eva::createCustomizeOptions('eva_csf_demo_customize', [
    'title'      => 'CSF 兼容演示',
    'database'   => 'option',
    'transport'  => 'refresh',
    'priority'   => 30,
    'csf_compat' => true,
]);
\Eva::createSection('eva_csf_demo_customize', [
    'fields' => [
        ['id' => 'accent', 'type' => 'color', 'title' => '强调色', 'default' => '#ff758c'],
        ['id' => 'show_banner', 'type' => 'switcher', 'title' => '显示顶部横幅', 'default' => false],
    ],
]);
