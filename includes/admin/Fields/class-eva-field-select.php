<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * select 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/Select/Select.js` 与 `Libs/Eva-select/Eva-select.js`，
 * 同时承载 AJAX 搜索文章/页面的后台接口。
 */
class Select
{
    /**
     * 功能：清洗普通下拉、AJAX 下拉、单选和多选保存值。
     *
     * @param array $field 字段配置。
     * @param mixed $value 原始字段值。
     * @return string|int|array
     */
    public static function sanitize($field, $value)
    {
        $legacy_type = sanitize_key(isset($field['type']) ? $field['type'] : 'select');
        $legacy_sources = [
            'ajax_select' => 'posts', 'post_selector' => 'posts', 'post' => 'posts',
            'term_selector' => 'terms', 'term' => 'terms', 'taxonomy' => 'terms',
            'user_selector' => 'users', 'user' => 'users',
            'nav_menu' => 'menus', 'menu' => 'menus',
            'sidebar' => 'sidebars', 'sidebars' => 'sidebars',
        ];
        $source = isset($field['source']) ? $field['source'] : (isset($field['data_source']) ? $field['data_source'] : '');
        if ($source === '' && isset($legacy_sources[$legacy_type])) {
            $source = $legacy_sources[$legacy_type];
        }
        $relationship = $legacy_type === 'relationship'
            || (isset($field['variant']) && sanitize_key((string) $field['variant']) === 'relationship');
        if ($relationship) {
            $source = $source !== '' ? $source : (isset($field['resource']) ? $field['resource'] : 'posts');
            $field['multiple'] = true;
            $field['variant'] = 'relationship';
        }
        $source = sanitize_key(is_array($source) ? reset($source) : $source);
        if ($source !== '') {
            $field['type'] = 'select';
            $field['source'] = $source;
            return Data_Selector::sanitize($value, $field);
        }

        $multiple = ! empty($field['multiple']);
        $ajax = ! empty($field['ajax']) || (isset($field['type']) && $field['type'] === 'ajax_select');

        if ($multiple) {
            $values = is_array($value) ? $value : (($value === null || $value === '') ? [] : [$value]);
            $out = [];
            foreach ($values as $item) {
                $clean = $ajax ? absint($item) : sanitize_text_field((string) $item);
                if ($clean !== '' && $clean !== 0) {
                    $out[] = $clean;
                }
            }
            return array_values(array_unique($out));
        }

        return $ajax ? absint($value) : sanitize_text_field((string) $value);
    }

    /**
     * 功能：响应 ajax_select 字段的文章/页面远程搜索请求。
     *
     * @return void 以 JSON 响应并结束请求。
     */
    public static function ajax_search_posts()
    {
        if (! check_ajax_referer('eva_fw_guide', 'nonce', false)) {
            wp_send_json_error(['msg' => 'bad_nonce'], 403);
        }
        if (! current_user_can('edit_posts')) {
            wp_send_json_error(['msg' => 'forbidden'], 403);
        }

        $query = isset($_GET['q']) ? sanitize_text_field(wp_unslash($_GET['q'])) : '';
        $include = isset($_GET['include']) ? self::ajax_search_include_ids(wp_unslash($_GET['include'])) : [];
        $limit = isset($_GET['limit']) ? max(1, min(30, absint($_GET['limit']))) : 20;
        $post_types = self::ajax_search_post_types();

        $query_length = function_exists('mb_strlen') ? mb_strlen($query) : strlen($query);
        if (! $include && $query_length < 2) {
            wp_send_json_success(['items' => []]);
        }

        $args = [
            'post_type'      => $post_types,
            'post_status'    => ['publish', 'draft', 'pending', 'future', 'private'],
            'posts_per_page' => $limit,
            'no_found_rows'  => true,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ];

        if ($include) {
            $args['post__in'] = $include;
            $args['orderby'] = 'post__in';
        } else {
            $args['s'] = $query;
        }

        $posts = new \WP_Query($args);
        $items = [];

        foreach ($posts->posts as $post) {
            $type_object = get_post_type_object($post->post_type);
            $type_label = ($type_object && ! empty($type_object->labels->singular_name))
                ? $type_object->labels->singular_name
                : $post->post_type;
            $title = get_the_title($post);
            if ($title === '') {
                $title = '（无标题）';
            }
            $items[] = [
                'value'  => (string) $post->ID,
                'label'  => $title,
                'type'   => $type_label,
                'status' => get_post_status($post),
            ];
        }

        wp_send_json_success(['items' => $items]);
    }

    /**
     * 功能：读取并校验 AJAX 下拉允许搜索的 post type。
     *
     * @return string[]
     */
    private static function ajax_search_post_types()
    {
        $raw = isset($_GET['post_type']) ? wp_unslash($_GET['post_type']) : ['post', 'page'];
        if (is_string($raw)) {
            $raw = explode(',', $raw);
        }

        $types = [];
        foreach ((array) $raw as $type) {
            $type = sanitize_key($type);
            $object = $type ? get_post_type_object($type) : null;
            if ($object && ! empty($object->show_ui)) {
                $types[] = $type;
            }
        }

        return $types ?: ['post', 'page'];
    }

    /**
     * 功能：解析 AJAX 回填已有值时传入的文章 ID 列表。
     *
     * @param mixed $raw include 参数，可为逗号字符串或数组。
     * @return int[]
     */
    private static function ajax_search_include_ids($raw)
    {
        if (is_string($raw)) {
            $raw = explode(',', $raw);
        }

        $ids = [];
        foreach ((array) $raw as $id) {
            $id = absint($id);
            if ($id > 0) {
                $ids[] = $id;
            }
        }

        return array_values(array_unique($ids));
    }
}
