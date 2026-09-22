<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** Secure WordPress resource search and sanitizer for commercial data selectors. */
class Data_Selector
{
    public static function sanitize($value, $field = [])
    {
        $type = sanitize_key(isset($field['type']) ? $field['type'] : 'post_selector');
        $variant = sanitize_key(isset($field['variant']) ? $field['variant'] : '');
        $multiple = ! empty($field['multiple']) || $type === 'relationship' || $variant === 'relationship';
        $raw = $multiple ? (is_array($value) ? $value : (($value === null || $value === '') ? [] : [$value])) : [$value];
        $out = [];
        foreach ($raw as $item) {
            $clean = self::sanitize_one($item, $type, $field);
            if ($clean !== '' && $clean !== 0 && $clean !== null) {
                $out[] = $clean;
            }
        }
        $out = array_values(array_unique($out, SORT_REGULAR));
        $limit = isset($field['max_items']) ? absint($field['max_items']) : (isset($field['limit']) ? absint($field['limit']) : 0);
        if ($limit > 0) {
            $out = array_slice($out, 0, $limit);
        }
        return $multiple ? $out : (isset($out[0]) ? $out[0] : '');
    }

    public static function sanitize_relationship($value, $field = [])
    {
        $field['type'] = 'relationship';
        $field['multiple'] = true;
        return self::sanitize($value, $field);
    }

    /**
     * 取站点已注册的侧边栏清单。
     *
     * WordPress 没有 get_registered_sidebars() 这个函数，注册表就是全局变量本身
     * （`wp-includes/widgets.php` 里由 register_sidebar() 逐个写入）。
     *
     * @return array 侧边栏定义数组，每项含 id / name 等键。
     */
    private static function registered_sidebars()
    {
        global $wp_registered_sidebars;
        return is_array($wp_registered_sidebars) ? $wp_registered_sidebars : [];
    }

    private static function sanitize_one($value, $type, $field)
    {
        $resource = self::resource_for($type, $field);
        if ($resource === 'sidebars') {
            $id = sanitize_key((string) $value);
            foreach (self::registered_sidebars() as $sidebar) {
                if (! empty($sidebar['id']) && $sidebar['id'] === $id) {
                    return $id;
                }
            }
            return '';
        }

        $id = absint($value);
        if ($id < 1) {
            return '';
        }
        if ($resource === 'posts') {
            $post = get_post($id);
            if (! $post || ! self::allowed_post_type($post->post_type, $field)) {
                return '';
            }
            return $id;
        }
        if ($resource === 'terms') {
            $taxonomy = self::first_taxonomy($field);
            $term = get_term($id, $taxonomy);
            return ($term && ! is_wp_error($term)) ? $id : '';
        }
        if ($resource === 'users') {
            $user = get_userdata($id);
            if (! $user) { return ''; }
            $roles = isset($field['role']) ? (is_array($field['role']) ? $field['role'] : explode(',', (string) $field['role'])) : [];
            if ($roles && ! array_intersect(array_map('sanitize_key', $roles), (array) $user->roles)) { return ''; }
            return $id;
        }
        if ($resource === 'menus') {
            return wp_get_nav_menu_object($id) ? $id : '';
        }
        return $id;
    }

    public static function ajax_search()
    {
        if (! check_ajax_referer('eva_fw_guide', 'nonce', false)) {
            wp_send_json_error(['msg' => 'bad_nonce'], 403);
        }
        $resource = self::resource_from_request();
        if (! self::can_search($resource)) {
            wp_send_json_error(['msg' => 'forbidden'], 403);
        }
        $query = isset($_GET['q']) ? sanitize_text_field(wp_unslash($_GET['q'])) : '';
        $include_raw = isset($_GET['include']) ? wp_unslash($_GET['include']) : '';
        $include = self::include_ids($include_raw);
        $include_values = self::include_values($include_raw);
        $limit = isset($_GET['limit']) ? max(1, min(50, absint($_GET['limit']))) : 20;
        $items = [];
        if ($resource === 'posts') {
            $items = self::search_posts($query, $include, $limit);
        } elseif ($resource === 'terms') {
            $items = self::search_terms($query, $include, $limit);
        } elseif ($resource === 'users') {
            $items = self::search_users($query, $include, $limit);
        } elseif ($resource === 'menus') {
            $items = self::search_menus($query, $include, $limit);
        } elseif ($resource === 'sidebars') {
            $items = self::search_sidebars($query, $include_values, $limit);
        }
        wp_send_json_success(['items' => $items, 'resource' => $resource]);
    }

    public static function ajax_search_posts()
    {
        $_GET['resource'] = 'posts';
        self::ajax_search();
    }

    private static function search_posts($query, $include, $limit)
    {
        $types = self::post_types_from_request();
        $args = [
            'post_type' => $types,
            'post_status' => ['publish', 'draft', 'pending', 'future', 'private'],
            'posts_per_page' => $limit,
            'no_found_rows' => true,
            'orderby' => $include ? 'post__in' : 'date',
            'order' => 'DESC',
        ];
        if ($include) { $args['post__in'] = $include; } else { $args['s'] = $query; }
        $items = [];
        foreach ((new \WP_Query($args))->posts as $post) {
            $object = get_post_type_object($post->post_type);
            $items[] = [
                'value' => (string) $post->ID,
                'label' => get_the_title($post) ?: '（无标题）',
                'url' => get_permalink($post),
                'type' => $object && ! empty($object->labels->singular_name) ? $object->labels->singular_name : $post->post_type,
                'meta' => get_post_status($post),
            ];
        }
        return $items;
    }

    private static function search_terms($query, $include, $limit)
    {
        $taxonomy = self::first_taxonomy_from_request();
        $args = ['taxonomy' => $taxonomy, 'hide_empty' => false, 'number' => $limit, 'orderby' => $include ? 'include' : 'name'];
        if ($include) { $args['include'] = $include; } else { $args['search'] = $query; }
        $terms = get_terms($args);
        if (is_wp_error($terms)) { return []; }
        $items = [];
        foreach ((array) $terms as $term) {
            $term_url = get_term_link($term);
            $items[] = ['value' => (string) $term->term_id, 'label' => $term->name, 'url' => is_wp_error($term_url) ? '' : $term_url, 'type' => $term->taxonomy, 'meta' => sprintf('%d 篇内容', (int) $term->count)];
        }
        return $items;
    }

    private static function search_users($query, $include, $limit)
    {
        $args = ['number' => $limit, 'orderby' => 'display_name', 'order' => 'ASC', 'fields' => ['ID', 'display_name', 'user_login']];
        $roles = isset($_GET['role']) ? array_filter(array_map('sanitize_key', explode(',', (string) wp_unslash($_GET['role'])))) : [];
        if ($roles) { $args['role__in'] = $roles; }
        if ($include) { $args['include'] = $include; } elseif ($query !== '') { $args['search'] = '*' . $query . '*'; }
        $items = [];
        foreach ((array) get_users($args) as $user) {
            $items[] = ['value' => (string) $user->ID, 'label' => $user->display_name ?: $user->user_login, 'type' => 'user', 'meta' => '@' . $user->user_login];
        }
        return $items;
    }

    private static function search_menus($query, $include, $limit)
    {
        $menus = wp_get_nav_menus();
        $items = [];
        foreach ((array) $menus as $menu) {
            if ($include && ! in_array((int) $menu->term_id, $include, true)) { continue; }
            if (! $include && $query !== '' && stripos($menu->name, $query) === false) { continue; }
            $items[] = ['value' => (string) $menu->term_id, 'label' => $menu->name, 'type' => 'nav_menu', 'meta' => '菜单 · ' . $menu->slug];
            if (count($items) >= $limit) { break; }
        }
        return $items;
    }

    private static function search_sidebars($query, $include, $limit)
    {
        $items = [];
        foreach (self::registered_sidebars() as $sidebar) {
            $id = sanitize_key(isset($sidebar['id']) ? $sidebar['id'] : '');
            $name = isset($sidebar['name']) ? wp_strip_all_tags($sidebar['name']) : $id;
            if ($id === '' || ($include && ! in_array($id, array_map('strval', $include), true))) { continue; }
            if (! $include && $query !== '' && stripos($name . ' ' . $id, $query) === false) { continue; }
            $items[] = ['value' => $id, 'label' => $name, 'type' => 'sidebar', 'meta' => $id];
            if (count($items) >= $limit) { break; }
        }
        return $items;
    }

    private static function resource_from_request()
    {
        $resource = sanitize_key(isset($_GET['resource']) ? wp_unslash($_GET['resource']) : 'posts');
        return in_array($resource, ['posts', 'terms', 'users', 'menus', 'sidebars'], true) ? $resource : 'posts';
    }

    private static function resource_for($type, $field)
    {
        $configured = isset($field['source']) ? $field['source'] : (isset($field['data_source']) ? $field['data_source'] : (isset($field['resource']) ? $field['resource'] : ''));
        if ($configured !== '') {
            $configured = sanitize_key(is_array($configured) ? reset($configured) : $configured);
            $aliases = ['post' => 'posts', 'term' => 'terms', 'taxonomy' => 'terms', 'user' => 'users', 'menu' => 'menus', 'nav_menu' => 'menus', 'sidebar' => 'sidebars'];
            $configured = isset($aliases[$configured]) ? $aliases[$configured] : $configured;
            if (in_array($configured, ['posts', 'terms', 'users', 'menus', 'sidebars'], true)) { return $configured; }
        }
        if ($type === 'relationship') { return isset($field['resource']) ? self::resource_from_value($field['resource']) : 'posts'; }
        if ($type === 'term_selector' || $type === 'taxonomy') { return 'terms'; }
        if ($type === 'user_selector' || $type === 'user') { return 'users'; }
        if ($type === 'nav_menu' || $type === 'menu') { return 'menus'; }
        if ($type === 'sidebar' || $type === 'sidebars') { return 'sidebars'; }
        return 'posts';
    }

    private static function resource_from_value($value)
    {
        $value = sanitize_key((string) $value);
        return in_array($value, ['posts', 'terms', 'users', 'menus', 'sidebars'], true) ? $value : 'posts';
    }

    private static function can_search($resource)
    {
        if ($resource === 'users') { return current_user_can('list_users') || current_user_can('edit_users'); }
        if ($resource === 'menus') { return current_user_can('edit_theme_options'); }
        if ($resource === 'sidebars') { return current_user_can('edit_theme_options'); }
        if ($resource === 'terms') { return current_user_can('edit_posts') || current_user_can('manage_categories'); }
        return current_user_can('edit_posts');
    }

    private static function post_types_from_request()
    {
        $raw = isset($_GET['post_type']) ? wp_unslash($_GET['post_type']) : 'post,page';
        $types = is_array($raw) ? $raw : explode(',', (string) $raw);
        $valid = [];
        foreach ($types as $type) {
            $type = sanitize_key($type); $object = $type ? get_post_type_object($type) : null;
            if ($object && ! empty($object->show_ui)) { $valid[] = $type; }
        }
        return $valid ?: ['post', 'page'];
    }

    private static function first_taxonomy($field)
    {
        $taxonomy = isset($field['taxonomy']) ? $field['taxonomy'] : 'category';
        return sanitize_key(is_array($taxonomy) ? reset($taxonomy) : $taxonomy) ?: 'category';
    }

    private static function first_taxonomy_from_request()
    {
        $taxonomy = isset($_GET['taxonomy']) ? wp_unslash($_GET['taxonomy']) : 'category';
        return sanitize_key(is_array($taxonomy) ? reset($taxonomy) : explode(',', (string) $taxonomy)[0]) ?: 'category';
    }

    private static function allowed_post_type($type, $field)
    {
        $allowed = isset($field['post_type']) ? $field['post_type'] : [];
        if (! $allowed) { return true; }
        $allowed = is_array($allowed) ? $allowed : explode(',', (string) $allowed);
        return in_array($type, array_map('sanitize_key', $allowed), true);
    }

    private static function include_values($raw)
    {
        if (is_string($raw)) { $raw = explode(',', $raw); }
        $out = [];
        foreach ((array) $raw as $value) {
            $value = sanitize_key((string) $value);
            if ($value !== '') { $out[] = $value; }
        }
        return array_values(array_unique($out));
    }

    private static function include_ids($raw)
    {
        if (is_string($raw)) { $raw = explode(',', $raw); }
        $out = [];
        foreach ((array) $raw as $id) { if (is_numeric($id) && absint($id) > 0) { $out[] = absint($id); } }
        return array_values(array_unique($out));
    }
}
