<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * upload 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/Upload/Upload.js` 与 `Libs/Media/Media.js`，负责媒体值保存前清洗。
 */
class Upload
{
    /**
     * 功能：清洗 URL、附件 ID、媒体对象或多媒体数组。
     *
     * @param mixed $value 原始字段值。
     * @param array $field 字段配置。
     * @return mixed
     */
    public static function sanitize($value, $field = [])
    {
        if (is_array($value)) {
            if ($value === []) {
                return [];
            }
            $is_list = array_keys($value) === range(0, count($value) - 1);
            if ($is_list) {
                $out = [];
                foreach ($value as $item) {
                    $clean = self::sanitize($item, $field);
                    if ($clean !== '' && $clean !== []) {
                        $out[] = $clean;
                    }
                }
                return $out;
            }

            $allowed = ['id', 'url', 'title', 'filename', 'mime', 'width', 'height', 'size'];
            $out = [];
            foreach ($allowed as $key) {
                if (! array_key_exists($key, $value)) {
                    continue;
                }
                if ($key === 'id' || $key === 'width' || $key === 'height') {
                    $out[$key] = absint($value[$key]);
                } elseif ($key === 'url') {
                    $out[$key] = esc_url_raw((string) $value[$key]);
                } else {
                    $out[$key] = sanitize_text_field((string) $value[$key]);
                }
            }
            return $out;
        }

        if (is_numeric($value)) {
            return absint($value);
        }

        $value = trim((string) $value);
        if ($value === '') {
            return '';
        }

        return esc_url_raw($value);
    }
}
