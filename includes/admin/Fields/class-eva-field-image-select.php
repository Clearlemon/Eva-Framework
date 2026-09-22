<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * image_select 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/ImageSelect/ImageSelect.js`，负责校验图像选项值是否来自字段配置。
 */
class Image_Select
{
    /**
     * 功能：只允许保存 options 中声明过的图像选项值，并兼容单选/多选。
     *
     * 多选时保留提交顺序、去重并应用 max / max_select / maxSelect 限制；
     * 显式空数组或空字符串代表用户清空，返回空数组。字段未提交（null）时
     * 才读取数组形式的 default，避免清空后又被默认值回填。
     *
     * @param array $field 字段配置。
     * @param mixed $value 原始字段值。
     * @return string|array<int,string>
     */
    public static function sanitize($field, $value)
    {
        $field   = is_array($field) ? $field : [];
        $allowed = self::image_select_values(isset($field['options']) ? $field['options'] : []);
        $multiple = isset($field['multiple']) && ($field['multiple'] === true || $field['multiple'] === 'true');

        if ($multiple) {
            if ($value === null && array_key_exists('default', $field)) {
                $value = $field['default'];
            }

            if ($value === null || $value === '' || $value === []) {
                return [];
            }

            $values = is_array($value) ? $value : [$value];
            $clean  = [];

            foreach ($values as $item) {
                if (! is_scalar($item)) {
                    continue;
                }

                $item = sanitize_text_field((string) $item);
                if ($item === '' || ! in_array($item, $allowed, true) || in_array($item, $clean, true)) {
                    continue;
                }

                $clean[] = $item;
            }

            $max = self::max_select_count($field);
            if ($max > 0 && count($clean) > $max) {
                $clean = array_slice($clean, 0, $max);
            }

            return array_values($clean);
        }

        $value = is_scalar($value) ? sanitize_text_field((string) $value) : '';
        if (in_array($value, $allowed, true)) {
            return $value;
        }

        $default = isset($field['default']) && is_scalar($field['default'])
            ? sanitize_text_field((string) $field['default'])
            : '';

        return in_array($default, $allowed, true) ? $default : '';
    }

    /**
     * 功能：读取与前端一致的多选数量限制。
     *
     * @param array $field 字段配置。
     * @return int
     */
    private static function max_select_count($field)
    {
        foreach (['max', 'max_select', 'maxSelect'] as $key) {
            if (! empty($field[$key])) {
                $max = (int) $field[$key];
                return $max > 0 ? $max : 0;
            }
        }

        return 0;
    }

    /**
     * 功能：从 image_select 的 options 配置中提取允许保存的值。
     *
     * 支持关联数组、列表数组，以及 value/id 属性的数组或对象选项。
     *
     * 列表与关联的判定口径与 json_encode、前端组件一致：只有「0 起连续列表」才把元素本身当值，
     * 否则键即值。不能用 is_int($key) 代替——CSF 主题惯用 '1' => ['url' => …] 这种数字字符串键，
     * PHP 会把它转成 int，误判之后白名单里一个键都收不到，存量值全部被清空。
     *
     * @param mixed $options 字段选项配置。
     * @return string[]
     */
    private static function image_select_values($options)
    {
        if (is_object($options)) {
            $options = get_object_vars($options);
        }
        if (! is_array($options)) {
            return [];
        }

        $is_list = $options === [] || array_keys($options) === range(0, count($options) - 1);

        $values = [];
        foreach ($options as $key => $item) {
            if (is_object($item)) {
                $item = get_object_vars($item);
            }

            if (is_array($item)) {
                if (isset($item['value']) && is_scalar($item['value'])) {
                    $values[] = sanitize_text_field((string) $item['value']);
                } elseif (isset($item['id']) && is_scalar($item['id'])) {
                    $values[] = sanitize_text_field((string) $item['id']);
                } elseif (! $is_list) {
                    $values[] = sanitize_text_field((string) $key);
                }
                continue;
            }

            $raw_value = $is_list
                ? (is_scalar($item) ? $item : '')
                : $key;
            $values[] = sanitize_text_field((string) $raw_value);
        }

        return array_values(array_unique(array_filter($values, static function ($value) {
            return $value !== '';
        })));
    }
}
