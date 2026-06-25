<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

// WP_Widget 在 widgets_init 时已可用；本文件由 Widget::register 在该时机 require。
// 基类不存在则直接 return，避免 extends 未定义类导致致命错误。
if (! class_exists('WP_Widget')) {
    return;
}

/**
 * Eva 动态小工具：一个 Eva 小工具容器对应一个 WP_Widget 实例。
 *
 * form()   渲染 Eva 嵌入式挂载点（name 前缀用 WP 的 get_field_name，去掉末尾 []）。
 * update() 按字段 schema 清洗并作为 widget 实例存储。
 * widget() 前台输出：默认仅标题，正文交给 filter eva_widget_{id_base} 由站点决定。
 *
 * @package Eva\Framework
 */
class Eva_Widget_Instance extends \WP_Widget
{
    /** @var array 容器配置（含 title / description / sections）。 */
    protected $eva_cfg = [];

    /**
     * 构造：记录容器配置，并以 id_base / 名称 / 描述初始化 WP_Widget。
     *
     * @param string $id_base 小工具 id_base（即容器 id）。
     * @param array  $cfg     容器配置。
     */
    public function __construct($id_base = '', $cfg = [])
    {
        // 保存配置供 form/update/widget 复用。
        $this->eva_cfg = is_array($cfg) ? $cfg : [];
        // 调用父类构造：名称缺省用 id_base，描述缺省为空。
        parent::__construct(
            $id_base,
            isset($cfg['title']) ? $cfg['title'] : $id_base,
            ['description' => isset($cfg['description']) ? $cfg['description'] : '']
        );
    }

    /**
     * 后台表单：输出 Eva 嵌入式挂载点，由前端渲染字段。
     *
     * @param array $instance 当前 widget 实例已存值。
     * @return string         父类要求返回字符串（此处实际渲染已 echo，返回空串）。
     */
    public function form($instance)
    {
        // get_field_name('') => widget-{id_base}[{number}][]，去掉末尾 [] 作为字段 name 前缀。
        $prefix = preg_replace('/\[\]$/', '', $this->get_field_name(''));
        echo \Eva::embed_markup('widget', $this->eva_cfg, is_array($instance) ? $instance : [], $prefix); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        return '';
    }

    /**
     * 保存：按字段 schema 清洗新值作为 widget 实例存储。
     *
     * @param array $new_instance 新提交值。
     * @param array $old_instance 旧值（此处直接整体覆盖，不做合并）。
     * @return array              清洗后的实例数据。
     */
    public function update($new_instance, $old_instance)
    {
        return Data::sanitize_by_sections(
            isset($this->eva_cfg['sections']) ? $this->eva_cfg['sections'] : [],
            (array) $new_instance
        );
    }

    /**
     * 前台输出：包裹结构 + 可选标题 + 由 filter 决定的正文。
     *
     * @param array $args     主题注册侧栏时提供的 before/after 包裹标记。
     * @param array $instance 当前 widget 实例值。
     * @return void
     */
    public function widget($args, $instance)
    {
        // 侧栏包裹起始标记。
        echo $args['before_widget']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        // 有标题则按主题标题包裹输出。
        if (! empty($instance['title'])) {
            echo $args['before_title'] . esc_html($instance['title']) . $args['after_title']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        }
        // 正文不由框架硬编码：交给站点通过 filter eva_widget_{id_base} 自定义渲染。
        echo apply_filters('eva_widget_' . $this->id_base, '', $instance, $args); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        // 侧栏包裹结束标记。
        echo $args['after_widget']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }
}
