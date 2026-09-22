<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * color 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/Color/Color.js` 与 `Libs/Color/Color.js`，负责颜色字符串清洗。
 */
class Color
{
    /**
     * CSS 关键字白名单。
     *
     * 取色器产不出这些值，但开发者常写在字段 default 或 output 里（demo 的
     * `demo_color_transparent` 就是 `'transparent'`），过去一律清成空串会把人家
     * 声明的默认值吃掉。具名颜色（red、rebeccapurple…）共 148 个，不在此列。
     */
    private const KEYWORDS = ['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'revert'];

    /**
     * 功能：仅允许 HEX、rgb()、rgba() 或 CSS 关键字保存。
     *
     * @param mixed $value 原始字段值。
     * @param array $field 字段配置。
     * @return string
     */
    public static function sanitize($value, $field = [])
    {
        // 复合字段可能把整项（如 color_group 的 ['color' => …, 'label' => …]）传进来。
        // 这里只认标量；由调用方负责先取出颜色那一项。
        if (! is_scalar($value)) {
            return '';
        }

        $value = trim((string) $value);
        if ($value === '') {
            return '';
        }

        if (in_array(strtolower($value), self::KEYWORDS, true)) {
            return strtolower($value);
        }

        // 3 位 / 6 位 / 8 位 HEX。8 位是 #RRGGBBAA：Fields/ColorGroup 开 alpha 时
        // 发的就是这个格式（Libs/Color 则走 rgba()），两种编码都得认，否则带透明度的
        // 颜色一保存就被清空。
        if (preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $value)) {
            return strtoupper($value);
        }

        if (preg_match('/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i', $value, $m)) {
            $r = max(0, min(255, (int) round((float) $m[1])));
            $g = max(0, min(255, (int) round((float) $m[2])));
            $b = max(0, min(255, (int) round((float) $m[3])));
            if (isset($m[4]) && $m[4] !== '') {
                $a = max(0, min(1, (float) $m[4]));
                $a = rtrim(rtrim(number_format($a, 3, '.', ''), '0'), '.');
                return 'rgba(' . $r . ', ' . $g . ', ' . $b . ', ' . $a . ')';
            }
            return 'rgb(' . $r . ', ' . $g . ', ' . $b . ')';
        }

        return '';
    }
}
