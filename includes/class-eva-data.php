<?php

namespace Eva\Framework;

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 字段数据层（MVP）：把前端提交的字段值按 schema 做 type 级 sanitize 后存入 wp_options。
 * 读取(注入前端)在 \Eva::get_values()，保存走本类的 AJAX(eva_fw_save_options)。
 */
class Data
{
    public function __construct()
    {
        add_action('wp_ajax_eva_fw_save_options', [$this, 'ajax_save']);
    }

    public function ajax_save()
    {
        if (! check_ajax_referer('eva_fw_guide', 'nonce', false)) {
            wp_send_json_error(['msg' => 'bad_nonce'], 403);
        }
        if (! current_user_can('manage_options')) {
            wp_send_json_error(['msg' => 'forbidden'], 403);
        }

        $option_id = isset($_POST['option_id']) ? sanitize_text_field(wp_unslash($_POST['option_id'])) : '';
        $opt = \Eva::get($option_id);
        if (! $opt) {
            wp_send_json_error(['msg' => 'unknown_option'], 400);
        }

        $raw = isset($_POST['values']) ? json_decode(wp_unslash($_POST['values']), true) : [];
        if (! is_array($raw)) {
            $raw = [];
        }

        // 按已注册的字段 schema 逐项 sanitize，未知键一律丢弃
        $clean = [];
        foreach ($opt['sections'] as $section) {
            if (empty($section['fields']) || ! is_array($section['fields'])) {
                continue;
            }
            foreach ($section['fields'] as $field) {
                if (empty($field['id'])) {
                    continue;
                }
                $id   = $field['id'];
                $type = isset($field['type']) ? $field['type'] : 'text';
                $val  = array_key_exists($id, $raw) ? $raw[$id] : null;
                $clean[$id] = self::sanitize_field($type, $val);
            }
        }

        update_option($option_id, $clean);
        wp_send_json_success(['values' => $clean]);
    }

    /** 按字段类型清洗单个值。 */
    private static function sanitize_field($type, $val)
    {
        switch ($type) {
            case 'switcher':
                return ($val === true || $val === 1 || $val === '1') ? 1 : 0;
            case 'textarea':
                return sanitize_textarea_field((string) $val);
            case 'select':
            case 'text':
            default:
                return sanitize_text_field((string) $val);
        }
    }
}
