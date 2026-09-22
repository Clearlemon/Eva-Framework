<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * icon 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/Icon/Icon.js` 与 `Libs/Icon-picker/Icon-picker.js`，负责图标值清洗。
 */
class Icon
{
    /**
     * 功能：只允许图标类名、symbol 标识和常见安全字符保存。
     *
     * @param mixed $value 原始字段值。
     * @param array $field 字段配置。
     * @return string
     */
    public static function sanitize($value, $field = [])
    {
        $value = sanitize_text_field((string) $value);
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        return preg_match('/^[#A-Za-z0-9_\-\s]+$/', $value) ? $value : '';
    }
}
