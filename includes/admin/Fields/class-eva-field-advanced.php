<?php

namespace Eva\Framework\Admin\Fields;

if (! defined('ABSPATH')) {
    exit;
}

/** 高级复合字段共享清洗工具。 */
final class Advanced_Field_Util
{
    public static function source($value, $field = [])
    {
        if (($value === null || $value === '') && array_key_exists('default', $field)) {
            $value = $field['default'];
        }
        return is_array($value) ? $value : [];
    }

    public static function number($value, $min = null, $max = null)
    {
        if ($value === '' || $value === null || ! is_numeric($value)) {
            return '';
        }
        $number = (float) $value;
        if ($min !== null) {
            $number = max((float) $min, $number);
        }
        if ($max !== null) {
            $number = min((float) $max, $number);
        }
        return floor($number) === $number ? (int) $number : round($number, 4);
    }

    public static function unit($value, $allowed = [], $default = 'px')
    {
        $allowed = $allowed ?: ['px', 'rem', 'em', '%', 'vw', 'vh'];
        $value = strtolower(trim((string) $value));
        return in_array($value, $allowed, true) ? $value : $default;
    }

    public static function choice($value, $allowed, $default = '')
    {
        $value = (string) $value;
        return in_array($value, $allowed, true) ? $value : $default;
    }

    /** 将列表或 value => label 形式的单位配置归一化为安全单位白名单。 */
    public static function units($units)
    {
        if (! is_array($units)) {
            return [];
        }

        $allowed = ['px', 'rem', 'em', '%', 'vw', 'vh'];
        $clean = [];
        foreach ($units as $key => $item) {
            if (is_array($item)) {
                $candidate = $item['value'] ?? ($item['id'] ?? '');
            } elseif (is_string($key) && ! ctype_digit($key)) {
                $candidate = $key;
            } else {
                $candidate = $item;
            }
            $candidate = strtolower(trim((string) $candidate));
            if (in_array($candidate, $allowed, true)) {
                $clean[] = $candidate;
            }
        }
        return array_values(array_unique($clean));
    }

    public static function text($value, $max_length = 300)
    {
        $value = sanitize_text_field((string) $value);
        return function_exists('mb_substr') ? mb_substr($value, 0, $max_length) : substr($value, 0, $max_length);
    }
}

/** 固定结构字段组。 */
class Group
{
    public static function sanitize($value, $field = [])
    {
        $value = Advanced_Field_Util::source($value, $field);
        $fields = isset($field['fields']) && is_array($field['fields']) ? $field['fields'] : (isset($field['items']) && is_array($field['items']) ? $field['items'] : []);
        return \Eva\Framework\Data::sanitize_by_sections([['fields' => $fields]], $value);
    }
}

/** 可增删、复制和排序的重复字段组。 */
class Repeater
{
    public static function sanitize($value, $field = [])
    {
        $value = Advanced_Field_Util::source($value, $field);
        $fields = isset($field['fields']) && is_array($field['fields']) ? $field['fields'] : (isset($field['items']) && is_array($field['items']) ? $field['items'] : []);
        $min = max(0, isset($field['min']) ? absint($field['min']) : 0);
        $max = max($min, min(200, isset($field['max']) ? absint($field['max']) : 50));
        $clean = [];

        foreach (array_slice(array_values($value), 0, $max) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $clean[] = \Eva\Framework\Data::sanitize_by_sections([['fields' => $fields]], $row);
        }

        while (count($clean) < $min) {
            $clean[] = \Eva\Framework\Data::sanitize_by_sections([['fields' => $fields]], []);
        }
        return $clean;
    }
}

/** 字体排版复合字段。 */
class Typography
{
    public static function sanitize($value, $field = [])
    {
        $raw = Advanced_Field_Util::source($value, $field);
        $weights = ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
        $out = [
            'family'              => Advanced_Field_Util::text($raw['family'] ?? '', 240),
            'size'                => Advanced_Field_Util::number($raw['size'] ?? '', 0, 500),
            'size_unit'           => Advanced_Field_Util::unit($raw['size_unit'] ?? 'px'),
            'weight'              => Advanced_Field_Util::choice((string) ($raw['weight'] ?? '400'), $weights, '400'),
            'style'               => Advanced_Field_Util::choice($raw['style'] ?? 'normal', ['normal', 'italic', 'oblique'], 'normal'),
            'line_height'         => Advanced_Field_Util::number($raw['line_height'] ?? '', 0, 50),
            'line_height_unit'    => Advanced_Field_Util::unit($raw['line_height_unit'] ?? '', ['', 'px', 'rem', 'em', '%'], ''),
            'letter_spacing'      => Advanced_Field_Util::number($raw['letter_spacing'] ?? '', -100, 100),
            'letter_spacing_unit' => Advanced_Field_Util::unit($raw['letter_spacing_unit'] ?? 'px', ['px', 'rem', 'em'], 'px'),
            'transform'           => Advanced_Field_Util::choice($raw['transform'] ?? 'none', ['none', 'uppercase', 'lowercase', 'capitalize'], 'none'),
            'align'               => Advanced_Field_Util::choice($raw['align'] ?? 'inherit', ['inherit', 'left', 'center', 'right', 'justify'], 'inherit'),
            'color'               => Color::sanitize($raw['color'] ?? '', ['alpha' => ! isset($field['alpha']) || $field['alpha'] !== false]),
        ];
        return $out;
    }
}

/** 外边距/内边距四向值。 */
class Spacing
{
    public static function sanitize($value, $field = [])
    {
        $raw = Advanced_Field_Util::source($value, $field);
        $mode = isset($field['output_mode']) && $field['output_mode'] === 'padding' ? 'padding' : 'margin';
        $minimum = $mode === 'padding' ? 0 : -10000;
        $units = Advanced_Field_Util::units($field['units'] ?? []);

        return [
            'top'    => Advanced_Field_Util::number($raw['top'] ?? '', $minimum, 10000),
            'right'  => Advanced_Field_Util::number($raw['right'] ?? '', $minimum, 10000),
            'bottom' => Advanced_Field_Util::number($raw['bottom'] ?? '', $minimum, 10000),
            'left'   => Advanced_Field_Util::number($raw['left'] ?? '', $minimum, 10000),
            'unit'   => Advanced_Field_Util::unit($raw['unit'] ?? 'px', $units),
            'linked' => ! empty($raw['linked']),
        ];
    }
}

/** 宽高尺寸复合字段。 */
class Dimensions
{
    public static function sanitize($value, $field = [])
    {
        $raw = Advanced_Field_Util::source($value, $field);
        $units = Advanced_Field_Util::units($field['units'] ?? []);

        return [
            'width'     => Advanced_Field_Util::number($raw['width'] ?? '', 0, 100000),
            'height'    => Advanced_Field_Util::number($raw['height'] ?? '', 0, 100000),
            'min_width' => Advanced_Field_Util::number($raw['min_width'] ?? '', 0, 100000),
            'max_width' => Advanced_Field_Util::number($raw['max_width'] ?? '', 0, 100000),
            'unit'      => Advanced_Field_Util::unit($raw['unit'] ?? 'px', $units),
        ];
    }
}

/** 边框宽度、样式、颜色及圆角。 */
class Border
{
    public static function sanitize($value, $field = [])
    {
        $raw = Advanced_Field_Util::source($value, $field);
        $width = isset($raw['width']) && is_array($raw['width']) ? $raw['width'] : [];
        $radius = isset($raw['radius']) && is_array($raw['radius']) ? $raw['radius'] : [];
        $clean_width = [];
        foreach (['top', 'right', 'bottom', 'left'] as $side) {
            $clean_width[$side] = Advanced_Field_Util::number($width[$side] ?? '', 0, 1000);
        }
        $clean_radius = [];
        foreach (['top_left', 'top_right', 'bottom_right', 'bottom_left'] as $corner) {
            $clean_radius[$corner] = Advanced_Field_Util::number($radius[$corner] ?? '', 0, 10000);
        }
        return [
            'style'         => Advanced_Field_Util::choice($raw['style'] ?? 'solid', ['none', 'solid', 'dashed', 'dotted', 'double'], 'solid'),
            'color'         => Color::sanitize($raw['color'] ?? '', ['alpha' => true]),
            'unit'          => Advanced_Field_Util::unit($raw['unit'] ?? 'px', ['px', 'rem', 'em'], 'px'),
            'width'         => $clean_width,
            'radius'        => $clean_radius,
            'linked_width'  => ! array_key_exists('linked_width', $raw) || ! empty($raw['linked_width']),
            'linked_radius' => ! array_key_exists('linked_radius', $raw) || ! empty($raw['linked_radius']),
        ];
    }
}

/** 背景颜色、图片和铺放方式。 */
class Background
{
    public static function sanitize($value, $field = [])
    {
        $raw = Advanced_Field_Util::source($value, $field);
        // allow_unset：各属性允许留空（＝不输出对应的 CSS），空值和非法值都落到空字符串；
        // 兼容层给 CSF 写法的 background 打开它。默认行为不变：落到各属性的常用取值上。
        if (! empty($field['allow_unset'])) {
            $pick = static function ($key, $allowed) use ($raw) {
                $current = isset($raw[$key]) && is_scalar($raw[$key]) ? (string) $raw[$key] : '';
                return in_array($current, $allowed, true) ? $current : '';
            };
            return [
                'color'      => Color::sanitize($raw['color'] ?? '', ['alpha' => true]),
                'image'      => Upload::sanitize($raw['image'] ?? '', ['library' => 'image']),
                'repeat'     => $pick('repeat', ['no-repeat', 'repeat', 'repeat-x', 'repeat-y']),
                'size'       => $pick('size', ['auto', 'cover', 'contain']),
                'position'   => $pick('position', ['left top', 'center top', 'right top', 'left center', 'center center', 'right center', 'left bottom', 'center bottom', 'right bottom']),
                'attachment' => $pick('attachment', ['scroll', 'fixed', 'local']),
                'blend_mode' => $pick('blend_mode', ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten']),
            ];
        }
        return [
            'color'      => Color::sanitize($raw['color'] ?? '', ['alpha' => true]),
            'image'      => Upload::sanitize($raw['image'] ?? '', ['library' => 'image']),
            'repeat'     => Advanced_Field_Util::choice($raw['repeat'] ?? 'no-repeat', ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'], 'no-repeat'),
            'size'       => Advanced_Field_Util::choice($raw['size'] ?? 'cover', ['auto', 'cover', 'contain'], 'cover'),
            'position'   => Advanced_Field_Util::choice($raw['position'] ?? 'center center', ['left top', 'center top', 'right top', 'left center', 'center center', 'right center', 'left bottom', 'center bottom', 'right bottom'], 'center center'),
            'attachment' => Advanced_Field_Util::choice($raw['attachment'] ?? 'scroll', ['scroll', 'fixed', 'local'], 'scroll'),
            'blend_mode' => Advanced_Field_Util::choice($raw['blend_mode'] ?? 'normal', ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'], 'normal'),
        ];
    }
}


