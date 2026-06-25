<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

// WP_Customize_Control 仅在 Customizer 上下文存在；此文件由 Customize::register 在该上下文 require。
// 非 Customizer 环境（基类不存在）直接 return，避免 extends 一个未定义类导致致命错误。
if (! class_exists('WP_Customize_Control')) {
    return;
}

/**
 * Eva 自定义 Customizer 控件：渲染一个 Eva 嵌入式挂载点，
 * 由前端 eva-app 把字段渲染进去，再把值同步回该控件的 setting（前端联调）。
 *
 * @package Eva\Framework
 */
class Eva_Customize_Control extends \WP_Customize_Control
{
    /** @var string 控件类型标识（供前端 / WP 识别此控件）。 */
    public $type = 'eva_embed';

    /** @var array 由 add_control 的 args 注入的容器配置（含 sections）。 */
    public $eva_cfg = [];

    /**
     * 渲染控件内容：可选标题 + Eva 嵌入式挂载点（含当前 setting 值）。
     *
     * @return void
     */
    public function render_content()
    {
        // 取当前 setting 值作为字段初始值；非数组（未设置过）兜底为空数组。
        $values = $this->value();
        if (! is_array($values)) {
            $values = [];
        }
        // 有 label 则先输出标题。
        if (! empty($this->label)) {
            echo '<span class="customize-control-title">' . esc_html($this->label) . '</span>';
        }
        // 输出挂载点，交由前端渲染字段（embed_markup 内部已转义）。
        echo \Eva::embed_markup('customize', $this->eva_cfg, $values); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }
}
