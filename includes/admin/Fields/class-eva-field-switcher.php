<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * switcher 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/Switcher/Switcher.js`，负责把开关状态保存为稳定的 1/0。
 */
class Switcher
{
    /**
     * 功能：把布尔、数字或字符串开关值规整为 1 或 0。
     *
     * @param mixed $value 原始字段值。
     * @param array $field 字段配置。
     * @return int
     */
    public static function sanitize($value, $field = [])
    {
        $has_custom_on  = array_key_exists('value_on', $field);
        $has_custom_off = array_key_exists('value_off', $field);

        if (! $has_custom_on && ! $has_custom_off) {
            return ($value === true || $value === 1 || $value === '1') ? 1 : 0;
        }

        $on_value  = $has_custom_on ? self::clean_value($field['value_on']) : 1;
        $off_value = $has_custom_off ? self::clean_value($field['value_off']) : 0;

        return (string) $value === (string) $on_value ? $on_value : $off_value;
    }

    private static function clean_value($value)
    {
        if (is_bool($value)) {
            return $value ? 1 : 0;
        }
        if (is_int($value) || is_float($value)) {
            return $value;
        }
        return sanitize_text_field((string) $value);
    }
}
