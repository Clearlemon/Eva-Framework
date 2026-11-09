<?php

namespace Eva\Framework;

if (!defined('ABSPATH')) { exit; }

/** Authenticated REST transport for framework operations and their legacy adapters. */
class Rest extends \WP_REST_Controller
{
    public static function init()
    {
        add_action('rest_api_init', [new self(), 'register_routes']);
        require_once EVA_FW_DIR . 'includes/class-eva-backup-rest.php';
        add_action('rest_api_init', [new BackupRest(), 'register_routes']);
    }

    private static function definitions()
    {
        $text = ['type' => 'string', 'maxLength' => 500, 'sanitize_callback' => 'sanitize_text_field'];
        $id = ['type' => 'integer', 'minimum' => 0];
        $object = ['type' => 'object', 'additionalProperties' => true];
        $strings = ['type' => 'array', 'items' => ['type' => 'string'], 'maxItems' => 500];
        $menu = ['location_id' => $text + ['required' => true], 'menu_id' => $id];
        $option = ['option_id' => $text + ['required' => true]];
        return [
            'eva_fw_search_data' => ['resources', 'GET', [Admin\Fields\Data_Selector::class, 'request_search'], 'resources', [
                'resource' => ['type' => 'string', 'enum' => ['posts', 'terms', 'users', 'menus', 'sidebars'], 'default' => 'posts'],
                'q' => $text + ['default' => ''], 'include' => $text,
                'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50, 'default' => 20],
                'post_type' => $text, 'taxonomy' => $text, 'role' => $text,
            ]],
            'eva_fw_save_options' => ['options', 'POST', [Data::class, 'request_save'], 'options', $option + ['values' => $object + ['required' => true]]],
            'eva_fw_builder_history' => ['builder/history', 'GET', [Builder\SaveHistory::class, 'request_get'], 'options', $option + ['field_id' => $text + ['required' => true], 'history_id' => $text]],
            'eva_fw_render_builder_preview' => ['builder/preview', 'POST', ['Eva', 'request_render_builder_preview'], 'manage_options', [
                'value' => $object + ['required' => true], 'structure_values' => $object,
                'preview_role' => $text, 'option_id' => $text, 'field_id' => $text, 'page_id' => $text,
            ]],
            'eva_fw_builder_widgets_get' => ['widgets', 'GET', [Builder\NativeWidgets::class, 'request_get'], 'edit_theme_options', []],
            'eva_fw_builder_widget_change' => ['widgets/assignment', 'POST', [Builder\WidgetEditor::class, 'request_change'], 'edit_theme_options', [
                'operation' => ['type' => 'string', 'enum' => ['add', 'move', 'remove'], 'required' => true],
                'area' => $text + ['required' => true], 'widget' => $text + ['required' => true], 'before' => $text,
            ]],
            'eva_fw_builder_menu_get' => ['menus', 'GET', [Builder\MenuEditor::class, 'request_get'], 'edit_theme_options', $menu + ['include_resources' => ['type' => 'boolean', 'default' => false]]],
            'eva_fw_builder_menu_resources' => ['menus/resources', 'POST', [Builder\MenuEditor::class, 'request_resources'], 'edit_theme_options', ['queries' => $object + ['required' => true]]],
            'eva_fw_builder_menu_create' => ['menus', 'POST', [Builder\MenuEditor::class, 'request_create'], 'edit_theme_options', $menu + ['menu_name' => $text + ['required' => true]]],
            'eva_fw_builder_menu_assign' => ['menus/assignment', 'POST', [Builder\MenuEditor::class, 'request_assign'], 'edit_theme_options', $menu],
            'eva_fw_builder_menu_save' => ['menus/items', 'POST', [Builder\MenuEditor::class, 'request_save'], 'edit_theme_options', $menu + [
                'menu_name' => $text,
                'items' => ['type' => 'array', 'items' => $object, 'maxItems' => 500, 'required' => true],
                'removed_ids' => ['type' => 'array', 'items' => $id, 'maxItems' => 500, 'required' => true],
                'assigned_locations' => $strings + ['required' => true], 'history_restore_id' => $text,
            ]],
            'eva_fw_import_media_urls' => ['media/import', 'POST', [Admin\Fields\Media::class, 'request_import_urls'], 'upload_files', [
                'urls' => ['type' => 'array', 'items' => ['type' => 'string', 'format' => 'uri'], 'minItems' => 1, 'maxItems' => 30, 'required' => true],
            ]],
            'eva_fw_set_guide' => ['preferences/guide', 'POST', [Admin::class, 'request_set_guide'], 'manage_options', ['visible' => ['type' => 'string', 'enum' => ['0', '1'], 'required' => true]]],
            'eva_fw_set_floating' => ['preferences/floating', 'POST', [Admin::class, 'request_set_floating'], 'manage_options', ['enabled' => ['type' => 'string', 'enum' => ['0', '1'], 'required' => true]]],
            'eva_fw_set_accent' => ['preferences/accent', 'POST', [Admin::class, 'request_set_accent'], 'read', ['key' => $text, 'color' => $text, 'c600' => $text, 'c050' => $text]],
            'eva_fw_set_dark' => ['preferences/dark', 'POST', [Admin::class, 'request_set_dark'], 'read', ['dark' => ['type' => 'string', 'enum' => ['0', '1'], 'required' => true]]],
        ];
    }

    public function register_routes()
    {
        foreach (self::definitions() as $definition) {
            [$path, $method, $handler, $capability, $args] = $definition;
            register_rest_route('eva/v1', '/' . $path, [
                'methods' => $method,
                'args' => $args,
                'permission_callback' => static function ($request) use ($capability) {
                    return self::permission($capability, $request);
                },
                'callback' => static function ($request) use ($handler) {
                    $user = wp_get_current_user();
                    try {
                        // Existing sanitizers expect WordPress-slashed values; no request globals are changed.
                        return rest_ensure_response(call_user_func($handler, wp_slash($request->get_params())));
                    } finally {
                        $GLOBALS['current_user'] = $user;
                    }
                },
            ]);
        }
        if (defined('EVA_FW_DEV') && EVA_FW_DEV) {
            register_rest_route('eva/v1', '/development/stamp', [
                'methods' => 'GET',
                'permission_callback' => static function () { return self::permission('edit_posts', null); },
                'callback' => static function () { return rest_ensure_response(['stamp' => \Eva::dev_watch_stamp()]); },
            ]);
        }
    }

    private static function permission($capability, $request)
    {
        if (!is_user_logged_in()) { return self::error(['message' => 'Authentication required.'], 401); }
        if ($capability === 'resources') {
            $allowed = Admin\Fields\Data_Selector::can_search($request['resource']);
        } elseif ($capability === 'options') {
            $option = \Eva::get_resolved($request['option_id']);
            if (!$option) { return self::error(['message' => 'Unknown option.'], 404); }
            $allowed = current_user_can(trim((string) ($option['capability'] ?? 'manage_options')) ?: 'manage_options');
        } else {
            $allowed = current_user_can($capability);
        }
        return $allowed ? true : self::error(['message' => 'You are not allowed to perform this operation.'], 403);
    }

    public static function config()
    {
        $routes = [];
        foreach (self::definitions() as $action => $definition) {
            $routes[$action] = ['url' => rest_url('eva/v1/' . $definition[0]), 'method' => $definition[1]];
        }
        $routes['eva_fw_search_posts'] = $routes['eva_fw_search_data'];
        return $routes;
    }

    public static function enqueue()
    {
        wp_enqueue_script('eva-axios', EVA_FW_URL . 'assets/vendor/axios.min.js', [], '1.20.0', true);
        wp_enqueue_script('eva-api', EVA_FW_URL . 'assets/eva-api.js', ['eva-axios'], \Eva::asset_ver('assets/eva-api.js'), true);
    }

    public static function decode($value)
    {
        return is_array($value) ? wp_unslash($value) : json_decode(wp_unslash((string) $value), true);
    }

    public static function error($data, $status = 400)
    {
        $message = is_array($data) ? ($data['message'] ?? ($data['msg'] ?? 'Request failed.')) : (string) $data;
        return new \WP_Error('eva_request_failed', $message, ['status' => (int) $status, 'details' => $data]);
    }

    /** Preserve third-party AJAX callers while all bundled consumers use REST. */
    public static function legacy($result)
    {
        if (is_wp_error($result)) {
            $data = $result->get_error_data();
            wp_send_json_error($data['details'] ?? ['message' => $result->get_error_message()], $data['status'] ?? 400);
        }
        wp_send_json_success($result);
    }
}
