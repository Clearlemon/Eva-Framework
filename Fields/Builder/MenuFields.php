<?php
namespace Eva\Framework\Builder;

if (!defined('ABSPATH')) { exit; }

/** Adapter for the actual WP menu-item containers; never defines replacement fields. */
class MenuFields
{
    public static function containers()
    {
        $out = [];
        foreach (\Eva::get_nav_menus() as $id => $cfg) {
            if (!current_user_can($cfg['capability'] ?? 'edit_theme_options')) { continue; }
            $out[$id] = ['id' => $id, 'framework' => 'eva', 'config' => $cfg, 'sections' => $cfg['sections'] ?? []];
        }
        // Use the live legacy objects, whose args/sections filters have already run.
        global $wp_filter;
        $instances = [];
        if (isset($wp_filter['wp_nav_menu_item_custom_fields']->callbacks)) {
            foreach ($wp_filter['wp_nav_menu_item_custom_fields']->callbacks as $callbacks) {
                foreach ($callbacks as $callback) {
                    $fn = $callback['function'];
                    if (is_array($fn) && is_object($fn[0]) && is_a($fn[0], 'CSF_Nav_Menu_Options')) { $instances[$fn[0]->unique] = $fn[0]; }
                }
            }
        }
        $vars = class_exists('CSF', false) ? get_class_vars('CSF') : [];
        $legacy_args = isset($vars['args']) && is_array(\CSF::$args) ? \CSF::$args : [];
        foreach (($legacy_args['nav_menu_options'] ?? []) as $id => $args) {
            if (isset($out[$id]) || !current_user_can($args['capability'] ?? 'edit_theme_options')) { continue; }
            $object = $instances[$id] ?? null;
            if (!$object && class_exists('CSF_Nav_Menu_Options', false)) {
                // Front-end standalone pages may not have instantiated the admin walker yet.
                $object = (new \ReflectionClass('CSF_Nav_Menu_Options'))->newInstanceWithoutConstructor();
                $object->unique = $id;
                $object->args = apply_filters('csf_' . $id . '_args', array_merge($object->args, $args), $object);
                $object->sections = apply_filters('csf_' . $id . '_sections', $legacy_args['sections'][$id] ?? [], $object);
            }
            if (!$object || !current_user_can($object->args['capability'] ?? 'edit_theme_options')) { continue; }
            $sections = array_map(static function ($section) { return \Eva\Framework\Csf_Compat::normalize_section($section, true); }, $object->sections);
            $out[$id] = ['id' => $id, 'framework' => 'csf', 'config' => $object->args, 'sections' => $sections, 'object' => $object];
        }
        return $out;
    }

    public static function schema($containers = null)
    {
        $schema = [];
        foreach ($containers ?? self::containers() as $id => $container) {
            $schema[] = ['id' => $id, 'sections' => \Eva::prepare_sections($container['sections'])];
        }
        return $schema;
    }

    private static function direct($container)
    {
        $type = $container['config']['data_type'] ?? 'serialize';
        return $container['framework'] === 'csf' ? $type !== 'serialize' : $type === 'direct';
    }

    public static function raw_values($item_id, $container)
    {
        $cfg = $container['config'];
        $stored = self::direct($container) ? [] : get_post_meta($item_id, $container['id'], true);
        $out = is_array($stored) ? $stored : [];
        foreach ($container['sections'] as $section) {
            foreach ($section['fields'] ?? [] as $field) {
                if (empty($field['id'])) { continue; }
                $id = $field['id'];
                if (self::direct($container) && metadata_exists('post', $item_id, $id)) { $out[$id] = get_post_meta($item_id, $id, true); }
                if (!array_key_exists($id, $out)) { $out[$id] = $cfg['defaults'][$id] ?? $field['default'] ?? ''; }
            }
        }
        return $out;
    }

    public static function values($item_id, $containers)
    {
        $values = [];
        foreach ($containers as $id => $container) {
            $values[$id] = \Eva\Framework\Csf_Compat::values_to_eva($container['sections'], self::raw_values($item_id, $container));
        }
        return $values;
    }

    public static function icon($values, $containers)
    {
        foreach ($containers as $id => $container) {
            foreach ($container['sections'] as $section) {
                foreach ($section['fields'] ?? [] as $field) {
                    if (($field['type'] ?? '') === 'icon' && !empty($field['id'])) { return (string) ($values[$id][$field['id']] ?? ''); }
                }
            }
        }
        return '';
    }

    public static function at_depth($field, $depth)
    {
        if (!isset($field['menu']) || $field['menu'] === '') { return true; }
        $range = array_map('intval', explode(',', (string) $field['menu']));
        return $depth >= $range[0] - 1 && $depth <= ($range[1] ?? $range[0]) - 1;
    }

    public static function save($menu_id, $item_id, $submitted, $containers)
    {
        if (!is_array($submitted)) { return; }
        $depth = 0; $parent = (int) get_post_meta($item_id, '_menu_item_menu_item_parent', true); $seen = [];
        while ($parent > 0 && !isset($seen[$parent]) && $depth < 20) { $seen[$parent] = true; $depth++; $parent = (int) get_post_meta($parent, '_menu_item_menu_item_parent', true); }
        foreach ($containers as $id => $container) {
            if (!isset($submitted[$id]) || !is_array($submitted[$id])) { continue; }
            $values = \Eva\Framework\Csf_Compat::values_to_eva($container['sections'], self::raw_values($item_id, $container));
            foreach ($container['sections'] as $section) {
                foreach ($section['fields'] ?? [] as $field) {
                    $key = $field['id'] ?? '';
                    if (!$key || !self::at_depth($field, $depth) || !empty($field['readonly']) || !empty($field['disabled']) || (isset($field['save']) && $field['save'] === false)) { continue; }
                    if (array_key_exists($key, $submitted[$id])) { $values[$key] = $submitted[$id][$key]; }
                }
            }
            if ($container['framework'] === 'eva') {
                \Eva\Framework\NavMenu::save_values($item_id, $id, $container['config'], $values);
                continue;
            }
            // Let the existing WP menu container run its own sanitizers, validators and hooks.
            $stored_values = [];
            foreach ($container['sections'] as $section) {
                foreach ($section['fields'] ?? [] as $field) {
                    $key = $field['id'] ?? '';
                    if ($key && array_key_exists($key, $values)) { $stored_values[$key] = \Eva\Framework\Csf_Compat::value_to_csf($field, $values[$key], $values); }
                }
            }
            $values = $stored_values;
            $previous = $_POST;
            try {
                $_POST[$id][$item_id] = wp_slash($values);
                $_POST['update-nav-menu-nonce'] = wp_create_nonce('update-nav_menu');
                $container['object']->wp_update_nav_menu_item($menu_id, $item_id, []);
            } finally { $_POST = $previous; }
        }
    }
}
