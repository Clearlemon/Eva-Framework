<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** WordPress CodeMirror field sanitizer and lightweight validator. */
class Code_Editor
{
    public static function sanitize($value, $field = [])
    {
        if (is_array($value) || is_object($value) || is_resource($value)) {
            return '';
        }
        $value = str_replace("\0", '', (string) $value);
        $value = str_replace(["\r\n", "\r"], "\n", $value);
        if (! empty($field['max_length'])) {
            $max = absint($field['max_length']);
            if ($max > 0) {
                $value = function_exists('mb_substr') ? mb_substr($value, 0, $max) : substr($value, 0, $max);
            }
        }
        return $value;
    }

    public static function validate($value, $field = [])
    {
        $value = (string) $value;
        if (trim($value) === '') {
            return '';
        }
        $mode = strtolower((string) (isset($field['mode']) ? $field['mode'] : (isset($field['language']) ? $field['language'] : 'html')));
        if ($mode === 'js') {
            $mode = 'javascript';
        }
        if ($mode === 'json') {
            json_decode($value, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return 'JSON 格式错误：' . json_last_error_msg();
            }
        }
        if ($mode === 'css' && ! self::valid_css_balance($value)) {
            return 'CSS 大括号、注释或引号未正确闭合。';
        }
        return '';
    }

    private static function valid_css_balance($value)
    {
        $depth = 0;
        $quote = '';
        $comment = false;
        $length = strlen($value);
        for ($i = 0; $i < $length; $i++) {
            $char = $value[$i];
            $next = $i + 1 < $length ? $value[$i + 1] : '';
            if ($comment) {
                if ($char === '*' && $next === '/') {
                    $comment = false;
                    $i++;
                }
                continue;
            }
            if ($quote === '' && $char === '/' && $next === '*') {
                $comment = true;
                $i++;
                continue;
            }
            if ($quote !== '') {
                if ($char === '\\') {
                    $i++;
                    continue;
                }
                if ($char === $quote) {
                    $quote = '';
                }
                continue;
            }
            if ($char === '"' || $char === "'") {
                $quote = $char;
            } elseif ($char === '{') {
                $depth++;
            } elseif ($char === '}') {
                $depth--;
                if ($depth < 0) {
                    return false;
                }
            }
        }
        return $depth === 0 && ! $comment && $quote === '';
    }
}
