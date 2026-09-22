<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** Sorter / sortable field sanitizer. */
class Sorter
{
    public static function sanitize($value, $field = [])
    {
        $allowed = self::option_keys(isset($field['options']) ? $field['options'] : (isset($field['items']) ? $field['items'] : []));
        $mode = isset($field['mode']) ? (string) $field['mode'] : (isset($field['variant']) ? (string) $field['variant'] : 'dual');
        if ($mode === 'single') {
            return self::ordered(is_array($value) ? $value : [], $allowed, true);
        }

        $value = is_array($value) ? $value : [];
        $enabled = self::ordered(isset($value['enabled']) && is_array($value['enabled']) ? $value['enabled'] : (self::is_list($value) ? $value : []), $allowed, false);
        $disabled = self::ordered(isset($value['disabled']) && is_array($value['disabled']) ? $value['disabled'] : [], $allowed, false);
        $disabled = array_values(array_diff($disabled, $enabled));
        foreach ($allowed as $key) {
            if (! in_array($key, $enabled, true) && ! in_array($key, $disabled, true)) {
                $disabled[] = $key;
            }
        }
        return ['enabled' => $enabled, 'disabled' => $disabled];
    }

    /**
     * 取出合法的条目键。
     *
     * 「0 起连续列表」才把元素本身当值，其余情况一律用键。不能用 is_int($key) 代替——
     * CSF 惯用的 '1' => '标题' 数字字符串键会被 PHP 转成 int，误判后白名单里收的是标签，
     * 中文标签再经 sanitize_key 会变成空串，整个条目表都会丢。
     *
     * @param mixed $options 条目配置（options 或 items）。
     * @return string[]
     */
    private static function option_keys($options)
    {
        $options = (array) $options;
        $is_list = self::is_list($options);
        $keys = [];
        foreach ($options as $key => $label) {
            if (is_array($label) && isset($label['value'])) {
                $value = sanitize_key((string) $label['value']);
            } elseif ($is_list) {
                $value = sanitize_key(is_scalar($label) ? (string) $label : '');
            } else {
                $value = sanitize_key((string) $key);
            }
            if ($value !== '' && ! in_array($value, $keys, true)) {
                $keys[] = $value;
            }
        }
        return $keys;
    }

    private static function ordered($values, $allowed, $append_missing)
    {
        $out = [];
        foreach ((array) $values as $value) {
            $value = sanitize_key((string) $value);
            if (in_array($value, $allowed, true) && ! in_array($value, $out, true)) {
                $out[] = $value;
            }
        }
        if ($append_missing) {
            foreach ($allowed as $value) {
                if (! in_array($value, $out, true)) {
                    $out[] = $value;
                }
            }
        }
        return $out;
    }

    private static function is_list($value)
    {
        return is_array($value) && ($value === [] || array_keys($value) === range(0, count($value) - 1));
    }
}
