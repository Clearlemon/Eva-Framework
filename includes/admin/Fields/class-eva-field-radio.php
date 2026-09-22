<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** radio 单选字段清理器。 */
class Radio
{
    public static function sanitize($value, $field = [])
    {
        if (($value === '' || $value === null) && ! empty($field['clearable'])) {
            return '';
        }
        if ($value === null && array_key_exists('default', $field)) {
            $value = $field['default'];
        }
        if (! is_scalar($value)) {
            return '';
        }
        $value = sanitize_text_field((string) $value);
        $allowed = self::allowed_values(isset($field['options']) ? $field['options'] : []);
        if (! $allowed || in_array($value, $allowed, true)) {
            return $value;
        }
        if (isset($field['default']) && is_scalar($field['default'])) {
            $default = sanitize_text_field((string) $field['default']);
            if (in_array($default, $allowed, true)) {
                return $default;
            }
        }
        return '';
    }

    /**
     * 取出允许保存的值集合。
     *
     * 判定口径与 json_encode、前端组件保持一致：options 是「0 起连续列表」时元素本身即值
     * （['小','中','大']），否则键即值。这里不能用 is_int($key) 代替——PHP 会把 CSF 惯用的
     * '1' => '图片' 这种数字字符串键转成 int，一旦误判，白名单里收的就是标签而不是键，
     * 存量值反被判非法清空。
     *
     * @param mixed $options 字段选项配置。
     * @return string[]
     */
    private static function allowed_values($options)
    {
        $options = (array) $options;
        $is_list = $options === [] || array_keys($options) === range(0, count($options) - 1);
        $out = [];
        foreach ($options as $key => $option) {
            if (is_array($option) || is_object($option)) {
                $data = (array) $option;
                $candidate = isset($data['value']) ? $data['value'] : (isset($data['id']) ? $data['id'] : $key);
            } else {
                $candidate = $is_list ? $option : $key;
            }
            if (is_scalar($candidate)) {
                $out[] = sanitize_text_field((string) $candidate);
            }
        }
        return array_values(array_unique(array_filter($out, 'strlen')));
    }
}
