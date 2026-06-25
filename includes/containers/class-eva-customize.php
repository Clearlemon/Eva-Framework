<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 定制器容器（对应 CSF::createCustomizeOptions）。
 *
 * 在 Customizer 注册 section + 自定义 control（输出 Eva 嵌入式挂载点），
 * setting 类型为 option，值存 wp_options[$id]，sanitize 走 Data::sanitize_by_sections。
 *
 * 注意：Customizer 的「实时预览 / 值回写 setting」需 control 端 JS 把嵌入字段同步到
 * customize setting，此处先搭好 section/setting/control 注册与挂载点（后端就绪、前端联调）。
 *
 * @package Eva\Framework
 */
class Customize
{
    /**
     * 挂载 Customizer 注册钩子与控件区资源加载钩子。
     */
    public function __construct()
    {
        // 注册 section / setting / control。
        add_action('customize_register', [$this, 'register']);
        // 控件区（左侧面板）加载 Eva 运行时资源。
        add_action('customize_controls_enqueue_scripts', [$this, 'enqueue']);
    }

    /**
     * 向 Customizer 注册每个容器对应的 section、setting 与自定义 control。
     *
     * @param \WP_Customize_Manager $wp_customize Customizer 管理器实例。
     * @return void
     */
    public function register($wp_customize)
    {
        // control 基类（继承 WP_Customize_Control）只在 Customizer 上下文可用，延迟到此处再载入。
        require_once EVA_FW_DIR . 'includes/containers/class-eva-customize-control.php';
        // 上下文异常导致控件类未定义时，安全退出，避免致命错误。
        if (! class_exists('\\Eva\\Framework\\Eva_Customize_Control')) {
            return;
        }

        foreach (\Eva::get_customizes() as $id => $cfg) {
            // section id 加前缀避免与他人撞名。
            $section_id = 'eva_' . $id;
            $cap        = isset($cfg['capability']) ? $cfg['capability'] : 'edit_theme_options';

            // 1) 注册一个 Customizer 区块。
            $wp_customize->add_section($section_id, [
                'title'      => isset($cfg['title']) ? $cfg['title'] : $id,
                'capability' => $cap,
            ]);

            // 2) 注册 setting：type=option 表示值直接落 wp_options[$id]。
            $wp_customize->add_setting($id, [
                'type'              => 'option',
                'capability'        => $cap,
                'default'           => [],
                // 保存前清洗：兼容数组或 JSON 字符串两种提交形态，统一走全框架清洗规则。
                'sanitize_callback' => function ($value) use ($cfg) {
                    $raw = is_array($value) ? $value : (array) json_decode((string) $value, true);
                    return Data::sanitize_by_sections(isset($cfg['sections']) ? $cfg['sections'] : [], $raw);
                },
            ]);

            // 3) 注册自定义 control：渲染 Eva 嵌入式挂载点，并把容器配置经 eva_cfg 注入。
            $wp_customize->add_control(new Eva_Customize_Control($wp_customize, $id, [
                'section'  => $section_id,
                'settings' => $id,
                'label'    => isset($cfg['title']) ? $cfg['title'] : $id,
                'eva_cfg'  => $cfg,
            ]));
        }
    }

    /**
     * 存在定制器容器时，为控件区装载 Eva 运行时资源。
     *
     * @return void
     */
    public function enqueue()
    {
        if (empty(\Eva::get_customizes())) {
            return;
        }
        \Eva::enqueue_runtime();
    }
}
