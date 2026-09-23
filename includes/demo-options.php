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

if (! function_exists('eva_demo_image_select_preview')) {
    /**
     * 生成 image_select 演示用 SVG 预览图，避免依赖额外图片资源。
     *
     * @param string $variant 预览变体：card/list/grid/minimal。
     * @return string         data URI，可直接作为字段 option 的 url。
     */
    function eva_demo_image_select_preview($variant)
    {
        $variant = sanitize_key($variant);
        $accent  = '#FF758C';
        $muted   = '#E8EAF0';
        $soft    = '#F7F8FA';
        $text    = '#B8BECA';

        if ($variant === 'list') {
            $body = '<rect x="18" y="20" width="36" height="24" rx="4" fill="' . $muted . '"/><rect x="64" y="22" width="72" height="6" rx="3" fill="' . $accent . '" opacity=".35"/><rect x="64" y="34" width="96" height="5" rx="2.5" fill="' . $text . '" opacity=".65"/><rect x="18" y="58" width="36" height="24" rx="4" fill="' . $muted . '"/><rect x="64" y="60" width="86" height="6" rx="3" fill="' . $text . '" opacity=".65"/><rect x="64" y="72" width="66" height="5" rx="2.5" fill="' . $text . '" opacity=".45"/>';
        } elseif ($variant === 'grid') {
            $body = '<rect x="18" y="18" width="42" height="30" rx="4" fill="' . $accent . '" opacity=".28"/><rect x="68" y="18" width="42" height="30" rx="4" fill="' . $muted . '"/><rect x="118" y="18" width="42" height="30" rx="4" fill="' . $muted . '"/><rect x="18" y="58" width="42" height="30" rx="4" fill="' . $muted . '"/><rect x="68" y="58" width="42" height="30" rx="4" fill="' . $muted . '"/><rect x="118" y="58" width="42" height="30" rx="4" fill="' . $accent . '" opacity=".22"/>';
        } elseif ($variant === 'minimal') {
            $body = '<rect x="20" y="20" width="140" height="10" rx="5" fill="' . $accent . '" opacity=".32"/><rect x="20" y="42" width="110" height="7" rx="3.5" fill="' . $text . '" opacity=".7"/><rect x="20" y="60" width="132" height="7" rx="3.5" fill="' . $text . '" opacity=".45"/><rect x="20" y="78" width="88" height="7" rx="3.5" fill="' . $text . '" opacity=".45"/>';
        } else {
            $body = '<rect x="18" y="18" width="56" height="52" rx="6" fill="' . $accent . '" opacity=".28"/><rect x="86" y="22" width="72" height="8" rx="4" fill="' . $text . '" opacity=".7"/><rect x="86" y="40" width="56" height="6" rx="3" fill="' . $text . '" opacity=".45"/><rect x="86" y="56" width="78" height="6" rx="3" fill="' . $text . '" opacity=".35"/><rect x="18" y="78" width="146" height="10" rx="5" fill="' . $muted . '"/>';
        }

        $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="106" viewBox="0 0 180 106"><rect width="180" height="106" rx="10" fill="' . $soft . '"/>' . $body . '</svg>';
        return 'data:image/svg+xml;charset=UTF-8,' . rawurlencode($svg);
    }
}

if (! function_exists('eva_demo_image_select_options')) {
    /**
     * image_select 演示选项集合，供多个演示字段复用。
     *
     * @param bool $with_disabled 是否附带禁用选项示例。
     * @return array<string,array>
     */
    function eva_demo_image_select_options($with_disabled = false)
    {
        $options = [
            'card'    => ['label' => '卡片布局', 'desc' => '适合内容聚合页', 'url' => eva_demo_image_select_preview('card')],
            'list'    => ['label' => '列表布局', 'desc' => '适合信息流页面', 'url' => eva_demo_image_select_preview('list')],
            'grid'    => ['label' => '网格布局', 'desc' => '适合图库或产品墙', 'url' => eva_demo_image_select_preview('grid')],
            'minimal' => ['label' => '极简布局', 'desc' => '适合文档与设置页', 'url' => eva_demo_image_select_preview('minimal')],
        ];

        if ($with_disabled) {
            $options['minimal']['disabled'] = true;
            $options['minimal']['desc'] = '此项演示禁用状态';
        }

        return $options;
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
// Codex: field showcase menu
\Eva::addMenuItem('eva_demo', [
    'id'       => 'field-showcase',
    'label'    => ['zh' => '字段展示', 'en' => 'Field Showcase', 'ja' => 'フィールド表示', 'ko' => '필드 표시'],
    'icon'     => 'ri-input-method-line',
    'children' => [
        ['id' => 'field-params', 'label' => ['zh' => '字段参数', 'en' => 'Field Parameters', 'ja' => 'フィールド設定', 'ko' => '필드 매개변수'], 'icon' => 'ri-settings-5-line'],
        ['id' => 'field-image-select', 'label' => ['zh' => '图像选择', 'en' => 'Image Select', 'ja' => '画像選択', 'ko' => '이미지 선택'], 'icon' => 'ri-image-line'],
        ['id' => 'field-text', 'label' => ['zh' => '单行文本', 'en' => 'Text', 'ja' => 'テキスト', 'ko' => '텍스트'], 'icon' => 'ri-text'],
        ['id' => 'field-textarea', 'label' => ['zh' => '多行文本', 'en' => 'Textarea', 'ja' => 'テキストエリア', 'ko' => '텍스트 영역'], 'icon' => 'ri-file-text-line'],
        ['id' => 'field-switcher', 'label' => ['zh' => '开关字段', 'en' => 'Switcher', 'ja' => 'スイッチ', 'ko' => '스위치'], 'icon' => 'ri-toggle-line'],
        ['id' => 'field-checkbox', 'label' => ['zh' => '多选框', 'en' => 'Checkbox', 'ja' => 'チェックボックス', 'ko' => '체크박스'], 'icon' => 'ri-checkbox-multiple-line'],
        ['id' => 'field-radio', 'label' => ['zh' => '单选框', 'en' => 'Radio', 'ja' => 'ラジオ', 'ko' => '라디오'], 'icon' => 'ri-radio-button-line'],
        ['id' => 'field-button-set', 'label' => ['zh' => '按钮组', 'en' => 'Button Set', 'ja' => 'ボタンセット', 'ko' => '버튼 세트'], 'icon' => 'ri-layout-row-line'],
        ['id' => 'field-number', 'label' => ['zh' => '数字', 'en' => 'Number', 'ja' => '数値', 'ko' => '숫자'], 'icon' => 'ri-numbers-line'],
        ['id' => 'field-slider', 'label' => ['zh' => '滑块', 'en' => 'Slider', 'ja' => 'スライダー', 'ko' => '슬라이더'], 'icon' => 'ri-equalizer-2-line'],
        ['id' => 'field-spinner', 'label' => ['zh' => '步进器', 'en' => 'Spinner', 'ja' => 'スピナー', 'ko' => '스피너'], 'icon' => 'ri-add-box-line'],
        ['id' => 'field-date', 'label' => ['zh' => '日期', 'en' => 'Date', 'ja' => '日付', 'ko' => '날짜'], 'icon' => 'ri-calendar-line'],
        ['id' => 'field-datetime', 'label' => ['zh' => '日期时间', 'en' => 'Datetime', 'ja' => '日時', 'ko' => '날짜 시간'], 'icon' => 'ri-calendar-schedule-line'],
        ['id' => 'field-link', 'label' => ['zh' => '链接', 'en' => 'Link', 'ja' => 'リンク', 'ko' => '링크'], 'icon' => 'ri-links-line'],
        ['id' => 'field-link-color', 'label' => ['zh' => '链接颜色', 'en' => 'Link Color', 'ja' => 'リンク色', 'ko' => '링크 색상'], 'icon' => 'ri-palette-line'],
        ['id' => 'field-group', 'label' => ['zh' => '字段组', 'en' => 'Group', 'ja' => 'フィールドグループ', 'ko' => '필드 그룹'], 'icon' => 'ri-layout-grid-line'],
        ['id' => 'field-repeater', 'label' => ['zh' => '重复器', 'en' => 'Repeater', 'ja' => 'リピーター', 'ko' => '리피터'], 'icon' => 'ri-list-unordered'],
        ['id' => 'field-typography', 'label' => ['zh' => '字体排版', 'en' => 'Typography', 'ja' => 'タイポグラフィ', 'ko' => '타이포그래피'], 'icon' => 'ri-font-size-2'],
        ['id' => 'field-spacing', 'label' => ['zh' => '间距', 'en' => 'Spacing', 'ja' => 'スペーシング', 'ko' => '간격'], 'icon' => 'ri-expand-up-down-line'],
        ['id' => 'field-dimensions', 'label' => ['zh' => '尺寸', 'en' => 'Dimensions', 'ja' => 'サイズ', 'ko' => '크기'], 'icon' => 'ri-ruler-line'],
        ['id' => 'field-border', 'label' => ['zh' => '边框', 'en' => 'Border', 'ja' => 'ボーダー', 'ko' => '테두리'], 'icon' => 'ri-checkbox-blank-line'],
        ['id' => 'field-background', 'label' => ['zh' => '背景', 'en' => 'Background', 'ja' => '背景', 'ko' => '배경'], 'icon' => 'ri-landscape-line'],
        ['id' => 'field-select', 'label' => ['zh' => '选择字段', 'en' => 'Select', 'ja' => '選択', 'ko' => '선택'], 'icon' => 'ri-list-check-2'],
        ['id' => 'field-color', 'label' => ['zh' => '颜色字段', 'en' => 'Color', 'ja' => 'カラー', 'ko' => '색상'], 'icon' => 'ri-palette-line'],
        ['id' => 'field-color-group', 'label' => ['zh' => '颜色组', 'en' => 'Color Group', 'ja' => 'カラーグループ', 'ko' => '색상 그룹'], 'icon' => 'ri-color-filter-line'],
        ['id' => 'field-upload', 'label' => ['zh' => '媒体上传', 'en' => 'Media Upload', 'ja' => 'メディアアップロード', 'ko' => '미디어 업로드'], 'icon' => 'ri-folder-image-line'],
        ['id' => 'field-gallery', 'label' => ['zh' => '图库', 'en' => 'Gallery', 'ja' => 'ギャラリー', 'ko' => '갤러리'], 'icon' => 'ri-gallery-line'],
        ['id' => 'field-media', 'label' => ['zh' => '媒体字段', 'en' => 'Media', 'ja' => 'メディア', 'ko' => '미디어'], 'icon' => 'ri-file-music-line'],
        ['id' => 'field-sorter', 'label' => ['zh' => '排序字段', 'en' => 'Sorter', 'ja' => 'ソーター', 'ko' => '정렬'], 'icon' => 'ri-drag-move-2-line'],
        ['id' => 'field-wp-editor', 'label' => ['zh' => '富文本编辑器', 'en' => 'WP Editor', 'ja' => 'リッチエディター', 'ko' => '리치 편집기'], 'icon' => 'ri-file-edit-line'],
        ['id' => 'field-code-editor', 'label' => ['zh' => '代码编辑器', 'en' => 'Code Editor', 'ja' => 'コードエディター', 'ko' => '코드 편집기'], 'icon' => 'ri-code-s-slash-line'],
        ['id' => 'field-icon', 'label' => ['zh' => '图标选择', 'en' => 'Icon Picker', 'ja' => 'アイコン選択', 'ko' => '아이콘 선택'], 'icon' => 'ri-star-line'],
        ['id' => 'field-accordion', 'label' => ['zh' => '手风琴折叠', 'en' => 'Accordion', 'ja' => 'アコーディオン', 'ko' => '아코디언'], 'icon' => 'ri-menu-fold-line'],
        ['id' => 'field-dependency', 'label' => ['zh' => '字段依赖', 'en' => 'Dependencies', 'ja' => 'フィールド依存', 'ko' => '필드 종속성'], 'icon' => 'ri-git-branch-line'],
        ['id' => 'field-html', 'label' => ['zh' => 'HTML 内容', 'en' => 'HTML Content', 'ja' => 'HTML コンテンツ', 'ko' => 'HTML 콘텐츠'], 'icon' => 'ri-code-box-line'],
    ],
]);
\Eva::addMenuItem('eva_demo', ['id' => 'extended', 'label' => '扩展模块', 'icon' => 'ri-puzzle-2-line']);
\Eva::addMenuItem('eva_demo', ['id' => 'renewal', 'label' => '更新&文档', 'icon' => 'ri-refresh-line', 'children' => [
    ['id' => 'renewal-version', 'label' => '版本计划', 'icon' => 'ri-git-branch-line'],
    ['id' => 'renewal-help', 'label' => '帮助中心', 'icon' => 'ri-book-open-line'],
]]);
// 页面构建器与主题备份都是整页型大字段，作为 Eva Framework 菜单底部的独立入口。
\Eva::addMenuItem('eva_demo', ['id' => 'field-builder', 'label' => ['zh' => '页面构建器', 'en' => 'Page Builder', 'ja' => 'ページビルダー', 'ko' => '페이지 빌더'], 'icon' => 'ri-layout-masonry-line']);
\Eva::addMenuItem('eva_demo', ['id' => 'backup', 'label' => ['zh' => '主题备份', 'en' => 'Theme Backup', 'ja' => 'テーマバックアップ', 'ko' => '테마 백업'], 'icon' => 'ri-database-2-line']);

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

// Codex: field showcase sections
// 每个子菜单使用同 id 的 section，点击后直接展示对应字段组件。
\Eva::createSection('eva_demo', [
    'id'    => 'field-text',
    'title' => ['zh' => '单行文本字段', 'en' => 'Text Fields', 'ja' => 'テキストフィールド', 'ko' => '텍스트 필드'],
    'icon'  => 'ri-text',
    'fields' => [
        ['id' => 'demo_text_basic', 'type' => 'text', 'title' => ['zh' => '普通文本', 'en' => 'Basic text', 'ja' => '通常テキスト', 'ko' => '기본 텍스트'], 'desc' => ['zh' => '最基础的单行文本输入', 'en' => 'A standard single-line text input.', 'ja' => '基本的な単一行テキスト入力です。', 'ko' => '기본 한 줄 텍스트 입력입니다.'], 'default' => '', 'placeholder' => ['zh' => '请输入内容', 'en' => 'Enter text', 'ja' => '内容を入力', 'ko' => '내용을 입력하세요'], 'width' => '1/2'],
        ['id' => 'demo_text_default', 'type' => 'text', 'title' => ['zh' => '默认值', 'en' => 'Default value', 'ja' => '初期値', 'ko' => '기본값'], 'desc' => ['zh' => '字段可以预设初始内容', 'en' => 'The field can provide an initial value.', 'ja' => '初期内容を設定できます。', 'ko' => '초기 내용을 지정할 수 있습니다.'], 'default' => 'Eva Framework', 'width' => '1/2'],
        ['id' => 'demo_text_url', 'type' => 'text', 'input_type' => 'url', 'title' => ['zh' => '网址输入', 'en' => 'URL input', 'ja' => 'URL 入力', 'ko' => 'URL 입력'], 'desc' => ['zh' => '使用浏览器原生 URL 输入类型', 'en' => 'Uses the browser-native URL input type.', 'ja' => 'ブラウザー標準の URL 入力を使用します。', 'ko' => '브라우저 기본 URL 입력 유형을 사용합니다.'], 'default' => '', 'placeholder' => 'https://example.com', 'autocomplete' => 'url', 'width' => '1/2'],
        ['id' => 'demo_text_email', 'type' => 'text', 'input_type' => 'email', 'title' => ['zh' => '邮箱输入', 'en' => 'Email input', 'ja' => 'メール入力', 'ko' => '이메일 입력'], 'desc' => ['zh' => '适合保存联系邮箱等内容', 'en' => 'Suitable for contact email addresses.', 'ja' => '連絡先メールアドレスなどに適しています。', 'ko' => '연락처 이메일 주소에 적합합니다.'], 'default' => '', 'placeholder' => 'name@example.com', 'autocomplete' => 'email', 'width' => '1/2'],
        ['id' => 'demo_text_password', 'type' => 'text', 'input_type' => 'password', 'title' => ['zh' => '密码输入', 'en' => 'Password input', 'ja' => 'パスワード入力', 'ko' => '비밀번호 입력'], 'desc' => ['zh' => '输入内容会以密码形式隐藏', 'en' => 'Entered content is visually masked.', 'ja' => '入力内容をパスワード形式で隠します。', 'ko' => '입력 내용을 비밀번호 형식으로 숨깁니다.'], 'default' => '', 'placeholder' => '••••••••', 'autocomplete' => 'new-password', 'width' => '1/2'],
        ['id' => 'demo_text_maxlength', 'type' => 'text', 'title' => ['zh' => '长度限制', 'en' => 'Maximum length', 'ja' => '文字数制限', 'ko' => '길이 제한'], 'desc' => ['zh' => '最多输入 20 个字符，并演示 attributes 配置', 'en' => 'Limits input to 20 characters and demonstrates attributes.', 'ja' => '20 文字までに制限し、attributes も示します。', 'ko' => '20자로 제한하며 attributes 설정도 보여줍니다.'], 'default' => '', 'placeholder' => ['zh' => '最多 20 个字符', 'en' => 'Up to 20 characters', 'ja' => '最大 20 文字', 'ko' => '최대 20자'], 'maxlength' => 20, 'attributes' => ['spellcheck' => 'false'], 'width' => '1/2'],
        ['id' => 'demo_text_readonly', 'type' => 'text', 'title' => ['zh' => '只读文本', 'en' => 'Read-only text', 'ja' => '読み取り専用', 'ko' => '읽기 전용'], 'desc' => ['zh' => '内容可以复制，但不可编辑', 'en' => 'The value can be copied but not edited.', 'ja' => 'コピーできますが編集はできません。', 'ko' => '복사할 수 있지만 편집할 수 없습니다.'], 'default' => 'eva-readonly-value', 'readonly' => true, 'width' => '1/2'],
        ['id' => 'demo_text_disabled', 'type' => 'text', 'title' => ['zh' => '禁用文本', 'en' => 'Disabled text', 'ja' => '無効なテキスト', 'ko' => '비활성 텍스트'], 'desc' => ['zh' => '用于展示不可操作的禁用状态', 'en' => 'Shows the non-interactive disabled state.', 'ja' => '操作できない無効状態を表示します。', 'ko' => '조작할 수 없는 비활성 상태를 보여줍니다.'], 'default' => '当前字段不可编辑', 'disabled' => true, 'width' => '1/2'],

        ['id' => 'text_affix_url', 'type' => 'text', 'title' => '前缀、后缀和图标', 'desc' => '前缀与后缀属于输入框结构，不会写入保存值。', 'prefix_icon' => 'ri-global-line', 'prefix' => 'https://', 'suffix' => '.com', 'default' => 'eva-framework', 'width' => '1/2'],
        ['id' => 'text_unit', 'type' => 'text', 'title' => '单位后缀', 'desc' => '适合金额、尺寸、百分比、时间等带单位的文本值。', 'prefix' => '¥', 'suffix' => 'CNY', 'inputmode' => 'decimal', 'transform' => 'numeric', 'transform_on' => 'input', 'default' => '199.00', 'width' => '1/2'],
        ['id' => 'text_counter', 'type' => 'text', 'title' => '字符计数', 'desc' => '接近 maxlength 时计数器切换为提醒状态。', 'default' => '首页 SEO 标题', 'maxlength' => 32, 'show_counter' => true, 'clearable' => true, 'width' => '1/2'],
        ['id' => 'text_actions', 'type' => 'text', 'title' => '清空、复制和自定义操作', 'desc' => '操作按钮采用固定图标命中区域，不改变输入框尺寸。', 'default' => 'eva_product_2026', 'clearable' => true, 'copyable' => true, 'actions' => [['action' => 'copy', 'title' => '复制标识']], 'width' => '1/2'],
        ['id' => 'text_password_toggle', 'type' => 'text', 'input_type' => 'password', 'title' => '密码显隐与强度', 'desc' => '密码默认隐藏，可切换可见性并显示强度。', 'default' => 'Eva@2026-Secure', 'toggle_password' => true, 'password_strength' => true, 'autocomplete' => 'new-password', 'width' => '1/2'],
        ['id' => 'text_phone_mask', 'type' => 'text', 'input_type' => 'tel', 'title' => '手机号掩码', 'desc' => '0 代表数字占位；mask_save = raw 时保存纯数字。', 'mask' => '000-0000-0000', 'mask_save' => 'raw', 'inputmode' => 'tel', 'validate' => 'phone', 'realtime_validate' => true, 'default' => '138-0013-8000', 'width' => '1/2'],
        ['id' => 'text_license_mask', 'type' => 'text', 'title' => '许可证格式掩码', 'desc' => 'A 表示字母，0 表示数字，* 表示任意字母或数字。', 'mask' => 'AAAA-0000-****', 'pattern' => '^[A-Za-z]{4}-[0-9]{4}-[A-Za-z0-9]{4}$', 'pattern_message' => '格式应为 ABCD-1234-EVA8', 'default' => 'EVAQ-2026-PRO8', 'width' => '1/2'],
        ['id' => 'text_live_email', 'type' => 'text', 'input_type' => 'email', 'title' => '实时邮箱验证', 'desc' => '输入过程中即时反馈，保存时后端再次校验。', 'required' => true, 'realtime_validate' => true, 'success_text' => '邮箱格式正确', 'default' => 'demo@example.com', 'preview' => 'email', 'width' => '1/2'],
        ['id' => 'text_live_slug', 'type' => 'text', 'title' => 'Slug 自动格式化', 'desc' => '失焦时转换为小写 slug，并执行前后端一致校验。', 'transform' => 'slug', 'transform_on' => 'blur', 'validate' => 'slug', 'success_text' => 'Slug 可用', 'default' => 'Eva Framework Pro', 'width' => '1/2'],
        ['id' => 'text_pattern', 'type' => 'text', 'title' => '正则与长度范围', 'desc' => '限制 3–12 位大写字母或数字。', 'minlength' => 3, 'maxlength' => 12, 'pattern' => '^[A-Z0-9]+$', 'pattern_message' => '仅允许 3–12 位大写字母或数字', 'show_counter' => true, 'default' => 'EVA2026', 'width' => '1/2'],
        ['id' => 'text_suggestions', 'type' => 'text', 'title' => '输入建议', 'desc' => '使用原生 datalist 展示本地常用值。', 'placeholder' => '输入或选择环境', 'suggestions' => [['value' => 'production', 'label' => '生产环境'], ['value' => 'staging', 'label' => '预发布环境'], ['value' => 'development', 'label' => '开发环境']], 'default' => 'production', 'width' => '1/2'],
        ['id' => 'text_uppercase', 'type' => 'text', 'title' => '实时大写格式化', 'desc' => 'transform = uppercase，输入时立即格式化。', 'transform' => 'uppercase', 'transform_on' => 'input', 'default' => 'eva-pro', 'width' => '1/2'],
        ['id' => 'text_generate_uuid', 'type' => 'text', 'title' => 'UUID 生成', 'desc' => '点击刷新图标生成 UUID，并提供复制与清空。', 'generate' => 'uuid', 'validate' => 'uuid', 'copyable' => true, 'clearable' => true, 'default' => '', 'width' => '1/2'],
        ['id' => 'text_generate_token', 'type' => 'text', 'title' => 'Token 生成', 'desc' => '生成长度为 32 的字母数字 Token。', 'generate' => ['type' => 'token', 'length' => 32], 'copyable' => true, 'default' => '', 'width' => '1/2'],
        ['id' => 'text_generate_password', 'type' => 'text', 'input_type' => 'password', 'title' => '随机密码生成', 'desc' => '生成 18 位随机密码，支持显隐、复制和强度显示。', 'generate' => ['type' => 'password', 'length' => 18], 'copyable' => true, 'toggle_password' => true, 'password_strength' => true, 'default' => '', 'width' => '1/2'],
        ['id' => 'text_generate_timestamp', 'type' => 'text', 'title' => '时间戳生成', 'desc' => '点击生成当前毫秒时间戳。', 'generate' => 'timestamp', 'copyable' => true, 'inputmode' => 'numeric', 'default' => '', 'width' => '1/2'],
        ['id' => 'text_preview_url', 'type' => 'text', 'input_type' => 'url', 'title' => 'URL 打开预览', 'desc' => '右侧按钮在新窗口打开当前地址。', 'preview' => 'url', 'copyable' => true, 'default' => 'https://wordpress.org', 'width' => '1/2'],
        ['id' => 'text_preview_color', 'type' => 'text', 'title' => '颜色值预览', 'desc' => 'Text 仍保存字符串，只在右侧显示颜色色块。', 'preview' => 'color', 'default' => '#FF758C', 'clearable' => true, 'width' => '1/2'],
        ['id' => 'text_preview_image', 'type' => 'text', 'input_type' => 'url', 'title' => '图片 URL 预览', 'desc' => '输入图片 URL 后显示紧凑缩略图。', 'preview' => 'image', 'default' => 'https://s.w.org/style/images/about/WordPress-logotype-standard.png', 'width' => 'full'],
    ],
]);

\Eva::createSection('eva_demo', [
    'id'    => 'field-textarea',
    'title' => ['zh' => '多行文本字段', 'en' => 'Textarea Fields', 'ja' => 'テキストエリア', 'ko' => '텍스트 영역 필드'],
    'icon'  => 'ri-file-text-line',
    'fields' => [
        ['id' => 'demo_textarea_basic', 'type' => 'textarea', 'title' => ['zh' => '普通多行文本', 'en' => 'Basic textarea', 'ja' => '通常テキストエリア', 'ko' => '기본 텍스트 영역'], 'desc' => ['zh' => '适合摘要、简介和说明内容', 'en' => 'Suitable for summaries and descriptions.', 'ja' => '概要や説明文に適しています。', 'ko' => '요약과 설명에 적합합니다.'], 'default' => '', 'placeholder' => ['zh' => '请输入内容摘要', 'en' => 'Enter a summary', 'ja' => '概要を入力', 'ko' => '요약을 입력하세요'], 'width' => '1/2'],
        ['id' => 'demo_textarea_default', 'type' => 'textarea', 'title' => ['zh' => '默认内容', 'en' => 'Default content', 'ja' => '初期内容', 'ko' => '기본 내용'], 'desc' => ['zh' => '多行文本也可以预设初始内容', 'en' => 'Textareas can also provide initial content.', 'ja' => '複数行の初期内容も設定できます。', 'ko' => '여러 줄의 초기 내용을 지정할 수 있습니다.'], 'default' => "第一行内容\n第二行内容", 'width' => '1/2'],
        ['id' => 'demo_textarea_placeholder', 'type' => 'textarea', 'title' => ['zh' => '占位提示', 'en' => 'Placeholder', 'ja' => 'プレースホルダー', 'ko' => '플레이스홀더'], 'desc' => ['zh' => '无默认值时显示引导文案', 'en' => 'Shows guidance when no value is set.', 'ja' => '値がない場合に案内文を表示します。', 'ko' => '값이 없을 때 안내 문구를 표시합니다.'], 'default' => '', 'placeholder' => ['zh' => '请填写详细说明…', 'en' => 'Enter a detailed description…', 'ja' => '詳しい説明を入力…', 'ko' => '상세 설명을 입력하세요…'], 'width' => '1/2'],
        ['id' => 'demo_textarea_compact', 'type' => 'textarea', 'title' => ['zh' => '紧凑高度', 'en' => 'Compact height', 'ja' => 'コンパクト表示', 'ko' => '컴팩트 높이'], 'desc' => ['zh' => '通过 rows=3 控制为较矮的输入区域', 'en' => 'Uses rows=3 for a shorter input area.', 'ja' => 'rows=3 で低めに表示します。', 'ko' => 'rows=3으로 낮게 표시합니다.'], 'default' => '', 'rows' => 3, 'width' => '1/2'],
        ['id' => 'demo_textarea_large', 'type' => 'textarea', 'title' => ['zh' => '大文本区域', 'en' => 'Large textarea', 'ja' => '大きなテキストエリア', 'ko' => '큰 텍스트 영역'], 'desc' => ['zh' => '通过 rows=7 展示适合长内容的编辑空间', 'en' => 'Uses rows=7 for longer content.', 'ja' => 'rows=7 で長文向けの領域を表示します。', 'ko' => 'rows=7로 긴 내용을 위한 공간을 제공합니다.'], 'default' => '', 'rows' => 7, 'width' => 'full'],
        ['id' => 'demo_textarea_maxlength', 'type' => 'textarea', 'title' => ['zh' => '长度限制', 'en' => 'Maximum length', 'ja' => '文字数制限', 'ko' => '길이 제한'], 'desc' => ['zh' => '最多允许输入 120 个字符', 'en' => 'Limits content to 120 characters.', 'ja' => '120 文字まで入力できます。', 'ko' => '최대 120자까지 입력할 수 있습니다.'], 'default' => '', 'maxlength' => 120, 'rows' => 4, 'width' => '1/2'],
        ['id' => 'demo_textarea_readonly', 'type' => 'textarea', 'title' => ['zh' => '只读内容', 'en' => 'Read-only content', 'ja' => '読み取り専用', 'ko' => '읽기 전용'], 'desc' => ['zh' => '内容可选择和复制，但不可修改', 'en' => 'Content can be selected and copied, but not changed.', 'ja' => '選択・コピーできますが変更できません。', 'ko' => '선택하고 복사할 수 있지만 수정할 수 없습니다.'], 'default' => '这是一段只读的说明内容。', 'readonly' => true, 'rows' => 4, 'width' => '1/2'],
        ['id' => 'demo_textarea_disabled', 'type' => 'textarea', 'title' => ['zh' => '禁用状态', 'en' => 'Disabled state', 'ja' => '無効状態', 'ko' => '비활성 상태'], 'desc' => ['zh' => '用于展示不可操作的多行文本字段', 'en' => 'Shows a non-interactive textarea.', 'ja' => '操作できないテキストエリアです。', 'ko' => '조작할 수 없는 텍스트 영역입니다.'], 'default' => '当前多行文本字段已禁用。', 'disabled' => true, 'rows' => 4, 'width' => '1/2'],
        ['id' => 'textarea_auto_grow', 'type' => 'textarea', 'title' => '自动增高', 'desc' => 'auto_grow 根据内容自动调整高度，并通过 min_rows / max_rows 限制范围。', 'default' => "第一行内容\n继续输入或换行观察高度变化", 'auto_grow' => true, 'min_rows' => 2, 'max_rows' => 8, 'width' => '1/2'],
        ['id' => 'textarea_character_counter', 'type' => 'textarea', 'title' => '字符统计', 'desc' => '实时显示字符数量，接近 maxlength 时切换提醒状态。', 'default' => '用于文章摘要、SEO 描述和短说明。', 'maxlength' => 160, 'show_counter' => true, 'counter_mode' => 'characters', 'rows' => 4, 'width' => '1/2'],
        ['id' => 'textarea_all_counter', 'type' => 'textarea', 'title' => '字符、词数和行数', 'desc' => 'counter_mode = all，适合对内容结构有要求的录入场景。', 'default' => "Eva Framework textarea field.\n支持字符、词数和行数统计。", 'show_counter' => true, 'counter_mode' => 'all', 'max_words' => 40, 'max_lines' => 5, 'rows' => 4, 'width' => '1/2'],
        ['id' => 'textarea_word_limit', 'type' => 'textarea', 'title' => '词数限制', 'desc' => '前端实时反馈，保存时后端再次校验 min_words / max_words。', 'default' => 'commercial project content summary', 'min_words' => 3, 'max_words' => 12, 'show_counter' => true, 'counter_mode' => 'words', 'realtime_validate' => true, 'success_text' => '词数符合要求', 'rows' => 4, 'width' => '1/2'],
        ['id' => 'textarea_line_limit', 'type' => 'textarea', 'title' => '行数限制', 'desc' => '限制 2 到 4 行，可用于卖点、地址、步骤或列表内容。', 'default' => "快速配置\n统一保存", 'min_lines' => 2, 'max_lines' => 4, 'show_counter' => true, 'counter_mode' => 'lines', 'realtime_validate' => true, 'success_text' => '行数符合要求', 'rows' => 4, 'width' => '1/2'],
        ['id' => 'textarea_required', 'type' => 'textarea', 'title' => '必填与实时校验', 'desc' => 'required 和 minlength 同时启用，输入时即时显示状态。', 'default' => '', 'placeholder' => '至少输入 10 个字符', 'required' => true, 'minlength' => 10, 'realtime_validate' => true, 'success_text' => '内容可以保存', 'rows' => 4, 'width' => '1/2'],
        ['id' => 'textarea_actions', 'type' => 'textarea', 'title' => '清空与复制', 'desc' => '顶部工具栏提供固定尺寸图标按钮，不占用文本编辑区域。', 'default' => '这段内容可以一键复制，也可以快速清空。', 'copyable' => true, 'clearable' => true, 'toolbar_label' => '快捷操作', 'rows' => 4, 'width' => '1/2'],
        ['id' => 'textarea_cleanup', 'type' => 'textarea', 'title' => '空白与空行整理', 'desc' => '工具栏可清理首尾空白或删除空行，transform 保存时再次统一格式。', 'default' => "  第一段内容  \n\n  第二段内容  " , 'actions' => [['action' => 'trim', 'title' => '整理首尾空白'], ['action' => 'compact_lines', 'title' => '删除空行']], 'transform' => 'trim_lines', 'toolbar_label' => '内容整理', 'rows' => 5, 'width' => '1/2'],
        ['id' => 'textarea_monospace', 'type' => 'textarea', 'title' => '等宽文本', 'desc' => 'monospace 适合日志、模板、纯文本配置；复杂代码仍应使用 Code Editor。', 'default' => "HOST=localhost\nPORT=8881\nDEBUG=false", 'monospace' => true, 'spellcheck' => false, 'rows' => 5, 'width' => '1/2'],
        ['id' => 'textarea_no_resize', 'type' => 'textarea', 'title' => '固定高度', 'desc' => 'resize = none 禁止手动拉伸，适合需要稳定后台布局的表单。', 'default' => '', 'placeholder' => '此文本区域保持固定高度', 'resize' => 'none', 'rows' => 5, 'width' => '1/2'],
    ],
]);

\Eva::createSection('eva_demo', [
    'id'    => 'field-switcher',
    'title' => ['zh' => '开关字段', 'en' => 'Switcher Fields', 'ja' => 'スイッチフィールド', 'ko' => '스위치 필드'],
    'icon'  => 'ri-toggle-line',
    'fields' => [
        ['id' => 'demo_switch_off', 'type' => 'switcher', 'title' => ['zh' => '默认关闭', 'en' => 'Off by default', 'ja' => '初期状態オフ', 'ko' => '기본 꺼짐'], 'desc' => ['zh' => '基础关闭状态的布尔开关', 'en' => 'A basic switch in the off state.', 'ja' => '基本的なオフ状態のスイッチです。', 'ko' => '기본 꺼짐 상태의 스위치입니다.'], 'default' => false, 'width' => '1/3'],
        ['id' => 'demo_switch_on', 'type' => 'switcher', 'title' => ['zh' => '默认开启', 'en' => 'On by default', 'ja' => '初期状態オン', 'ko' => '기본 켜짐'], 'desc' => ['zh' => '默认值为开启状态', 'en' => 'The default value is enabled.', 'ja' => '初期値がオンの状態です。', 'ko' => '기본값이 켜짐 상태입니다.'], 'default' => true, 'width' => '1/3'],
        ['id' => 'demo_switch_label', 'type' => 'switcher', 'title' => ['zh' => '旁侧标签', 'en' => 'Side label', 'ja' => '横ラベル', 'ko' => '옆 라벨'], 'desc' => ['zh' => '通过 label 在开关右侧显示补充文字', 'en' => 'Displays supporting text beside the switch.', 'ja' => 'スイッチの横に補足ラベルを表示します。', 'ko' => '스위치 옆에 보조 라벨을 표시합니다.'], 'default' => true, 'label' => ['zh' => '允许访客访问', 'en' => 'Allow guest access', 'ja' => 'ゲストアクセスを許可', 'ko' => '게스트 접근 허용'], 'width' => '1/3'],
        ['id' => 'demo_switch_yes_no', 'type' => 'switcher', 'title' => ['zh' => '是 / 否文字', 'en' => 'Yes / No text', 'ja' => 'Yes / No 表示', 'ko' => '예 / 아니요 텍스트'], 'desc' => ['zh' => '开关内部显示自定义状态文字', 'en' => 'Shows custom state text inside the switch.', 'ja' => 'スイッチ内に状態テキストを表示します。', 'ko' => '스위치 안에 상태 문구를 표시합니다.'], 'default' => true, 'text_on' => ['zh' => '是', 'en' => 'Yes', 'ja' => 'はい', 'ko' => '예'], 'text_off' => ['zh' => '否', 'en' => 'No', 'ja' => 'いいえ', 'ko' => '아니요'], 'text_width' => 60, 'width' => '1/3'],
        ['id' => 'demo_switch_enabled', 'type' => 'switcher', 'title' => ['zh' => '启用 / 禁用', 'en' => 'Enabled / Disabled', 'ja' => '有効 / 無効', 'ko' => '활성 / 비활성'], 'desc' => ['zh' => '适合需要明确状态文案的设置', 'en' => 'Useful when the state needs an explicit label.', 'ja' => '状態を明示したい設定に適しています。', 'ko' => '상태를 명확히 표시해야 하는 설정에 적합합니다.'], 'default' => false, 'text_on' => ['zh' => '启用', 'en' => 'Enabled', 'ja' => '有効', 'ko' => '활성'], 'text_off' => ['zh' => '禁用', 'en' => 'Disabled', 'ja' => '無効', 'ko' => '비활성'], 'text_width' => 72, 'width' => '1/3'],
        ['id' => 'demo_switch_wide', 'type' => 'switcher', 'title' => ['zh' => '自定义文字宽度', 'en' => 'Custom text width', 'ja' => 'カスタム幅', 'ko' => '사용자 지정 너비'], 'desc' => ['zh' => 'text_width 可控制带文字开关的整体宽度', 'en' => 'text_width controls the width of a text switch.', 'ja' => 'text_width で文字付きスイッチの幅を調整します。', 'ko' => 'text_width로 텍스트 스위치 너비를 조절합니다.'], 'default' => true, 'text_on' => ['zh' => '已开启', 'en' => 'Active', 'ja' => 'オン', 'ko' => '켜짐'], 'text_off' => ['zh' => '已关闭', 'en' => 'Inactive', 'ja' => 'オフ', 'ko' => '꺼짐'], 'text_width' => 80, 'width' => '1/3'],
        ['id' => 'demo_switch_disabled', 'type' => 'switcher', 'title' => ['zh' => '禁用开关', 'en' => 'Disabled switch', 'ja' => '無効なスイッチ', 'ko' => '비활성 스위치'], 'desc' => ['zh' => '保持当前值，但不允许用户切换', 'en' => 'Keeps its value but cannot be toggled.', 'ja' => '現在値を保持し、操作はできません。', 'ko' => '현재 값을 유지하지만 전환할 수 없습니다.'], 'default' => true, 'disabled' => true, 'label' => ['zh' => '由系统策略控制', 'en' => 'Controlled by system policy', 'ja' => 'システムポリシーで管理', 'ko' => '시스템 정책으로 제어됨'], 'width' => '1/3'],
        ['id' => 'switch_small', 'type' => 'switcher', 'title' => '小尺寸', 'desc' => 'size = small，适合字段密集的设置列表。', 'default' => true, 'size' => 'small', 'label' => '紧凑开关', 'width' => '1/3'],
        ['id' => 'switch_large', 'type' => 'switcher', 'title' => '大尺寸', 'desc' => 'size = large，适合重要功能或触屏操作区域。', 'default' => false, 'size' => 'large', 'label' => '重要功能', 'width' => '1/3'],
        ['id' => 'switch_icons', 'type' => 'switcher', 'title' => '状态图标', 'desc' => '开关圆点可根据状态显示不同图标。', 'default' => true, 'icon_on' => 'ri-check-line', 'icon_off' => 'ri-close-line', 'label' => '图标随状态变化', 'width' => '1/3'],
        ['id' => 'switch_status', 'type' => 'switcher', 'title' => '外部状态标签', 'desc' => 'show_status 在开关右侧显示明确状态，不挤压开关内部。', 'default' => true, 'show_status' => true, 'status_on' => '运行中', 'status_off' => '已暂停', 'label' => '后台任务', 'width' => '1/3'],
        ['id' => 'switch_description', 'type' => 'switcher', 'title' => '动态状态说明', 'desc' => 'desc_on / desc_off 根据当前状态显示不同说明。', 'default' => false, 'label' => '维护模式', 'desc_on' => '访客将看到维护页面，管理员仍可访问网站。', 'desc_off' => '网站正常对外开放。', 'show_status' => true, 'status_on' => '维护中', 'status_off' => '正常', 'width' => '1/3'],
        ['id' => 'switch_block', 'type' => 'switcher', 'title' => '整行布局', 'desc' => 'layout = block 时内容在左，开关固定在右侧，适合设置列表。', 'default' => true, 'layout' => 'block', 'label' => '允许自动更新插件', 'desc_on' => '检测到新版本后自动执行后台更新。', 'width' => '1/3'],
        ['id' => 'switch_colors', 'type' => 'switcher', 'title' => '自定义状态颜色', 'desc' => 'active_color / inactive_color 可匹配业务语义色。', 'default' => true, 'active_color' => '#2f8f5b', 'inactive_color' => '#aeb4bd', 'label' => '安全检查', 'show_status' => true, 'status_on' => '已保护', 'status_off' => '未保护', 'width' => '1/3'],
        ['id' => 'switch_custom_values', 'type' => 'switcher', 'title' => '自定义保存值', 'desc' => 'value_on / value_off 可保存 enabled / disabled，而不是固定 1 / 0。', 'default' => 'enabled', 'value_on' => 'enabled', 'value_off' => 'disabled', 'text_on' => '启用', 'text_off' => '禁用', 'text_width' => 72, 'label' => 'API 状态', 'width' => '1/3'],
        ['id' => 'switch_readonly', 'type' => 'switcher', 'title' => '只读状态', 'desc' => 'readonly 展示当前状态但不允许修改，语义区别于业务禁用。', 'default' => true, 'readonly' => true, 'label' => '许可证已激活', 'show_status' => true, 'status_on' => '有效', 'status_off' => '无效', 'width' => '1/3'],
        ['id' => 'switch_loading', 'type' => 'switcher', 'title' => '加载状态', 'desc' => 'loading 表示状态正在同步，此时禁止重复点击。', 'default' => true, 'loading' => true, 'icon_on' => 'ri-loader-4-line', 'label' => '正在同步云端状态', 'width' => '1/3'],
        ['id' => 'switch_disabled_reason', 'type' => 'switcher', 'title' => '禁用原因', 'desc' => 'disabled_reason 明确说明为什么当前不能操作。', 'default' => false, 'disabled' => true, 'label' => '开启 CDN 加速', 'disabled_reason' => '请先绑定并验证域名后再开启。', 'width' => '1/3'],
        ['id' => 'switch_confirm', 'type' => 'switcher', 'title' => '危险操作确认', 'desc' => 'confirm_off 仅在关闭功能时要求用户二次确认。', 'default' => true, 'label' => '启用访问日志', 'confirm_off' => '关闭后将停止记录新的访问日志，确定继续吗？', 'show_status' => true, 'status_on' => '记录中', 'status_off' => '已停止', 'width' => '1/3'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id'    => 'field-select',
    'title' => ['zh' => '选择字段', 'en' => 'Select Fields', 'ja' => '選択フィールド', 'ko' => '선택 필드'],
    'icon'  => 'ri-list-check-2',
    'fields' => [
        ['id' => 'demo_select_layout', 'type' => 'select', 'title' => ['zh' => '键值选项', 'en' => 'Key-value options', 'ja' => 'キーと値の選択肢', 'ko' => '키-값 옵션'], 'desc' => ['zh' => '使用键值对象配置最常见的下拉选项', 'en' => 'The standard key-value option format.', 'ja' => '標準的なキーと値の形式です。', 'ko' => '일반적인 키-값 옵션 형식입니다.'], 'default' => 'wide', 'options' => ['wide' => '宽屏布局', 'boxed' => '盒装布局', 'fluid' => '流式布局'], 'width' => '1/3'],
        ['id' => 'demo_select_placeholder', 'type' => 'select', 'title' => ['zh' => '占位提示', 'en' => 'Placeholder', 'ja' => 'プレースホルダー', 'ko' => '플레이스홀더'], 'desc' => ['zh' => '未设置默认值时显示自定义提示文字', 'en' => 'Shows custom prompt text without a default value.', 'ja' => '初期値がない場合の案内文を表示します。', 'ko' => '기본값이 없을 때 안내 문구를 표시합니다.'], 'default' => '', 'placeholder' => '请选择内容状态', 'options' => ['draft' => '草稿', 'publish' => '已发布', 'private' => '私密'], 'width' => '1/3'],
        ['id' => 'demo_select_array', 'type' => 'select', 'title' => ['zh' => '普通数组', 'en' => 'Simple array', 'ja' => '配列オプション', 'ko' => '배열 옵션'], 'desc' => ['zh' => '选项的值和显示文字保持一致', 'en' => 'The value and label use the same text.', 'ja' => '値と表示名が同じ配列形式です。', 'ko' => '값과 표시 문구가 같은 배열 형식입니다.'], 'default' => '中等', 'options' => ['较小', '中等', '较大'], 'width' => '1/3'],
        ['id' => 'demo_select_objects', 'type' => 'select', 'title' => ['zh' => '对象数组', 'en' => 'Object array', 'ja' => 'オブジェクト配列', 'ko' => '객체 배열'], 'desc' => ['zh' => '通过 value 与 label 分别定义保存值和显示文字', 'en' => 'Defines stored values and labels separately.', 'ja' => 'value と label を個別に指定します。', 'ko' => 'value와 label을 각각 지정합니다.'], 'default' => 'zh_CN', 'options' => [
            ['value' => 'zh_CN', 'label' => '简体中文'],
            ['value' => 'en_US', 'label' => 'English'],
            ['value' => 'ja_JP', 'label' => '日本語'],
            ['value' => 'ko_KR', 'label' => '한국어'],
        ], 'width' => '1/3'],
        ['id' => 'demo_select_region', 'type' => 'select', 'title' => ['zh' => '分组选项', 'en' => 'Grouped options', 'ja' => 'グループ選択', 'ko' => '그룹 옵션'], 'desc' => ['zh' => '按照地区分组展示选项', 'en' => 'Displays options in labeled groups.', 'ja' => '地域ごとにグループ表示します。', 'ko' => '지역별 그룹으로 옵션을 표시합니다.'], 'default' => 'sh', 'options' => ['华北' => ['bj' => '北京', 'tj' => '天津'], '华东' => ['sh' => '上海', 'hz' => '杭州'], '华南' => ['gz' => '广州', 'sz' => '深圳']], 'width' => '1/3'],
        ['id' => 'demo_select_search', 'type' => 'select', 'title' => ['zh' => '搜索下拉框', 'en' => 'Searchable select', 'ja' => '検索付き選択', 'ko' => '검색 선택'], 'desc' => ['zh' => '强制显示搜索框并设置无结果提示', 'en' => 'Always shows search with a custom empty message.', 'ja' => '検索欄と空状態メッセージを表示します。', 'ko' => '검색창과 빈 결과 안내를 표시합니다.'], 'default' => 'sh', 'searchable' => true, 'empty_message' => '没有匹配的城市', 'options' => ['bj' => '北京', 'sh' => '上海', 'gz' => '广州', 'sz' => '深圳', 'hz' => '杭州', 'nj' => '南京', 'cd' => '成都', 'cq' => '重庆', 'wh' => '武汉', 'xa' => '西安', 'cs' => '长沙', 'xm' => '厦门'], 'width' => '1/3'],
        ['id' => 'demo_select_auto_search', 'type' => 'select', 'title' => ['zh' => '自动搜索', 'en' => 'Automatic search', 'ja' => '自動検索', 'ko' => '자동 검색'], 'desc' => ['zh' => '选项达到 8 个时自动启用下拉搜索', 'en' => 'Search turns on automatically at eight options.', 'ja' => '8 件以上で検索が自動的に有効になります。', 'ko' => '옵션이 8개 이상이면 검색이 자동 활성화됩니다.'], 'default' => 'news', 'options' => ['news' => '新闻资讯', 'blog' => '博客文章', 'product' => '产品内容', 'video' => '视频内容', 'audio' => '音频内容', 'gallery' => '图片画廊', 'download' => '下载资源', 'course' => '在线课程', 'event' => '活动信息', 'notice' => '站点公告'], 'width' => '1/3'],
        ['id' => 'demo_select_no_search', 'type' => 'select', 'title' => ['zh' => '关闭搜索', 'en' => 'Search disabled', 'ja' => '検索を無効化', 'ko' => '검색 비활성화'], 'desc' => ['zh' => '长列表也可以通过 searchable=false 关闭搜索框', 'en' => 'Disables search even for a long option list.', 'ja' => '長いリストでも検索欄を無効にできます。', 'ko' => '긴 목록에서도 검색창을 비활성화합니다.'], 'default' => 'v3', 'searchable' => false, 'options' => ['v1' => '版本 1', 'v2' => '版本 2', 'v3' => '版本 3', 'v4' => '版本 4', 'v5' => '版本 5', 'v6' => '版本 6', 'v7' => '版本 7', 'v8' => '版本 8', 'v9' => '版本 9', 'v10' => '版本 10'], 'width' => '1/3'],
        ['id' => 'demo_select_empty', 'type' => 'select', 'title' => ['zh' => '空状态', 'en' => 'Empty state', 'ja' => '空の状態', 'ko' => '빈 상태'], 'desc' => ['zh' => '没有可用选项时展示自定义空状态文案', 'en' => 'Shows a custom message when no options are available.', 'ja' => '選択肢がない場合のメッセージです。', 'ko' => '사용 가능한 옵션이 없을 때 안내를 표시합니다.'], 'default' => '', 'placeholder' => '暂无可选内容', 'empty_message' => '当前没有可用选项', 'options' => [], 'width' => '1/3'],

        // 从桌面新版迁入的完整功能示例。
        ['id' => 'select_basic', 'type' => 'select', 'title' => '基础下拉', 'desc' => '最常见的 key => label 选项写法。', 'default' => 'wide', 'placeholder' => '请选择布局', 'width' => '1/2', 'options' => [
            'wide'  => '宽屏布局',
            'boxed' => '盒装布局',
            'fluid' => '流式布局',
        ]],
        ['id' => 'select_searchable', 'type' => 'select', 'title' => '可搜索下拉', 'desc' => 'searchable = true，适合选项较多的场景。', 'default' => 'sz', 'searchable' => true, 'placeholder' => '搜索城市', 'empty_message' => '没有匹配城市', 'width' => '1/2', 'options' => [
            'bj' => '北京',
            'sh' => '上海',
            'gz' => '广州',
            'sz' => '深圳',
            'hz' => '杭州',
            'nj' => '南京',
            'cd' => '成都',
            'wh' => '武汉',
        ]],
        ['id' => 'select_grouped', 'type' => 'select', 'title' => '分组选项', 'desc' => 'options 可按地区或类型分组，适合层级较清晰的选项。', 'default' => 'sh', 'searchable' => true, 'placeholder' => '请选择地区', 'width' => 'full', 'options' => [
            '华北' => ['bj' => '北京', 'tj' => '天津', 'sjz' => '石家庄'],
            '华东' => ['sh' => '上海', 'hz' => '杭州', 'nj' => '南京', 'su' => '苏州'],
            '华南' => ['gz' => '广州', 'sz' => '深圳', 'xm' => '厦门'],
            '西南' => ['cd' => '成都', 'cq' => '重庆', 'km' => '昆明'],
        ]],
        ['id' => 'select_disabled', 'type' => 'select', 'title' => '禁用选项', 'desc' => '数组对象写法支持 disabled，禁用项会变淡且无法选中。', 'default' => 'pro', 'placeholder' => '请选择套餐', 'width' => 'full', 'options' => [
            ['value' => 'free', 'label' => '免费版'],
            ['value' => 'pro', 'label' => '专业版'],
            ['value' => 'team', 'label' => '团队版（暂不可选）', 'disabled' => true],
            ['value' => 'enterprise', 'label' => '企业版'],
        ]],
        ['id' => 'select_multiple_sortable', 'type' => 'select', 'title' => '多选 + 排序', 'desc' => 'multiple = true 可选多个值；sortable = true 时已选标签可拖拽调整顺序。', 'default' => ['header', 'sidebar'], 'multiple' => true, 'sortable' => true, 'searchable' => true, 'placeholder' => '请选择模块', 'width' => 'full', 'options' => [
            'header'  => '头部模块',
            'hero'    => '首屏模块',
            'sidebar' => '侧边栏',
            'content' => '正文模块',
            'footer'  => '底部模块',
        ]],
        ['id' => 'ajax_select_post', 'type' => 'select', 'ajax' => true, 'source' => 'posts', 'title' => '文章查找', 'desc' => '输入关键词后通过 admin-ajax 搜索 post，保存文章 ID。', 'post_type' => 'post', 'placeholder' => '搜索并选择文章', 'search_placeholder' => '输入文章标题关键词…', 'width' => 'full'],
        ['id' => 'ajax_select_page', 'type' => 'select', 'ajax' => true, 'source' => 'posts', 'title' => '页面查找', 'desc' => '限制 post_type = page，适合选择落地页、协议页、帮助页。', 'post_type' => 'page', 'placeholder' => '搜索并选择页面', 'search_placeholder' => '输入页面标题关键词…', 'width' => 'full'],
        ['id' => 'ajax_select_content', 'type' => 'select', 'ajax' => true, 'source' => 'posts', 'title' => '文章 + 页面查找', 'desc' => 'post_type 可传数组，同时搜索 post 与 page。', 'post_type' => ['post', 'page'], 'placeholder' => '搜索文章或页面', 'search_placeholder' => '输入至少 2 个字符…', 'limit' => 15, 'width' => 'full'],
        ['id' => 'ajax_select_multiple', 'type' => 'select', 'ajax' => true, 'source' => 'posts', 'multiple' => true, 'sortable' => true, 'title' => 'AJAX 多选 + 排序', 'desc' => 'AJAX 模式同样支持 multiple / sortable，适合配置相关文章、推荐页面等有顺序的内容列表。', 'post_type' => ['post', 'page'], 'placeholder' => '搜索并选择多个内容', 'search_placeholder' => '输入标题关键词…', 'limit' => 15, 'width' => 'full'],
        ['id' => 'select_source_terms', 'type' => 'select', 'ajax' => true, 'source' => 'terms', 'title' => '分类法数据源', 'desc' => 'Select 统一扩展：从分类法中 AJAX 搜索术语。', 'taxonomy' => 'category', 'multiple' => true, 'sortable' => true, 'width' => 'full'],
        ['id' => 'select_source_users', 'type' => 'select', 'ajax' => true, 'source' => 'users', 'title' => '用户数据源', 'desc' => 'Select 统一扩展：搜索用户并保存用户 ID。', 'multiple' => true, 'sortable' => true, 'width' => 'full'],
        ['id' => 'select_source_menus', 'type' => 'select', 'ajax' => true, 'source' => 'menus', 'title' => '菜单数据源', 'desc' => 'Select 统一扩展：选择已注册的 WordPress 导航菜单。', 'width' => '1/2'],
        ['id' => 'select_source_sidebars', 'type' => 'select', 'ajax' => true, 'source' => 'sidebars', 'title' => '侧边栏数据源', 'desc' => 'Select 统一扩展：选择主题注册的挂件区域。', 'width' => '1/2'],
        ['id' => 'select_relationship', 'type' => 'select', 'ajax' => true, 'source' => 'posts', 'variant' => 'relationship', 'title' => '关联内容（双栏模式）', 'desc' => '仍然是 Select 字段；variant = relationship 时显示可选/已选双栏，保存有序 ID 数组。', 'post_type' => ['post', 'page'], 'sortable' => true, 'max_items' => 12, 'limit' => 20, 'default' => [], 'width' => 'full'],
    ],
]);

\Eva::createSection('eva_demo', [
    'id'    => 'field-color',
    'title' => ['zh' => '颜色字段', 'en' => 'Color Fields', 'ja' => 'カラーフィールド', 'ko' => '색상 필드'],
    'icon'  => 'ri-palette-line',
    'fields' => [
        ['id' => 'demo_color_basic', 'type' => 'color', 'title' => ['zh' => '普通颜色', 'en' => 'Basic color', 'ja' => '基本カラー', 'ko' => '기본 색상'], 'desc' => ['zh' => '支持直接输入 HEX、RGB 或 RGBA，也可以打开颜色面板选择。', 'en' => 'Enter HEX, RGB or RGBA, or choose from the color panel.', 'ja' => 'HEX、RGB、RGBA を入力するか、カラーパネルから選択できます。', 'ko' => 'HEX, RGB, RGBA를 입력하거나 색상 패널에서 선택할 수 있습니다.'], 'placeholder' => '#ff6f91', 'width' => '1/2'],
        ['id' => 'demo_color_hex', 'type' => 'color', 'title' => ['zh' => 'HEX 默认值', 'en' => 'HEX default', 'ja' => 'HEX 初期値', 'ko' => 'HEX 기본값'], 'desc' => ['zh' => '常用的十六进制主题色。', 'en' => 'A standard hexadecimal theme color.', 'ja' => '標準的な 16 進テーマカラーです。', 'ko' => '표준 16진수 테마 색상입니다.'], 'default' => '#ff6f91', 'width' => '1/2'],
        ['id' => 'demo_color_rgba', 'type' => 'color', 'title' => ['zh' => 'RGBA 与透明度', 'en' => 'RGBA and opacity', 'ja' => 'RGBA と透明度', 'ko' => 'RGBA 및 투명도'], 'desc' => ['zh' => '拖动透明度滑杆后会保存为 RGBA 值。', 'en' => 'Changing opacity saves the value as RGBA.', 'ja' => '透明度を変更すると RGBA 値で保存されます。', 'ko' => '투명도를 변경하면 RGBA 값으로 저장됩니다.'], 'default' => 'rgba(99, 102, 241, 0.45)', 'width' => '1/2'],
        ['id' => 'demo_color_transparent', 'type' => 'color', 'title' => ['zh' => '完全透明', 'en' => 'Transparent', 'ja' => '完全透明', 'ko' => '완전 투명'], 'desc' => ['zh' => '支持 transparent 关键字，并保留棋盘格透明预览。', 'en' => 'Supports the transparent keyword with a checkerboard preview.', 'ja' => 'transparent キーワードと透明プレビューに対応します。', 'ko' => 'transparent 키워드와 투명 미리보기를 지원합니다.'], 'default' => 'transparent', 'width' => '1/2'],
        ['id' => 'demo_color_solid', 'type' => 'color', 'title' => ['zh' => '纯色模式', 'en' => 'Solid color only', 'ja' => '単色モード', 'ko' => '단색 모드'], 'desc' => ['zh' => '关闭透明度与透明颜色，只允许选择纯色。', 'en' => 'Disables opacity and transparent values.', 'ja' => '透明度と透明色を無効にし、単色のみ選択できます。', 'ko' => '투명도와 투명 색상을 비활성화하고 단색만 선택합니다.'], 'default' => '#0ea5e9', 'alpha' => false, 'allow_transparent' => false, 'width' => '1/2'],
        ['id' => 'demo_color_presets', 'type' => 'color', 'title' => ['zh' => '预设色板', 'en' => 'Color presets', 'ja' => 'カラープリセット', 'ko' => '색상 프리셋'], 'desc' => ['zh' => '在颜色面板中提供常用主题色快捷选择。', 'en' => 'Provides quick theme-color choices in the panel.', 'ja' => 'パネルからテーマカラーをすばやく選択できます。', 'ko' => '패널에서 자주 쓰는 테마 색상을 빠르게 선택할 수 있습니다.'], 'default' => '#14b8a6', 'presets' => ['#ff6f91', '#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', 'transparent'], 'width' => '1/2'],
        ['id' => 'demo_color_disabled', 'type' => 'color', 'title' => ['zh' => '禁用状态', 'en' => 'Disabled state', 'ja' => '無効状態', 'ko' => '비활성 상태'], 'desc' => ['zh' => '用于展示不可编辑的颜色值。', 'en' => 'Shows a non-editable color value.', 'ja' => '編集できないカラー値を表示します。', 'ko' => '편집할 수 없는 색상 값을 표시합니다.'], 'default' => '#94a3b8', 'disabled' => true, 'width' => '1/2'],

        // 从桌面新版迁入的完整功能示例。
        ['id' => 'color_primary', 'type' => 'color', 'title' => '主色调', 'desc' => '基础 color 字段，默认允许透明度，适合按钮、链接、强调状态等主题主色。', 'default' => '#FF4D7F', 'alpha' => true, 'placeholder' => '#FF4D7F', 'width' => '1/2', 'presets' => [
            '#FF4D7F',
            '#EF4444',
            '#F97316',
            '#FACC15',
            '#22C55E',
            '#38BDF8',
            '#3B82F6',
            '#8B5CF6',
            '#64748B',
        ]],
        ['id' => 'color_solid', 'type' => 'color', 'title' => '纯色选择', 'desc' => 'alpha = false，仅保存 HEX 颜色，适合不需要透明度的品牌色或边框色。', 'default' => '#3B82F6', 'alpha' => false, 'placeholder' => '#3B82F6', 'width' => '1/2', 'presets' => [
            '#111827',
            '#374151',
            '#6B7280',
            '#D1D5DB',
            '#F9FAFB',
            '#3B82F6',
            '#10B981',
            '#F59E0B',
            '#EF4444',
        ]],
        ['id' => 'color_presets', 'type' => 'color', 'title' => '预设色板', 'desc' => 'presets 可传一组常用色，便于快速选择统一的设计令牌。', 'default' => '#06D6A0', 'alpha' => true, 'placeholder' => '#06D6A0', 'width' => 'full', 'presets' => [
            '#FF4D8D',
            '#FF6B6B',
            '#FFD166',
            '#06D6A0',
            '#4D96FF',
            '#9B5DE5',
            '#222222',
            '#FFFFFF',
        ]],
        ['id' => 'color_inline', 'type' => 'color', 'title' => '内联面板', 'desc' => 'mode = inline 时颜色面板直接展开，适合需要高频调色的页面。', 'default' => '#8B5CF6', 'mode' => 'inline', 'palette_label' => '常用主题色', 'popover_width' => '320px', 'board_height' => '150px', 'preset_shape' => 'circle', 'width' => 'full', 'presets' => [
            '#FF4D7F',
            '#8B5CF6',
            '#3B82F6',
            '#06B6D4',
            '#22C55E',
            '#FACC15',
            '#F97316',
            '#EF4444',
        ]],
        ['id' => 'color_compact', 'type' => 'color', 'title' => '紧凑模式', 'desc' => 'size = small，并关闭输入框、格式切换、预设色板和清除按钮，适合表格或小空间。', 'default' => '#64748B', 'size' => 'small', 'show_input' => false, 'show_format' => false, 'show_presets' => false, 'clearable' => false, 'default_text' => '还原', 'apply_text' => '确定', 'width' => '1/2'],
        ['id' => 'color_rgba_only', 'type' => 'color', 'title' => 'RGBA 专用', 'desc' => 'format = rgba 且 formats 只给 rgba，可固定输出透明色。', 'default' => 'rgba(255, 77, 127, 0.72)', 'alpha' => true, 'format' => 'rgba', 'formats' => ['rgba'], 'placeholder' => 'rgba(255, 77, 127, 0.72)', 'palette_label' => '透明色预设', 'width' => '1/2', 'presets' => [
            'rgba(255, 77, 127, 0.35)',
            'rgba(59, 130, 246, 0.35)',
            'rgba(34, 197, 94, 0.35)',
            'rgba(250, 204, 21, 0.45)',
        ]],
        ['id' => 'color_disabled', 'type' => 'color', 'title' => '禁用状态', 'desc' => 'disabled = true 时只展示当前颜色，不允许打开或修改。', 'default' => '#94A3B8', 'disabled' => true, 'width' => 'full'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id'    => 'field-html',
    'title' => ['zh' => 'HTML 内容字段', 'en' => 'HTML Content', 'ja' => 'HTML コンテンツ', 'ko' => 'HTML 콘텐츠'],
    'icon'  => 'ri-code-box-line',
    'fields' => [
        ['id' => 'demo_html_content', 'type' => 'html', 'width' => 'full', 'html' => '<section style="margin:16px;padding:18px 20px;border:1px solid var(--eva-border);border-radius:6px;background:var(--eva-surface)"><h2 style="margin:0 0 8px;font-size:16px">HTML 内容字段</h2><p style="margin:0;color:var(--eva-text-sub);font-size:13px;line-height:1.65">用于展示可信的静态 HTML、说明内容、iframe 或第三方应用挂载点。该字段不参与普通表单值保存。</p><div style="display:flex;gap:8px;margin-top:14px"><span style="padding:4px 8px;border-radius:4px;color:var(--eva-primary);background:var(--eva-primary-050);font-size:12px">静态内容</span><span style="padding:4px 8px;border-radius:4px;color:var(--eva-primary);background:var(--eva-primary-050);font-size:12px">应用挂载</span></div></section>'],
    ],
]);

// 帮助中心：CSF 里就是个 iframe，直接搬过来即可用。
\Eva::createSection('eva_demo', [
    'id'     => 'field-params',
    'title'  => '字段参数',
    'icon'   => 'ri-settings-5-line',
    'fields' => [
        ['id' => 'params_overview', 'type' => 'html', 'title' => '参数总览', 'width' => 'full', 'html' => '<div class="eva-html-note">字段参数不是全部通用：一部分作用在字段行上，所有字段可用；一部分作用在具体输入控件上，只适合 text / textarea / select 等；还有一部分是字段类型专属参数，例如 upload 的 button_title、color 的 alpha。</div>'],

        ['id' => 'params_group_common', 'type' => 'html', 'title' => '字段行通用参数', 'width' => 'full', 'html' => '<div class="eva-html-note"><strong>通用：</strong>title、subtitle、desc、help、before、after、content、class 由字段外层统一渲染，和字段类型无关。</div>'],
        ['id' => 'params_title_help', 'type' => 'textarea', 'title' => 'textarea：subtitle / desc / help', 'subtitle' => 'subtitle 显示在标题和描述之间。', 'desc' => 'desc 用于更长的字段说明；标题旁问号来自 help。', 'help' => 'help 是通用参数，所有字段行都能显示。', 'default' => '这里用 textarea 展示标题说明类参数。', 'placeholder' => '请输入多行内容', 'width' => '1/2'],
        ['id' => 'params_before_after', 'type' => 'color', 'title' => 'color：before / after', 'before' => '<p>before：这段内容显示在颜色选择器之前。</p>', 'after' => '<p>after：这段内容显示在颜色选择器之后。</p>', 'help' => 'before/after 不是 text 专属，字段行都会渲染。', 'default' => '#7C3AED', 'alpha' => true, 'width' => '1/2'],
        ['id' => 'params_content', 'type' => 'upload', 'title' => 'upload：content / button_title / preview', 'content' => '<strong>content：</strong>这块说明显示在媒体上传控件之前。', 'subtitle' => '这里用 upload 字段展示辅助内容和字段特有参数。', 'button_title' => '选择示例图片', 'preview' => true, 'library' => 'image', 'return_type' => 'url', 'width' => 'full'],

        ['id' => 'params_group_input', 'type' => 'html', 'title' => '输入控件参数', 'width' => 'full', 'html' => '<div class="eva-html-note"><strong>非全局：</strong>placeholder、attributes、readonly、disabled 需要字段组件自己支持。它们最适合 text / textarea 这类原生输入；其它字段要逐个组件适配。</div>'],
        ['id' => 'params_attributes', 'type' => 'text', 'title' => 'text：attributes', 'subtitle' => 'attributes 是输入元素属性，更适合 text / textarea 这类原生输入。', 'desc' => '此示例限制 maxlength=12，并追加 data-demo 属性。', 'default' => '最多12字', 'width' => '1/2', 'attributes' => [
            'maxlength' => 12,
            'data-demo' => 'field-attributes',
            'autocomplete' => 'off',
        ]],
        ['id' => 'params_custom_class', 'type' => 'switcher', 'title' => 'switcher：class / help', 'subtitle' => '给字段行追加自定义 CSS class。', 'desc' => '此字段带 eva-demo-param-highlight class，可由主题或插件追加样式。', 'help' => 'class 是字段行参数，不依赖具体字段组件。', 'default' => true, 'width' => '1/2', 'class' => 'eva-demo-param-highlight'],
        ['id' => 'params_readonly', 'type' => 'textarea', 'title' => 'textarea：readonly', 'subtitle' => '字段可显示但不可编辑。', 'default' => '这段 textarea 是只读内容。', 'width' => '1/2', 'readonly' => true],
        ['id' => 'params_disabled', 'type' => 'switcher', 'title' => 'switcher：disabled', 'subtitle' => '字段禁用后不可点击。', 'default' => true, 'width' => '1/2', 'disabled' => true],

        ['id' => 'params_group_type', 'type' => 'html', 'title' => '字段类型专属参数', 'width' => 'full', 'html' => '<div class="eva-html-note"><strong>按字段类型生效：</strong>select 的 multiple / sortable / searchable，color 的 output / alpha，upload 的 button_title / preview / library 等，不应该理解为所有字段通用。</div>'],
        ['id' => 'params_select_enhanced', 'type' => 'select', 'title' => 'select 增强参数', 'subtitle' => 'multiple / sortable / searchable。', 'default' => ['header', 'footer'], 'width' => 'full', 'multiple' => true, 'sortable' => true, 'searchable' => true, 'options' => [
            'header' => '头部模块',
            'hero'   => '首屏模块',
            'main'   => '主体模块',
            'footer' => '底部模块',
        ]],
        ['id' => 'params_output_color', 'type' => 'color', 'title' => 'output / output_mode', 'subtitle' => '保存后会在前台 wp_head 输出 CSS。', 'desc' => 'output=.eva-output-demo-preview，output_mode=background-color。', 'default' => '#FF758C', 'alpha' => false, 'width' => '1/2', 'output' => '.eva-output-demo-preview', 'output_mode' => 'background-color'],
        ['id' => 'params_output_note', 'type' => 'html', 'title' => 'output 说明', 'width' => '1/2', 'html' => '<div class="eva-html-note eva-output-demo-preview" style="padding:12px;border-radius:10px;color:#fff;">保存颜色后，前台同名选择器会自动获得背景色。后台这里仅作为说明块。</div>'],

        ['id' => 'params_group_save', 'type' => 'html', 'title' => '保存处理参数', 'width' => 'full', 'html' => '<div class="eva-html-note"><strong>保存链路：</strong>validate 负责保存前拦截错误，sanitize 负责入库前格式化。它们不是 text 专属，但 email/url/numeric 这类例子天然更适合文本输入。</div>'],
        ['id' => 'sanitize_title_demo', 'type' => 'text', 'title' => 'sanitize 清洗', 'subtitle' => '保存时执行 sanitize_title，把内容清洗成 slug。', 'placeholder' => '例如 Hello World 2026', 'default' => 'Hello World 2026', 'width' => 'full', 'sanitize' => 'sanitize_title'],

        ['id' => 'validate_required', 'type' => 'text', 'title' => 'required 必填验证', 'subtitle' => '保存时不能为空。', 'placeholder' => '留空后保存会显示字段错误', 'default' => '', 'width' => '1/2', 'required' => true],
        ['id' => 'validate_email', 'type' => 'text', 'title' => 'email 邮箱验证', 'subtitle' => 'validate => email。', 'placeholder' => 'name@example.com', 'default' => 'demo@example.com', 'width' => '1/2', 'validate' => 'email'],
        ['id' => 'validate_numeric', 'type' => 'text', 'title' => 'numeric 数字验证', 'subtitle' => 'validate => numeric。', 'placeholder' => '请输入数字', 'default' => '100', 'width' => '1/2', 'validate' => 'numeric'],
        ['id' => 'validate_url', 'type' => 'text', 'title' => 'url 地址验证', 'subtitle' => 'validate => url。', 'placeholder' => 'https://example.com', 'default' => 'https://example.com', 'width' => '1/2', 'validate' => 'url'],
    ],
]);

\Eva::createSection('eva_demo', [
    'id'     => 'field-image-select',
    'title'  => '图像选择',
    'icon'   => 'ri-image-line',
    'fields' => [
        ['id' => 'image_select_default', 'type' => 'image_select', 'title' => '默认卡片', 'desc' => '默认 16:9 缩略图、显示标题和描述、开启放大预览。', 'default' => 'card', 'columns' => 4, 'width' => '1/2', 'options' => eva_demo_image_select_options()],
        ['id' => 'image_select_compact', 'type' => 'image_select', 'title' => '简约模式', 'desc' => '隐藏选项标题和描述，只保留图片预览，适合空间较小的设置区。', 'default' => 'card', 'columns' => 4, 'preview_height' => 76, 'show_label' => false, 'show_desc' => false, 'zoom' => false, 'width' => '1/2', 'options' => eva_demo_image_select_options()],
        ['id' => 'image_select_disabled', 'type' => 'image_select', 'title' => '禁用选项', 'desc' => '单个 option 可设置 disabled，字段本身也可设置 disabled。', 'default' => 'card', 'columns' => 4, 'width' => '1/2', 'options' => eva_demo_image_select_options(true)],
        ['id' => 'image_select_size', 'type' => 'image_select', 'title' => '自定义卡片大小', 'desc' => '用 size = small / medium / large 一键设定卡片尺寸（此处为 small）；无需手动算 columns，卡片按固定宽度自动换行。', 'default' => 'card', 'size' => 'small', 'width' => '1/2', 'options' => eva_demo_image_select_options()],
        ['id' => 'image_select_multiple', 'type' => 'image_select', 'title' => '多选 + 上限', 'desc' => 'multiple 开启多选、max=2 限制最多选 2 个；选中再点可取消，保存为数组。卡片支持方向键 ←→↑↓ 移动焦点、Enter/Space 选择。', 'default' => ['card', 'grid'], 'multiple' => true, 'max' => 2, 'columns' => 4, 'width' => '1/2', 'options' => eva_demo_image_select_options()],
        ['id' => 'image_select_search_group', 'type' => 'image_select', 'title' => '搜索 + 分组 + 徽章', 'desc' => 'searchable 顶部搜索框过滤；选项带 group 自动分组并显示小标题；带 badge 的选项右上角显示徽章（支持 primary/success/warn/danger 配色）。', 'default' => 'card', 'searchable' => true, 'columns' => 4, 'width' => '1/2', 'options' => [
            'card'    => ['label' => '卡片布局', 'group' => '基础布局', 'badge' => '常用', 'badge_tone' => 'primary', 'url' => eva_demo_image_select_preview('card')],
            'list'    => ['label' => '列表布局', 'group' => '基础布局', 'url' => eva_demo_image_select_preview('list')],
            'grid'    => ['label' => '网格布局', 'group' => '进阶布局', 'badge' => '新', 'badge_tone' => 'success', 'url' => eva_demo_image_select_preview('grid')],
            'minimal' => ['label' => '极简布局', 'group' => '进阶布局', 'badge' => 'Pro', 'badge_tone' => 'warn', 'url' => eva_demo_image_select_preview('minimal')],
        ]],
        ['id' => 'image_select_lazy', 'type' => 'image_select', 'title' => '懒加载 + 骨架', 'desc' => 'lazy=true：图片懒加载并在加载完成前显示微光骨架占位，图多时更顺滑、不跳动。', 'default' => 'card', 'lazy' => true, 'columns' => 4, 'width' => '1/2', 'options' => eva_demo_image_select_options()],
    ],
]);

\Eva::createSection('eva_demo', [
    'id'     => 'field-color-group',
    'title'  => '颜色组',
    'icon'   => 'ri-color-filter-line',
    'fields' => [
        ['id' => 'color_group_brand', 'type' => 'color_group', 'title' => '品牌色组', 'group_title' => '品牌色组', 'group_desc' => 'color_group 保存颜色数组，适合主题色、图表色、标签色等成组配置；default_color 控制新增颜色。', 'default' => ['#FF4D8D', '#FF6B6B', '#FFD166', '#06D6A0', '#4D96FF'], 'default_color' => '#FF4D8D', 'presets' => ['#FF4D8D', '#FF6B6B', '#FFD166', '#06D6A0', '#4D96FF', '#9B5DE5', '#222222', '#FFFFFF'], 'width' => '1/2'],
        ['id' => 'color_group_sortable', 'type' => 'color_group', 'title' => '颜色组 + 排序', 'group_title' => '可排序色组', 'group_desc' => 'sortable = true 时，颜色块可拖拽调整顺序；max_colors 限制最多添加数量。', 'default' => ['#3B82F6', '#22C55E', '#FACC15', '#EF4444'], 'default_color' => '#3B82F6', 'presets' => ['#3B82F6', '#22C55E', '#FACC15', '#EF4444', '#8B5CF6', '#06B6D4'], 'max_colors' => 6, 'sortable' => true, 'width' => '1/2'],
        ['id' => 'color_group_limit', 'type' => 'color_group', 'title' => '数量上下限 + 计数', 'group_title' => '数量上下限', 'group_desc' => 'min_colors=2、max_colors=5：到下限禁删、到上限禁加，标题旁实时显示数量。', 'default' => ['#FF4D7F', '#4D96FF', '#22C55E'], 'min_colors' => 2, 'max_colors' => 5, 'presets' => ['#FF4D7F', '#FF6B6B', '#FFD166', '#06D6A0', '#4D96FF', '#9B5DE5'], 'width' => '1/2'],
        ['id' => 'color_group_disabled', 'type' => 'color_group', 'title' => '禁用态 disabled', 'group_title' => '禁用态', 'group_desc' => 'disabled = true 时只读展示当前颜色，不可增删改。', 'default' => ['#94A3B8', '#CBD5E1', '#E2E8F0'], 'disabled' => true, 'width' => '1/2'],
        ['id' => 'color_group_named_alpha', 'type' => 'color_group', 'title' => '命名 + HEX + 透明度', 'group_title' => '品牌色标注', 'group_desc' => 'named、show_hex、alpha、copyable 组合：为颜色命名、编辑 8 位 HEX、调整透明度并复制色值。', 'default' => [['color' => '#FF4D8DCC', 'label' => '主色'], ['color' => '#4D96FFCC', 'label' => '辅助色'], ['color' => '#06D6A0CC', 'label' => '成功色']], 'default_color' => '#FF4D8D', 'named' => true, 'show_hex' => true, 'alpha' => true, 'copyable' => true, 'sortable' => true, 'max_colors' => 6, 'presets' => ['#FF4D8D', '#4D96FF', '#06D6A0', '#FFD166', '#9B5DE5'], 'palette_label' => '快捷色板', 'width' => 'full'],
        ['id' => 'color_group_schemes', 'type' => 'color_group', 'title' => '配色方案 + 清空重置', 'group_title' => '主题配色方案', 'group_desc' => 'schemes 一键套用整组颜色；clearable 清空当前值，resettable 恢复默认方案。', 'default' => ['#0F172A', '#334155', '#38BDF8', '#F97316'], 'default_color' => '#38BDF8', 'max_colors' => 6, 'show_count' => true, 'clearable' => true, 'resettable' => true, 'presets' => ['#0F172A', '#334155', '#38BDF8', '#F97316', '#22C55E'], 'schemes' => [['label' => '海盐蓝', 'colors' => ['#0F172A', '#1E3A8A', '#38BDF8', '#E0F2FE']], ['label' => '森林绿', 'colors' => ['#14532D', '#166534', '#22C55E', '#DCFCE7']], ['label' => '日落橙', 'colors' => ['#7C2D12', '#C2410C', '#F97316', '#FFEDD5']]], 'palette_label' => '方案外色板', 'width' => 'full'],
    ],
]);

\Eva::createSection('eva_demo', [
    'id'     => 'field-upload',
    'title'  => '媒体上传',
    'icon'   => 'ri-folder-image-line',
    'fields' => [
        ['id' => 'upload_image_url', 'type' => 'upload', 'title' => '单图上传', 'desc' => '默认图片上传，return_type = url，保存图片 URL。', 'default' => '', 'library' => 'image', 'button_title' => '选择图片', 'placeholder' => '点击或拖拽图片到此处', 'return_type' => 'url', 'preview' => true, 'width' => '1/2'],
        ['id' => 'upload_image_id', 'type' => 'upload', 'title' => '返回附件 ID', 'desc' => 'return_type = id，保存 WordPress 媒体库附件 ID，适合后端读取图片尺寸或元数据。', 'default' => '', 'library' => 'image', 'button_title' => '选择附件', 'placeholder' => '选择图片并保存附件 ID', 'return_type' => 'id', 'preview' => true, 'width' => '1/2'],
        ['id' => 'upload_image_array', 'type' => 'upload', 'title' => '返回媒体信息', 'desc' => 'return_type = array，保存 id、url、title、mime、width、height 等结构化信息。', 'default' => [], 'library' => 'image', 'button_title' => '选择图片', 'placeholder' => '选择图片并保存完整媒体信息', 'return_type' => 'array', 'preview' => true, 'width' => '1/2'],
        ['id' => 'upload_gallery', 'type' => 'upload', 'title' => '多图上传', 'desc' => 'multiple = true，可选择多张图片；适合相册、轮播图、产品图集。', 'default' => [], 'library' => 'image', 'multiple' => true, 'button_title' => '选择多张图片', 'placeholder' => '点击或拖拽多张图片到此处', 'return_type' => 'array', 'preview' => true, 'width' => '1/2'],
        ['id' => 'upload_file', 'type' => 'upload', 'title' => '文件上传', 'desc' => 'library = file，适合上传 zip、pdf、文档等非图片文件；preview = false 关闭图片预览。', 'default' => '', 'library' => 'file', 'button_title' => '选择文件', 'placeholder' => '点击选择或拖拽文件', 'return_type' => 'url', 'preview' => false, 'max_size' => 10, 'width' => '1/2'],
        ['id' => 'upload_video', 'type' => 'upload', 'title' => '视频上传', 'desc' => 'library = video，可用于上传或选择视频素材；通常关闭图片预览。', 'default' => '', 'library' => 'video', 'button_title' => '选择视频', 'placeholder' => '点击选择或拖拽视频文件', 'return_type' => 'url', 'preview' => false, 'max_size' => 50, 'width' => '1/2'],
        ['id' => 'upload_hide_drop', 'type' => 'upload', 'title' => '隐藏拖拽上传区', 'desc' => 'show_drop = false：专门演示隐藏 eva-media-drop，只保留按钮和媒体库入口。', 'default' => '', 'library' => 'image', 'button_title' => '选择图片', 'placeholder' => '这里不会显示拖拽区', 'return_type' => 'url', 'preview' => true, 'show_drop' => false, 'width' => 'full'],
    ],
]);

\Eva::createSection('eva_demo', [
    'id'     => 'field-icon',
    'title'  => '图标选择',
    'icon'   => 'ri-star-line',
    'fields' => [
        ['id' => 'icon_intro', 'type' => 'html', 'title' => '字段说明', 'width' => 'full', 'html' => '<div class="eva-html-note"><strong>Icon 字段保存安全的图标名称字符串。</strong><br>支持 Remixicon、Font Awesome、WordPress Dashicons 和 Iconfont Symbol，并提供搜索、分类、手动输入、清除、恢复默认、只读和禁用状态。</div>'],
        ['id' => 'icon_remix', 'type' => 'icon', 'title' => 'Remixicon 图标', 'subtitle' => 'library => remix，保存值类似 ri-star-fill。', 'default' => 'ri-star-fill', 'library' => 'remix', 'placeholder' => '请选择 Remixicon 图标', 'width' => '1/2'],
        ['id' => 'icon_fa', 'type' => 'icon', 'title' => 'Font Awesome 常用名', 'subtitle' => 'library => fa，内部映射到可预览的图标。', 'default' => 'star', 'library' => 'fa', 'placeholder' => '例如 star / user / home', 'width' => '1/2'],
        ['id' => 'icon_dashicons', 'type' => 'icon', 'title' => 'Dashicons 图标', 'subtitle' => 'library => dashicons，适合 WordPress 后台风格。', 'default' => 'admin-settings', 'library' => 'dashicons', 'placeholder' => '请选择 Dashicons 图标', 'width' => '1/2'],
        ['id' => 'icon_iconfont', 'type' => 'icon', 'title' => '阿里 Iconfont SVG', 'subtitle' => 'library => iconfont；先在右抽屉填写 Symbol JS 地址。', 'default' => '', 'library' => 'iconfont', 'placeholder' => '例如 #icon-home', 'width' => '1/2'],
        ['id' => 'icon_menu_scene', 'type' => 'icon', 'title' => '菜单场景示例', 'subtitle' => '用于左侧菜单、模块入口、功能卡片。', 'default' => 'ri-menu-4-line', 'library' => 'remix', 'placeholder' => '请选择菜单图标', 'width' => '1/2'],
        ['id' => 'icon_empty', 'type' => 'icon', 'title' => '空值与占位提示', 'subtitle' => '不设置 default 时显示 placeholder，可选择后再清除。', 'default' => '', 'library' => 'remix', 'placeholder' => '尚未选择图标', 'width' => '1/2'],
        ['id' => 'icon_readonly', 'type' => 'icon', 'title' => '只读状态', 'subtitle' => 'readonly=true：保留预览和值，但不能打开选择器或修改。', 'default' => 'ri-shield-check-line', 'library' => 'remix', 'readonly' => true, 'width' => '1/2'],
        ['id' => 'icon_disabled', 'type' => 'icon', 'title' => '禁用状态', 'subtitle' => 'disabled=true：完整展示禁用视觉和不可操作状态。', 'default' => 'ri-lock-2-line', 'library' => 'remix', 'disabled' => true, 'width' => '1/2'],
        ['id' => 'icon_picker_only', 'type' => 'icon', 'title' => '仅选择器模式', 'subtitle' => '禁止手动输入，同时隐藏恢复默认和清除操作。', 'default' => 'ri-layout-grid-line', 'library' => 'remix', 'allow_input' => false, 'show_reset' => false, 'clearable' => false, 'width' => '1/2'],
        ['id' => 'icon_no_search', 'type' => 'icon', 'title' => '关闭搜索框', 'subtitle' => 'searchable=false：打开图标面板后直接通过分类浏览。', 'default' => 'ri-compass-3-line', 'library' => 'remix', 'searchable' => false, 'width' => '1/2'],
        ['id' => 'icon_no_clear', 'type' => 'icon', 'title' => '不可清除', 'subtitle' => 'clearable=false：允许重新选择和恢复默认，但不显示清除按钮。', 'default' => 'ri-checkbox-circle-line', 'library' => 'remix', 'clearable' => false, 'width' => '1/2'],
        ['id' => 'icon_usage_note', 'type' => 'html', 'title' => '配置示例', 'width' => 'full', 'html' => '<div class="eva-html-note"><code>type => icon</code>，常用参数：<code>library</code>、<code>default</code>、<code>placeholder</code>、<code>readonly</code>、<code>disabled</code>、<code>allow_input</code>、<code>searchable</code>、<code>clearable</code>、<code>show_reset</code>。保存结果是字符串，可直接用于前端 class、菜单或模块图标。</div>'],
    ],
]);

\Eva::createSection('eva_demo', [
    'id'     => 'field-accordion',
    'title'  => '手风琴折叠',
    'icon'   => 'ri-menu-fold-line',
    'fields' => [
        ['id' => 'accordion_intro', 'type' => 'html', 'title' => '字段说明', 'width' => 'full', 'html' => '<div class="eva-html-note"><strong>Accordion 适合复杂模块、页面区域和功能设置。</strong><br>支持同时展开多个面板或单面板模式，每个面板可配置图标、徽章、说明、禁用状态和独立子字段；保存值为对象结构：<code>{ section_id: { child_field_id: value } }</code>。</div>'],
        ['id' => 'accordion_menu_config', 'type' => 'accordion', 'title' => '菜单字段配置', 'subtitle' => '多面板可同时展开，适合菜单、模块、卡片等成组配置。', 'desc' => '演示 default_open、badge、disabled、open_icon、closed_icon 和子字段布局。', 'default_open' => ['basic', 'style'], 'multiple' => true, 'closed_icon' => 'ri-arrow-down-s-line', 'open_icon' => 'ri-arrow-up-s-line', 'width' => 'full', 'sections' => [
            ['id' => 'basic', 'title' => '基础信息', 'icon' => 'ri-information-line', 'desc' => '配置菜单标题、描述和启用状态。', 'badge' => '基础', 'fields' => [
                ['id' => 'menu_title', 'type' => 'text', 'title' => '菜单标题', 'default' => 'Eva 菜单', 'placeholder' => '请输入菜单标题', 'width' => '1/2'],
                ['id' => 'menu_desc', 'type' => 'textarea', 'title' => '菜单描述', 'default' => '这里是手风琴字段里的描述内容。', 'width' => '1/2'],
                ['id' => 'menu_enabled', 'type' => 'switcher', 'title' => '启用菜单', 'default' => 1, 'width' => '1/2'],
                ['id' => 'menu_icon', 'type' => 'icon', 'title' => '菜单图标', 'default' => 'ri-menu-4-line', 'width' => '1/2'],
                ['id' => 'menu_slug', 'type' => 'text', 'title' => '菜单标识', 'desc' => '用于模板调用和 CSS 定位。', 'default' => 'primary-menu', 'placeholder' => 'primary-menu', 'width' => '1/2'],
                ['id' => 'menu_position', 'type' => 'number', 'title' => '排序位置', 'min' => 0, 'max' => 99, 'step' => 1, 'default' => 10, 'width' => '1/4'],
                ['id' => 'menu_target', 'type' => 'select', 'title' => '打开方式', 'default' => '_self', 'width' => '1/4', 'options' => ['_self' => '当前窗口', '_blank' => '新窗口']],
                ['id' => 'menu_roles', 'type' => 'checkbox', 'title' => '可见角色', 'desc' => '选择允许看到该菜单的用户角色。', 'inline' => true, 'default' => ['guest', 'user'], 'width' => 'full', 'options' => ['guest' => '游客', 'user' => '登录用户', 'editor' => '编辑', 'admin' => '管理员']],
            ]],
            ['id' => 'style', 'title' => '样式配置', 'icon' => 'ri-palette-line', 'desc' => '配置颜色、展示方式和布局参数。', 'badge' => '样式', 'fields' => [
                ['id' => 'menu_color', 'type' => 'color', 'title' => '菜单主色', 'default' => '#7C3AED', 'alpha' => true, 'width' => '1/2'],
                ['id' => 'menu_layout', 'type' => 'select', 'title' => '菜单布局', 'default' => 'vertical', 'width' => '1/2', 'options' => [
                    'vertical' => '纵向菜单',
                    'horizontal' => '横向菜单',
                    'compact' => '紧凑菜单',
                ]],
                ['id' => 'menu_badges', 'type' => 'select', 'title' => '菜单角标', 'default' => ['new'], 'multiple' => true, 'sortable' => true, 'searchable' => true, 'width' => 'full', 'options' => [
                    'new' => '新功能',
                    'hot' => '热门',
                    'beta' => '测试版',
                    'pro' => '专业版',
                ]],
                ['id' => 'menu_width', 'type' => 'number', 'title' => '菜单宽度', 'default' => 260, 'min' => 160, 'max' => 480, 'step' => 10, 'units' => 'px', 'width' => '1/3'],
                ['id' => 'menu_gap', 'type' => 'spinner', 'title' => '项目间距', 'default' => 8, 'min' => 0, 'max' => 32, 'step' => 1, 'unit' => 'px', 'width' => '1/3'],
                ['id' => 'menu_radius', 'type' => 'spinner', 'title' => '圆角大小', 'default' => 6, 'min' => 0, 'max' => 30, 'step' => 1, 'unit' => 'px', 'width' => '1/3'],
                ['id' => 'menu_shadow', 'type' => 'switcher', 'title' => '启用阴影', 'default' => true, 'width' => '1/2'],
                ['id' => 'menu_sticky', 'type' => 'switcher', 'title' => '滚动时固定', 'default' => false, 'width' => '1/2'],
            ]],
            ['id' => 'media', 'title' => '媒体配置', 'icon' => 'ri-image-line', 'desc' => '配置菜单封面或展示图。', 'badge' => '媒体', 'fields' => [
                ['id' => 'menu_cover', 'type' => 'upload', 'title' => '菜单封面', 'button_title' => '选择封面', 'library' => 'image', 'preview' => true, 'return_type' => 'url', 'width' => 'full'],
                ['id' => 'menu_cover_alt', 'type' => 'text', 'title' => '封面替代文字', 'placeholder' => '请输入图片说明', 'width' => '1/2'],
                ['id' => 'menu_cover_lazy', 'type' => 'switcher', 'title' => '图片懒加载', 'default' => true, 'width' => '1/2'],
                ['id' => 'menu_overlay', 'type' => 'color', 'title' => '遮罩颜色', 'default' => 'rgba(15,23,42,0.35)', 'alpha' => true, 'width' => '1/2'],
                ['id' => 'menu_cover_fit', 'type' => 'select', 'title' => '图片填充', 'default' => 'cover', 'width' => '1/2', 'options' => ['cover' => '裁剪填充', 'contain' => '完整显示', 'fill' => '拉伸填充']],
            ]],
            ['id' => 'interaction', 'title' => '交互设置', 'icon' => 'ri-cursor-line', 'desc' => '设置菜单交互、动画和追踪属性。', 'badge' => '交互', 'fields' => [
                ['id' => 'menu_hover_action', 'type' => 'select', 'title' => '悬停行为', 'default' => 'highlight', 'width' => '1/2', 'options' => ['none' => '无', 'highlight' => '高亮', 'expand' => '展开子菜单', 'preview' => '显示预览']],
                ['id' => 'menu_animation', 'type' => 'select', 'title' => '展开动画', 'default' => 'fade', 'width' => '1/2', 'options' => ['none' => '无动画', 'fade' => '淡入', 'slide' => '滑动', 'scale' => '缩放']],
                ['id' => 'menu_close_outside', 'type' => 'switcher', 'title' => '点击外部关闭', 'default' => true, 'width' => '1/2'],
                ['id' => 'menu_track_click', 'type' => 'switcher', 'title' => '记录点击事件', 'default' => false, 'width' => '1/2'],
                ['id' => 'menu_css_class', 'type' => 'text', 'title' => '附加 CSS 类', 'placeholder' => 'my-custom-menu', 'width' => '1/2'],
                ['id' => 'menu_tracking_key', 'type' => 'text', 'title' => '统计事件标识', 'placeholder' => 'nav_primary_click', 'width' => '1/2'],
            ]],
            ['id' => 'locked', 'title' => '禁用面板', 'icon' => 'ri-lock-line', 'desc' => '此面板禁用，用于展示 section.disabled。', 'badge' => '禁用', 'disabled' => true, 'fields' => [
                ['id' => 'locked_text', 'type' => 'text', 'title' => '禁用说明', 'default' => '当前面板不可编辑', 'width' => 'full'],
            ]],
        ]],
        ['id' => 'accordion_single_mode', 'type' => 'accordion', 'title' => '单面板展开模式', 'subtitle' => '一次只展开一个面板，适合分步骤或互斥配置。', 'desc' => '演示 multiple=false、独立默认面板和自定义折叠图标。', 'default_open' => ['display'], 'multiple' => false, 'closed_icon' => 'ri-add-line', 'open_icon' => 'ri-subtract-line', 'width' => 'full', 'sections' => [
            ['id' => 'display', 'title' => '内容展示', 'icon' => 'ri-layout-grid-line', 'badge' => '显示', 'desc' => '设置内容类型、数量和空状态。', 'fields' => [
                ['id' => 'content_type', 'type' => 'select', 'title' => '内容类型', 'default' => 'post', 'width' => '1/2', 'options' => ['post' => '文章', 'page' => '页面', 'product' => '产品', 'custom' => '自定义内容']],
                ['id' => 'items_per_page', 'type' => 'number', 'title' => '展示数量', 'default' => 8, 'min' => 1, 'max' => 50, 'step' => 1, 'width' => '1/2'],
                ['id' => 'show_title', 'type' => 'switcher', 'title' => '显示标题', 'default' => true, 'width' => '1/2'],
                ['id' => 'show_excerpt', 'type' => 'switcher', 'title' => '显示摘要', 'default' => true, 'width' => '1/2'],
                ['id' => 'empty_text', 'type' => 'text', 'title' => '空状态文字', 'default' => '暂无内容', 'width' => 'full'],
            ]],
            ['id' => 'playback', 'title' => '轮播行为', 'icon' => 'ri-play-circle-line', 'badge' => '行为', 'desc' => '配置自动播放和循环方式。', 'fields' => [
                ['id' => 'autoplay', 'type' => 'switcher', 'title' => '自动播放', 'default' => true, 'width' => '1/3'],
                ['id' => 'loop', 'type' => 'switcher', 'title' => '循环播放', 'default' => true, 'width' => '1/3'],
                ['id' => 'pause_hover', 'type' => 'switcher', 'title' => '悬停暂停', 'default' => true, 'width' => '1/3'],
                ['id' => 'interval', 'type' => 'number', 'title' => '切换间隔', 'default' => 5, 'min' => 1, 'max' => 30, 'step' => 1, 'units' => '秒', 'width' => '1/2'],
                ['id' => 'transition', 'type' => 'select', 'title' => '切换效果', 'default' => 'slide', 'width' => '1/2', 'options' => ['slide' => '滑动', 'fade' => '淡入淡出', 'coverflow' => '层叠']],
            ]],
            ['id' => 'advanced', 'title' => '高级配置', 'icon' => 'ri-settings-3-line', 'badge' => '高级', 'desc' => '添加缓存、标识和自定义样式。', 'fields' => [
                ['id' => 'cache_enabled', 'type' => 'switcher', 'title' => '启用缓存', 'default' => true, 'width' => '1/2'],
                ['id' => 'cache_time', 'type' => 'number', 'title' => '缓存时间', 'default' => 30, 'min' => 0, 'max' => 1440, 'step' => 5, 'units' => '分钟', 'width' => '1/2'],
                ['id' => 'element_id', 'type' => 'text', 'title' => '元素 ID', 'placeholder' => 'featured-content', 'width' => '1/2'],
                ['id' => 'custom_class', 'type' => 'text', 'title' => '自定义 CSS 类', 'placeholder' => 'featured-content--custom', 'width' => '1/2'],
            ]],
        ]],
    ],
]);

\Eva::createSection('eva_demo', [
    'id'     => 'field-builder',
    'title'  => '页面构建器',
    'icon'   => 'ri-layout-masonry-line',
    'fields' => [
        ['id' => 'page_blocks', 'type' => 'builder', 'title' => '页面内容', 'desc' => '空 Builder 示例。注册模块后，左侧模块库会显示可拖拽模块。', 'slots' => [
            ['id' => 'main', 'label' => '页面内容'],
            ['id' => 'after_main', 'label' => '内容下方'],
        ], 'default' => ['slots' => ['main' => [], 'after_main' => []]], 'width' => 'full'],
    ],
]);

\Eva::createSection('eva_demo', [
    'id'     => 'field-dependency',
    'title'  => '字段依赖',
    'icon'   => 'ri-git-branch-line',
    'fields' => [
        ['id' => 'dep_enable_csf', 'type' => 'switcher', 'title' => 'CSF 兼容开关', 'desc' => '开启后，下方 CSF dependency 写法的字段才会显示。', 'default' => false, 'width' => '1/3'],
        ['id' => 'dep_csf_text', 'type' => 'text', 'title' => 'CSF dependency 显示字段', 'desc' => '使用 dependency => array("dep_enable_csf", "==", "true")，用于验证旧 CSF 配置迁移。', 'default' => '开启开关后显示', 'width' => '2/3', 'dependency' => ['dep_enable_csf', '==', 'true']],

        ['id' => 'dep_mode', 'type' => 'select', 'title' => '依赖模式', 'desc' => '切换不同模式，观察下方字段状态。', 'default' => 'basic', 'width' => '1/3', 'options' => [
            'basic'    => '基础模式',
            'advanced' => '高级模式',
            'pro'      => '专业模式',
        ]],
        ['id' => 'dep_visible_text', 'type' => 'text', 'title' => 'visible 模式置灰', 'desc' => '只有选择“高级模式”才可编辑；不满足时保留显示但置灰遮罩。', 'default' => 'visible_if + dependency_action=visible', 'width' => '2/3', 'dependency_action' => 'visible', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_mode', 'operator' => '==', 'value' => 'advanced'],
        ]],

        ['id' => 'dep_disabled_text', 'type' => 'text', 'title' => 'disabled_if 禁用字段', 'desc' => '选择“专业模式”时会禁用并置灰。', 'default' => '专业模式下禁用', 'width' => '1/2', 'disabled_if' => [
            ['source' => 'field', 'id' => 'dep_mode', 'operator' => '==', 'value' => 'pro'],
        ]],
        ['id' => 'dep_readonly_text', 'type' => 'text', 'title' => 'readonly_if 只读字段', 'desc' => '选择“专业模式”时进入只读遮罩状态。', 'default' => '专业模式下只读', 'width' => '1/2', 'readonly_if' => [
            ['source' => 'field', 'id' => 'dep_mode', 'operator' => '==', 'value' => 'pro'],
        ]],

        ['id' => 'dep_multi_text', 'type' => 'text', 'title' => '多条件依赖', 'desc' => '需要同时开启 CSF 开关，并选择高级模式。', 'default' => '两个条件都满足才显示', 'width' => 'full', 'visible_if' => [
            'relation' => 'and',
            'rules'    => [
                ['source' => 'field', 'id' => 'dep_enable_csf', 'operator' => '==', 'value' => true],
                ['source' => 'field', 'id' => 'dep_mode', 'operator' => '==', 'value' => 'advanced'],
            ],
        ]],

        ['id' => 'dep_cross_option_note', 'type' => 'text', 'title' => '跨 option 依赖', 'desc' => '读取当前 demo option 中“常规设置 > 启用示例功能”的已保存值。先保存常规设置并刷新页面，即可看到跨来源依赖效果。', 'default' => '外部 option 满足后显示', 'width' => 'full', 'visible_if' => [
            ['source' => 'option', 'option' => 'eva_demo', 'key' => 'enable_feature', 'operator' => '==', 'value' => true],
        ]],

        ['id' => 'dep_save_policy', 'type' => 'text', 'title' => '隐藏时不保存', 'desc' => '关闭 CSF 兼容开关后，此字段会隐藏，并因 save_when_hidden=false 在保存时从结果中跳过。', 'default' => '这个值只在字段显示时保存', 'width' => 'full', 'save_when_hidden' => false, 'dependency' => ['dep_enable_csf', '==', 'true']],

        ['id' => 'dep_keyword', 'type' => 'text', 'title' => '关键词条件', 'desc' => '输入任意内容，用于演示 empty / not_empty 条件。', 'default' => '', 'placeholder' => '输入后触发 not_empty 示例', 'width' => '1/2'],
        ['id' => 'dep_keyword_not_empty', 'type' => 'text', 'title' => 'not_empty 示例', 'desc' => '关键词不为空时显示。', 'default' => '关键词已有内容', 'width' => '1/2', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_keyword', 'operator' => 'not_empty'],
        ]],
        ['id' => 'dep_keyword_empty', 'type' => 'text', 'title' => 'empty 示例', 'desc' => '关键词为空时显示。', 'default' => '关键词为空', 'width' => 'full', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_keyword', 'operator' => 'empty'],
        ]],

        ['id' => 'dep_modules', 'type' => 'select', 'title' => '模块多选条件', 'desc' => '用于演示 contains / not_contains；选择多个模块后观察下方字段。', 'default' => ['header', 'sidebar'], 'multiple' => true, 'sortable' => true, 'width' => 'full', 'options' => [
            'header'  => '头部模块',
            'hero'    => '首屏模块',
            'sidebar' => '侧边栏',
            'footer'  => '底部模块',
        ]],
        ['id' => 'dep_contains_sidebar', 'type' => 'text', 'title' => 'contains 示例', 'desc' => '模块多选中包含“侧边栏”时显示。', 'default' => '已包含 sidebar', 'width' => '1/2', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_modules', 'operator' => 'contains', 'value' => 'sidebar'],
        ]],
        ['id' => 'dep_not_contains_footer', 'type' => 'text', 'title' => 'not_contains 示例', 'desc' => '模块多选中不包含“底部模块”时显示。', 'default' => '未包含 footer', 'width' => '1/2', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_modules', 'operator' => 'not_contains', 'value' => 'footer'],
        ]],

        ['id' => 'dep_score', 'type' => 'text', 'title' => '数字比较条件', 'desc' => '输入数字，演示 > / >= / < / <= 这类比较。', 'default' => '5', 'placeholder' => '例如 8', 'width' => '1/3'],
        ['id' => 'dep_score_high', 'type' => 'text', 'title' => '> 数字比较示例', 'desc' => '数字大于 7 时显示。', 'default' => '当前数值大于 7', 'width' => '2/3', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_score', 'operator' => '>', 'value' => 7],
        ]],
        ['id' => 'dep_score_ge', 'type' => 'text', 'title' => '>= 数字比较示例', 'desc' => '数字大于等于 5 时显示。', 'default' => '当前数值大于等于 5', 'width' => '1/3', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_score', 'operator' => '>=', 'value' => 5],
        ]],
        ['id' => 'dep_score_lt', 'type' => 'text', 'title' => '< 数字比较示例', 'desc' => '数字小于 5 时显示。', 'default' => '当前数值小于 5', 'width' => '1/3', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_score', 'operator' => '<', 'value' => 5],
        ]],
        ['id' => 'dep_score_le', 'type' => 'text', 'title' => '<= 数字比较示例', 'desc' => '数字小于等于 5 时显示。', 'default' => '当前数值小于等于 5', 'width' => '1/3', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_score', 'operator' => '<=', 'value' => 5],
        ]],

        ['id' => 'dep_or_relation', 'type' => 'text', 'title' => 'OR 关系示例', 'desc' => '选择“专业模式”或关键词不为空，任一满足即显示。', 'default' => 'relation=or 已满足', 'width' => 'full', 'visible_if' => [
            'relation' => 'or',
            'rules'    => [
                ['source' => 'field', 'id' => 'dep_mode', 'operator' => '==', 'value' => 'pro'],
                ['source' => 'field', 'id' => 'dep_keyword', 'operator' => 'not_empty'],
            ],
        ]],

        ['id' => 'dep_not_equal', 'type' => 'text', 'title' => '!= 示例', 'desc' => '依赖模式不等于“基础模式”时显示。', 'default' => '当前不是基础模式', 'width' => '1/2', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_mode', 'operator' => '!=', 'value' => 'basic'],
        ]],
        ['id' => 'dep_any_mode', 'type' => 'text', 'title' => 'any 示例', 'desc' => '依赖模式是“高级模式”或“专业模式”时显示。', 'default' => '命中 any: advanced,pro', 'width' => '1/2', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_mode', 'operator' => 'any', 'value' => 'advanced,pro'],
        ]],
        ['id' => 'dep_not_any_mode', 'type' => 'text', 'title' => 'not_any 示例', 'desc' => '依赖模式不是“专业模式”时显示。', 'default' => '未命中 pro', 'width' => '1/2', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_mode', 'operator' => 'not_any', 'value' => 'pro'],
        ]],
        ['id' => 'dep_in_module', 'type' => 'text', 'title' => 'in 示例', 'desc' => '模块多选中包含“头部模块”时显示；in 与 any 语义一致。', 'default' => '模块中包含 header', 'width' => '1/2', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_modules', 'operator' => 'in', 'value' => 'header'],
        ]],
        ['id' => 'dep_not_in_module', 'type' => 'text', 'title' => 'not_in 示例', 'desc' => '模块多选中不包含“首屏模块”时显示。', 'default' => '模块中不包含 hero', 'width' => 'full', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_modules', 'operator' => 'not_in', 'value' => 'hero'],
        ]],

        ['id' => 'dep_truth_flag', 'type' => 'switcher', 'title' => 'truthy / falsy 控制开关', 'desc' => '用于演示 truthy 和 falsy 条件。', 'default' => false, 'width' => '1/3'],
        ['id' => 'dep_truthy_text', 'type' => 'text', 'title' => 'truthy 示例', 'desc' => '控制开关为真时显示。', 'default' => '开关为真', 'width' => '1/3', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_truth_flag', 'operator' => 'truthy'],
        ]],
        ['id' => 'dep_falsy_text', 'type' => 'text', 'title' => 'falsy 示例', 'desc' => '控制开关为假时显示。', 'default' => '开关为假', 'width' => '1/3', 'visible_if' => [
            ['source' => 'field', 'id' => 'dep_truth_flag', 'operator' => 'falsy'],
        ]],

        ['id' => 'dep_site_option_note', 'type' => 'text', 'title' => 'site_option 来源示例', 'desc' => '读取 WordPress 多站点网络选项 site_name；单站点若该值不存在，此字段会隐藏。', 'default' => 'site_option(site_name) 不为空', 'width' => 'full', 'visible_if' => [
            ['source' => 'site_option', 'option' => 'site_name', 'operator' => 'not_empty'],
        ]],
    ],
]);

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
            // 扩展管理仪表盘由 assets/extension-page.js 自动挂载，并通过主题现有 REST 接口读取真实模块。
            echo '<div id="extended" class="extended-page"></div>';
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
// 主题备份恢复：单字段整页应用。
\Eva::createSection('eva_demo', [
    'id'     => 'backup',
    'title'  => ['zh' => '主题备份恢复', 'en' => 'Theme Backup & Restore', 'ja' => 'テーマのバックアップと復元', 'ko' => '테마 백업 및 복원'],
    'fields' => [
        ['id' => 'backup_ui', 'type' => 'theme_backup', 'width' => 'full'],
    ],
]);


// 第二批：常用字段（Checkbox / Radio / Button Set / Number / Slider / Spinner / Date / Datetime / Link / Link Color）。
\Eva::createSection('eva_demo', [
    'id' => 'field-checkbox', 'title' => 'Checkbox / 多选框', 'icon' => 'ri-checkbox-multiple-line',
    'fields' => [
        ['id' => 'demo_checkbox_basic', 'type' => 'checkbox', 'title' => '基础多选', 'desc' => '标准列表，多选结果保存为数组。', 'options' => ['news' => '内容通知', 'security' => '安全提醒', 'product' => '产品更新', 'weekly' => '每周摘要'], 'default' => ['news', 'security'], 'width' => '1/2'],
        ['id' => 'demo_checkbox_inline', 'type' => 'checkbox', 'title' => '行内排列', 'desc' => 'inline=true 时横向紧凑排列。', 'inline' => true, 'options' => ['php' => 'PHP', 'vue' => 'Vue', 'css' => 'CSS', 'api' => 'API'], 'default' => ['php', 'vue'], 'width' => '1/2'],
        ['id' => 'demo_checkbox_card', 'type' => 'checkbox', 'title' => '卡片样式', 'card' => true, 'max' => 2, 'options' => ['starter' => ['label' => '入门版', 'desc' => '适合个人站点', 'icon' => 'ri-seedling-line'], 'pro' => ['label' => '专业版', 'desc' => '适合商业项目', 'icon' => 'ri-vip-crown-line'], 'team' => ['label' => '团队版', 'desc' => '多人协作授权', 'icon' => 'ri-team-line']], 'default' => ['pro'], 'width' => '1/2'],
        ['id' => 'demo_checkbox_disabled', 'type' => 'checkbox', 'title' => '禁用状态', 'disabled' => true, 'inline' => true, 'options' => ['a' => '选项 A', 'b' => '选项 B'], 'default' => ['a'], 'width' => '1/2'],
        ['id' => 'demo_checkbox_limit', 'type' => 'checkbox', 'title' => '最多选择三项', 'desc' => '通过 max_select=3 限制最多可选数量。', 'max_select' => 3, 'options' => ['cache' => '页面缓存', 'cdn' => 'CDN 加速', 'lazyload' => '图片懒加载', 'minify' => '资源压缩', 'preload' => '链接预加载'], 'default' => ['cache', 'lazyload'], 'width' => '1/2'],
        ['id' => 'demo_checkbox_option_disabled', 'type' => 'checkbox', 'title' => '部分选项禁用', 'desc' => '字段可用，但其中个别选项不可选择。', 'options' => ['basic' => ['label' => '基础功能'], 'beta' => ['label' => 'Beta 功能', 'desc' => '当前版本暂不可用', 'disabled' => true], 'stable' => ['label' => '稳定功能']], 'default' => ['basic'], 'width' => '1/2'],
        ['id' => 'demo_checkbox_all_selected', 'type' => 'checkbox', 'title' => '默认全部选中', 'desc' => '通过 default 数组预选所有项目。', 'inline' => true, 'options' => ['desktop' => '桌面端', 'tablet' => '平板端', 'mobile' => '移动端'], 'default' => ['desktop', 'tablet', 'mobile'], 'width' => '1/2'],
        ['id' => 'demo_checkbox_empty', 'type' => 'checkbox', 'title' => '默认不选', 'desc' => '初始值为空数组，用户可按需选择。', 'inline' => true, 'options' => ['light' => '浅色模式', 'dark' => '深色模式', 'auto' => '跟随系统'], 'default' => [], 'width' => '1/2'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-radio', 'title' => 'Radio / 单选框', 'icon' => 'ri-radio-button-line',
    'fields' => [
        ['id' => 'demo_radio_basic', 'type' => 'radio', 'title' => '基础单选', 'options' => ['draft' => '草稿', 'review' => '等待审核', 'publish' => '立即发布'], 'default' => 'review', 'width' => '1/2'],
        ['id' => 'demo_radio_inline', 'type' => 'radio', 'title' => '行内排列', 'inline' => true, 'options' => ['left' => '左对齐', 'center' => '居中', 'right' => '右对齐'], 'default' => 'left', 'width' => '1/2'],
        ['id' => 'demo_radio_card', 'type' => 'radio', 'title' => '图标卡片', 'card' => true, 'options' => ['basic' => ['label' => '基础', 'desc' => '轻量配置', 'icon' => 'ri-flashlight-line'], 'advanced' => ['label' => '高级', 'desc' => '完整功能', 'icon' => 'ri-vip-diamond-line'], 'custom' => ['label' => '自定义', 'desc' => '自由组合', 'icon' => 'ri-tools-line']], 'default' => 'advanced', 'width' => '1/2'],
        ['id' => 'demo_radio_readonly', 'type' => 'radio', 'title' => '只读状态', 'readonly' => true, 'inline' => true, 'options' => ['yes' => '已启用', 'no' => '未启用'], 'default' => 'yes', 'width' => '1/2'],
        ['id' => 'demo_radio_disabled_option', 'type' => 'radio', 'title' => '部分选项禁用', 'desc' => '字段可用，但某个选项不可选。', 'options' => ['standard' => ['label' => '标准', 'desc' => '推荐配置'], 'beta' => ['label' => 'Beta', 'desc' => '暂未开放', 'disabled' => true], 'pro' => ['label' => '专业版', 'desc' => '完整能力']], 'default' => 'standard', 'width' => 'full'],
        ['id' => 'demo_radio_clearable', 'type' => 'radio', 'title' => '可取消单选', 'desc' => 'clearable = true：再次点击当前选项即可清空。', 'clearable' => true, 'inline' => true, 'options' => ['auto' => '自动', 'manual' => '手动', 'scheduled' => '定时'], 'default' => 'auto', 'width' => 'full'],
        ['id' => 'demo_radio_columns', 'type' => 'radio', 'title' => '固定四列卡片', 'desc' => 'columns 控制卡片列数，适合设备、套餐和模板选择。', 'card' => true, 'columns' => 4, 'options' => ['desktop' => ['label' => '桌面', 'icon' => 'ri-computer-line'], 'tablet' => ['label' => '平板', 'icon' => 'ri-tablet-line'], 'mobile' => ['label' => '手机', 'icon' => 'ri-smartphone-line'], 'tv' => ['label' => '电视', 'icon' => 'ri-tv-line']], 'default' => 'desktop', 'width' => 'full'],
        ['id' => 'demo_radio_clearable_card', 'type' => 'radio', 'title' => '可取消卡片单选', 'desc' => '卡片模式同样支持再次点击取消。', 'card' => true, 'clearable' => true, 'columns' => 3, 'options' => ['light' => ['label' => '浅色', 'desc' => '明亮界面'], 'dark' => ['label' => '深色', 'desc' => '低光环境'], 'auto' => ['label' => '自动', 'desc' => '跟随系统']], 'default' => 'auto', 'width' => 'full'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-button-set', 'title' => 'Button Set / 按钮组', 'icon' => 'ri-layout-row-line',
    'fields' => [
        ['id' => 'demo_button_set_basic', 'type' => 'button_set', 'title' => '基础按钮组', 'options' => ['all' => '全部', 'enabled' => '已启用', 'disabled' => '已禁用'], 'default' => 'all', 'width' => '1/2'],
        ['id' => 'demo_button_set_icons', 'type' => 'button_set', 'title' => '图标按钮', 'options' => ['grid' => ['label' => '网格', 'icon' => 'ri-grid-line'], 'list' => ['label' => '列表', 'icon' => 'ri-list-check'], 'compact' => ['label' => '紧凑', 'icon' => 'ri-layout-row-line']], 'default' => 'grid', 'width' => '1/2'],
        ['id' => 'demo_button_set_sizes', 'type' => 'button_set', 'title' => '小尺寸', 'size' => 'sm', 'options' => ['sm' => '小', 'md' => '中', 'lg' => '大'], 'default' => 'md', 'width' => '1/2'],
        ['id' => 'demo_button_set_full', 'type' => 'button_set', 'title' => '等宽铺满', 'full_width' => true, 'options' => ['desktop' => '桌面', 'tablet' => '平板', 'mobile' => '手机'], 'default' => 'desktop', 'width' => '1/2'],
        ['id' => 'demo_button_set_disabled', 'type' => 'button_set', 'title' => '部分按钮禁用', 'desc' => '保留按钮组布局，仅禁用某个不可用选项。', 'options' => ['draft' => ['label' => '草稿'], 'review' => ['label' => '审核中'], 'archived' => ['label' => '已归档', 'disabled' => true]], 'default' => 'review', 'width' => 'full'],
        ['id' => 'demo_button_set_multiple', 'type' => 'button_set', 'title' => '按钮组多选', 'desc' => 'multiple = true：可同时启用多个筛选条件。', 'multiple' => true, 'options' => ['new' => '最新', 'popular' => '热门', 'featured' => '精选', 'free' => '免费'], 'default' => ['new', 'featured'], 'width' => 'full'],
        ['id' => 'demo_button_set_limit', 'type' => 'button_set', 'title' => '多选上限', 'desc' => '最多同时选择两个按钮，达到上限后其他按钮自动禁用。', 'multiple' => true, 'max_select' => 2, 'options' => ['php' => 'PHP', 'vue' => 'Vue', 'css' => 'CSS', 'api' => 'API'], 'default' => ['php'], 'width' => '1/2'],
        ['id' => 'demo_button_set_vertical', 'type' => 'button_set', 'title' => '垂直按钮组', 'desc' => 'vertical = true：适合侧栏筛选和窄区域。', 'vertical' => true, 'options' => ['overview' => '概览', 'settings' => '设置', 'logs' => '日志'], 'default' => 'overview', 'width' => '1/2'],
        ['id' => 'demo_button_set_clearable', 'type' => 'button_set', 'title' => '可取消按钮组', 'desc' => '再次点击当前按钮可清空选择。', 'clearable' => true, 'options' => ['day' => '日', 'week' => '周', 'month' => '月'], 'default' => 'week', 'width' => 'full'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-number', 'title' => 'Number / 数字', 'icon' => 'ri-numbers-line',
    'fields' => [
        ['id' => 'demo_number_basic', 'type' => 'number', 'title' => '基础数字', 'min' => 0, 'max' => 100, 'step' => 1, 'default' => 24, 'width' => '1/2'],
        ['id' => 'demo_number_unit', 'type' => 'number', 'title' => '单位后缀', 'min' => 0, 'max' => 2000, 'step' => 10, 'units' => 'px', 'default' => 960, 'width' => '1/2'],
        ['id' => 'demo_number_decimal', 'type' => 'number', 'title' => '小数步长', 'min' => 0, 'max' => 10, 'step' => 0.1, 'default' => 1.5, 'width' => '1/2'],
        ['id' => 'demo_number_disabled', 'type' => 'number', 'title' => '禁用状态', 'disabled' => true, 'default' => 100, 'units' => '%', 'width' => '1/2'],
        ['id' => 'demo_number_affix', 'type' => 'number', 'title' => '前后缀 + 只读', 'desc' => '支持前缀、后缀和只读状态，适合金额、比例和计算结果。', 'before' => '¥', 'after' => 'CNY', 'readonly' => true, 'min' => 0, 'max' => 99999, 'step' => 0.01, 'default' => 199.99, 'width' => 'full'],
        ['id' => 'demo_number_clamp', 'type' => 'number', 'title' => '清空 + 自动限幅', 'desc' => '失焦时自动限制在 min/max 内，并按 precision 保留小数位。', 'clearable' => true, 'clamp' => true, 'precision' => 2, 'min' => 0, 'max' => 100, 'step' => 0.25, 'after' => '%', 'default' => 66.5, 'width' => 'full'],
        ['id' => 'demo_number_currency', 'type' => 'number', 'title' => '金额输入', 'desc' => '前缀、两位小数、自动限幅和清空组合。', 'before' => '¥', 'clearable' => true, 'clamp' => true, 'precision' => 2, 'min' => 0, 'max' => 999999, 'step' => 0.01, 'default' => 1299.00, 'width' => '1/2'],
        ['id' => 'demo_number_offset', 'type' => 'number', 'title' => '正负偏移量', 'desc' => '允许负数，适合位置偏移、校准值和温差。', 'min' => -500, 'max' => 500, 'step' => 0.5, 'after' => 'px', 'clearable' => true, 'default' => -12.5, 'width' => '1/2'],
        ['id' => 'demo_number_empty', 'type' => 'number', 'title' => '允许空值', 'desc' => '不设置默认值，通过 placeholder 提示推荐范围。', 'min' => 1, 'max' => 999, 'placeholder' => '请输入 1–999', 'clearable' => true, 'default' => '', 'width' => 'full'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-slider', 'title' => 'Slider / 滑块', 'icon' => 'ri-equalizer-2-line',
    'fields' => [
        ['id' => 'demo_slider_basic', 'type' => 'slider', 'title' => '基础滑块', 'min' => 0, 'max' => 100, 'step' => 1, 'default' => 46, 'width' => '1/2'],
        ['id' => 'demo_slider_marks', 'type' => 'slider', 'title' => '刻度标记', 'min' => 0, 'max' => 100, 'step' => 10, 'marks' => [0 => '0', 25 => '25', 50 => '50', 75 => '75', 100 => '100'], 'default' => 60, 'width' => '1/2'],
        ['id' => 'demo_slider_percent', 'type' => 'slider', 'title' => '百分比输出', 'min' => 0, 'max' => 1, 'step' => 0.05, 'output' => 'percent', 'default' => 0.65, 'width' => '1/2'],
        ['id' => 'demo_slider_disabled', 'type' => 'slider', 'title' => '禁用状态', 'min' => 0, 'max' => 100, 'default' => 35, 'disabled' => true, 'width' => '1/2'],
        ['id' => 'demo_slider_hidden_value', 'type' => 'slider', 'title' => '隐藏当前值', 'desc' => 'show_value = false：仅保留滑轨和刻度，适合紧凑设置面板。', 'min' => 0, 'max' => 10, 'step' => 1, 'marks' => [0 => '低', 5 => '中', 10 => '高'], 'show_value' => false, 'default' => 6, 'width' => 'full'],
        ['id' => 'demo_slider_unit', 'type' => 'slider', 'title' => '带单位滑块', 'desc' => '当前值与范围端点统一显示单位。', 'min' => -20, 'max' => 50, 'step' => 0.5, 'unit' => '°C', 'default' => 22.5, 'width' => 'full'],
        ['id' => 'demo_slider_color', 'type' => 'slider', 'title' => '自定义主题色', 'desc' => 'color 自定义滑轨、滑块和数值标签颜色。', 'min' => 0, 'max' => 100, 'step' => 1, 'color' => '#22C55E', 'unit' => '%', 'default' => 72, 'width' => '1/2'],
        ['id' => 'demo_slider_fine', 'type' => 'slider', 'title' => '精细小数滑块', 'desc' => '以 0.01 为步长调整精确参数。', 'min' => 0, 'max' => 1, 'step' => 0.01, 'show_limits' => false, 'default' => 0.42, 'width' => '1/2'],
        ['id' => 'demo_slider_levels', 'type' => 'slider', 'title' => '语义刻度', 'desc' => '刻度可以使用业务文案并点击跳转。', 'min' => 1, 'max' => 5, 'step' => 1, 'marks' => [1 => '很低', 2 => '低', 3 => '中', 4 => '高', 5 => '很高'], 'default' => 3, 'width' => 'full'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-spinner', 'title' => 'Spinner / 步进器', 'icon' => 'ri-add-box-line',
    'fields' => [
        ['id' => 'demo_spinner_basic', 'type' => 'spinner', 'title' => '基础步进', 'min' => 0, 'max' => 20, 'step' => 1, 'default' => 5, 'width' => '1/2'],
        ['id' => 'demo_spinner_unit', 'type' => 'spinner', 'title' => '带单位', 'min' => 8, 'max' => 72, 'step' => 2, 'unit' => 'px', 'default' => 16, 'width' => '1/2'],
        ['id' => 'demo_spinner_compact', 'type' => 'spinner', 'title' => '紧凑样式', 'compact' => true, 'min' => 1, 'max' => 10, 'default' => 2, 'width' => '1/2'],
        ['id' => 'demo_spinner_vertical', 'type' => 'spinner', 'title' => '垂直按钮', 'vertical' => true, 'min' => 0, 'max' => 100, 'step' => 5, 'default' => 25, 'width' => '1/2'],
        ['id' => 'demo_spinner_negative', 'type' => 'spinner', 'title' => '负值 + 小数步长', 'desc' => '允许负值并以 0.5 为步长，适合偏移量、温度和校准参数。', 'min' => -20, 'max' => 20, 'step' => 0.5, 'unit' => 'px', 'default' => -2.5, 'width' => 'full'],
        ['id' => 'demo_spinner_wrap', 'type' => 'spinner', 'title' => '循环步进', 'desc' => 'wrap = true：超过最大值回到最小值，低于最小值回到最大值。', 'wrap' => true, 'min' => 1, 'max' => 12, 'step' => 1, 'unit' => '月', 'default' => 12, 'width' => 'full'],
        ['id' => 'demo_spinner_percent', 'type' => 'spinner', 'title' => '百分比步进器', 'desc' => '以 5% 为步长调整比例。', 'min' => 0, 'max' => 100, 'step' => 5, 'unit' => '%', 'default' => 75, 'width' => '1/2'],
        ['id' => 'demo_spinner_decimal', 'type' => 'spinner', 'title' => '精细数值步进', 'desc' => '紧凑模式下以 0.01 步进。', 'compact' => true, 'min' => 0, 'max' => 1, 'step' => 0.01, 'default' => 0.25, 'width' => '1/2'],
        ['id' => 'demo_spinner_disabled', 'type' => 'spinner', 'title' => '禁用步进器', 'disabled' => true, 'min' => 0, 'max' => 10, 'default' => 4, 'width' => 'full'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-date', 'title' => 'Date / 日期', 'icon' => 'ri-calendar-line',
    'fields' => [
        ['id' => 'demo_date_basic', 'type' => 'date', 'title' => '选择日期', 'default' => current_time('Y-m-d'), 'format' => 'Y-m-d', 'width' => '1/2'],
        ['id' => 'demo_date_limit', 'type' => 'date', 'title' => '日期范围限制', 'min_date' => '2026-01-01', 'max_date' => '2027-12-31', 'placeholder' => '请选择有效日期', 'width' => '1/2'],
        ['id' => 'demo_date_range', 'type' => 'date', 'title' => '日期区间', 'range' => true, 'default' => ['2026-08-01', '2026-08-07'], 'width' => '1/2'],
        ['id' => 'demo_date_disabled', 'type' => 'date', 'title' => '禁用状态', 'disabled' => true, 'default' => '2026-08-03', 'width' => '1/2'],
        ['id' => 'demo_date_presets', 'type' => 'date', 'title' => '快捷日期', 'desc' => '日历底部提供今天、项目开始日和截止日快捷选项。', 'presets' => [current_time('Y-m-d') => '今天', '2026-09-01' => '项目开始', '2026-12-31' => '项目截止'], 'default' => '2026-09-01', 'width' => 'full'],
        ['id' => 'demo_date_business', 'type' => 'date', 'title' => '工作日选择', 'desc' => '禁用周六、周日和指定节假日。', 'disabled_weekdays' => [0, 6], 'disabled_dates' => ['2026-10-01', '2026-10-02', '2026-10-03'], 'default' => '2026-09-30', 'width' => 'full'],
        ['id' => 'demo_date_display_format', 'type' => 'date', 'title' => '显示格式与保存格式', 'desc' => '界面显示中文日期，保存值仍使用标准 Y-m-d。', 'display_format' => 'Y年m月d日', 'return_format' => 'Y-m-d', 'default' => '2026-08-26', 'width' => '1/2'],
        ['id' => 'demo_date_month_range', 'type' => 'date', 'title' => '活动周期', 'desc' => '带最小/最大日期的区间选择。', 'range' => true, 'min_date' => '2026-08-01', 'max_date' => '2026-12-31', 'default' => ['2026-09-01', '2026-09-30'], 'width' => '1/2'],
        ['id' => 'demo_date_empty', 'type' => 'date', 'title' => '可清空日期', 'desc' => '无默认值，用户可选择后再清除。', 'placeholder' => '尚未安排日期', 'default' => '', 'width' => 'full'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-datetime', 'title' => 'Datetime / 日期时间', 'icon' => 'ri-calendar-schedule-line',
    'fields' => [
        ['id' => 'demo_datetime_basic', 'type' => 'datetime', 'title' => '日期与时间', 'default' => current_time('Y-m-d H:i'), 'format' => 'Y-m-d H:i', 'width' => '1/2'],
        ['id' => 'demo_datetime_seconds', 'type' => 'datetime', 'title' => '显示秒', 'show_seconds' => true, 'format' => 'Y-m-d H:i:s', 'default' => current_time('Y-m-d H:i:s'), 'width' => '1/2'],
        ['id' => 'demo_datetime_range', 'type' => 'datetime', 'title' => '日期时间区间', 'range' => true, 'default' => ['2026-08-03 09:00', '2026-08-03 18:00'], 'width' => '1/2'],
        ['id' => 'demo_datetime_disabled', 'type' => 'datetime', 'title' => '禁用状态', 'disabled' => true, 'default' => '2026-08-03 12:30', 'width' => '1/2'],
        ['id' => 'demo_datetime_limit', 'type' => 'datetime', 'title' => '时间范围 + 秒', 'desc' => '限制可选时间范围，并显示秒级精度。', 'min_date' => '2026-08-01 08:00', 'max_date' => '2026-12-31 18:00', 'show_seconds' => true, 'minute_step' => 15, 'second_step' => 10, 'format' => 'Y-m-d H:i:s', 'default' => '2026-08-26 10:30:00', 'width' => 'full'],
        ['id' => 'demo_datetime_slots', 'type' => 'datetime', 'title' => '预约时间段', 'desc' => '15 分钟一个时间槽，并禁用周末。', 'minute_step' => 15, 'disabled_weekdays' => [0, 6], 'min_date' => '2026-08-01 09:00', 'max_date' => '2026-12-31 18:00', 'default' => '2026-08-26 10:15', 'width' => '1/2'],
        ['id' => 'demo_datetime_custom_format', 'type' => 'datetime', 'title' => '自定义显示格式', 'desc' => '显示中文日期时间，保存标准格式。', 'display_format' => 'Y年m月d日 H:i', 'return_format' => 'Y-m-d H:i', 'default' => '2026-08-26 14:30', 'width' => '1/2'],
        ['id' => 'demo_datetime_empty', 'type' => 'datetime', 'title' => '可清空日期时间', 'placeholder' => '请选择执行时间', 'default' => '', 'width' => 'full'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-link', 'title' => 'Link / 链接', 'icon' => 'ri-links-line',
    'fields' => [
        ['id' => 'demo_link_basic', 'type' => 'link', 'title' => '结构化链接', 'desc' => '保存 URL、链接文字、打开方式、rel、title 与页面 ID。', 'default' => ['url' => 'https://example.com', 'text' => '访问示例站点', 'target' => '_blank', 'rel' => 'nofollow', 'title' => '示例链接', 'page' => 0]],
        ['id' => 'demo_link_empty', 'type' => 'link', 'title' => '空链接', 'placeholder' => 'https://your-site.com'],
        ['id' => 'demo_link_disabled', 'type' => 'link', 'title' => '禁用状态', 'disabled' => true, 'default' => ['url' => 'https://example.com/docs', 'text' => '帮助文档', 'target' => '_self']],
        ['id' => 'demo_link_external', 'type' => 'link', 'title' => '外部链接 + 复制', 'desc' => '自定义打开方式、rel 安全属性和复制链接操作。', 'copyable' => true, 'targets' => ['_blank' => '新窗口打开', '_self' => '当前窗口'], 'default' => ['url' => 'https://developer.wordpress.org', 'text' => 'WordPress 开发文档', 'target' => '_blank', 'rel' => 'noopener noreferrer', 'title' => '打开开发文档']],
        ['id' => 'demo_link_download', 'type' => 'link', 'title' => '下载链接', 'desc' => 'download = true：显示下载行为开关，适合文件、模板和资源链接。', 'download' => true, 'copyable' => true, 'default' => ['url' => 'https://example.com/assets/eva-guide.pdf', 'text' => '下载使用指南', 'target' => '_self', 'rel' => 'nofollow', 'download' => true], 'width' => '1/2'],
        ['id' => 'demo_link_minimal', 'type' => 'link', 'title' => '简化链接字段', 'desc' => '隐藏 Title、Rel 和页面 ID，只保留 URL、文字与打开方式。', 'show_title' => false, 'show_rel' => false, 'show_page' => false, 'default' => ['url' => 'https://example.com', 'text' => '查看详情', 'target' => '_blank'], 'width' => '1/2'],
        ['id' => 'demo_link_internal', 'type' => 'link', 'title' => '站内资源链接', 'desc' => '选择文章、页面、分类或标签后自动填充 URL、标题和资源 ID。', 'internal_picker' => true, 'copyable' => true, 'default' => ['url' => '', 'text' => '', 'target' => '_self', 'rel' => '', 'title' => '', 'page' => 0, 'resource_type' => '', 'resource_id' => 0], 'width' => 'full'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-link-color', 'title' => 'Link Color / 链接颜色', 'icon' => 'ri-palette-line',
    'fields' => [
        ['id' => 'demo_link_color', 'type' => 'link_color', 'title' => '四态链接颜色', 'desc' => '分别设置默认、悬停、激活与已访问状态。', 'default' => ['normal' => '#2563EB', 'hover' => '#EC4899', 'active' => '#E11D48', 'visited' => '#8B5CF6'], 'presets' => ['#2563EB', '#EC4899', '#E11D48', '#8B5CF6', '#0EA5E9', '#22C55E']],
        ['id' => 'demo_link_color_solid', 'type' => 'link_color', 'title' => '纯色模式', 'alpha' => false, 'default' => ['normal' => '#111827', 'hover' => '#FF4D7F', 'active' => '#E11D48', 'visited' => '#7C3AED']],
        ['id' => 'demo_link_color_alpha', 'type' => 'link_color', 'title' => '透明度 + 复制色值', 'desc' => '支持 8 位 HEX 透明度，并为每个链接状态提供复制按钮。', 'alpha' => true, 'copyable' => true, 'default' => ['normal' => '#2563EBCC', 'hover' => '#1D4ED8FF', 'active' => '#1E40AACC', 'visited' => '#7C3AEDAA'], 'presets' => ['#2563EB', '#1D4ED8', '#1E40AF', '#7C3AED'], 'width' => '1/2'],
        ['id' => 'demo_link_color_basic', 'type' => 'link_color', 'title' => '基础 + 悬停状态', 'desc' => '只展示默认和悬停颜色，适合简单链接或按钮文字。', 'states' => ['normal', 'hover'], 'labels' => ['normal' => '默认颜色', 'hover' => '悬停颜色'], 'preview' => true, 'default' => ['normal' => '#0EA5E9', 'hover' => '#0369A1'], 'presets' => ['#0EA5E9', '#0369A1', '#14B8A6', '#0F766E'], 'width' => '1/2'],
        ['id' => 'demo_link_color_button', 'type' => 'link_color', 'title' => '按钮交互状态', 'desc' => '完整配置按钮文字在默认、悬停、激活和已访问状态下的颜色。', 'copyable' => true, 'labels' => ['normal' => '默认', 'hover' => '悬停', 'active' => '按下', 'visited' => '已访问'], 'default' => ['normal' => '#FFFFFF', 'hover' => '#FFFFFF', 'active' => '#E2E8F0', 'visited' => '#F8FAFC'], 'presets' => ['#FFFFFF', '#E2E8F0', '#111827', '#FF4D7F'], 'width' => 'full'],
    ],
]);

// 商业化字段覆盖：结构化字段、设计系统字段与 CSS 输出字段。
\Eva::createSection('eva_demo', [
    'id' => 'field-group', 'title' => 'Group / 字段组', 'icon' => 'ri-layout-grid-line',
    'fields' => [
        [
            'id' => 'demo_group', 'type' => 'group', 'title' => '固定结构配置',
            'desc' => '适合套餐、卡片、模块设置等固定结构数据，子字段支持栅格宽度和独立清洗。',
            'heading' => '商业套餐', 'description' => '一个字段保存一组结构化配置。',
            'default' => ['name' => '专业版', 'slug' => 'pro', 'enabled' => true, 'accent' => '#FF4D7F'],
            'fields' => [
                ['id' => 'name', 'type' => 'text', 'title' => '套餐名称', 'width' => '1/2'],
                ['id' => 'slug', 'type' => 'text', 'title' => '标识', 'width' => '1/2'],
                ['id' => 'enabled', 'type' => 'switcher', 'title' => '启用套餐', 'width' => '1/2'],
                ['id' => 'accent', 'type' => 'color', 'title' => '强调色', 'width' => '1/2'],
            ],
        ],
        [
            'id' => 'demo_group_collapsible', 'type' => 'group', 'title' => '可折叠字段组',
            'desc' => '点击标题可收起或展开，适合设置页中的高级选项。', 'heading' => '高级选项', 'description' => '需要时展开详细配置。', 'collapsible' => true, 'compact' => true, 'default' => ['enabled' => true, 'mode' => 'advanced', 'note' => '仅在高级模式下显示。'], 'width' => '1/2',
            'fields' => [
                ['id' => 'enabled', 'type' => 'switcher', 'title' => '启用高级模式', 'width' => 'full'],
                ['id' => 'mode', 'type' => 'select', 'title' => '模式', 'options' => ['basic' => '基础', 'advanced' => '高级'], 'default' => 'advanced', 'width' => 'full'],
                ['id' => 'note', 'type' => 'textarea', 'title' => '说明', 'rows' => 2, 'width' => 'full'],
            ],
        ],
        [
            'id' => 'demo_group_readonly', 'type' => 'group', 'title' => '只读字段组',
            'desc' => 'disabled = true 时整个字段组及其子字段统一只读。', 'heading' => '系统信息', 'description' => '这些值由系统维护。', 'disabled' => true, 'default' => ['version' => 'v2.1.0', 'channel' => '稳定版', 'verified' => true], 'width' => '1/2',
            'fields' => [
                ['id' => 'version', 'type' => 'text', 'title' => '版本', 'width' => '1/2'],
                ['id' => 'channel', 'type' => 'text', 'title' => '发布通道', 'width' => '1/2'],
                ['id' => 'verified', 'type' => 'switcher', 'title' => '已验证', 'width' => '1/2'],
            ],
        ],
        [
            'id' => 'demo_group_nested', 'type' => 'group', 'title' => '嵌套字段组',
            'desc' => '字段组可以嵌套字段组，适合组织多层设置对象。', 'heading' => '站点设置', 'description' => '基础信息与外观配置分组管理。', 'show_child_meta' => true, 'default' => ['site' => ['name' => 'Eva Demo', 'tagline' => 'Build better settings'], 'theme' => ['dark' => false, 'accent' => '#FF4D7F']], 'width' => 'full',
            'fields' => [
                ['id' => 'site', 'type' => 'group', 'title' => '站点信息', 'heading' => '站点信息', 'description' => '名称与副标题。', 'fields' => [
                    ['id' => 'name', 'type' => 'text', 'title' => '站点名称', 'width' => '1/2'],
                    ['id' => 'tagline', 'type' => 'text', 'title' => '副标题', 'width' => '1/2'],
                ], 'width' => 'full'],
                ['id' => 'theme', 'type' => 'group', 'title' => '主题设置', 'heading' => '主题设置', 'fields' => [
                    ['id' => 'dark', 'type' => 'switcher', 'title' => '深色模式', 'width' => '1/2'],
                    ['id' => 'accent', 'type' => 'color', 'title' => '主题色', 'width' => '1/2'],
                ], 'width' => 'full'],
            ],
        ],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-repeater', 'title' => 'Repeater / 重复器', 'icon' => 'ri-list-unordered',
    'fields' => [
        [
            'id' => 'demo_repeater', 'type' => 'repeater', 'title' => '功能列表',
            'desc' => '支持新增、删除、复制、折叠和上下排序，可限制最少与最多行数。',
            'min' => 1, 'max' => 8, 'title_field' => 'name', 'item_title' => '功能', 'button_title' => '添加功能',
            'default' => [
                ['name' => '内容管理', 'icon' => 'ri-file-list-3-line', 'url' => '/content', 'enabled' => true],
                ['name' => '会员系统', 'icon' => 'ri-user-star-line', 'url' => '/members', 'enabled' => true],
            ],
            'fields' => [
                ['id' => 'name', 'type' => 'text', 'title' => '名称', 'width' => '1/2'],
                ['id' => 'url', 'type' => 'text', 'input_type' => 'url', 'title' => '链接', 'width' => '1/2'],
                ['id' => 'icon', 'type' => 'icon', 'title' => '图标', 'width' => '1/2'],
                ['id' => 'enabled', 'type' => 'switcher', 'title' => '启用', 'default' => true, 'width' => '1/2'],
            ],
        ],
        [
            'id' => 'demo_repeater_cards', 'type' => 'repeater', 'title' => '内容卡片列表',
            'desc' => '通过 title_field 显示行标题，支持折叠、复制和上下排序；最多 6 条。',
            'max' => 6, 'title_field' => 'title', 'item_title' => '内容卡片', 'button_title' => '添加卡片', 'empty_text' => '还没有内容卡片',
            'default' => [
                ['title' => '安全可靠', 'summary' => '稳定的权限与数据保护能力。', 'featured' => true],
                ['title' => '灵活扩展', 'summary' => '通过模块和字段快速扩展功能。', 'featured' => false],
            ],
            'fields' => [
                ['id' => 'title', 'type' => 'text', 'title' => '卡片标题', 'width' => '1/2'],
                ['id' => 'summary', 'type' => 'textarea', 'title' => '摘要', 'rows' => 2, 'width' => '1/2'],
                ['id' => 'featured', 'type' => 'switcher', 'title' => '推荐展示', 'default' => false, 'width' => '1/2'],
            ],
            'width' => '1/2',
        ],
        [
            'id' => 'demo_repeater_pricing', 'type' => 'repeater', 'title' => '套餐价格列表',
            'desc' => 'min / max 限制套餐数量，适合价格表、服务档位和权益配置。',
            'min' => 1, 'max' => 4, 'title_field' => 'name', 'item_title' => '套餐', 'button_title' => '添加套餐',
            'default' => [
                ['name' => '基础版', 'price' => 0, 'unit' => '月', 'popular' => false],
                ['name' => '专业版', 'price' => 199, 'unit' => '月', 'popular' => true],
            ],
            'fields' => [
                ['id' => 'name', 'type' => 'text', 'title' => '套餐名称', 'width' => '1/2'],
                ['id' => 'price', 'type' => 'number', 'title' => '价格', 'min' => 0, 'step' => 1, 'width' => '1/2'],
                ['id' => 'unit', 'type' => 'text', 'title' => '周期单位', 'default' => '月', 'width' => '1/2'],
                ['id' => 'popular', 'type' => 'switcher', 'title' => '热门推荐', 'default' => false, 'width' => '1/2'],
            ],
            'width' => '1/2',
        ],
        [
            'id' => 'demo_repeater_nested', 'type' => 'repeater', 'title' => '嵌套配置列表',
            'desc' => '重复器内再嵌套重复器，保存为多层数组结构，适合模块及其子项配置。',
            'max' => 4, 'title_field' => 'module', 'item_title' => '模块', 'button_title' => '添加模块',
            'default' => [
                ['module' => '内容模块', 'enabled' => true, 'items' => [['label' => '文章'], ['label' => '分类']]],
                ['module' => '用户模块', 'enabled' => false, 'items' => [['label' => '用户资料']]],
            ],
            'fields' => [
                ['id' => 'module', 'type' => 'text', 'title' => '模块名称', 'width' => '1/2'],
                ['id' => 'enabled', 'type' => 'switcher', 'title' => '启用模块', 'default' => true, 'width' => '1/2'],
                ['id' => 'items', 'type' => 'repeater', 'title' => '子项目', 'item_title' => '子项目', 'button_title' => '添加子项目', 'max' => 8, 'fields' => [
                    ['id' => 'label', 'type' => 'text', 'title' => '名称', 'width' => 'full'],
                ], 'width' => 'full'],
            ],
            'width' => 'full',
        ],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-typography', 'title' => 'Typography / 字体排版', 'icon' => 'ri-font-size-2',
    'fields' => [
        [
            'id' => 'demo_typography', 'type' => 'typography', 'title' => '完整字体控制',
            'desc' => '字体、字号、字重、行高、字距、样式、大小写、对齐和颜色统一保存。',
            'preview_text' => 'Eva Framework 商业化字体排版预览 Typography Preview',
            'output' => '.eva-demo-typography-output',
            'default' => [
                'family' => 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                'size' => 18, 'size_unit' => 'px', 'weight' => '600', 'style' => 'normal',
                'line_height' => 1.6, 'line_height_unit' => '', 'letter_spacing' => 0, 'letter_spacing_unit' => 'px',
                'transform' => 'none', 'align' => 'left', 'color' => '#1F2937',
            ],
        ],
        [
            'id' => 'demo_typography_heading', 'type' => 'typography', 'title' => '标题排版',
            'desc' => '聚焦字体、字号、字重、行高和颜色，适合页面标题与营销 Banner。',
            'show_letter_spacing' => false, 'show_style' => false, 'show_transform' => false, 'show_align' => false,
            'preview_text' => '页面主标题 / Heading Preview', 'fonts' => ['system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' => '系统默认', 'Georgia, serif' => 'Georgia'],
            'default' => ['family' => 'Georgia, serif', 'size' => 32, 'size_unit' => 'px', 'weight' => '700', 'line_height' => 1.2, 'line_height_unit' => '', 'color' => '#0F172A'], 'width' => '1/2',
        ],
        [
            'id' => 'demo_typography_body', 'type' => 'typography', 'title' => '正文排版',
            'desc' => '聚焦字号、行高、字距和颜色，适合文章正文、说明文字与长段落。',
            'show_style' => false, 'show_transform' => false, 'show_align' => false,
            'preview_text' => '这是一段正文预览，用于观察行高、字距和阅读密度。', 'default' => ['family' => 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', 'size' => 16, 'size_unit' => 'px', 'weight' => '400', 'line_height' => 1.75, 'line_height_unit' => '', 'letter_spacing' => 0, 'letter_spacing_unit' => 'px', 'color' => '#475569'], 'width' => '1/2',
        ],
        [
            'id' => 'demo_typography_label', 'type' => 'typography', 'title' => '标签与强调文本',
            'desc' => '演示斜体、大小写转换、对齐和响应式字号单位，适合徽章、按钮和小标题。',
            'show_line_height' => false, 'show_letter_spacing' => false,
            'preview_text' => 'LABEL / 强调文本', 'default' => ['family' => 'Arial, sans-serif', 'size' => 12, 'size_unit' => 'rem', 'weight' => '700', 'style' => 'italic', 'transform' => 'uppercase', 'align' => 'center', 'color' => '#E11D48'], 'width' => 'full',
        ],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-spacing', 'title' => 'Spacing / 间距', 'icon' => 'ri-expand-up-down-line',
    'fields' => [
        ['id' => 'demo_padding', 'type' => 'spacing', 'title' => '内边距', 'desc' => '四向输入、单位切换和数值联动。', 'output' => '.eva-demo-card', 'output_mode' => 'padding', 'default' => ['top' => 16, 'right' => 20, 'bottom' => 16, 'left' => 20, 'unit' => 'px', 'linked' => false], 'width' => '1/2'],
        ['id' => 'demo_margin', 'type' => 'spacing', 'title' => '外边距', 'output' => '.eva-demo-card', 'output_mode' => 'margin', 'default' => ['top' => 12, 'right' => 0, 'bottom' => 12, 'left' => 0, 'unit' => 'px', 'linked' => false], 'width' => '1/2'],
        ['id' => 'demo_spacing_linked', 'type' => 'spacing', 'title' => '四向联动间距', 'desc' => '开启 linked 后修改任意一侧，四个方向同步更新，适合统一内外边距。', 'output' => '.eva-demo-card', 'output_mode' => 'padding', 'units' => ['px', 'rem', '%'], 'default' => ['top' => 24, 'right' => 24, 'bottom' => 24, 'left' => 24, 'unit' => 'px', 'linked' => true], 'width' => '1/2'],
        ['id' => 'demo_spacing_vertical', 'type' => 'spacing', 'title' => '仅上下间距', 'desc' => '隐藏左右输入，只配置上下间距，适合文章流和区块之间的垂直节奏。', 'output' => '.eva-demo-card', 'output_mode' => 'margin', 'show_left' => false, 'show_right' => false, 'show_link' => false, 'units' => ['px', 'rem', 'vh'], 'default' => ['top' => 20, 'right' => 0, 'bottom' => 20, 'left' => 0, 'unit' => 'px', 'linked' => false], 'width' => '1/2'],
        ['id' => 'demo_spacing_negative', 'type' => 'spacing', 'title' => '负外边距 + 响应式单位', 'desc' => '外边距允许负值，支持 rem、%、vw 和 vh，适合叠层、偏移和响应式布局。', 'output' => '.eva-demo-card', 'output_mode' => 'margin', 'min' => -120, 'units' => ['px', 'rem', '%', 'vw', 'vh'], 'default' => ['top' => -8, 'right' => 0, 'bottom' => 16, 'left' => 0, 'unit' => 'px', 'linked' => false], 'width' => 'full'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-dimensions', 'title' => 'Dimensions / 尺寸', 'icon' => 'ri-ruler-line',
    'fields' => [
        ['id' => 'demo_dimensions', 'type' => 'dimensions', 'title' => '元素尺寸', 'desc' => '宽度、高度、最小宽度和最大宽度。', 'output' => '.eva-demo-card', 'default' => ['width' => 720, 'height' => '', 'min_width' => 280, 'max_width' => 1200, 'unit' => 'px', 'linked' => false]],
        ['id' => 'demo_dimensions_size', 'type' => 'dimensions', 'title' => '宽度 + 高度', 'desc' => '只展示基础宽高和单位，适合固定尺寸的卡片、图片或容器。', 'show_min_width' => false, 'show_max_width' => false, 'units' => ['px', '%', 'vw', 'vh'], 'default' => ['width' => 640, 'height' => 360, 'min_width' => '', 'max_width' => '', 'unit' => 'px'], 'width' => '1/2'],
        ['id' => 'demo_dimensions_constraints', 'type' => 'dimensions', 'title' => '最小 / 最大尺寸', 'desc' => '只展示尺寸边界，适合响应式容器和可伸缩布局；单位可使用 px、rem、%、vw。', 'show_width' => false, 'show_height' => false, 'units' => ['px', 'rem', '%', 'vw'], 'default' => ['width' => '', 'height' => '', 'min_width' => 280, 'max_width' => 1200, 'unit' => 'px'], 'width' => '1/2'],
        ['id' => 'demo_dimensions_viewport', 'type' => 'dimensions', 'title' => '视口尺寸单位', 'desc' => '使用 vw / vh 配置随视口变化的宽高，适合首屏、弹窗和全屏模块。', 'show_min_width' => false, 'show_max_width' => false, 'units' => ['vw', 'vh', '%', 'px'], 'default' => ['width' => 80, 'height' => 60, 'min_width' => '', 'max_width' => '', 'unit' => 'vw'], 'width' => '1/2'],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-border', 'title' => 'Border / 边框', 'icon' => 'ri-checkbox-blank-line',
    'fields' => [
        [
            'id' => 'demo_border', 'type' => 'border', 'title' => '完整边框',
            'desc' => '边框样式、颜色、四向宽度与四角圆角，支持分别联动。', 'output' => '.eva-demo-card',
            'default' => [
                'style' => 'solid', 'color' => '#E5E7EB', 'unit' => 'px',
                'width' => ['top' => 1, 'right' => 1, 'bottom' => 1, 'left' => 1],
                'radius' => ['top_left' => 6, 'top_right' => 6, 'bottom_right' => 6, 'bottom_left' => 6],
                'linked_width' => true, 'linked_radius' => true,
            ],
        ],
        [
            'id' => 'demo_border_style', 'type' => 'border', 'title' => '边框样式 + 颜色',
            'desc' => '只展示样式、颜色和单位，适合快速配置实线、虚线、双线等视觉风格。', 'output' => '.eva-demo-card',
            'show_width_link' => false, 'show_width' => false, 'show_radius_link' => false, 'show_radius' => false,
            'default' => ['style' => 'dashed', 'color' => '#94A3B8', 'unit' => 'px', 'width' => ['top' => 1, 'right' => 1, 'bottom' => 1, 'left' => 1], 'radius' => ['top_left' => 0, 'top_right' => 0, 'bottom_right' => 0, 'bottom_left' => 0]], 'width' => '1/2',
        ],
        [
            'id' => 'demo_border_sides', 'type' => 'border', 'title' => '四向宽度 + 联动',
            'desc' => '分别调整上、右、下、左边框宽度；关闭联动后可做卡片强调线和单侧装饰线。', 'output' => '.eva-demo-card',
            'show_radius_link' => false, 'show_radius' => false,
            'default' => ['style' => 'solid', 'color' => '#4D96FF', 'unit' => 'px', 'width' => ['top' => 3, 'right' => 1, 'bottom' => 1, 'left' => 1], 'radius' => ['top_left' => 6, 'top_right' => 6, 'bottom_right' => 6, 'bottom_left' => 6], 'linked_width' => false], 'width' => '1/2',
        ],
        [
            'id' => 'demo_border_radius', 'type' => 'border', 'title' => '四角圆角 + 联动',
            'desc' => '独立配置四个圆角；关闭联动后可制作不对称卡片、气泡和标签形状。', 'output' => '.eva-demo-card',
            'show_width_link' => false, 'show_width' => false,
            'default' => ['style' => 'solid', 'color' => '#E2E8F0', 'unit' => 'px', 'width' => ['top' => 1, 'right' => 1, 'bottom' => 1, 'left' => 1], 'radius' => ['top_left' => 18, 'top_right' => 4, 'bottom_right' => 18, 'bottom_left' => 4], 'linked_radius' => false], 'width' => '1/2',
        ],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-background', 'title' => 'Background / 背景', 'icon' => 'ri-landscape-line',
    'fields' => [
        [
            'id' => 'demo_background', 'type' => 'background', 'title' => '完整背景',
            'desc' => '背景色、图片、重复、尺寸、位置、滚动方式和混合模式。', 'output' => '.eva-demo-card',
            'default' => ['color' => '#F8FAFC', 'image' => '', 'repeat' => 'no-repeat', 'size' => 'cover', 'position' => 'center center', 'attachment' => 'scroll', 'blend_mode' => 'normal'],
        ],
        [
            'id' => 'demo_background_solid', 'type' => 'background', 'title' => '纯色背景 + 预设',
            'desc' => '只使用背景颜色，内置预设色板，适合面板、区块和主题色配置。', 'output' => '.eva-demo-card',
            'presets' => ['#F8FAFC', '#EEF2FF', '#ECFDF5', '#FFF7ED', '#FFF1F2', '#0F172A'],
            'show_image' => false, 'show_repeat' => false, 'show_size' => false, 'show_position' => false, 'show_attachment' => false, 'show_blend_mode' => false,
            'default' => ['color' => '#EEF2FF', 'image' => '', 'repeat' => 'no-repeat', 'size' => 'cover', 'position' => 'center center', 'attachment' => 'scroll', 'blend_mode' => 'normal'], 'width' => '1/2',
        ],
        [
            'id' => 'demo_background_photo', 'type' => 'background', 'title' => '图片背景 + 固定定位',
            'desc' => 'cover 保持满铺，center center 居中，fixed 固定背景，适合首屏或沉浸式区域。', 'output' => '.eva-demo-card',
            'show_repeat' => false, 'show_blend_mode' => false,
            'default' => ['color' => '#0F172A', 'image' => '', 'repeat' => 'no-repeat', 'size' => 'cover', 'position' => 'center center', 'attachment' => 'fixed', 'blend_mode' => 'normal'], 'width' => '1/2',
        ],
        [
            'id' => 'demo_background_pattern', 'type' => 'background', 'title' => '平铺纹理 + 混合模式',
            'desc' => 'repeat / repeat-x / repeat-y 配合 multiply、overlay 等混合模式，适合纹理与装饰背景。', 'output' => '.eva-demo-card',
            'presets' => ['#FFFFFF', '#E2E8F0', '#CBD5E1', '#94A3B8'],
            'show_size' => true, 'show_position' => true, 'show_attachment' => false,
            'default' => ['color' => '#E2E8F0', 'image' => '', 'repeat' => 'repeat', 'size' => 'auto', 'position' => 'left top', 'attachment' => 'scroll', 'blend_mode' => 'multiply'], 'width' => '1/2',
        ],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-gallery', 'title' => 'Gallery / 图库', 'icon' => 'ri-gallery-line',
    'fields' => [
        [
            'id' => 'demo_gallery', 'type' => 'gallery', 'title' => '项目图库',
            'desc' => '一个图库字段，顶部按钮可切换列表、卡片和瀑布流；最多 8 张。',
            'return_type' => 'array', 'max_items' => 8, 'layout' => 'masonry', 'show_drop' => false,
            'allowed_types' => ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
            'default' => [],
        ],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-media', 'title' => 'Media / 媒体字段', 'icon' => 'ri-file-music-line',
    'fields' => [
        [
            'id' => 'demo_media_single', 'type' => 'media', 'title' => '单个附件',
            'desc' => '支持图片、视频、音频和文档，显示附件名称、大小与缩略图，保存附件 ID。',
            'media_type' => 'all', 'return_type' => 'id', 'width' => '1/2',
        ],
        [
            'id' => 'demo_media_documents', 'type' => 'media', 'title' => '文档附件',
            'desc' => '允许多个文档，最多 5 个，按 URL 数组保存。',
            'media_type' => 'document', 'multiple' => true, 'return_type' => 'url', 'max_items' => 5,
            'allowed_types' => ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip'], 'layout' => 'grid', 'group_by' => 'extension', 'width' => '1/2',
        ],
        [
            'id' => 'demo_media_gallery_layout', 'type' => 'media', 'title' => '网格图库 + 批量选择',
            'desc' => 'layout=grid：多图卡片、媒体库多选、拖拽排序和编辑元数据。',
            'media_type' => 'image', 'multiple' => true, 'return_type' => 'array', 'max_items' => 8,
            'layout' => 'grid', 'image_size' => 'medium', 'sortable' => true, 'group_by' => 'type', 'width' => 'full',
        ],
        [
            'id' => 'demo_media_external', 'type' => 'media', 'title' => '外部媒体 URL',
            'desc' => '支持从媒体库选择、本地上传，也可以直接添加 http(s) 外部地址。',
            'media_type' => 'image', 'return_type' => 'object', 'allow_external' => true, 'width' => '1/2',
        ],
        [
            'id' => 'demo_media_dimension_limit', 'type' => 'media', 'title' => '图片尺寸校验',
            'desc' => '上传图片时校验宽度范围；当前限制为 320px 至 2400px。',
            'media_type' => 'image', 'return_type' => 'id', 'min_width' => 320, 'max_width' => 2400, 'max_size' => 8, 'width' => '1/2',
        ],
        [
            'id' => 'demo_media_video_audio', 'type' => 'media', 'title' => '视频 / 音频附件',
            'desc' => '统一媒体选择器也支持视频、音频附件，并按文件类型显示对应图标。',
            'media_type' => 'video,audio', 'multiple' => true, 'return_type' => 'array', 'max_items' => 4, 'layout' => 'compact', 'width' => 'full',
        ],
        [
            'id' => 'demo_media_metadata', 'type' => 'media', 'title' => '媒体信息编辑',
            'desc' => '选择已有附件后可编辑标题、替代文字、说明和图片焦点位置。',
            'media_type' => 'image', 'return_type' => 'object', 'editable_meta' => true, 'image_size' => 'large', 'width' => '1/2',
        ],
        [
            'id' => 'demo_media_batch_url', 'type' => 'media', 'title' => '批量 URL 拉取',
            'desc' => '每行输入一个远程 URL，批量下载并注册到 WordPress 媒体库。',
            'media_type' => 'image', 'multiple' => true, 'return_type' => 'array', 'max_items' => 10, 'allow_batch_url' => true, 'width' => '1/2',
        ],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-sorter', 'title' => 'Sorter / Sortable 排序字段', 'icon' => 'ri-drag-move-2-line',
    'fields' => [
        [
            'id' => 'demo_sorter_dual', 'type' => 'sorter', 'title' => '首页模块',
            'desc' => '在启用与禁用区域之间拖拽，也可在区域内调整顺序。',
            'enabled_title' => '已启用模块', 'disabled_title' => '未启用模块',
            'options' => [
                'hero' => ['label' => '首屏横幅', 'icon' => 'ri-layout-top-line'],
                'featured' => ['label' => '精选内容', 'icon' => 'ri-star-line'],
                'products' => ['label' => '产品列表', 'icon' => 'ri-shopping-bag-3-line'],
                'news' => ['label' => '新闻动态', 'icon' => 'ri-newspaper-line'],
                'contact' => ['label' => '联系我们', 'icon' => 'ri-contacts-line'],
            ],
            'default' => ['enabled' => ['hero', 'featured', 'products'], 'disabled' => ['news', 'contact']],
            'width' => '1/2',
        ],
        [
            'id' => 'demo_sorter_single', 'type' => 'sorter', 'title' => '文章元素顺序',
            'desc' => '单列表拖拽排序，可用于文章、侧边栏或产品详情元素。',
            'mode' => 'single', 'list_title' => '显示顺序',
            'options' => ['title' => '标题', 'meta' => '文章信息', 'cover' => '封面图', 'content' => '正文', 'related' => '相关文章'],
            'default' => ['title', 'meta', 'cover', 'content', 'related'], 'width' => '1/2',
        ],
        [
            'id' => 'demo_sorter_icons', 'type' => 'sorter', 'title' => '图标模块排序',
            'desc' => '选项支持图标、启用区/禁用区自定义标题和跨区域移动。',
            'enabled_title' => '当前启用', 'disabled_title' => '候选模块', 'searchable' => true, 'min_enabled' => 1, 'max_enabled' => 3,
            'options' => [
                'hero' => ['label' => '首屏横幅', 'icon' => 'ri-layout-top-line'],
                'news' => ['label' => '新闻列表', 'icon' => 'ri-newspaper-line'],
                'gallery' => ['label' => '图片画廊', 'icon' => 'ri-gallery-line'],
                'comments' => ['label' => '评论区', 'icon' => 'ri-chat-3-line'],
                'contact' => ['label' => '联系信息', 'icon' => 'ri-contacts-line', 'locked' => true],
            ],
            'default' => ['enabled' => ['hero', 'news'], 'disabled' => ['gallery', 'comments', 'contact']], 'width' => '1/2',
        ],
        [
            'id' => 'demo_sorter_no_reset', 'type' => 'sorter', 'title' => '无恢复按钮',
            'desc' => 'show_reset=false：只提供拖拽、上下移动和排序结果保存。',
            'mode' => 'single', 'show_reset' => false, 'list_title' => '展示顺序',
            'options' => ['overview' => '产品概览', 'features' => '功能特点', 'pricing' => '价格方案', 'faq' => '常见问题'],
            'default' => ['overview', 'features', 'pricing', 'faq'], 'width' => '1/2',
        ],
        [
            'id' => 'demo_sorter_order_button', 'type' => 'sorter', 'title' => '升序 / 降序按钮',
            'desc' => '点击列表标题右侧的排序图标，可按项目名称在升序和降序之间切换。',
            'mode' => 'single', 'sort_by' => 'value', 'list_title' => '按标识排序',
            'options' => ['zebra' => 'Zebra 模块', 'alpha' => 'Alpha 模块', 'gamma' => 'Gamma 模块', 'beta' => 'Beta 模块'],
            'default' => ['zebra', 'alpha', 'gamma', 'beta'], 'width' => '1/2',
        ],
        [
            'id' => 'demo_sorter_disabled', 'type' => 'sorter', 'title' => '禁用状态',
            'desc' => 'disabled=true：保留当前排序结果，但不允许拖拽、移动或跨区域切换。',
            'disabled' => true, 'mode' => 'single', 'list_title' => '固定顺序',
            'options' => ['header' => ['label' => '页头', 'icon' => 'ri-layout-top-line'], 'main' => ['label' => '主要内容', 'icon' => 'ri-file-text-line'], 'footer' => ['label' => '页脚', 'icon' => 'ri-layout-bottom-line']],
            'default' => ['header', 'main', 'footer'], 'width' => '1/2',
        ],
        [
            'id' => 'demo_sorter_empty_dual', 'type' => 'sorter', 'title' => '空启用区示例',
            'desc' => '启用区可以为空，模块从候选区拖入后再调整顺序。',
            'enabled_title' => '已选模块', 'disabled_title' => '可用模块', 'searchable' => true, 'max_enabled' => 3,
            'options' => ['search' => '搜索', 'filter' => '筛选器', 'sort' => '排序', 'export' => '导出', 'bulk' => '批量操作'],
            'default' => ['enabled' => [], 'disabled' => ['search', 'filter', 'sort', 'export', 'bulk']], 'width' => 'full',
        ],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-wp-editor', 'title' => 'WP Editor / 富文本编辑器', 'icon' => 'ri-file-edit-line',
    'fields' => [
        [
            'id' => 'demo_wp_editor', 'type' => 'wp_editor', 'title' => '内容编辑器',
            'desc' => '接入 WordPress TinyMCE，支持可视化/文本模式、媒体按钮和完整工具栏。',
            'toolbar' => 'full', 'media_buttons' => true, 'rows' => 14,
            'default' => '<h2>欢迎使用 Eva Framework</h2><p>这里可以编辑图文内容。</p>',
        ],
        [
            'id' => 'demo_editor_repeater', 'type' => 'repeater', 'title' => '重复器内编辑器',
            'desc' => '用于验证动态新增、复制、删除时 TinyMCE 能正确初始化和销毁。',
            'max' => 4, 'button_title' => '添加内容块', 'title_field' => 'heading',
            'fields' => [
                ['id' => 'heading', 'type' => 'text', 'title' => '标题', 'width' => '1/3'],
                ['id' => 'body', 'type' => 'wp_editor', 'title' => '正文', 'toolbar' => 'basic', 'media_buttons' => true, 'rows' => 8, 'width' => '2/3'],
            ],
        ],
    ],
]);
\Eva::createSection('eva_demo', [
    'id' => 'field-code-editor', 'title' => 'Code Editor / 代码编辑器', 'icon' => 'ri-code-s-slash-line',
    'fields' => [
        ['id' => 'demo_code_html', 'type' => 'code_editor', 'title' => 'HTML', 'mode' => 'html', 'rows' => 12, 'default' => '<section class="hero">Eva Framework</section>', 'width' => '1/2'],
        ['id' => 'demo_code_css', 'type' => 'code_editor', 'title' => 'CSS（基础校验）', 'mode' => 'css', 'rows' => 12, 'default' => ".hero {\n  color: #ff758c;\n}", 'width' => '1/2'],
        ['id' => 'demo_code_js', 'type' => 'code_editor', 'title' => 'JavaScript', 'mode' => 'javascript', 'rows' => 12, 'default' => "document.addEventListener('DOMContentLoaded', () => {\n  console.log('Eva ready');\n});", 'width' => '1/2'],
        ['id' => 'demo_code_php', 'type' => 'code_editor', 'title' => 'PHP', 'mode' => 'php', 'rows' => 12, 'default' => "<?php\necho esc_html(get_bloginfo('name'));", 'width' => '1/2'],
        ['id' => 'demo_code_json', 'type' => 'code_editor', 'title' => 'JSON（基础校验）', 'mode' => 'json', 'rows' => 12, 'default' => "{\n  \"framework\": \"Eva\",\n  \"enabled\": true\n}", 'width' => 'full'],
    ],
]);

// 用户资料页示例：对齐 CSF::createProfileOptions 的写法，值保存到 user_meta。
\Eva::createProfileOptions('eva_demo_profile', [
    'data_type'  => 'serialize',
    'capability' => 'edit_user',
]);
\Eva::createSection('eva_demo_profile', [
    'id'          => 'profile-about',
    'title'       => '个人信息',
    'description' => '这些字段只属于当前用户，保存后写入 user_meta，不会混入主题全局设置。',
    'fields'      => [
        [
            'id'          => 'profile_signature',
            'type'        => 'textarea',
            'title'       => '个人签名',
            'desc'        => '用于评论、作者卡片或个人主页简介。',
            'placeholder' => '介绍一下自己…',
            'maxlength'   => 160,
            'show_counter' => true,
            'width'       => 'full',
        ],
        [
            'id'         => 'profile_website',
            'type'       => 'text',
            'title'      => '个人网站',
            'desc'       => '可填写站点、作品集或社交主页地址。',
            'input_type' => 'url',
            'placeholder' => 'https://example.com',
            'validate'   => 'url',
            'width'      => '1/2',
        ],
        [
            'id'      => 'profile_job_title',
            'type'    => 'text',
            'title'   => '职业 / 职位',
            'default' => '内容创作者',
            'width'   => '1/2',
        ],
        [
            'id'          => 'profile_avatar',
            'type'        => 'media',
            'title'       => '个人头像',
            'desc'        => '可从媒体库选择一张图片；返回附件 ID。',
            'media_type'  => 'image',
            'return_type' => 'id',
            'max_items'   => 1,
            'layout'      => 'compact',
            'width'       => '1/2',
        ],
    ],
]);
\Eva::createSection('eva_demo_profile', [
    'id'          => 'profile-preferences',
    'title'       => '界面偏好',
    'description' => '每个用户可以独立保存自己的后台使用习惯。',
    'fields'      => [
        [
            'id'      => 'profile_email_notice',
            'type'    => 'switcher',
            'title'   => '邮件通知',
            'label'   => '接收重要更新和安全提醒',
            'default' => 1,
            'width'   => '1/2',
        ],
        [
            'id'      => 'profile_language',
            'type'    => 'select',
            'title'   => '偏好语言',
            'options' => [
                'zh' => '简体中文',
                'en' => 'English',
                'ja' => '日本語',
            ],
            'default' => 'zh',
            'width'   => '1/2',
        ],
        [
            'id'      => 'profile_digest',
            'type'    => 'radio',
            'title'   => '摘要频率',
            'options' => [
                'realtime' => '实时',
                'daily'    => '每日摘要',
                'weekly'   => '每周摘要',
            ],
            'default' => 'daily',
            'width'   => '1/2',
        ],
        [
            'id'         => 'profile_topics',
            'type'       => 'checkbox',
            'title'      => '关注主题',
            'desc'       => '最多选择 3 项，保存为数组。',
            'options'    => [
                'design'  => '设计',
                'wordpress' => 'WordPress',
                'frontend' => '前端开发',
                'product' => '产品',
                'security' => '安全',
            ],
            'max_select' => 3,
            'default'    => ['design', 'wordpress'],
        ],
    ],
]);

// 分类法示例：对齐 CSF::createTaxonomyOptions 的写法，值保存到 term_meta。
// 在「文章 → 分类」的新增表单里直接排在原生字段下方；编辑分类页（term.php）则由标题旁的
// 「WP 设置 / Eva 设置」切换器在原生字段行与这里的字段之间切换，两侧共用底部的「更新」按钮。
\Eva::createTaxonomyOptions('eva_demo_term', [
    'taxonomy'   => ['category', 'post_tag'],
    'data_type'  => 'serialize',
    'capability' => 'manage_categories',
]);
\Eva::createSection('eva_demo_term', [
    'id'          => 'term-display',
    'title'       => '分类展示',
    'description' => '这些字段只属于当前分类项，保存后写入 term_meta，不会混入主题全局设置。',
    'fields'      => [
        [
            'id'          => 'term_cover',
            'type'        => 'media',
            'title'       => '分类封面',
            'desc'        => '用于归档页头图；返回附件 ID。',
            'media_type'  => 'image',
            'return_type' => 'id',
            'max_items'   => 1,
            'layout'      => 'compact',
            'width'       => '1/2',
        ],
        [
            'id'      => 'term_icon',
            'type'    => 'icon',
            'title'   => '分类图标',
            'desc'    => '显示在导航和文章卡片上。',
            'width'   => '1/2',
        ],
        [
            'id'      => 'term_color',
            'type'    => 'color',
            'title'   => '主题色',
            'default' => '#ff758c',
            'width'   => '1/2',
        ],
        [
            'id'      => 'term_layout',
            'type'    => 'image_select',
            'title'   => '归档布局',
            'desc'    => '预览图与设置页的 image_select 示例共用同一批内联 SVG。',
            'options' => [
                'card' => ['label' => '卡片布局', 'url' => eva_demo_image_select_preview('card')],
                'list' => ['label' => '列表布局', 'url' => eva_demo_image_select_preview('list')],
                'grid' => ['label' => '网格布局', 'url' => eva_demo_image_select_preview('grid')],
            ],
            'default' => 'card',
            'columns' => 3,
            'width'   => 'full',
        ],
    ],
]);
\Eva::createSection('eva_demo_term', [
    'id'          => 'term-seo',
    'title'       => '分类 SEO',
    'description' => '留空则回落到主题的全局设置。',
    'fields'      => [
        [
            'id'           => 'term_seo_title',
            'type'         => 'text',
            'title'        => 'SEO 标题',
            'placeholder'  => '留空则使用分类名称',
            'maxlength'    => 60,
            'show_counter' => true,
            'width'        => 'full',
        ],
        [
            'id'           => 'term_seo_desc',
            'type'         => 'textarea',
            'title'        => 'SEO 描述',
            'placeholder'  => '留空则使用分类描述',
            'maxlength'    => 160,
            'show_counter' => true,
            'width'        => 'full',
        ],
        [
            'id'      => 'term_noindex',
            'type'    => 'switcher',
            'title'   => '禁止收录',
            'label'   => '给归档页输出 noindex',
            'default' => 0,
            'width'   => '1/2',
        ],
    ],
]);
