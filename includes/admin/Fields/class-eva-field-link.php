<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** link 结构化链接字段清理器。 */
class Link
{
    public static function sanitize($value, $field = [])
    {
        if ($value === null && isset($field['default']) && is_array($field['default'])) {
            $value = $field['default'];
        }
        if (! is_array($value)) {
            return ['url' => '', 'text' => '', 'target' => '_self', 'rel' => '', 'title' => '', 'page' => 0, 'resource_type' => '', 'resource_id' => 0];
        }

        $url = isset($value['url']) && is_scalar($value['url']) ? esc_url_raw((string) $value['url']) : '';
        $target = isset($value['target']) && (string) $value['target'] === '_blank' ? '_blank' : '_self';
        $rel = isset($value['rel']) && is_scalar($value['rel']) ? self::sanitize_rel((string) $value['rel']) : '';
        if ($target === '_blank') {
            $tokens = preg_split('/\s+/', $rel, -1, PREG_SPLIT_NO_EMPTY);
            foreach (['noopener', 'noreferrer'] as $token) {
                if (! in_array($token, $tokens, true)) {
                    $tokens[] = $token;
                }
            }
            $rel = implode(' ', $tokens);
        }

        return [
            'url'    => $url,
            'text'   => isset($value['text']) && is_scalar($value['text']) ? sanitize_text_field((string) $value['text']) : '',
            'target' => $target,
            'rel'    => $rel,
            'title'  => isset($value['title']) && is_scalar($value['title']) ? sanitize_text_field((string) $value['title']) : '',
            'page'   => isset($value['page']) ? absint($value['page']) : 0,
            'resource_type' => isset($value['resource_type']) ? sanitize_key((string) $value['resource_type']) : '',
            'resource_id'   => isset($value['resource_id']) ? absint($value['resource_id']) : 0,
        ];
    }

    private static function sanitize_rel($value)
    {
        $allowed = ['alternate', 'author', 'bookmark', 'external', 'help', 'license', 'next', 'nofollow', 'noopener', 'noreferrer', 'prev', 'search', 'tag', 'ugc', 'sponsored'];
        $clean = [];
        foreach (preg_split('/\s+/', strtolower($value), -1, PREG_SPLIT_NO_EMPTY) as $token) {
            $token = sanitize_key($token);
            if (in_array($token, $allowed, true) && ! in_array($token, $clean, true)) {
                $clean[] = $token;
            }
        }
        return implode(' ', $clean);
    }
}
