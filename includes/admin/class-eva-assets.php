<?php

namespace Eva\Framework\Admin;

if (! defined('ABSPATH')) {
    exit;
}

/** Resolve field assets from the page schema, including nested Builder modules. */
class Assets
{
    public static function field_types($sections)
    {
        $types = [];
        $walk = static function ($nodes) use (&$walk, &$types) {
            foreach ((array) $nodes as $node) {
                if (! is_array($node)) {
                    continue;
                }
                if (isset($node['type'])) {
                    $types[\Eva::normalizeFieldType($node['type'])] = true;
                }
                foreach (['fields', 'items', 'tabs', 'sections', 'global_fields', 'container_fields', 'container_tabs', 'fixed_structure'] as $key) {
                    if (isset($node[$key]) && is_array($node[$key])) {
                        $walk($node[$key]);
                    }
                }
            }
        };
        $walk($sections);
        if (isset($types['builder'])) {
            foreach (\Eva::get_builder_modules() as $module) {
                $walk($module['fields'] ?? []);
                $walk($module['tabs'] ?? []);
            }
            // The Builder menu editor creates these fields dynamically.
            foreach (['text', 'textarea', 'select', 'link'] as $type) {
                $types[$type] = true;
            }
        }
        return array_keys($types);
    }

    public static function filter_assets($assets, $types, $scripts)
    {
        $aliases = ['heading' => 'Notice', 'subheading' => 'Notice', 'submessage' => 'Notice', 'sortable' => 'Sorter', 'editor' => 'WpEditor'];
        $available = [];
        foreach ($scripts as $name => $url) {
            $available[strtolower(str_replace('_', '', $name))] = $name;
        }
        $needed = ['AdvancedCore' => true, 'BoxFields' => true];
        // Link 的输入框、纵向标签与 URL 图标样式位于共用 CSS，没有独立 Link.css。
        if (in_array('link', $types, true)) {
            $needed['CommonFields'] = true;
        }
        // 重复器等复合字段只有独立 JS，布局和按钮共用 AdvancedFields.css。
        if (array_intersect($types, ['group', 'repeater', 'tabbed', 'background', 'border', 'typography', 'spacing', 'dimensions'])) {
            $needed['AdvancedFields'] = true;
        }
        // Composite components can render other field components internally.
        $dependencies = [
            'background' => ['color', 'upload', 'select', 'text'],
            'border' => ['color', 'select', 'spinner'],
            'typography' => ['select', 'color', 'spinner', 'text'],
            'color_group' => ['color'], 'color_set' => ['color'], 'link_color' => ['color'],
        ];
        foreach ($types as $type) {
            foreach ($dependencies[$type] ?? [] as $dependency) {
                $types[] = $dependency;
            }
        }
        foreach (array_unique($types) as $type) {
            $key = strtolower(str_replace('_', '', $aliases[$type] ?? $type));
            // Unknown custom fields retain the original loading behavior.
            if (! isset($available[$key])) {
                return $assets;
            }
            $needed[$available[$key]] = true;
        }
        return array_filter($assets, static function ($url, $name) use ($needed) {
            return isset($needed[$name]) || strpos($url, EVA_FW_URL . 'Fields/') !== 0;
        }, ARRAY_FILTER_USE_BOTH);
    }
}
