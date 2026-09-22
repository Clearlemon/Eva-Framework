<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * text 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/Text/Text.js`，负责单行文本在保存前的清洗。
 */
class Text
{
    /**
     * 功能：把任意输入规整为安全的单行文本。
     *
     * @param mixed $value 原始字段值。
     * @param array $field 字段配置。
     * @return string
     */
    public static function sanitize($value, $field = [])
    {
        $value = is_scalar($value) ? (string) $value : '';
        $transform = isset($field['transform']) ? sanitize_key((string) $field['transform']) : '';

        if ($transform === 'trim') {
            $value = trim($value);
        } elseif ($transform === 'slug') {
            $value = sanitize_title($value);
        } elseif ($transform === 'uppercase') {
            $value = function_exists('mb_strtoupper') ? mb_strtoupper($value, 'UTF-8') : strtoupper($value);
        } elseif ($transform === 'lowercase') {
            $value = function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
        } elseif ($transform === 'numeric') {
            $value = preg_replace('/[^0-9+.-]/', '', $value);
        } elseif ($transform === 'alphanumeric') {
            $value = preg_replace('/[^a-z0-9]/i', '', $value);
        }

        if (! empty($field['mask']) && isset($field['mask_save']) && $field['mask_save'] === 'raw') {
            $value = preg_replace('/[^a-z0-9]/i', '', $value);
        }

        $input_type = isset($field['input_type']) ? sanitize_key((string) $field['input_type']) : 'text';
        if ($input_type === 'email') {
            return sanitize_email($value);
        }
        if ($input_type === 'url') {
            return esc_url_raw($value);
        }
        if ($input_type === 'password') {
            return preg_replace('/[\r\n\t]+/', '', wp_unslash($value));
        }
        return sanitize_text_field($value);
    }
}
