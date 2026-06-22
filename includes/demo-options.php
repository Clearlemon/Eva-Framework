<?php

/**
 * 内置演示：注册一个干净的设置页骨架（外框架先行，暂不含任何字段）。
 * 后续用 \Eva::createSection('eva_demo', [...]) 往里追加分组与字段。
 * 可整文件删除，不影响框架本体。
 */

if (! defined('ABSPATH')) {
    exit;
}

\Eva::createOptions('eva_demo', [
    'menu_title' => 'Eva Framework',
    'menu_slug'  => 'eva-framework',
    'location'   => 'admin_bar',
    'standalone' => true,
    'subtitle'   => '轻量 · 现代 · 好看的 WordPress 设置框架',
]);

// 左侧主菜单：复刻 CSF「LF主题设置」的菜单树（图标映射为 Remix Icon）。
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
\Eva::addMenuItem('eva_demo', ['id' => 'panel', 'label' => '设置面板', 'icon' => 'ri-window-line']);

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

// 扩展模块 / 版本计划 / 备份恢复：CSF 里是「独立 Vue 应用挂载点」(callback 只 echo 一个 div)。
// 挂载点已搬过来，但要真正渲染需加载主题对应前端 JS（standalone 页默认没有），故此处为占位。
\Eva::createSection('eva_demo', [
    'id'     => 'extended',
    'title'  => '扩展模块',
    'fields' => [
        ['id' => 'ext_app', 'type' => 'callback', 'width' => 'full', 'function' => function () {
            $mods = (array) get_option('lentasy_enabled_modules', []);
            $on   = array_filter($mods, function ($m) { return ((is_array($m) ? ($m['state'] ?? '') : '') === 'enabled'); });
            echo '<div class="eva-embed-card"><strong>扩展模块 · callback 实时读取</strong>';
            echo '<p class="eva-html-note">已启用扩展：<b>' . count($on) . '</b> 个（来自 option <code>lentasy_enabled_modules</code>）。</p>';
            echo '<div id="extended" class="extended-page"></div>';
            echo '<p class="eva-html-note">完整扩展市场是主题独立 Vue 应用，挂载点 <code>#extended</code>（REST <code>lf/v2/getallExtendeds</code>），需其前端 JS。</p></div>';
        }],
    ],
]);
\Eva::createSection('eva_demo', [
    'id'     => 'renewal-version',
    'title'  => '版本计划',
    'fields' => [
        ['id' => 'update_app', 'type' => 'callback', 'width' => 'full', 'function' => function () {
            $en   = get_option('update_schedule_enabled', false);
            $time = get_option('update_schedule_time', '03:00');
            $freq = get_option('update_schedule_frequency', 'everyday');
            echo '<div class="eva-embed-card"><strong>版本计划 · callback 实时读取</strong>';
            echo '<p class="eva-html-note">计划更新：<b>' . ($en ? '已开启' : '未开启') . '</b>，时间 ' . esc_html($time) . '，频率 ' . esc_html($freq) . '。</p>';
            echo '<div id="update" class="update-blcok"></div>';
            echo '<p class="eva-html-note">完整更新 UI 是主题独立 Vue 应用，挂载点 <code>#update</code>（REST <code>lf/v2/GetUpdateProgress</code>），需其前端 JS。</p></div>';
        }],
    ],
]);
\Eva::createSection('eva_demo', [
    'id'     => 'backup',
    'title'  => '备份恢复',
    'fields' => [
        ['id' => 'backup_app', 'type' => 'callback', 'width' => 'full', 'function' => function () {
            $list   = (array) get_option('theme_backups_list', []);
            $latest = isset($list[0]['time']) ? $list[0]['time'] : '—';
            echo '<div class="eva-embed-card"><strong>备份恢复 · callback 实时读取</strong>';
            echo '<p class="eva-html-note">现有备份：<b>' . count($list) . '</b> 份，最近备份：' . esc_html($latest) . '（来自 option <code>theme_backups_list</code>）。</p>';
            echo '<div id="backup" class="backup-blcok"></div>';
            echo '<p class="eva-html-note">完整备份 UI 是主题独立 Vue 应用，挂载点 <code>#backup</code>（AJAX <code>backupData</code>），需其前端 JS。</p></div>';
        }],
    ],
]);
