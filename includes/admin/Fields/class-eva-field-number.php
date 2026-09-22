<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** number 数字字段清理器。 */
class Number_Field
{
    public static function sanitize($value, $field = [])
    {
        if ($value === null && array_key_exists('default', $field)) {
            $value = $field['default'];
        }
        if ($value === '' || $value === null || ! is_numeric($value)) {
            return '';
        }

        $number = (float) $value;
        if (isset($field['min']) && is_numeric($field['min'])) {
            $number = max((float) $field['min'], $number);
        }
        if (isset($field['max']) && is_numeric($field['max'])) {
            $number = min((float) $field['max'], $number);
        }
        if (isset($field['step']) && is_numeric($field['step']) && (float) $field['step'] > 0) {
            $base = isset($field['min']) && is_numeric($field['min']) ? (float) $field['min'] : 0.0;
            $step = (float) $field['step'];
            $number = $base + round(($number - $base) / $step) * $step;
        }

        // 步长对齐后再次钳制，避免 max 不落在 step 网格时舍入越界。
        if (isset($field['min']) && is_numeric($field['min'])) {
            $number = max((float) $field['min'], $number);
        }
        if (isset($field['max']) && is_numeric($field['max'])) {
            $number = min((float) $field['max'], $number);
        }

        $precision = self::precision(isset($field['step']) ? $field['step'] : $value);
        $number = round($number, $precision);
        return $precision === 0 ? (int) $number : $number;
    }

    private static function precision($value)
    {
        $value = strtolower((string) $value);
        if (strpos($value, 'e-') !== false) {
            return min(8, max(0, (int) substr($value, strpos($value, 'e-') + 2)));
        }
        $dot = strpos($value, '.');
        return $dot === false ? 0 : min(8, strlen(rtrim(substr($value, $dot + 1), '0')));
    }
}
