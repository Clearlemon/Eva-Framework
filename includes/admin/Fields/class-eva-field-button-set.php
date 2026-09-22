<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** button_set 字段与 radio 使用相同的有限单选语义。 */
class Button_Set
{
    public static function sanitize($value, $field = [])
    {
        if (! empty($field['multiple'])) {
            return Checkbox::sanitize($value, $field);
        }
        return Radio::sanitize($value, $field);
    }
}
