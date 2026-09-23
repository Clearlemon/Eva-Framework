<?php

/**
 * 小工具演示（仅作示例，可整文件删除，不影响框架本体）。
 *
 * 作用：用 \Eva::createWidget 注册一个最小的经典小工具（WP_Widget），把容器那条链跑通——
 *       后台「外观 → 小工具」里出现「Eva 演示小工具」，表单是 Eva 的嵌入式字段；
 *       保存走 Eva_Widget_Instance::update()（按 section schema 清洗）；
 *       前台输出由过滤器 eva_widget_{id_base} 决定，框架本体只负责标题和侧栏包裹标记。
 *
 * 字段挑的是四类不同的清洗路径：text / textarea / color / switcher（布尔）。
 *
 * 注意：字段 id 用 title 的那个是有讲究的——Eva_Widget_Instance::widget() 读 $instance['title']
 *       作为标题，交给主题注册侧栏时给的 before_title / after_title 包裹；换成别的 id 就不会被包。
 *
 * 前提：WP 5.8 起「外观 → 小工具」默认是区块小工具编辑器，经典 WP_Widget 只能包在「旧版小工具」
 *       区块里，Eva 的 Vue 挂载点在那个环境跑不起来。需要 use_widgets_block_editor 返回 false
 *       （本地开发站由 mu-plugin 临时切着）才能看到下面这个小工具的真实表单。
 *
 * 删除方式：删掉本文件，并去掉 eva-framework.php 里对应的 require。
 * 已经拖进侧栏的实例会因为 widget 不再注册而从侧栏消失（数据留在 option 里，不会产生坏 HTML）。
 */

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

// 容器 id 即 widget 的 id_base，前台过滤器名 eva_widget_{id_base} 也由它拼出来。
\Eva::createWidget('eva_demo_widget', [
    'title'       => 'Eva 演示小工具',
    'description' => '用 Eva 字段配置的经典小工具，演示 createWidget 的表单 / 保存 / 前台输出三段。',
    // classname：前台小工具外层容器的 class；不写时 WP 用 widget_{id_base}。
    'classname'   => 'eva-demo-widget',
]);

\Eva::createSection('eva_demo_widget', [
    'fields' => [
        // id 必须是 title，才会走主题的标题包裹标记，见文件头说明。
        ['id' => 'title', 'type' => 'text', 'title' => '标题', 'default' => 'Eva 小工具'],
        ['id' => 'content', 'type' => 'textarea', 'title' => '正文', 'placeholder' => '支持换行，前台按纯文本输出'],
        ['id' => 'accent', 'type' => 'color', 'title' => '强调色', 'default' => '#ff758c'],
        ['id' => 'bordered', 'type' => 'switcher', 'title' => '显示左侧强调条', 'default' => true],
    ],
]);

/**
 * 前台输出：框架本体不硬编码正文结构，全部交给这里。
 *
 * @param string $html     上游内容（框架传空串）。
 * @param array  $instance 当前小工具实例已清洗的值。
 * @return string          正文 HTML（标题和侧栏包裹由框架输出，这里不用管）。
 */
add_filter('eva_widget_eva_demo_widget', static function ($html, $instance) {
    $content = isset($instance['content']) ? (string) $instance['content'] : '';

    // 没填正文就什么都不输出，避免前台留一个空盒子。
    if ($content === '') {
        return $html;
    }

    // 颜色值会拼进内联样式，按十六进制校验，非法值回落到默认主色。
    $accent = isset($instance['accent']) ? sanitize_hex_color((string) $instance['accent']) : '';
    $accent = $accent ? $accent : '#ff758c';

    // switcher 存的是 1 / 0（或 true / false），统一按真假判断。
    $style = ! empty($instance['bordered'])
        ? sprintf('border-left:3px solid %s;padding-left:10px;', esc_attr($accent))
        : '';

    // 正文按纯文本处理：转义之后再把换行还原成 <br>，不允许用户写 HTML。
    return $html . sprintf(
        '<div class="eva-demo-widget-body" style="%s">%s</div>',
        esc_attr($style),
        nl2br(esc_html($content))
    );
}, 10, 2);
