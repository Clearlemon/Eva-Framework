<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** WordPress rich text editor sanitizer. */
class WP_Editor
{
    public static function sanitize($value, $field = [])
    {
        if (is_array($value) || is_object($value) || is_resource($value)) {
            return '';
        }
        $value = (string) $value;
        if (! empty($field['allow_unfiltered_html']) && current_user_can('unfiltered_html')) {
            return $value;
        }
        return wp_kses_post($value);
    }
}
