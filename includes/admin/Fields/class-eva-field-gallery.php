<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** Gallery field sanitizer. */
class Gallery
{
    public static function sanitize($value, $field = [])
    {
        return Media::sanitize_gallery($value, $field);
    }
}
