<?php

namespace Eva\Framework\Builder;

if (! defined('ABSPATH')) {
    exit;
}

/** 固定结构由主题声明，不进入模块注册表，也不存储可增删的实例。 */
class FixedStructure
{
    public static function render_preview($option_id, $field_id, $raw, $page)
    {
        $options = \Eva::get_options();
        $option = $options[$option_id] ?? [];
        $definitions = [];
        foreach ((array) ($option['sections'] ?? []) as $section) {
            foreach ((array) ($section['fields'] ?? []) as $field) {
                if (($field['type'] ?? '') === 'builder' && ($field['id'] ?? '') === $field_id) {
                    $definitions = (array) ($field['fixed_structure'] ?? []);
                    break 2;
                }
            }
        }
        $html = [];
        $saved = $definitions ? \Eva::get_values($option_id) : [];
        foreach ($definitions as $node) {
            $id = sanitize_key($node['id'] ?? '');
            if ($id === '' || (! empty($node['page']) && $node['page'] !== $page) || ! is_callable($node['render'] ?? null)) {
                continue;
            }
            $values = [];
            foreach ((array) ($node['fields'] ?? []) as $field) {
                if (empty($field['id'])) { continue; }
                $key = $field['id'];
                $values[$key] = array_key_exists($key, $raw) ? $raw[$key] : ($saved[$key] ?? ($field['default'] ?? ''));
            }
            // 只接受已注册结构的字段，沿用设置保存时的类型校验与自定义清洗。
            $clean = \Eva\Framework\Data::sanitize_by_sections([['fields' => $node['fields'] ?? []]], $values);
            $html[$id] = (string) call_user_func($node['render'], $clean);
        }
        return $html;
    }
}
