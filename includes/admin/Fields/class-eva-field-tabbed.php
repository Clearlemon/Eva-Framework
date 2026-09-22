<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * tabbed 字段：把子字段分到几个标签页里展示（对应 CSF 的 tabbed）。
 *
 * 存值与 CSF 一致：所有标签页的子字段值平铺在同一个关联数组里（[child_id => value]），
 * 标签页只是展示上的分组，不出现在存值结构中。
 */
class Tabbed
{
    /**
     * 按各标签页声明的子字段逐项清洗；未声明的键一律丢弃。
     *
     * @param mixed $value 原始值。
     * @param array $field 字段 schema（tabs[].fields）。
     * @return array       [child_id => clean_value]
     */
    public static function sanitize($value, $field = [])
    {
        $value = Advanced_Field_Util::source($value, $field);
        $tabs  = isset($field['tabs']) && is_array($field['tabs']) ? $field['tabs'] : [];

        // 每个标签页当作一个分区交给通用清洗流程，子字段的类型清洗、依赖判断、CSF 存值转换都在那里完成。
        $sections = [];
        foreach ($tabs as $tab) {
            if (is_array($tab) && ! empty($tab['fields']) && is_array($tab['fields'])) {
                $sections[] = ['fields' => $tab['fields']];
            }
        }
        return \Eva\Framework\Data::sanitize_by_sections($sections, $value);
    }
}
