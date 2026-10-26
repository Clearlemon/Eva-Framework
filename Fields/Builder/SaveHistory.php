<?php
namespace Eva\Framework\Builder;

if (!defined('ABSPATH')) { exit; }

/** Bounded server snapshots. Restoring reads a draft; normal saves apply it. */
class SaveHistory
{
    const LIMIT = 30;

    private static function key($scope)
    {
        return 'eva_builder_history_' . md5(get_stylesheet() . ':' . $scope);
    }

    private static function rows($scope)
    {
        $rows = get_option(self::key($scope), []);
        return is_array($rows) ? $rows : [];
    }

    private static function append($scope, $kind, $title, $payload, $initial = false)
    {
        $rows = self::rows($scope);
        $hash = hash('sha256', wp_json_encode($payload));
        if ($rows && ($rows[0]['hash'] ?? '') === $hash) { return; }
        $user = wp_get_current_user();
        array_unshift($rows, [
            'id' => wp_generate_uuid4(), 'kind' => $kind, 'title' => $title,
            'time' => time(), 'user' => sanitize_text_field($user->display_name),
            'initial' => $initial, 'hash' => $hash, 'payload' => $payload,
        ]);
        update_option(self::key($scope), array_slice($rows, 0, self::LIMIT), false);
    }

    private static function builder($option_id, $field_id)
    {
        $opt = \Eva::get_resolved($option_id);
        if (!$opt) { return null; }
        foreach ((array) ($opt['sections'] ?? []) as $section) {
            foreach ((array) ($section['fields'] ?? []) as $field) {
                if (($field['id'] ?? '') === $field_id && ($field['type'] ?? '') === 'builder') {
                    return ['option' => $opt, 'field' => $field];
                }
            }
        }
        return null;
    }

    private static function builder_values($field, $values)
    {
        $fields = [$field['id'] => $field];
        foreach (['global_fields', 'container_fields'] as $group) {
            foreach ((array) ($field[$group] ?? []) as $f) { if (!empty($f['id'])) { $fields[$f['id']] = $f; } }
        }
        foreach ((array) ($field['fixed_structure'] ?? []) as $node) {
            foreach ((array) ($node['fields'] ?? []) as $f) { if (!empty($f['id'])) { $fields[$f['id']] = $f; } }
        }
        $result = [];
        foreach ($fields as $id => $definition) {
            $result[$id] = array_key_exists($id, $values) ? $values[$id] : ($definition['default'] ?? '');
        }
        return $result;
    }

    public static function record_options($option_id, $sections, $before, $after)
    {
        foreach ((array) $sections as $section) {
            foreach ((array) ($section['fields'] ?? []) as $field) {
                if (($field['type'] ?? '') !== 'builder' || empty($field['id'])) { continue; }
                $old = self::builder_values($field, $before);
                $new = self::builder_values($field, $after);
                if ($old === $new) { continue; }
                $scope = 'builder:' . $option_id . ':' . $field['id'];
                if (!self::rows($scope)) { self::append($scope, 'builder', '首次保存前', ['values' => $old], true); }
                self::append($scope, 'builder', '页面与布局', ['values' => $new]);
            }
        }
    }

    private static function menu_values($data)
    {
        $items = $data['items'];
        foreach ($items as &$item) { unset($item['client_key']); }
        unset($item);
        return [
            'menu_id' => $data['menu_id'], 'menu_name' => $data['menu_name'],
            'location_id' => $data['location_id'], 'items' => $items,
            'assigned_locations' => array_values(array_column(array_filter($data['locations'], static function ($row) { return !empty($row['checked']); }), 'id')),
        ];
    }

    public static function record_menu($before, $after)
    {
        $old = self::menu_values($before); $new = self::menu_values($after);
        if ($old === $new) { return; }
        $rows = self::rows('menus'); $has_menu = false;
        foreach ($rows as $row) { if ((int) ($row['payload']['menu_id'] ?? 0) === (int) $after['menu_id']) { $has_menu = true; break; } }
        if (!$has_menu) { self::append('menus', 'menu', $before['menu_name'] . ' · 首次保存前', $old, true); }
        self::append('menus', 'menu', $after['menu_name'], $new);
    }

    public static function menu_snapshot($id, $menu_id)
    {
        foreach (self::rows('menus') as $row) {
            if ($row['id'] === $id && (int) ($row['payload']['menu_id'] ?? 0) === (int) $menu_id) { return $row['payload']; }
        }
        return null;
    }

    public static function ajax_get()
    {
        check_ajax_referer('eva_fw_guide', 'nonce');
        $option_id = isset($_POST['option_id']) ? sanitize_text_field(wp_unslash($_POST['option_id'])) : '';
        $field_id = isset($_POST['field_id']) ? sanitize_text_field(wp_unslash($_POST['field_id'])) : '';
        $builder = self::builder($option_id, $field_id);
        if (!$builder) { wp_send_json_error(['message' => '构建器不存在。'], 404); }
        $cap = trim((string) ($builder['option']['capability'] ?? 'manage_options')) ?: 'manage_options';
        if (!current_user_can($cap)) { wp_send_json_error(['message' => '没有读取历史的权限。'], 403); }
        $rows = self::rows('builder:' . $option_id . ':' . $field_id);
        if (current_user_can('edit_theme_options')) { $rows = array_merge($rows, self::rows('menus')); }
        usort($rows, static function ($a, $b) { return $b['time'] <=> $a['time']; });
        $id = isset($_POST['history_id']) ? sanitize_text_field(wp_unslash($_POST['history_id'])) : '';
        if ($id !== '') {
            foreach ($rows as $row) {
                if ($row['id'] !== $id) { continue; }
                $payload = $row['payload'];
                if ($row['kind'] === 'builder') { $payload['values'] = self::builder_values($builder['field'], $payload['values']); }
                if ($row['kind'] === 'menu') {
                    $current = MenuEditor::history_payload($payload['location_id'], $payload['menu_id']);
                    if (is_wp_error($current)) { wp_send_json_error(['message' => '该菜单或菜单位置已不存在。'], 409); }
                    $row['current'] = $current;
                }
                $row['payload'] = $payload; unset($row['hash']);
                wp_send_json_success(['entry' => $row]);
            }
            wp_send_json_error(['message' => '这条历史已过期，请刷新列表。'], 404);
        }
        $list = array_map(static function ($row) {
            $menu = $row['kind'] === 'menu';
            return [
                'id' => $row['id'], 'kind' => $row['kind'], 'title' => $row['title'],
                'time' => wp_date('Y-m-d H:i:s', $row['time']), 'timestamp' => $row['time'], 'user' => $row['user'], 'initial' => $row['initial'],
                'summary' => $menu ? count($row['payload']['items']) . ' 个菜单项 · ' . count($row['payload']['assigned_locations']) . ' 个位置' : '页面内容与布局设置',
            ];
        }, array_slice($rows, 0, self::LIMIT));
        wp_send_json_success(['entries' => $list, 'limit' => self::LIMIT]);
    }
}
