<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * html 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/Html/Html.js`，该字段主要用于展示可信 HTML，通常不参与保存。
 */
class Html
{
    /**
     * 功能：保持展示型字段的保存行为与普通文本兜底一致。
     *
     * @param mixed $value 原始字段值。
     * @param array $field 字段配置。
     * @return string
     */
    public static function sanitize($value, $field = [])
    {
        return Text::sanitize($value, $field);
    }
}
