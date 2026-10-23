<?php

// 每项增强能力独立演示；统一关闭无关工具，让操作与结果一一对应。
if (! defined('ABSPATH')) {
    exit;
}

$eva_accordion_demo_base = [
    'type' => 'accordion', 'width' => '1/2', 'class' => 'eva-accordion-demo', 'sortable' => false,
    'remember' => false, 'toolbar' => false, 'searchable' => false,
    'resettable' => false, 'summary' => false, 'dirty_mark' => false,
    'mode_switch' => false, 'bulk_actions' => false, 'default_open' => false,
];

\Eva::createSection('eva_demo', [
    'id' => 'field-accordion',
    'title' => '手风琴折叠',
    'icon' => 'ri-menu-fold-line',
    'fields' => [
        ['id' => 'accordion_intro', 'type' => 'html', 'title' => '功能演示', 'width' => 'full',
            'html' => '<div class="eva-html-note">下面按功能分为 <strong>10 个独立示例</strong>。每个示例只开启对应功能，按说明操作即可观察效果。</div>'],
        array_merge($eva_accordion_demo_base, [
            'id' => 'accordion_menu_config', 'title' => '01 · 标题旁显示配置摘要',
            'desc' => '展开后修改开关、标题或布局，再折叠：标题旁仍显示启用状态、当前选项及配置数量。', 'summary' => true,
            'sections' => [
                ['id' => 'basic', 'title' => '菜单摘要', 'summary_switch' => 'menu_enabled', 'summary_fields' => ['menu_title', 'menu_layout'], 'fields' => [
                    ['id' => 'menu_enabled', 'type' => 'switcher', 'title' => '启用菜单', 'default' => true],
                    ['id' => 'menu_title', 'type' => 'text', 'title' => '菜单标题', 'default' => 'Eva 菜单', 'width' => '1/2'],
                    ['id' => 'menu_layout', 'type' => 'select', 'title' => '菜单布局', 'default' => 'vertical', 'options' => ['vertical' => '纵向菜单', 'horizontal' => '横向菜单'], 'width' => '1/2'],
                ]],
            ],
        ]),
        array_merge($eva_accordion_demo_base, [
            'id' => 'accordion_error_demo', 'title' => '02 · 错误提示与自动展开',
            'desc' => '展开「联系信息」，清空必填标题或输入错误邮箱，再折叠并点击页面顶部「保存」。出错分组会自动展开，标题显示错误数量，并定位到具体字段。',
            'sections' => [
                ['id' => 'contact', 'title' => '联系信息', 'fields' => [
                    ['id' => 'contact_title', 'type' => 'text', 'title' => '联系标题（必填）', 'required' => true, 'default' => '联系我们', 'width' => '1/2'],
                    ['id' => 'contact_email', 'type' => 'text', 'input_type' => 'email', 'title' => '通知邮箱', 'required' => true, 'default' => 'admin@example.com', 'width' => '1/2'],
                ]],
                ['id' => 'other', 'title' => '普通分组', 'fields' => [
                    ['id' => 'contact_note', 'type' => 'text', 'title' => '备注', 'default' => '此分组无需展开'],
                ]],
            ],
        ]),
        array_merge($eva_accordion_demo_base, [
            'id' => 'accordion_remember_demo', 'title' => '03 · 记住展开状态',
            'desc' => '展开任意分组，然后刷新页面或切换到其他设置页再返回，检查展开状态是否保留。此示例单独保存浏览器偏好。',
            'remember' => true, 'default_open' => ['first'],
            'sections' => [
                ['id' => 'first', 'title' => '第一组 · 可收起后刷新', 'fields' => [
                    ['id' => 'remember_first', 'type' => 'text', 'title' => '第一组内容', 'default' => '展开状态会被记住'],
                ]],
                ['id' => 'second', 'title' => '第二组 · 可展开后刷新', 'fields' => [
                    ['id' => 'remember_second', 'type' => 'text', 'title' => '第二组内容', 'default' => '两组可同时保持展开'],
                ]],
            ],
        ]),
        array_merge($eva_accordion_demo_base, [
            'id' => 'accordion_mode_demo', 'title' => '04 · 单开 / 多开模式',
            'desc' => '点击「单开」后依次展开两个分组，前一个会收起；切换「多开」后可同时展开。这里只显示模式切换按钮。',
            'toolbar' => true, 'mode_switch' => true, 'multiple' => false,
            'sections' => [
                ['id' => 'display', 'title' => '展示设置', 'fields' => [['id' => 'mode_display', 'type' => 'text', 'title' => '展示标题', 'default' => '展示示例']]],
                ['id' => 'behavior', 'title' => '行为设置', 'fields' => [['id' => 'mode_behavior', 'type' => 'switcher', 'title' => '自动播放', 'default' => true]]],
                ['id' => 'layout', 'title' => '布局设置', 'fields' => [['id' => 'mode_gap', 'type' => 'number', 'title' => '项目间距', 'default' => 12]]],
            ],
        ]),
        array_merge($eva_accordion_demo_base, [
            'id' => 'accordion_condition_demo', 'title' => '05 · 条件显示整个分组',
            'desc' => '开启下面的「高级模式」，会出现完整的「高级设置」分组；关闭后隐藏，并保留已填写的值。', 'default_open' => ['basic'],
            'sections' => [
                ['id' => 'basic', 'title' => '模式开关', 'fields' => [['id' => 'advanced_mode', 'type' => 'switcher', 'title' => '高级模式', 'default' => false]]],
                ['id' => 'advanced', 'title' => '高级设置 · 开关控制显示', 'visible_if' => ['basic.advanced_mode', '==', true], 'fields' => [
                    ['id' => 'condition_cache', 'type' => 'number', 'title' => '缓存时间（分钟）', 'default' => 30],
                ]],
            ],
        ]),
        array_merge($eva_accordion_demo_base, [
            'id' => 'accordion_search_demo', 'title' => '06 · 搜索联动展开',
            'desc' => '在此搜索框输入「缓存时间」或「统计事件」：自动展开命中的分组并高亮对应字段。顶部全局搜索也可以定位这些内部字段。',
            'toolbar' => true, 'searchable' => true,
            'sections' => [
                ['id' => 'cache', 'title' => '缓存设置', 'fields' => [['id' => 'search_cache_time', 'type' => 'number', 'title' => '缓存时间', 'default' => 30]]],
                ['id' => 'tracking', 'title' => '统计设置', 'fields' => [['id' => 'search_tracking_key', 'type' => 'text', 'title' => '统计事件标识', 'default' => 'nav_click']]],
                ['id' => 'appearance', 'title' => '外观设置', 'fields' => [['id' => 'search_caption', 'type' => 'text', 'title' => '显示文字', 'default' => '浏览更多']]],
            ],
        ]),
        array_merge($eva_accordion_demo_base, [
            'id' => 'accordion_dirty_demo', 'title' => '07 · 未保存修改标记',
            'desc' => '修改任意分组内的文字，标题旁会出现小圆点；改回原值或保存成功后，圆点消失。两组分别标记。',
            'dirty_mark' => true, 'default_open' => ['first'],
            'sections' => [
                ['id' => 'first', 'title' => '第一组 · 修改后观察圆点', 'fields' => [['id' => 'dirty_title', 'type' => 'text', 'title' => '标题', 'default' => '原始标题']]],
                ['id' => 'second', 'title' => '第二组 · 独立标记修改', 'fields' => [['id' => 'dirty_subtitle', 'type' => 'text', 'title' => '副标题', 'default' => '原始副标题']]],
            ],
        ]),
        array_merge($eva_accordion_demo_base, [
            'id' => 'accordion_reset_demo', 'title' => '08 · 分组恢复默认',
            'desc' => '分别修改两组字段，再点击某组右侧「恢复默认」。确认提示会说明范围，操作只重置该组，另一组保持修改。保存后生效。',
            'resettable' => true, 'default_open' => ['first', 'second'],
            'sections' => [
                ['id' => 'first', 'title' => '标题分组', 'fields' => [['id' => 'reset_title', 'type' => 'text', 'title' => '默认标题', 'default' => '欢迎访问']]],
                ['id' => 'second', 'title' => '布局分组', 'fields' => [['id' => 'reset_width', 'type' => 'number', 'title' => '默认宽度', 'default' => 260]]],
            ],
        ]),
        array_merge($eva_accordion_demo_base, [
            'id' => 'accordion_bulk_demo', 'title' => '09 · 展开全部 / 折叠全部',
            'desc' => '使用这组按钮一次展开或收起下面三个分组。这里只显示批量操作按钮。', 'toolbar' => true, 'bulk_actions' => true,
            'sections' => [
                ['id' => 'one', 'title' => '分组一', 'fields' => [['id' => 'bulk_one', 'type' => 'text', 'title' => '分组一内容', 'default' => '批量展开示例']]],
                ['id' => 'two', 'title' => '分组二', 'fields' => [['id' => 'bulk_two', 'type' => 'text', 'title' => '分组二内容', 'default' => '批量展开示例']]],
                ['id' => 'three', 'title' => '分组三', 'fields' => [['id' => 'bulk_three', 'type' => 'text', 'title' => '分组三内容', 'default' => '批量展开示例']]],
            ],
        ]),
        array_merge($eva_accordion_demo_base, [
            'id' => 'accordion_help_demo', 'title' => '10 · 标题附带帮助说明',
            'desc' => '无需展开，将鼠标移到标题右侧的问号，或用 Tab 聚焦问号，即可查看帮助。',
            'sections' => [
                ['id' => 'cache', 'title' => '缓存配置', 'help' => '缓存时间越长，重复请求越少；内容更新后需要等待缓存过期。此处仅演示帮助提示。', 'fields' => [['id' => 'help_cache', 'type' => 'number', 'title' => '缓存时间（分钟）', 'default' => 30]]],
                ['id' => 'notification', 'title' => '通知配置', 'help' => '用于说明本分组的用途。鼠标悬停和键盘聚焦都能显示此说明。', 'fields' => [['id' => 'help_enabled', 'type' => 'switcher', 'title' => '接收通知', 'default' => true]]],
            ],
        ]),
    ],
]);

unset($eva_accordion_demo_base);
