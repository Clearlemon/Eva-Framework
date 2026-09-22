<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * color_set 字段：一组带名字的颜色，按选项键存值（对应 CSF 的 color_group）。
 *
 * Eva 自己的 color_group 是「可增删的颜色列表」，值是没有键的数组；CSF 的 color_group 是
 * 「固定几个命名颜色」，值是 ['键' => '#颜色']。两者同名但结构不同，所以 CSF 写法在兼容层里被映射到这个类型。
 *
 * 字段配置：options => ['键' => '标题', …]；default => ['键' => '#颜色', …]。
 */
class Color_Set
{
    /**
     * 只保留 options 里声明过的键，每个值按颜色清洗；缺失或非法的回退到 default 里同名键的颜色。
     *
     * @param mixed $value 原始值。
     * @param array $field 字段 schema。
     * @return array<string,string>
     */
    public static function sanitize($value, $field = [])
    {
        $value    = is_array($value) ? $value : [];
        $defaults = isset($field['default']) && is_array($field['default']) ? $field['default'] : [];
        $clean    = [];

        foreach ((isset($field['options']) && is_array($field['options']) ? $field['options'] : []) as $key => $label) {
            $key   = (string) $key;
            $color = isset($value[$key]) ? Color::sanitize($value[$key]) : '';
            if ($color === '' && ! array_key_exists($key, $value) && isset($defaults[$key])) {
                $color = Color::sanitize($defaults[$key]);
            }
            $clean[$key] = $color;
        }
        return $clean;
    }
}
