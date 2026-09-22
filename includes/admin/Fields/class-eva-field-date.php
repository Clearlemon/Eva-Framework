<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** date 日期字段清理器，支持单值与 range 数组。 */
class Date
{
    public static function sanitize($value, $field = [])
    {
        $range = self::is_range($field);
        if ($value === null && array_key_exists('default', $field)) {
            $value = $field['default'];
        }
        $format = ! empty($field['return_format']) ? (string) $field['return_format'] : (! empty($field['format']) ? (string) $field['format'] : 'Y-m-d');

        if ($range) {
            $items = array_pad(array_slice(self::range_values($value), 0, 2), 2, '');
            return [
                self::clean_date($items[0], $format, false),
                self::clean_date($items[1], $format, false),
            ];
        }
        return self::clean_date($value, $format, false);
    }

    protected static function clean_date($value, $format, $with_time)
    {
        if (! is_scalar($value)) {
            return '';
        }
        $value = trim((string) $value);
        if ($value === '') {
            return '';
        }
        if ($value === 'now') {
            return (new \DateTimeImmutable('now', wp_timezone()))->format($format);
        }

        $formats = $with_time
            ? [$format, 'Y-m-d H:i:s', 'Y-m-d H:i', 'Y-m-d\TH:i:s', 'Y-m-d\TH:i']
            : [$format, 'Y-m-d', 'Y/m/d'];
        foreach (array_unique($formats) as $candidate) {
            $date = \DateTimeImmutable::createFromFormat('!' . $candidate, $value, wp_timezone());
            $errors = \DateTimeImmutable::getLastErrors();
            if ($date && ($errors === false || ((int) $errors['warning_count'] === 0 && (int) $errors['error_count'] === 0))) {
                return $date->format($format);
            }
        }
        return '';
    }

    protected static function range_values($value)
    {
        if (! is_array($value)) {
            return [];
        }
        if (array_key_exists('start', $value) || array_key_exists('end', $value)) {
            return [isset($value['start']) ? $value['start'] : '', isset($value['end']) ? $value['end'] : ''];
        }
        return array_values($value);
    }

    protected static function is_range($field)
    {
        if (! empty($field['range'])) {
            return true;
        }
        $options = isset($field['type_options']) && is_array($field['type_options']) ? $field['type_options'] : [];
        return isset($options['mode']) && $options['mode'] === 'range';
    }
}
