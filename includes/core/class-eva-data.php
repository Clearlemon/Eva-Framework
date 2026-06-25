<?php

namespace Eva\Framework;

// 直接访问该文件时（未经 WordPress 引导）立即退出，防止源码被当作普通 PHP 执行而泄露逻辑。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 字段数据层（MVP）。
 *
 * 职责：把前端（Vue 外壳）提交上来的字段值，按「已注册的字段 schema」做 type 级清洗（sanitize），
 *       再写入 wp_options。读取（注入前端）那一侧不在这里，而在 \Eva::get_values()。
 *
 * 入口：设置页通过 AJAX(action = eva_fw_save_options) 调到本类的 ajax_save()；
 *       而 metabox / 分类法 / 导航菜单 / 评论 / 用户资料等嵌入式容器，则直接复用这里的
 *       静态方法 sanitize_by_sections() 做清洗，再各自写入对应的 meta 表。
 *
 * @package Eva\Framework
 */
class Data
{
    /**
     * 构造时挂载 AJAX 保存钩子。
     *
     * 仅注册「已登录用户」的 wp_ajax_ 动作（设置页只对后台有权限者开放，无需 nopriv）。
     */
    public function __construct()
    {
        // 绑定设置页保存动作：前端 fetch admin-ajax.php?action=eva_fw_save_options 时进入 ajax_save()。
        add_action('wp_ajax_eva_fw_save_options', [$this, 'ajax_save']);
    }

    /**
     * AJAX 回调：校验 → 清洗 → 落库，最后回吐清洗后的值给前端。
     *
     * 失败时一律以 wp_send_json_error 配合对应 HTTP 状态码返回，前端据此提示。
     *
     * @return void 直接以 JSON 响应并结束请求（wp_send_json_* 内部会 die）。
     */
    public function ajax_save()
    {
        // 1) 校验 nonce：用与前端 EvaFW.config.nonce 同名的 'eva_fw_guide' 动作，防 CSRF。
        if (! check_ajax_referer('eva_fw_guide', 'nonce', false)) {
            wp_send_json_error(['msg' => 'bad_nonce'], 403);
        }
        // 2) 校验权限：设置页保存属于站点级配置，要求 manage_options。
        if (! current_user_can('manage_options')) {
            wp_send_json_error(['msg' => 'forbidden'], 403);
        }

        // 3) 取目标设置页 id，并从注册表反查其配置（拿到 sections 用于按 schema 清洗）。
        $option_id = isset($_POST['option_id']) ? sanitize_text_field(wp_unslash($_POST['option_id'])) : '';
        $opt = \Eva::get($option_id);
        if (! $opt) {
            // 未注册的 option_id：拒绝，避免被写入任意 wp_options 键。
            wp_send_json_error(['msg' => 'unknown_option'], 400);
        }

        // 4) 解析前端提交的值（JSON 字符串 → 关联数组）；非数组一律视为空，保证后续遍历安全。
        $raw = isset($_POST['values']) ? json_decode(wp_unslash($_POST['values']), true) : [];
        if (! is_array($raw)) {
            $raw = [];
        }

        // 5) 按已注册字段 schema 逐项清洗；schema 之外的键一律丢弃，杜绝越权写入。
        $clean = self::sanitize_by_sections($opt['sections'], $raw);

        // 6) 落库：整组以 option_id 为键存进 wp_options（与 CSF 的 serialize 默认行为一致）。
        update_option($option_id, $clean);

        // 7) 回吐清洗结果，前端可据此刷新本地状态（确认实际入库的值）。
        wp_send_json_success(['values' => $clean]);
    }

    /**
     * 按一组 sections 的字段 schema 清洗提交值；未在 schema 内的键一律丢弃。
     *
     * 设计为静态方法，供设置页(AJAX) 与 metabox / 分类法 / 导航菜单 / 评论 / 用户资料等
     * 各嵌入式容器共用，保证「能存什么、怎么存」的规则全框架统一。
     *
     * @param array $sections 容器的 sections（每个含 fields[]，字段需带 id / type）。
     * @param array $raw      前端提交的原始键值（[field_id => value]）。
     * @return array          清洗后的 [field_id => value]，仅含 schema 内声明的字段。
     */
    public static function sanitize_by_sections($sections, $raw)
    {
        // 入参兜底：$raw 必须是数组，否则后续 array_key_exists 会报错。
        $raw   = is_array($raw) ? $raw : [];
        $clean = [];

        // 遍历每个分组。
        foreach ((array) $sections as $section) {
            // 没有 fields 的分组（纯标题/占位）直接跳过。
            if (empty($section['fields']) || ! is_array($section['fields'])) {
                continue;
            }
            // 遍历分组内每个字段，按其类型清洗对应的提交值。
            foreach ($section['fields'] as $field) {
                // 无 id 的字段（如纯展示型）不参与存储。
                if (empty($field['id'])) {
                    continue;
                }
                $id   = $field['id'];
                // 字段未声明 type 时按 text 处理（最保守的字符串清洗）。
                $type = isset($field['type']) ? $field['type'] : 'text';
                // 前端没提交该字段时取 null，交由 sanitize_field 决定其空值表现。
                $val  = array_key_exists($id, $raw) ? $raw[$id] : null;
                $clean[$id] = self::sanitize_field($type, $val);
            }
        }
        return $clean;
    }

    /**
     * 按字段类型清洗单个值。
     *
     * 注意（迁移须知）：当前仅覆盖 switcher / textarea / select / text 四类，其余类型都会落到
     * default 分支被强制转成字符串。对「值为数组」的字段（group/repeater/checkbox/gallery 等），
     * 这会破坏数据——迁移此类字段前必须在此补对应分支。
     *
     * @param string $type 字段类型标识。
     * @param mixed  $val  原始值（可能为 null / 标量 / 数组）。
     * @return mixed       清洗后的值。
     */
    public static function sanitize_field($type, $val)
    {
        switch ($type) {
            case 'switcher':
                // 开关：统一规整为 1 / 0，兼容布尔、整数 1、字符串 '1' 多种真值表达。
                return ($val === true || $val === 1 || $val === '1') ? 1 : 0;
            case 'textarea':
                // 多行文本：保留换行的同时去除危险标签。
                return sanitize_textarea_field((string) $val);
            case 'select':
            case 'text':
            default:
                // 其余（含未识别类型）按单行文本清洗——数组型字段在此会被损坏，详见上方注意。
                return sanitize_text_field((string) $val);
        }
    }
}
