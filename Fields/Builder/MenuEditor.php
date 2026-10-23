<?php

namespace Eva\Framework\Builder;

if (! defined('ABSPATH')) {
    exit;
}

/**
 * AJAX endpoints for editing a WordPress menu from the Builder.
 */
class MenuEditor
{
    /** 在空菜单位置创建原生菜单，并直接进入现有编辑流程。 */
    public static function ajax_create()
    {
        check_ajax_referer('eva_fw_guide', 'nonce');
        self::authorize();
        self::load_menu_api();

        $location_id = isset($_POST['location_id']) && is_string($_POST['location_id']) ? sanitize_key(wp_unslash($_POST['location_id'])) : '';
        $registered = get_registered_nav_menus();
        if ($location_id === '' || !isset($registered[$location_id])) {
            wp_send_json_error(['message' => '请选择有效的菜单位置。'], 400);
        }
        $menu_name = isset($_POST['menu_name']) && is_string($_POST['menu_name']) ? trim(sanitize_text_field(wp_unslash($_POST['menu_name']))) : '';
        if ($menu_name === '') {
            wp_send_json_error(['message' => '请输入菜单名称。'], 400);
        }

        $locations = get_nav_menu_locations();
        if (!empty($locations[$location_id]) && wp_get_nav_menu_object($locations[$location_id])) {
            wp_send_json_error(['message' => '这个位置已分配菜单，请重新选择位置以读取最新内容。'], 409);
        }
        $menu_id = wp_create_nav_menu(wp_slash($menu_name));
        if (is_wp_error($menu_id) || !$menu_id) {
            $message = is_wp_error($menu_id) ? wp_strip_all_tags($menu_id->get_error_message()) : '菜单创建失败，请重试。';
            if (is_wp_error($menu_id) && $menu_id->get_error_code() === 'menu_exists') {
                $message = '菜单名称已存在，请换一个名称。';
            }
            wp_send_json_error(['message' => $message], 400);
        }

        // 重新读取位置，保留其他位置的分配；若此位置已被另一请求占用，不覆盖它。
        $locations = get_nav_menu_locations();
        if (!empty($locations[$location_id]) && wp_get_nav_menu_object($locations[$location_id])) {
            wp_send_json_error(['message' => '菜单已创建，但当前位置刚被其他菜单占用，请到 WordPress 菜单编辑器分配。'], 409);
        }
        $locations[$location_id] = absint($menu_id);
        set_theme_mod('nav_menu_locations', $locations);
        $data = self::payload($location_id, $menu_id);
        if (is_wp_error($data)) {
            wp_send_json_error(['message' => $data->get_error_message()], 400);
        }
        wp_send_json_success($data);
    }

    public static function ajax_get()
    {
        check_ajax_referer('eva_fw_guide', 'nonce');
        self::authorize();
        self::load_menu_api();

        $location_id = isset($_POST['location_id']) ? sanitize_key(wp_unslash($_POST['location_id'])) : '';
        $data = self::payload($location_id);
        if (is_wp_error($data)) {
            wp_send_json_error(['message' => $data->get_error_message()], 400);
        }
        if (!empty($_POST['include_resources'])) {
            $resources = \Eva\Framework\Admin\Fields\Data_Selector::menu_resources(array_fill_keys(['page', 'post', 'category', 'post_tag'], ''));
            if (!is_wp_error($resources)) { $data['resources'] = $resources; }
        }

        wp_send_json_success($data);
    }

    public static function ajax_resources()
    {
        check_ajax_referer('eva_fw_guide', 'nonce');
        self::authorize();
        $queries = isset($_POST['queries']) ? json_decode(wp_unslash((string) $_POST['queries']), true) : [];
        $resources = \Eva\Framework\Admin\Fields\Data_Selector::menu_resources($queries);
        if (is_wp_error($resources)) {
            wp_send_json_error(['message' => $resources->get_error_message()], $resources->get_error_code() === 'forbidden' ? 403 : 400);
        }
        wp_send_json_success(['resources' => $resources]);
    }

    public static function ajax_save()
    {
        check_ajax_referer('eva_fw_guide', 'nonce');
        self::authorize();
        self::load_menu_api();

        $location_id = isset($_POST['location_id']) ? sanitize_key(wp_unslash($_POST['location_id'])) : '';
        $registered   = get_registered_nav_menus();
        if ($location_id === '' || ! isset($registered[$location_id])) {
            wp_send_json_error(['message' => 'Invalid menu location.'], 400);
        }

        $menu_id = isset($_POST['menu_id']) ? absint($_POST['menu_id']) : 0;
        $menu    = $menu_id ? wp_get_nav_menu_object($menu_id) : false;
        if (! $menu) {
            wp_send_json_error(['message' => 'No menu is selected for this location.'], 400);
        }

        $items_json = isset($_POST['items']) ? wp_unslash((string) $_POST['items']) : '[]';
        $items      = json_decode($items_json, true);
        if (! is_array($items) || count($items) > 500) {
            wp_send_json_error(['message' => 'Invalid menu items.'], 400);
        }

        $current_items = (array) wp_get_nav_menu_items($menu_id, [
            'post_status' => 'publish,draft',
            'orderby'     => 'menu_order',
            'order'       => 'ASC',
        ]);
        $current_by_id = [];
        foreach ($current_items as $current_item) {
            $current_by_id[absint($current_item->ID)] = $current_item;
        }

        $removed_json = isset($_POST['removed_ids']) ? wp_unslash((string) $_POST['removed_ids']) : '[]';
        $removed_ids  = json_decode($removed_json, true);
        if (! is_array($removed_ids)) {
            wp_send_json_error(['message' => 'Invalid removed menu items.'], 400);
        }
        $removed_lookup = [];
        foreach ($removed_ids as $removed_id) {
            $removed_id = absint($removed_id);
            if (! $removed_id || ! isset($current_by_id[$removed_id]) || isset($removed_lookup[$removed_id])) {
                wp_send_json_error(['message' => 'A menu item cannot be removed from this menu.'], 400);
            }
            $removed_lookup[$removed_id] = true;
        }

        $submitted_ids = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $item_id = isset($item['id']) ? absint($item['id']) : 0;
            if ($item_id > 0) {
                if (! isset($current_by_id[$item_id]) || isset($submitted_ids[$item_id]) || isset($removed_lookup[$item_id])) {
                    wp_send_json_error(['message' => 'The menu changed. Reload it and try again.'], 409);
                }
                $submitted_ids[$item_id] = true;
            }
        }
        if (count($submitted_ids) !== count($current_by_id) - count($removed_lookup)) {
            wp_send_json_error(['message' => 'The menu changed. Reload it and try again.'], 409);
        }

        $raw_assigned = isset($_POST['assigned_locations']) ? wp_unslash((string) $_POST['assigned_locations']) : '';
        $requested_locations = json_decode($raw_assigned, true);
        if (! is_array($requested_locations)) {
            wp_send_json_error(['message' => 'Invalid menu locations.'], 400);
        }
        $requested_locations = array_values(array_unique(array_map('sanitize_key', $requested_locations)));
        foreach ($requested_locations as $requested_id) {
            if (! isset($registered[$requested_id])) {
                wp_send_json_error(['message' => 'Invalid menu location.'], 400);
            }
        }

        $menu_name = isset($_POST['menu_name']) ? sanitize_text_field(wp_unslash($_POST['menu_name'])) : '';
        if ($menu_name === '') {
            wp_send_json_error(['message' => 'Menu name cannot be empty.'], 400);
        }
        $menu_result = wp_update_nav_menu_object($menu_id, wp_slash(['menu-name' => $menu_name]));
        if (is_wp_error($menu_result)) {
            wp_send_json_error(['message' => $menu_result->get_error_message()], 400);
        }

        $client_keys = [];
        foreach (array_values($items) as $position => $item) {
            if (! is_array($item)) {
                continue;
            }

            $item_id = isset($item['id']) ? absint($item['id']) : 0;
            $current = $item_id > 0 && isset($current_by_id[$item_id]) ? $current_by_id[$item_id] : null;
            $title = isset($item['title']) ? sanitize_text_field((string) $item['title']) : '';
            $requested_url = isset($item['url']) ? esc_url_raw((string) $item['url']) : '';
            $resource_type = isset($item['resource_type']) ? sanitize_key((string) $item['resource_type']) : '';
            $resource_id = isset($item['resource_id']) ? absint($item['resource_id']) : 0;
            $status = $current && isset($current->post_status) && $current->post_status === 'draft' ? 'draft' : 'publish';

            $native_type = '';
            $native_object = '';
            $native_object_id = 0;
            if ($resource_id > 0 && in_array($resource_type, ['post', 'page'], true)) {
                $resource = get_post($resource_id);
                if (! $resource || $resource->post_type !== $resource_type) {
                    wp_send_json_error(['message' => 'The selected page or post no longer exists.'], 400);
                }
                $native_type = 'post_type';
                $native_object = $resource_type;
                $native_object_id = $resource_id;
            } elseif ($resource_id > 0 && in_array($resource_type, ['category', 'post_tag', 'post_format'], true)) {
                $resource = get_term($resource_id, $resource_type);
                if (! $resource || is_wp_error($resource)) {
                    wp_send_json_error(['message' => 'The selected taxonomy term no longer exists.'], 400);
                }
                $native_type = 'taxonomy';
                $native_object = $resource_type;
                $native_object_id = $resource_id;
            }

            $current_type = $current && isset($current->type) ? sanitize_key($current->type) : '';
            $current_object = $current && isset($current->object) ? sanitize_key($current->object) : '';
            $current_object_id = $current && isset($current->object_id) ? absint($current->object_id) : 0;
            $current_url = $current ? esc_url_raw((string) $current->url) : '';
            $same_resource = $current && $resource_type === $current_object && $resource_id === $current_object_id;
            $manual_url_override = $current && $current_type !== 'custom' && $same_resource && $requested_url !== $current_url;

            if ($manual_url_override) {
                $native_type = '';
            }
            if ($native_type !== '' && ! $manual_url_override) {
                $type = $native_type;
                $object = $native_object;
                $object_id = $native_object_id;
                $url = '';
            } elseif ($current && $current_type !== 'custom' && ! $manual_url_override && $requested_url === $current_url && ($resource_type === '' || $same_resource)) {
                $type = $current_type;
                $object = $current_object;
                $object_id = $current_object_id;
                $url = '';
            } else {
                $type = 'custom';
                $object = 'custom';
                $object_id = 0;
                $url = $requested_url;
            }
            if ($type === 'custom' && $title === '' && $item_id === 0) {
                continue;
            }
            if ($title === '') {
                wp_send_json_error(['message' => 'Menu item names cannot be empty.'], 400);
            }

            $target = isset($item['target']) ? sanitize_text_field((string) $item['target']) : ($current && isset($current->target) ? sanitize_text_field($current->target) : '_self');
            $rel = isset($item['rel']) ? sanitize_text_field((string) $item['rel']) : ($current && isset($current->xfn) ? sanitize_text_field($current->xfn) : '');
            $attr_title = isset($item['attr_title']) ? sanitize_text_field((string) $item['attr_title']) : ($current && isset($current->attr_title) ? sanitize_text_field($current->attr_title) : '');
            if ($type === 'custom' && class_exists('Eva\\Framework\\Admin\\Fields\\Link')) {
                $link = \Eva\Framework\Admin\Fields\Link::sanitize([
                    'url' => $url,
                    'text' => $title,
                    'target' => $target,
                    'rel' => $rel,
                    'title' => $attr_title,
                ]);
                $url = $link['url'];
                $title = $link['text'];
                $target = $link['target'];
                $rel = $link['rel'];
                $attr_title = $link['title'];
            }
            if ($type === 'custom' && $url === '') {
                wp_send_json_error(['message' => 'Custom links need a valid URL.'], 400);
            }

            $parent_id = isset($item['parent']) ? absint($item['parent']) : ($current ? absint($current->menu_item_parent) : 0);
            $parent_chain = [];
            while ($parent_id > 0 && isset($removed_lookup[$parent_id]) && ! isset($parent_chain[$parent_id])) {
                $parent_chain[$parent_id] = true;
                $removed_parent = $current_by_id[$parent_id] ?? null;
                $parent_id = $removed_parent ? absint($removed_parent->menu_item_parent) : 0;
            }
            if ($parent_id === $item_id || ($parent_id > 0 && ! isset($submitted_ids[$parent_id]))) {
                $parent_id = 0;
            }

            $classes_raw = isset($item['classes'])
                ? (string) $item['classes']
                : ($current && isset($current->classes) ? implode(' ', (array) $current->classes) : '');
            $classes = preg_split('/\s+/', trim($classes_raw));
            $classes = array_values(array_filter(array_map('sanitize_html_class', is_array($classes) ? $classes : [])));

            $args = [
                'menu-item-db-id'       => $item_id,
                'menu-item-object-id'   => $object_id,
                'menu-item-object'      => $object,
                'menu-item-parent-id'   => $parent_id,
                'menu-item-position'    => $position + 1,
                'menu-item-type'        => $type,
                'menu-item-title'       => $title,
                'menu-item-url'         => $url,
                'menu-item-description' => $current && isset($current->description) ? sanitize_text_field($current->description) : '',
                'menu-item-attr-title'  => $attr_title,
                'menu-item-target'      => $target,
                'menu-item-xfn'         => $rel,
                'menu-item-classes'     => implode(' ', $classes),
                'menu-item-status'      => $status,
            ];
            $saved_id = wp_update_nav_menu_item($menu_id, $item_id, wp_slash($args));
            if (is_wp_error($saved_id) || ! $saved_id) {
                $message = is_wp_error($saved_id) ? $saved_id->get_error_message() : 'Could not save a menu item.';
                wp_send_json_error(['message' => $message], 500);
            }

            $saved_id = absint($saved_id);
            if (array_key_exists('icon', $item)) {
                update_post_meta($saved_id, self::icon_meta_key(), \Eva\Framework\Admin\Fields\Icon::sanitize($item['icon']));
            }
            $client_key = isset($item['client_key']) ? sanitize_text_field((string) $item['client_key']) : '';
            if ($client_key !== '') {
                $client_keys[$saved_id] = $client_key;
            }
        }

        if ($removed_lookup && ! EMPTY_TRASH_DAYS) {
            wp_send_json_error(['message' => 'Trash is disabled, so menu items were not removed.'], 409);
        }
        foreach (array_keys($removed_lookup) as $removed_id) {
            if (! wp_trash_post($removed_id)) {
                wp_send_json_error(['message' => 'Could not move a menu item to the trash.'], 500);
            }
        }

        $locations = get_nav_menu_locations();
        foreach ($registered as $registered_id => $registered_label) {
            if (in_array($registered_id, $requested_locations, true)) {
                $locations[$registered_id] = $menu_id;
            } elseif (absint($locations[$registered_id] ?? 0) === $menu_id) {
                unset($locations[$registered_id]);
            }
        }
        set_theme_mod('nav_menu_locations', $locations);

        $data = self::payload($location_id, $menu_id);
        if (is_wp_error($data)) {
            wp_send_json_error(['message' => $data->get_error_message()], 400);
        }
        foreach ($data['items'] as &$saved_item) {
            $saved_id = absint($saved_item['id']);
            if (isset($client_keys[$saved_id])) {
                $saved_item['client_key'] = $client_keys[$saved_id];
            }
        }
        unset($saved_item);

        wp_send_json_success($data);
    }

    private static function authorize()
    {
        if (! current_user_can('edit_theme_options')) {
            wp_send_json_error(['message' => 'You are not allowed to edit menus.'], 403);
        }
    }

    /** Match the theme's existing menu icon field; other themes can supply their meta key. */
    private static function icon_meta_key()
    {
        return (string) apply_filters('eva_builder_menu_icon_meta_key', 'custom_icon_picker');
    }

    private static function load_menu_api()
    {
        if (! function_exists('get_registered_nav_menus') || ! function_exists('get_nav_menu_locations')) {
            require_once ABSPATH . WPINC . '/nav-menu.php';
        }
    }

    private static function payload($location_id, $menu_id_override = 0)
    {
        $registered = get_registered_nav_menus();
        if ($location_id === '' || ! isset($registered[$location_id])) {
            return new \WP_Error('invalid_location', 'Invalid menu location.');
        }

        $assigned = get_nav_menu_locations();
        $menu_id  = absint($menu_id_override);
        if ($menu_id < 1) {
            $menu_id = absint($assigned[$location_id] ?? 0);
        }
        $menu = $menu_id ? wp_get_nav_menu_object($menu_id) : false;
        if ($menu_id && ! $menu) {
            return new \WP_Error('invalid_menu', 'The assigned menu could not be found.');
        }

        $items = [];
        if ($menu_id) {
            foreach ((array) wp_get_nav_menu_items($menu_id, [
                'post_status' => 'publish,draft',
                'orderby'     => 'menu_order',
                'order'       => 'ASC',
            ]) as $item) {
                $classes = array_values(array_filter(array_map('sanitize_html_class', (array) ($item->classes ?? []))));
                $items[] = [
                    'id'          => absint($item->ID),
                    'parent'      => absint($item->menu_item_parent),
                    'title'       => sanitize_text_field((string) $item->title),
                    'icon'        => \Eva\Framework\Admin\Fields\Icon::sanitize(get_post_meta($item->ID, self::icon_meta_key(), true)),
                    'url'         => esc_url_raw((string) $item->url),
                    'type'        => sanitize_key((string) $item->type),
                    'object'      => sanitize_key((string) $item->object),
                    'object_id'   => absint($item->object_id),
                    'resource_type' => in_array($item->type, ['post_type', 'taxonomy'], true) && in_array($item->object, ['post', 'page', 'category', 'post_tag', 'post_format'], true) ? sanitize_key($item->object) : '',
                    'resource_id'   => in_array($item->type, ['post_type', 'taxonomy'], true) && in_array($item->object, ['post', 'page', 'category', 'post_tag', 'post_format'], true) ? absint($item->object_id) : 0,
                    'status'      => isset($item->post_status) && $item->post_status === 'draft' ? 'draft' : 'publish',
                    'attr_title'  => sanitize_text_field((string) ($item->attr_title ?? '')),
                    'target'      => sanitize_text_field((string) ($item->target ?? '')),
                    'rel'         => sanitize_text_field((string) ($item->xfn ?? '')),
                    'classes'     => implode(' ', $classes),
                    'description' => sanitize_text_field((string) ($item->description ?? '')),
                ];
            }
        }

        $locations_data = [];
        $location_data  = [];
        foreach ($registered as $registered_id => $registered_label) {
            $current_menu_id = absint($assigned[$registered_id] ?? 0);
            $current_menu    = $current_menu_id ? wp_get_nav_menu_object($current_menu_id) : false;
            $current_name    = $current_menu && isset($current_menu->name) ? sanitize_text_field($current_menu->name) : '';
            $label           = sanitize_text_field($registered_label);
            $locations_data[] = [
                'id'                 => sanitize_key($registered_id),
                'label'              => $label,
                'checked'            => $menu_id > 0 && $current_menu_id === $menu_id,
                'assigned_menu_id'   => $current_menu_id,
                'assigned_menu_name' => $current_name,
            ];
            $location_data[] = [
                'id'        => sanitize_key($registered_id),
                'label'     => $label,
                'menu_id'   => $current_menu_id,
                'menu_name' => $current_name,
            ];
        }

        return [
            'location_id'        => $location_id,
            'location_label'     => sanitize_text_field($registered[$location_id]),
            'menu_id'            => $menu_id,
            'menu_name'          => $menu && isset($menu->name) ? sanitize_text_field($menu->name) : '',
            'items'              => $items,
            'locations'          => $locations_data,
            'menu_location_data' => $location_data,
            'customizer_url'     => esc_url_raw(admin_url('customize.php?autofocus[panel]=nav_menus')),
        ];
    }
}
