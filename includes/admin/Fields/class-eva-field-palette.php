<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * palette 字段：从几套预设配色里单选一套（对应 CSF 的 palette）。
 *
 * 字段配置：options => ['键' => ['#色1', '#色2', …], …]；存值是选中那一套的键。
 */
class Palette
{
    /**
     * 只允许保存 options 里声明过的键；非法值回退到合法的 default，否则为空字符串。
     *
     * @param mixed $value 原始值。
     * @param array $field 字段 schema。
     * @return string
     */
    public static function sanitize($value, $field = [])
    {
        $allowed = [];
        foreach ((isset($field['options']) && is_array($field['options']) ? $field['options'] : []) as $key => $colors) {
            $allowed[] = (string) $key;
        }

        $value = is_scalar($value) ? (string) $value : '';
        if (in_array($value, $allowed, true)) {
            return $value;
        }

        $default = isset($field['default']) && is_scalar($field['default']) ? (string) $field['default'] : '';
        return in_array($default, $allowed, true) ? $default : '';
    }
}
