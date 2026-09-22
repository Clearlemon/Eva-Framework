<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** datetime 日期时间字段清理器，支持秒与范围。 */
class Datetime extends Date
{
    public static function sanitize($value, $field = [])
    {
        $range = ! empty($field['range']);
        if ($value === null && array_key_exists('default', $field)) {
            $value = $field['default'];
        }
        $fallback = ! empty($field['show_seconds']) ? 'Y-m-d H:i:s' : 'Y-m-d H:i';
        $format = ! empty($field['return_format']) ? (string) $field['return_format'] : (! empty($field['format']) ? (string) $field['format'] : $fallback);

        if ($range) {
            $items = array_pad(array_slice(self::range_values($value), 0, 2), 2, '');
            return [
                self::clean_date($items[0], $format, true),
                self::clean_date($items[1], $format, true),
            ];
        }
        return self::clean_date($value, $format, true);
    }
}
