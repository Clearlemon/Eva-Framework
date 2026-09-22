<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** checkbox 多选字段清理器。 */
class Checkbox
{
    public static function sanitize($value, $field = [])
    {
        if ($value === null && isset($field['default']) && is_array($field['default'])) {
            $value = $field['default'];
        }
        if ($value === '' || $value === null) {
            return [];
        }
        if (! is_array($value)) {
            $value = [$value];
        }

        $allowed = self::allowed_values(isset($field['options']) ? $field['options'] : []);
        $limit = 0;
        foreach (['max', 'max_select', 'maxSelect'] as $key) {
            if (isset($field[$key]) && is_numeric($field[$key])) {
                $limit = max(0, (int) $field[$key]);
                break;
            }
        }

        $clean = [];
        foreach ($value as $item) {
            if (! is_scalar($item)) {
                continue;
            }
            $item = sanitize_text_field((string) $item);
            if ($item === '' || ($allowed && ! in_array($item, $allowed, true)) || in_array($item, $clean, true)) {
                continue;
            }
            $clean[] = $item;
            if ($limit > 0 && count($clean) >= $limit) {
                break;
            }
        }
        return array_values($clean);
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
