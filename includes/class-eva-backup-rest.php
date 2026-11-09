<?php

namespace Eva\Framework;

if (!defined('ABSPATH')) { exit; }

/** REST adapter for the existing Lentasy-owned backup field and storage contract. */
class BackupRest extends \WP_REST_Controller
{
    public function register_routes()
    {
        $text = ['type' => 'string', 'maxLength' => 200, 'sanitize_callback' => 'sanitize_text_field'];
        $this->route('', 'POST', 'create', [
            'name' => $text + ['default' => '未命名'],
            'items' => ['type' => 'array', 'minItems' => 1, 'maxItems' => 5, 'required' => true,
                'items' => ['type' => 'string', 'enum' => ['main', 'users', 'system', 'media', 'config']]],
        ]);
        $id = ['id' => $text + ['required' => true]];
        $this->route('/(?P<id>[a-zA-Z0-9_.-]+)', 'DELETE', 'delete', $id);
        $this->route('/(?P<id>[a-zA-Z0-9_.-]+)/restore', 'POST', 'restore', $id);
        $this->route('/restore', 'POST', 'upload', []);
        $this->route('/schedule', 'POST', 'schedule', [
            'enabled' => ['type' => 'string', 'enum' => ['0', '1'], 'required' => true],
            'frequency' => ['type' => 'string', 'enum' => ['每天', '每周', '每月', '每季度'], 'required' => true],
            'time' => ['type' => 'string', 'pattern' => '^([01][0-9]|2[0-3]):[0-5][0-9]$', 'required' => true],
            'keep' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 100, 'required' => true],
        ]);
    }

    private function route($path, $method, $callback, $args)
    {
        register_rest_route('eva/v1', '/integrations/lentasy/backups' . $path, [
            'methods' => $method, 'callback' => [$this, $callback], 'args' => $args,
            'permission_callback' => [$this, 'permission'],
        ]);
    }

    public function permission()
    {
        if (!current_user_can('manage_options')) { return Rest::error(['message' => '没有管理备份的权限。'], rest_authorization_required_code()); }
        if (!class_exists('LF\\Modules\\Settings\\Backups')) { return Rest::error(['message' => '当前主题未提供 Lentasy 备份服务。'], 501); }
        return true;
    }

    private function rows()
    {
        $rows = get_option('theme_backups_list', []);
        return is_array($rows) ? $rows : [];
    }

    public function create($request)
    {
        $data = [];
        foreach ($request['items'] as $item) { $data[$item] = $item === 'main' ? get_option('Leantasy', null) : null; }
        $bytes = strlen(wp_json_encode($data));
        $entry = [
            'id' => uniqid('bk_', true), 'name' => $request['name'], 'type' => 'manual',
            'time' => current_time('mysql'), 'items' => $request['items'], 'settings' => $data,
            'size_mb' => $bytes > 1048576 ? round($bytes / 1048576, 2) . ' MB' : round($bytes / 1024, 2) . ' KB',
        ];
        $rows = $this->rows(); array_unshift($rows, $entry);
        $settings = get_option('theme_auto_backup_settings', []);
        $rows = array_slice($rows, 0, max(1, min(100, (int) ($settings['keep'] ?? 5))));
        if (!update_option('theme_backups_list', $rows)) { return Rest::error(['message' => '备份写入失败。'], 500); }
        return rest_ensure_response(['id' => $entry['id'], 'message' => '备份成功创建']);
    }

    private function find($id)
    {
        foreach ($this->rows() as $row) { if (($row['id'] ?? '') === $id) { return $row; } }
        return null;
    }

    public function delete($request)
    {
        if (!$this->find($request['id'])) { return Rest::error(['message' => '未找到对应备份。'], 404); }
        $id = $request['id'];
        update_option('theme_backups_list', array_values(array_filter($this->rows(), static function ($row) use ($id) { return ($row['id'] ?? '') !== $id; })));
        return rest_ensure_response(['message' => '备份已删除']);
    }

    private function apply($settings)
    {
        // The source integration only owns Leantasy settings; files never name arbitrary options to write.
        if (!is_array($settings) || !isset($settings['main']) || !is_array($settings['main'])) {
            return Rest::error(['message' => '备份不包含有效的主题设置。'], 400);
        }
        update_option('Leantasy', $settings['main']);
        return rest_ensure_response(['message' => '恢复成功']);
    }

    public function restore($request)
    {
        $row = $this->find($request['id']);
        return $row ? $this->apply($row['settings'] ?? null) : Rest::error(['message' => '未找到对应备份。'], 404);
    }

    public function upload($request)
    {
        $files = $request->get_file_params();
        $file = $files['backup_file'] ?? [];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !isset($file['tmp_name'])
            || !is_uploaded_file($file['tmp_name']) || ($file['size'] ?? 0) > 10 * 1024 * 1024
            || !in_array(strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION)), ['json', 'bak'], true)) {
            return Rest::error(['message' => '请上传不超过 10MB 的 JSON 备份文件。'], 400);
        }
        return $this->apply(json_decode(file_get_contents($file['tmp_name']), true));
    }

    public function schedule($request)
    {
        $settings = ['enabled' => $request['enabled'] === '1', 'frequency' => $request['frequency'], 'time' => $request['time'], 'keep' => $request['keep']];
        update_option('theme_auto_backup_settings', $settings);
        wp_clear_scheduled_hook('theme_auto_backup_single');
        if ($settings['enabled']) {
            $provider = new \LF\Modules\Settings\Backups;
            $next = $provider->calculate_next_backup_time($settings['frequency'], $settings['time']);
            $result = wp_schedule_single_event($next, 'theme_auto_backup_single', [], true);
            if (is_wp_error($result)) { return $result; }
        }
        return rest_ensure_response(['message' => '设置保存成功']);
    }
}
