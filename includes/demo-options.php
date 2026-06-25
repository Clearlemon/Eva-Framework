<?php

/**
 * 内置演示（仅作示例，可整文件删除，不影响框架本体）。
 *
 * 作用：用 \Eva::createOptions / addMenuItem / createSection 演示「如何用 Eva 注册一个设置页」，
 *       同时附带三个演示用辅助函数（解析更新日志 / 友好时间 / 近期动态）。
 *
 * 迁移到主题时：删除本文件，并移除 eva-framework.php 末尾对它的 require；改用主题真实容器 id 注册。
 * 详见插件根目录《迁移到主题使用指南.md》第 7 节。
 */

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

// 用 function_exists 守卫，避免与主题/其它插件的同名函数冲突。
if (! function_exists('eva_demo_parse_update_logs')) {
    /**
     * 解析本地 Markdown 更新日志为结构化数组（演示「版本计划」字段的数据来源）。
     *
     * 识别规则：
     * - `# YYYY-MM-DD - Version x.y` 开启一个版本块；
     * - `#### ~ ######` 标题开启该版本下的一个小节；
     * - `-`/`*`/`+` 为无序条目，`1.` 为有序条目。
     *
     * @param string $file 日志文件绝对路径。
     * @return array       版本块列表（每块含 version/date/sections）。
     */
    function eva_demo_parse_update_logs($file)
    {
        // 文件不可读直接返回空，调用方据此显示「暂无日志」。
        if (! is_readable($file)) {
            return [];
        }

        // 逐行解析：$current 累积当前版本块，$section 标记当前小节标题。
        $lines = explode("\n", (string) file_get_contents($file));
        $logs = [];
        $current = [];
        $section = '';

        foreach ($lines as $line) {
            $line = trim($line);
            // 跳过空行。
            if ($line === '') {
                continue;
            }

            if (preg_match('/^#\s*(\d{4}-\d{2}-\d{2})\s*-\s*Version\s*(.+)$/u', $line, $m)) {
                // 遇到版本标题：先把上一个版本块收尾入列，再开启新块。
                if (! empty($current)) {
                    $logs[] = $current;
                }
                $current = [
                    'version'  => trim($m[2]),
                    'date'     => trim($m[1]),
                    'sections' => [],
                ];
                $section = '';
            } elseif (! empty($current) && preg_match('/^#{4,6}\s*(.+)$/u', $line, $m)) {
                // 小节标题（####~######）：在当前版本块下建一个默认无序的小节。
                $section = trim($m[1]);
                $current['sections'][$section] = [
                    'type'  => 'unordered',
                    'items' => [],
                ];
            } elseif ($section && preg_match('/^[-*+]\s+(.+)$/u', $line, $m)) {
                // 无序条目：追加到当前小节。
                $current['sections'][$section]['items'][] = trim($m[1]);
            } elseif ($section && preg_match('/^\d+\.\s+(.+)$/u', $line, $m)) {
                // 有序条目：标记小节为有序并追加。
                $current['sections'][$section]['type'] = 'ordered';
                $current['sections'][$section]['items'][] = trim($m[1]);
            }
        }

        // 收尾：把最后一个版本块入列。
        if (! empty($current)) {
            $logs[] = $current;
        }

        return $logs;
    }
}

if (! function_exists('eva_demo_activity_time')) {
    /**
     * 把时间戳转成「N 前」的人类可读相对时间。
     *
     * @param int $timestamp Unix 时间戳。
     * @return string        形如「3 小时前」；无效时间返回「—」。
     */
    function eva_demo_activity_time($timestamp)
    {
        $timestamp = (int) $timestamp;
        // 非正时间戳视为无效。
        if ($timestamp <= 0) {
            return '—';
        }

        // 借 WP 的 human_time_diff 计算与当前时间的差，并加「前」字。
        return human_time_diff($timestamp, current_time('timestamp')) . '前';
    }
}

if (! function_exists('eva_demo_recent_activities')) {
    /**
     * 取最近 3 条更新动态（演示「版本计划」里的活动流）。
     *
     * @param array $logs  解析后的更新日志（此演示未直接使用，仅占位对齐签名）。
     * @param mixed $theme 当前主题对象（此演示未直接使用）。
     * @return array       最多 3 条 [title/desc/time] 记录，按时间倒序。
     */
    function eva_demo_recent_activities($logs, $theme)
    {
        // 动态数据存于 option；非数组直接返回空。
        $items = get_option('lentasy_update_activities', []);
        if (! is_array($items)) {
            return [];
        }

        // 按时间戳倒序（新→旧）。
        usort($items, function ($a, $b) {
            return (int) ($b['ts'] ?? 0) <=> (int) ($a['ts'] ?? 0);
        });

        // 规整字段并截取前 3 条返回。
        return array_slice(array_map(function ($item) {
            return [
                'title' => isset($item['title']) ? sanitize_text_field($item['title']) : '',
                'desc'  => isset($item['desc']) ? sanitize_text_field($item['desc']) : '',
                'time'  => eva_demo_activity_time($item['ts'] ?? 0),
            ];
        }, $items), 0, 3);
    }
}

// ============================================================================
// 演示设置页注册：先建容器（createOptions），再加左侧菜单树（addMenuItem），
// 最后逐区追加字段（createSection）。
// ============================================================================

// 1) 创建演示设置页容器：顶部工具栏入口 + 独立页模式。
\Eva::createOptions('eva_demo', [
    'menu_title' => 'Eva Framework',
    'menu_slug'  => 'eva-framework',
    'location'   => 'admin_bar',
    'standalone' => true,
    'subtitle'   => '轻量 · 现代 · 好看的 WordPress 设置框架',
]);

// 2) 左侧主菜单：复刻 CSF「LF主题设置」的菜单树（图标映射为 Remix Icon）。
// 「常规设置」对应下方同 id 的设置分组（有表单）；其余分区暂为菜单/占位，字段迁移后续逐区补。
\Eva::addMenuItem('eva_demo', ['id' => 'general', 'label' => '常规设置', 'icon' => 'ri-equalizer-line']);
\Eva::addMenuItem('eva_demo', ['id' => 'module', 'label' => '容器设置', 'icon' => 'ri-layout-2-line', 'children' => [
    ['id' => 'mod-top', 'label' => '顶部模块', 'icon' => 'ri-layout-top-line'],
    ['id' => 'mod-bottom', 'label' => '底部模块', 'icon' => 'ri-layout-bottom-line'],
    ['id' => 'mod-misc', 'label' => '杂项设置', 'icon' => 'ri-more-2-line'],
]]);
\Eva::addMenuItem('eva_demo', ['id' => 'pay', 'label' => '支付模块', 'icon' => 'ri-bank-card-line', 'children' => [
    ['id' => 'pay-set', 'label' => '支付设置', 'icon' => 'ri-secure-payment-line'],
]]);
\Eva::addMenuItem('eva_demo', ['id' => 'cms', 'label' => 'Cms模块', 'icon' => 'ri-stack-line', 'children' => [
    ['id' => 'cms-home', 'label' => '首页模块', 'icon' => 'ri-home-4-line'],
    ['id' => 'cms-single', 'label' => '文章模块', 'icon' => 'ri-article-line'],
    ['id' => 'cms-archive', 'label' => '归档页设置', 'icon' => 'ri-archive-line'],
    ['id' => 'cms-comment', 'label' => '评论模块', 'icon' => 'ri-chat-3-line'],
]]);
\Eva::addMenuItem('eva_demo', ['id' => 'user', 'label' => '用户模块', 'icon' => 'ri-user-3-line', 'children' => [
    ['id' => 'user-login', 'label' => '登录与注册', 'icon' => 'ri-login-box-line'],
    ['id' => 'user-menu', 'label' => '菜单设置', 'icon' => 'ri-menu-line'],
    ['id' => 'user-page', 'label' => '用户页设置', 'icon' => 'ri-profile-line'],
    ['id' => 'user-func', 'label' => '用户功能', 'icon' => 'ri-user-settings-line'],
]]);
\Eva::addMenuItem('eva_demo', ['id' => 'write', 'label' => '编辑器模块', 'icon' => 'ri-edit-box-line', 'children' => [
    ['id' => 'write-admin', 'label' => '后台文章编辑', 'icon' => 'ri-edit-2-line'],
    ['id' => 'write-front', 'label' => '前台发帖页', 'icon' => 'ri-quill-pen-line'],
]]);
\Eva::addMenuItem('eva_demo', ['id' => 'extended', 'label' => '扩展模块', 'icon' => 'ri-puzzle-2-line']);
\Eva::addMenuItem('eva_demo', ['id' => 'system', 'label' => '系统模块', 'icon' => 'ri-settings-4-line']);
\Eva::addMenuItem('eva_demo', ['id' => 'renewal', 'label' => '更新&文档', 'icon' => 'ri-refresh-line', 'children' => [
    ['id' => 'renewal-version', 'label' => '版本计划', 'icon' => 'ri-git-branch-line'],
    ['id' => 'renewal-help', 'label' => '帮助中心', 'icon' => 'ri-book-open-line'],
]]);
\Eva::addMenuItem('eva_demo', ['id' => 'backup', 'label' => '备份恢复', 'icon' => 'ri-database-2-line']);

// 3) 常规设置分组：演示 text / switcher / select（含分组+可搜索）/ textarea 等基础字段。
\Eva::createSection('eva_demo', [
    'id'     => 'general',
    'title'  => '常规设置',
    'icon'   => 'ri-equalizer-line',
    'fields' => [
        ['id' => 'site_slogan', 'type' => 'text', 'title' => '站点标语', 'desc' => '显示在首页的一句话', 'default' => '', 'placeholder' => '请输入标语', 'width' => '1/3'],
        ['id' => 'enable_feature', 'type' => 'switcher', 'title' => '启用示例功能', 'desc' => '开启或关闭', 'default' => false, 'width' => '1/3'],
        ['id' => 'layout_mode', 'type' => 'select', 'title' => '布局模式', 'desc' => '选择一种布局', 'default' => 'wide', 'options' => ['wide' => '宽屏', 'boxed' => '盒装', 'fluid' => '流式'], 'width' => '1/3'],
        ['id' => 'region', 'type' => 'select', 'title' => '所在地区', 'desc' => '分组 + 下拉内搜索演示', 'default' => 'sh', 'searchable' => true, 'empty_message' => '没有匹配的地区', 'width' => '1/2', 'options' => [
            '华北' => ['bj' => '北京', 'tj' => '天津', 'sjz' => '石家庄'],
            '华东' => ['sh' => '上海', 'hz' => '杭州', 'nj' => '南京', 'su' => '苏州'],
            '华南' => ['gz' => '广州', 'sz' => '深圳', 'xm' => '厦门'],
        ]],
        ['id' => 'about_text', 'type' => 'textarea', 'title' => '关于我们', 'desc' => '支持多行文本', 'default' => '', 'width' => 'full'],
    ],
]);

// 帮助中心：CSF 里就是个 iframe，直接搬过来即可用。
\Eva::createSection('eva_demo', [
    'id'     => 'renewal-help',
    'title'  => '帮助中心',
    'fields' => [
        ['id' => 'help_doc', 'type' => 'html', 'width' => 'full', 'html' => '<div class="eva-embed"><iframe src="https://docs.9wt.cn/" loading="lazy"></iframe></div>'],
    ],
]);

// 扩展模块 / 版本计划：沿用 CSF 的 callback 页面模式，callback 只输出挂载点。
// 备份恢复可作为 Eva 字段，因为它本身就是一个可复用的单字段应用。
\Eva::createSection('eva_demo', [
    'id'     => 'extended',
    'title'  => '扩展模块',
    'fields' => [
        // callback 字段：运行时执行此闭包，输出会被 prepare_sections 转成 html 注入前端。
        ['id' => 'ext_app', 'type' => 'callback', 'width' => 'full', 'function' => function () {
            // 实时读取已启用扩展数量，演示 callback 可访问运行时数据。
            $mods = (array) get_option('lentasy_enabled_modules', []);
            $on   = array_filter($mods, function ($m) { return ((is_array($m) ? ($m['state'] ?? '') : '') === 'enabled'); });
            echo '<div class="eva-embed-card"><strong>扩展模块 · callback 实时读取</strong>';
            echo '<p class="eva-html-note">已启用扩展：<b>' . count($on) . '</b> 个（来自 option <code>lentasy_enabled_modules</code>）。</p>';
            // 完整扩展市场是主题独立 Vue 应用，这里只放其挂载点。
            echo '<div id="extended" class="extended-page"></div>';
            echo '<p class="eva-html-note">完整扩展市场是主题独立 Vue 应用，挂载点 <code>#extended</code>（REST <code>lf/v2/getallExtendeds</code>），需其前端 JS。</p></div>';
        }],
    ],
]);
// 取当前主题对象，供下方版本计划 callback 通过 use 捕获使用。
$eva_demo_theme = wp_get_theme();
\Eva::createSection('eva_demo', [
    'id'     => 'renewal-version',
    'title'  => '版本计划',
    'fields' => [
        [
            'id'       => 'update_app',
            'type'     => 'callback',
            'width'    => 'full',
            // callback：组装版本/计划/动态数据，输出更新页 Vue 应用的挂载点（带 data-* 传参）。
            'function' => function () use ($eva_demo_theme) {
                // 解析主题目录下的 update_logs.md。
                $logs = eva_demo_parse_update_logs(get_template_directory() . '/update_logs.md');
                // 最新版本：优先取日志首条，否则退回主题头版本号。
                $latest = ! empty($logs[0]['version'])
                    ? 'Version ' . $logs[0]['version']
                    : 'Version ' . ($eva_demo_theme->get('Version') ?: '1.0.0');
                // 自动更新计划（来自各 option）。
                $schedule = [
                    'enabled'   => (bool) get_option('update_schedule_enabled', false),
                    'time'      => get_option('update_schedule_time', '03:00'),
                    'frequency' => get_option('update_schedule_frequency', 'everyday'),
                ];
                // 近期动态。
                $activities = eva_demo_recent_activities($logs, $eva_demo_theme);

                // 输出挂载点：所有数据经 esc_attr/json 编码后塞进 data-* 供前端读取。
                printf(
                    '<div id="update" class="update-blcok" data-eva-update-page="1" data-version="%s" data-last-update="%s" data-latest-version="%s" data-update-info="%s" data-schedule="%s" data-logs="%s" data-activities="%s"></div>',
                    esc_attr($eva_demo_theme->get('Version') ?: '1.0.0'),
                    esc_attr(date('Y-m-d H:i', @filemtime(get_template_directory() . '/style.css') ?: time())),
                    esc_attr($latest),
                    esc_attr($logs ? '读取本地 update_logs.md' : '暂无本地更新日志'),
                    esc_attr(wp_json_encode($schedule)),
                    esc_attr(wp_json_encode($logs)),
                    esc_attr(wp_json_encode($activities))
                );
            },
        ],
    ],
]);
// 备份恢复：单字段应用，演示自定义字段类型 backup。
\Eva::createSection('eva_demo', [
    'id'     => 'backup',
    'title'  => '备份恢复',
    'fields' => [
        ['id' => 'backup_ui', 'type' => 'backup', 'width' => 'full'],
    ],
]);
