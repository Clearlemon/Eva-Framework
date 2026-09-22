<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** link_color 四态链接颜色字段清理器。 */
class Link_Color
{
    public static function sanitize($value, $field = [])
    {
        if ($value === null && isset($field['default']) && is_array($field['default'])) {
            $value = $field['default'];
        }
        $value = is_array($value) ? $value : [];
        $clean = [];
        // focus 只在字段的 states 里声明了才保存（CSF 的 link_color 有这个状态），默认四态的输出保持不变。
        $states = ['normal', 'hover', 'active', 'visited'];
        if (isset($field['states']) && is_array($field['states']) && in_array('focus', $field['states'], true)) {
            $states[] = 'focus';
        }
        foreach ($states as $state) {
            $clean[$state] = Color::sanitize(isset($value[$state]) ? $value[$state] : '', $field);
        }
        return $clean;
    }
}
