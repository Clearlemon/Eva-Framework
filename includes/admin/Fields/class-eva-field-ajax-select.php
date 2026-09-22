<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * ajax_select 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/AjaxSelect/AjaxSelect.js`，复用 select 字段的保存清洗与远程搜索逻辑。
 */
class Ajax_Select
{
    /**
     * 功能：按 AJAX 下拉规则清洗文章 ID 或文章 ID 数组。
     *
     * @param array $field 字段配置。
     * @param mixed $value 原始字段值。
     * @return int|array
     */
    public static function sanitize($field, $value)
    {
        $field['ajax'] = true;
        $field['type'] = 'ajax_select';
        return Select::sanitize($field, $value);
    }
}
