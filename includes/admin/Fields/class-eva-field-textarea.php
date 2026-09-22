<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * textarea 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/Textarea/Textarea.js`，负责多行文本在保存前的清洗。
 */
class Textarea
{
    /**
     * 功能：清洗多行文本并保留换行。
     *
     * @param mixed $value 原始字段值。
     * @param array $field 字段配置。
     * @return string
     */
    public static function sanitize($value, $field = [])
    {
        $value = str_replace(["\r\n", "\r"], "\n", (string) $value);
        $mode  = isset($field['transform']) ? sanitize_key((string) $field['transform']) : '';

        if ($mode === 'trim') {
            $value = trim($value);
        } elseif ($mode === 'trim_lines') {
            $value = implode("\n", array_map('trim', explode("\n", $value)));
            $value = trim($value);
        } elseif ($mode === 'compact_lines') {
            $lines = array_map('trim', explode("\n", $value));
            $value = implode("\n", array_values(array_filter($lines, static function ($line) {
                return $line !== '';
            })));
        } elseif ($mode === 'uppercase') {
            $value = function_exists('mb_strtoupper') ? mb_strtoupper($value, 'UTF-8') : strtoupper($value);
        } elseif ($mode === 'lowercase') {
            $value = function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
        }

        return sanitize_textarea_field($value);
    }
}
