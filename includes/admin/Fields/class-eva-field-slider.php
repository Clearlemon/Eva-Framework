<?php
namespace Eva\Framework\Admin\Fields;
if (! defined('ABSPATH')) { exit; }
/** slider 字段使用 number 的范围、步长和精度规则。 */
class Slider { public static function sanitize($value, $field = []) { return Number_Field::sanitize($value, $field); } }
