<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * accordion 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/Accordion/Accordion.js`，负责按每个折叠面板的子字段 schema 递归清洗。
 */
class Accordion
{
    /**
     * 功能：按 accordion 每个 section 的 fields 子 schema 递归清洗保存值。
     *
     * @param array $field 字段配置。
     * @param mixed $value 原始字段值。
     * @return array
     */
    public static function sanitize($field, $value)
    {
        $raw = is_array($value) ? $value : [];
        $clean = [];
        $sections = isset($field['sections']) && is_array($field['sections']) ? $field['sections'] : [];
        $valid_order = [];

        foreach ($sections as $index => $section) {
            $section_id = isset($section['id']) && $section['id'] !== ''
                ? (string) $section['id']
                : (string) $index;
            $valid_order[] = $section_id;

            $section_raw = isset($raw[$section_id]) && is_array($raw[$section_id])
                ? $raw[$section_id]
                : [];

            $clean[$section_id] = \Eva\Framework\Data::sanitize_by_sections([
                [
                    'fields' => isset($section['fields']) && is_array($section['fields'])
                        ? $section['fields']
                        : [],
                ],
            ], $section_raw);
        }

        // 保留拖拽排序；过滤未知、重复面板，并补齐新增面板。
        $saved_order = isset($raw['_order']) && is_array($raw['_order']) ? array_map('strval', $raw['_order']) : [];
        $saved_order = array_values(array_unique(array_filter($saved_order, static function ($id) use ($valid_order) {
            return in_array($id, $valid_order, true);
        })));
        foreach ($valid_order as $section_id) {
            if (! in_array($section_id, $saved_order, true)) {
                $saved_order[] = $section_id;
            }
        }
        $clean['_order'] = $saved_order;

        return $clean;
    }
}
