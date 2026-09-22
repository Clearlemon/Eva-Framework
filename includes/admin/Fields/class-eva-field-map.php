<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * map 字段：地图选点（对应 CSF 的 map）。
 *
 * 存值与 CSF 一致：['address' => '', 'latitude' => '', 'longitude' => '', 'zoom' => '']，全部是字符串。
 */
class Map_Field
{
    /**
     * 清洗地图值：地址按纯文本，经纬度限定在合法范围内，缩放级别取 0–22 的整数。
     *
     * @param mixed $value 原始值。
     * @param array $field 字段 schema。
     * @return array{address:string,latitude:string,longitude:string,zoom:string}
     */
    public static function sanitize($value, $field = [])
    {
        if ($value === null && isset($field['default']) && is_array($field['default'])) {
            $value = $field['default'];
        }
        $value = is_array($value) ? $value : [];

        $latitude  = self::coordinate(isset($value['latitude']) ? $value['latitude'] : '', 90);
        $longitude = self::coordinate(isset($value['longitude']) ? $value['longitude'] : '', 180);
        // 经纬度必须成对：只有一个合法时两个都清空，避免存下半个坐标。
        if ($latitude === '' || $longitude === '') {
            $latitude  = '';
            $longitude = '';
        }

        $zoom = isset($value['zoom']) && is_numeric($value['zoom']) ? (string) max(0, min(22, (int) $value['zoom'])) : '';

        return [
            'address'   => Advanced_Field_Util::text(isset($value['address']) && is_scalar($value['address']) ? $value['address'] : '', 300),
            'latitude'  => $latitude,
            'longitude' => $longitude,
            'zoom'      => $latitude === '' ? '' : $zoom,
        ];
    }

    /**
     * 规整一个坐标分量：超出 ±$limit 的视为非法；保留 6 位小数并去掉末尾多余的 0。
     *
     * @param mixed $value 原始值。
     * @param int   $limit 绝对值上限（纬度 90、经度 180）。
     * @return string
     */
    private static function coordinate($value, $limit)
    {
        if (! is_numeric($value)) {
            return '';
        }
        $number = (float) $value;
        if ($number < -$limit || $number > $limit) {
            return '';
        }
        $text = rtrim(rtrim(sprintf('%.6F', $number), '0'), '.');
        return $text === '-0' ? '0' : $text;
    }
}
