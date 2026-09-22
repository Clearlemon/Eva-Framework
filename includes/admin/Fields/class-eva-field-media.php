<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** Media field sanitizer for attachment IDs, URLs and normalized media objects. */
class Media
{
    /** 批量下载远程 URL 并注册为 WordPress 媒体附件。 */
    public static function ajax_import_urls()
    {
        if (! check_ajax_referer('eva_fw_guide', 'nonce', false)) {
            wp_send_json_error(['msg' => 'bad_nonce'], 403);
        }
        if (! current_user_can('upload_files')) {
            wp_send_json_error(['msg' => 'forbidden'], 403);
        }

        $raw = isset($_POST['urls']) ? json_decode(wp_unslash($_POST['urls']), true) : [];
        $urls = is_array($raw) ? $raw : preg_split('/\r\n|\r|\n/', (string) $raw);
        $urls = array_values(array_unique(array_filter(array_map('trim', $urls))));
        if (! $urls) {
            wp_send_json_error(['msg' => 'empty_urls'], 400);
        }
        if (count($urls) > 30) {
            $urls = array_slice($urls, 0, 30);
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $items = [];
        $failed = [];
        foreach ($urls as $url) {
            $url = esc_url_raw($url);
            $host = wp_parse_url($url, PHP_URL_HOST);
            if (! preg_match('#^https?://#i', $url) || ! $host || ! wp_http_validate_url($url)) {
                $failed[] = ['url' => $url, 'message' => 'URL 无效或不允许访问'];
                continue;
            }

            $existing = get_posts([
                'post_type'      => 'attachment',
                'post_status'    => 'inherit',
                'posts_per_page' => 1,
                'fields'         => 'ids',
                'meta_key'       => '_eva_media_source_url',
                'meta_value'     => $url,
            ]);
            if (! empty($existing[0])) {
                $items[] = self::attachment_item((int) $existing[0]);
                continue;
            }

            $tmp = download_url($url, 30);
            if (is_wp_error($tmp)) {
                $failed[] = ['url' => $url, 'message' => $tmp->get_error_message()];
                continue;
            }

            $size = file_exists($tmp) ? filesize($tmp) : 0;
            if ($size > 20 * 1024 * 1024) {
                @unlink($tmp);
                $failed[] = ['url' => $url, 'message' => '文件超过 20MB 限制'];
                continue;
            }

            $path = (string) wp_parse_url($url, PHP_URL_PATH);
            $name = sanitize_file_name(wp_basename($path)) ?: 'eva-import-' . time() . '.bin';
            $file = [
                'name'     => $name,
                'type'     => function_exists('mime_content_type') ? (string) mime_content_type($tmp) : '',
                'tmp_name' => $tmp,
                'error'    => 0,
                'size'     => $size,
            ];
            $attachment_id = media_handle_sideload($file, 0);
            if (is_wp_error($attachment_id)) {
                @unlink($tmp);
                $failed[] = ['url' => $url, 'message' => $attachment_id->get_error_message()];
                continue;
            }
            update_post_meta($attachment_id, '_eva_media_source_url', $url);
            $items[] = self::attachment_item((int) $attachment_id);
        }

        wp_send_json_success(['items' => array_values(array_filter($items)), 'failed' => $failed]);
    }

    /** 生成前端媒体控件使用的附件摘要。 */
    private static function attachment_item($id)
    {
        $data = function_exists('wp_prepare_attachment_for_js') ? wp_prepare_attachment_for_js($id) : [];
        if (! is_array($data)) { return null; }
        $sizes = [];
        foreach ((array) ($data['sizes'] ?? []) as $key => $size) {
            if (! empty($size['url'])) { $sizes[$key] = esc_url_raw($size['url']); }
        }
        return [
            'id' => $id,
            'url' => esc_url_raw($data['url'] ?? ''),
            'thumb' => esc_url_raw($data['sizes']['thumbnail']['url'] ?? ($data['url'] ?? '')),
            'title' => sanitize_text_field($data['title'] ?? ''),
            'filename' => sanitize_file_name($data['filename'] ?? ''),
            'mime' => sanitize_mime_type($data['mime'] ?? ''),
            'width' => absint($data['width'] ?? 0),
            'height' => absint($data['height'] ?? 0),
            'size' => sanitize_text_field($data['filesizeHumanReadable'] ?? ''),
            'alt' => sanitize_text_field($data['alt'] ?? ''),
            'sizes' => $sizes,
        ];
    }

    public static function sanitize($value, $field = [])
    {
        $multiple = ! empty($field['multiple']);
        $items = self::is_list($value) ? $value : (($value === null || $value === '') ? [] : [$value]);
        $clean = [];

        foreach ($items as $item) {
            $normalized = self::normalize_item($item);
            if ($normalized === null || ! self::allowed($normalized, $field)) {
                continue;
            }
            $clean[] = self::format_return($normalized, $field);
        }

        $max = isset($field['max_items']) ? absint($field['max_items']) : (isset($field['limit']) ? absint($field['limit']) : 0);
        if ($max > 0) {
            $clean = array_slice($clean, 0, $max);
        }

        if ($multiple) {
            return array_values($clean);
        }
        return isset($clean[0]) ? $clean[0] : self::empty_value($field);
    }

    public static function sanitize_gallery($value, $field = [])
    {
        $field['multiple'] = true;
        $field['media_type'] = 'image';
        if (empty($field['return_type'])) {
            $field['return_type'] = 'array';
        }
        return self::sanitize($value, $field);
    }

    private static function is_list($value)
    {
        if (! is_array($value) || $value === []) {
            return false;
        }
        return array_keys($value) === range(0, count($value) - 1);
    }

    private static function normalize_item($value)
    {
        if (is_numeric($value)) {
            $id = absint($value);
            return $id ? self::from_attachment($id) : null;
        }

        if (is_string($value)) {
            $url = esc_url_raw(trim($value));
            return $url === '' ? null : [
                'id' => 0,
                'url' => $url,
                'thumb' => '',
                'title' => sanitize_text_field(wp_basename((string) wp_parse_url($url, PHP_URL_PATH))),
                'filename' => sanitize_text_field(wp_basename((string) wp_parse_url($url, PHP_URL_PATH))),
                'mime' => self::mime_from_url($url),
                'width' => 0,
                'height' => 0,
                'size' => '',
            ];
        }

        if (! is_array($value)) {
            return null;
        }

        $id = isset($value['id']) ? absint($value['id']) : 0;
        $base = $id ? self::from_attachment($id) : [];
        $out = [
            'id' => $id,
            'url' => isset($value['url']) ? esc_url_raw((string) $value['url']) : (isset($base['url']) ? $base['url'] : ''),
            'thumb' => isset($value['thumb']) ? esc_url_raw((string) $value['thumb']) : (isset($base['thumb']) ? $base['thumb'] : ''),
            'title' => isset($value['title']) ? sanitize_text_field((string) $value['title']) : (isset($base['title']) ? $base['title'] : ''),
            'filename' => isset($value['filename']) ? sanitize_file_name((string) $value['filename']) : (isset($base['filename']) ? $base['filename'] : ''),
            'mime' => isset($value['mime']) ? sanitize_mime_type((string) $value['mime']) : (isset($base['mime']) ? $base['mime'] : ''),
            'width' => isset($value['width']) ? absint($value['width']) : (isset($base['width']) ? $base['width'] : 0),
            'height' => isset($value['height']) ? absint($value['height']) : (isset($base['height']) ? $base['height'] : 0),
            'size' => isset($value['size']) ? sanitize_text_field((string) $value['size']) : (isset($base['size']) ? $base['size'] : ''),
            'alt' => isset($value['alt']) ? sanitize_text_field((string) $value['alt']) : (isset($base['alt']) ? $base['alt'] : ''),
            'caption' => isset($value['caption']) ? wp_kses_post((string) $value['caption']) : (isset($base['caption']) ? $base['caption'] : ''),
            'description' => isset($value['description']) ? wp_kses_post((string) $value['description']) : (isset($base['description']) ? $base['description'] : ''),
            'focalX' => isset($value['focalX']) ? min(100, max(0, (float) $value['focalX'])) : (isset($base['focalX']) ? $base['focalX'] : 50),
            'focalY' => isset($value['focalY']) ? min(100, max(0, (float) $value['focalY'])) : (isset($base['focalY']) ? $base['focalY'] : 50),
        ];

        if ($out['url'] === '' && ! $out['id']) {
            return null;
        }
        if ($out['mime'] === '' && $out['url'] !== '') {
            $out['mime'] = self::mime_from_url($out['url']);
        }
        if ($out['filename'] === '' && $out['url'] !== '') {
            $out['filename'] = sanitize_file_name(wp_basename((string) wp_parse_url($out['url'], PHP_URL_PATH)));
        }
        if ($out['title'] === '') {
            $out['title'] = $out['filename'];
        }
        return $out;
    }

    private static function from_attachment($id)
    {
        $url = function_exists('wp_get_attachment_url') ? wp_get_attachment_url($id) : '';
        $meta = function_exists('wp_get_attachment_metadata') ? (array) wp_get_attachment_metadata($id) : [];
        $file = function_exists('get_attached_file') ? get_attached_file($id) : '';
        $thumb = function_exists('wp_get_attachment_image_url') ? wp_get_attachment_image_url($id, 'thumbnail') : '';
        return [
            'id' => absint($id),
            'url' => $url ? esc_url_raw($url) : '',
            'thumb' => $thumb ? esc_url_raw($thumb) : '',
            'title' => function_exists('get_the_title') ? sanitize_text_field((string) get_the_title($id)) : '',
            'alt' => function_exists('get_post_meta') ? sanitize_text_field((string) get_post_meta($id, '_wp_attachment_image_alt', true)) : '',
            'caption' => function_exists('get_post_field') ? wp_kses_post((string) get_post_field('post_excerpt', $id)) : '',
            'description' => function_exists('get_post_field') ? wp_kses_post((string) get_post_field('post_content', $id)) : '',
            'filename' => $file ? sanitize_file_name(wp_basename($file)) : '',
            'mime' => function_exists('get_post_mime_type') ? sanitize_mime_type((string) get_post_mime_type($id)) : '',
            'width' => isset($meta['width']) ? absint($meta['width']) : 0,
            'height' => isset($meta['height']) ? absint($meta['height']) : 0,
            'size' => ($file && file_exists($file)) ? size_format(filesize($file)) : '',
            'focalX' => 50,
            'focalY' => 50,
        ];
    }

    private static function format_return($item, $field)
    {
        $type = strtolower((string) (isset($field['return_type']) ? $field['return_type'] : (isset($field['save_format']) ? $field['save_format'] : 'id')));
        if ($type === 'url') {
            return $item['url'];
        }
        if (in_array($type, ['array', 'object', 'full'], true)) {
            return $item;
        }
        return $item['id'] ?: $item['url'];
    }

    private static function empty_value($field)
    {
        $type = strtolower((string) (isset($field['return_type']) ? $field['return_type'] : 'id'));
        return in_array($type, ['array', 'object', 'full'], true) ? [] : '';
    }

    private static function allowed($item, $field)
    {
        $mime = strtolower((string) $item['mime']);
        $url = strtolower((string) $item['url']);
        $mode = strtolower((string) (isset($field['media_type']) ? $field['media_type'] : (isset($field['mode']) ? $field['mode'] : 'all')));
        $ext = strtolower((string) pathinfo((string) wp_parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));
        $groups = [
            'image' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'],
            'video' => ['mp4', 'webm', 'mov', 'm4v', 'avi'],
            'audio' => ['mp3', 'wav', 'ogg', 'm4a', 'flac'],
            'document' => ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip'],
        ];
        if (isset($groups[$mode]) && strpos($mime, $mode . '/') !== 0 && ! in_array($ext, $groups[$mode], true)) {
            return false;
        }
        $allowed = isset($field['allowed_types']) ? $field['allowed_types'] : (isset($field['mime_types']) ? $field['mime_types'] : []);
        if (is_string($allowed)) {
            $allowed = preg_split('/[\s,|]+/', strtolower($allowed), -1, PREG_SPLIT_NO_EMPTY);
        }
        if (! is_array($allowed) || $allowed === []) {
            return true;
        }
        foreach ($allowed as $token) {
            $token = strtolower(ltrim(trim((string) $token), '.'));
            if ($token === '' || $token === '*' || $token === $ext || $token === $mime || (substr($token, -2) === '/*' && strpos($mime, substr($token, 0, -1)) === 0)) {
                return true;
            }
        }
        return false;
    }

    private static function mime_from_url($url)
    {
        $check = function_exists('wp_check_filetype') ? wp_check_filetype((string) wp_parse_url($url, PHP_URL_PATH)) : [];
        return ! empty($check['type']) ? sanitize_mime_type($check['type']) : '';
    }
}
