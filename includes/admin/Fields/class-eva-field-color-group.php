<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * color_group 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/ColorGroup/ColorGroup.js`，负责成组颜色值在保存前的清洗。
 */
class Color_Group
{
    /**
     * 功能：清洗颜色数组，仅保留合法颜色并重排索引。
     *
     * @param mixed $value 原始字段值。
     * @param array $field 字段配置。
     * @return array<int,string>
     */
    public static function sanitize($value, $field = [])
    {
        if (! is_array($value)) {
            return [];
        }

        // 前端有两种存值形态（见 Fields/ColorGroup/ColorGroup.js 的 emit）：
        // named => true 时是 [{ color, label }]，否则是颜色字符串数组。
        // 以 schema 的 named 为准，不跟着提交内容走，避免客户端改变存值形状。
        $named = ! empty($field['named']);

        $out = [];
        foreach ($value as $item) {
            // 来源两种形态都认：直接是颜色字符串，或 { color|value, label|name }
            // （与组件的 Norm_Items 取键顺序保持一致）。
            $label = '';
            if (is_array($item)) {
                $raw = array_key_exists('color', $item) ? $item['color'] : (isset($item['value']) ? $item['value'] : '');
                if (isset($item['label']) && is_scalar($item['label'])) {
                    $label = (string) $item['label'];
                } elseif (isset($item['name']) && is_scalar($item['name'])) {
                    $label = (string) $item['name'];
                }
            } else {
                $raw = $item;
            }

            // 颜色非法就整项丢弃，与原行为一致。
            $color = Color::sanitize($raw);
            if ($color === '') {
                continue;
            }

            $out[] = $named ? ['color' => $color, 'label' => sanitize_text_field($label)] : $color;
        }

        return array_values($out);
    }
}
