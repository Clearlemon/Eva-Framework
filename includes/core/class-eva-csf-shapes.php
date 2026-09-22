<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * CSF 兼容层 · 复合字段的参数与存值转换。
 *
 * typography / background / border / spacing / dimensions / link_color / date / datetime 这几种字段，
 * CSF 与 Eva 同名但「注册参数」和「存值结构」都不一样：
 * - CSF 的值用 CSS 属性名做键（font-family、background-color…），Eva 用自己的键（family、color…）；
 * - CSF 的 date 按 jQuery UI 的 dateFormat 存字符串（默认 mm/dd/yy），Eva 按 PHP 记号（默认 Y-m-d）。
 *
 * 只有开了 csf_compat 的容器 / 分区才会走这里（Csf_Compat::normalize_field 给字段打上 csf_shape），
 * Eva 原生写法不受影响。组件始终拿到 Eva 结构的值；写库前转回 CSF 结构。
 *
 * 转换有损的地方（CSF 有而 Eva 组件没有对应控件的键，如渐变色、text-decoration、Google 字体的 subset）
 * 用 csf_extra 随值一起带到前端再带回来：各复合字段组件更新值时用的是 Object.assign，未知键会原样保留，
 * 保存时 to_csf() 从提交的原始值里取回，所以这些键不会因为在 Eva 里点了一次保存而丢失。
 *
 * @package Eva\Framework
 */
class Csf_Shapes
{
    /** 本类负责的字段类型。 */
    const TYPES = ['typography', 'background', 'border', 'spacing', 'dimensions', 'link_color', 'date', 'datetime'];

    /** 背景字段里 CSF 与 Eva 一一对应的几个属性（Eva 键名）。 */
    const BACKGROUND_KEYS = ['repeat', 'size', 'position', 'attachment', 'blend_mode'];

    /** CSF 内置的 Web 安全字体（与 CSF typography 的 safewebfonts 一致）。 */
    const SAFE_FONTS = [
        'Arial', 'Arial Black', 'Helvetica', 'Times New Roman', 'Courier New', 'Tahoma', 'Verdana', 'Impact',
        'Trebuchet MS', 'Comic Sans MS', 'Lucida Console', 'Lucida Sans Unicode', 'Georgia, serif', 'Palatino Linotype',
    ];

    /** 常用 Google 字体：CSF 自带上千个，这里只内置一批常用的；字段上写 google_fonts => [...] 可以换成自己的清单。 */
    const GOOGLE_FONTS = [
        'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Inter', 'Noto Sans', 'Noto Sans SC', 'Noto Serif SC',
        'Source Sans 3', 'Raleway', 'Nunito', 'Ubuntu', 'Oswald', 'Merriweather', 'Playfair Display', 'PT Sans',
        'Rubik', 'Work Sans', 'Fira Sans', 'Quicksand', 'Josefin Sans', 'DM Sans', 'Manrope', 'ZCOOL XiaoWei',
    ];

    /**
     * 是否由本类处理。
     *
     * @param string $type 字段类型或 csf_shape。
     * @return bool
     */
    public static function handles($type)
    {
        return in_array($type, self::TYPES, true);
    }

    // =========================================================================
    // 注册期：参数映射
    // =========================================================================

    /**
     * 把 CSF 的注册参数映射成 Eva 组件认的参数，并打上 csf_shape。
     *
     * @param array  $field 字段。
     * @param string $type  字段类型。
     * @return array
     */
    public static function map_args($field, $type)
    {
        $field['csf_shape'] = $type;

        if ($type === 'typography') {
            // CSF 用布尔参数决定显示哪些控件；Eva 用 show_*。
            $toggles = [
                'font_family' => 'show_family', 'font_size' => 'show_size', 'font_weight' => 'show_weight',
                'font_style' => 'show_style', 'line_height' => 'show_line_height', 'letter_spacing' => 'show_letter_spacing',
                'text_align' => 'show_align', 'text_transform' => 'show_transform', 'color' => 'show_color',
            ];
            foreach ($toggles as $csf_key => $eva_key) {
                if (array_key_exists($csf_key, $field) && is_bool($field[$csf_key]) && ! isset($field[$eva_key])) {
                    $field[$eva_key] = $field[$csf_key];
                }
            }
            // 字体清单：Web 安全字体 + Google 字体。CSF 存的 font-family 就是字体名本身（不是一长串回退字体）。
            $google = isset($field['google_fonts']) && is_array($field['google_fonts']) ? array_values($field['google_fonts']) : self::GOOGLE_FONTS;
            $field['csf_google_fonts'] = $google;
            if (empty($field['fonts']) && empty($field['options'])) {
                $fonts = [];
                foreach (self::SAFE_FONTS as $font) {
                    $fonts[] = ['value' => $font, 'label' => $font];
                }
                foreach ($google as $font) {
                    $fonts[] = ['value' => $font, 'label' => $font . ' · Google'];
                }
                $field['fonts'] = $fonts;
            }
        }

        if ($type === 'background') {
            // CSF 的各个背景属性都可以留空（留空就不输出那条 CSS）；让组件提供「不设置」选项，空值就能原样来回。
            $field['allow_unset'] = true;
        }

        if ($type === 'link_color') {
            // CSF：color / hover 默认开，active / visited / focus 默认关。Eva：states 列表，默认态叫 normal。
            if (empty($field['states'])) {
                $states = [];
                foreach (['color' => true, 'hover' => true, 'active' => false, 'visited' => false, 'focus' => false] as $key => $on) {
                    if (array_key_exists($key, $field) ? ! empty($field[$key]) : $on) {
                        $states[] = $key === 'color' ? 'normal' : $key;
                    }
                }
                $field['states'] = $states;
            }
        }

        if ($type === 'date' || $type === 'datetime') {
            $settings = isset($field['settings']) && is_array($field['settings']) ? $field['settings'] : [];
            if ($type === 'date') {
                // CSF date 用 jQuery UI datepicker，dateFormat 默认 mm/dd/yy。
                $field['csf_date_format'] = self::jquery_ui_to_php(isset($settings['dateFormat']) ? (string) $settings['dateFormat'] : 'mm/dd/yy');
                $component_format = 'Y-m-d';
            } else {
                // CSF datetime 用 flatpickr，dateFormat 的记号接近 PHP；enableTime 决定有没有时间部分。
                $with_time = ! array_key_exists('enableTime', $settings) || ! empty($settings['enableTime']);
                $default   = $with_time ? 'Y-m-d H:i' : 'Y-m-d';
                $field['csf_date_format'] = self::flatpickr_to_php(isset($settings['dateFormat']) ? (string) $settings['dateFormat'] : $default);
                $component_format = 'Y-m-d H:i:s';
            }
            // 组件只认 Y m d H i s 这几个记号，统一让它用 ISO 风格收发；CSF 的格式只在读写库时转换。
            $field['format']        = $component_format;
            $field['return_format'] = $component_format;
            if (! empty($field['from_to'])) {
                $field['range'] = true;
            }
        }

        return $field;
    }

    // =========================================================================
    // 读：CSF 存值 → 组件值
    // =========================================================================

    /**
     * @param string $shape csf_shape。
     * @param array  $field 字段定义。
     * @param mixed  $value 库里的值。
     * @return mixed
     */
    public static function to_eva($shape, $field, $value)
    {
        if ($shape === 'date' || $shape === 'datetime') {
            return self::date_to_eva($field, $value);
        }

        $v = is_array($value) ? $value : [];

        if ($shape === 'typography') {
            // 已经是 Eva 结构（带 family / size_unit）就不再转。
            if (isset($v['family']) || isset($v['size_unit'])) {
                return $value;
            }
            $unit      = self::pick($v, 'unit', isset($field['unit']) ? $field['unit'] : 'px');
            $line_unit = isset($field['line_height_unit']) ? (string) $field['line_height_unit'] : $unit;
            return [
                'family'              => (string) self::pick($v, 'font-family'),
                'size'                => self::pick($v, 'font-size'),
                'size_unit'           => $unit,
                'weight'              => (string) self::pick($v, 'font-weight'),
                'style'               => self::pick($v, 'font-style') ?: 'normal',
                'line_height'         => self::pick($v, 'line-height'),
                'line_height_unit'    => $line_unit,
                'letter_spacing'      => self::pick($v, 'letter-spacing'),
                'letter_spacing_unit' => in_array($unit, ['px', 'rem', 'em'], true) ? $unit : 'px',
                'transform'           => self::pick($v, 'text-transform') ?: 'none',
                'align'               => self::pick($v, 'text-align') ?: 'inherit',
                'color'               => (string) self::pick($v, 'color'),
                'csf_extra'           => array_intersect_key($v, array_flip(['font-weight', 'subset', 'text-decoration', 'word-spacing', 'backup-font-family'])),
            ];
        }

        if ($shape === 'background') {
            if (array_key_exists('color', $v) || array_key_exists('image', $v)) {
                return $value;
            }
            $image = self::pick($v, 'background-image');
            if (is_array($image)) {
                $image = (! empty($image['id']) || ! empty($image['url']))
                    ? ['id' => absint(isset($image['id']) ? $image['id'] : 0), 'url' => (string) (isset($image['url']) ? $image['url'] : '')]
                    : '';
            }
            $out = ['color' => (string) self::pick($v, 'background-color'), 'image' => $image];
            foreach (self::BACKGROUND_KEYS as $key) {
                $out[$key] = (string) self::pick($v, 'background-' . str_replace('_', '-', $key));
            }
            // 原始的 CSF 值整份带上：渐变、origin、clip 这些组件里没有控件的键，以及组件下拉里没有的取值
            //（CSF 的混合模式有十几种，Eva 只列了 6 种），保存时靠它还原。
            $out['csf_extra'] = $v;
            return $out;
        }

        if ($shape === 'border') {
            if (isset($v['width']) && is_array($v['width'])) {
                return $value;
            }
            $width = [];
            foreach (['top', 'right', 'bottom', 'left'] as $side) {
                $width[$side] = array_key_exists('all', $v) && $v['all'] !== '' ? $v['all'] : self::pick($v, $side);
            }
            return [
                'style'        => self::pick($v, 'style') ?: 'solid',
                'color'        => (string) self::pick($v, 'color'),
                'unit'         => isset($field['unit']) ? (string) $field['unit'] : 'px',
                'width'        => $width,
                'linked_width' => ! empty($field['all']),
            ];
        }

        if ($shape === 'spacing') {
            $out = [];
            foreach (['top', 'right', 'bottom', 'left'] as $side) {
                $out[$side] = array_key_exists('all', $v) && $v['all'] !== '' ? $v['all'] : self::pick($v, $side);
            }
            $out['unit']   = self::pick($v, 'unit', isset($field['unit']) ? $field['unit'] : 'px');
            $out['linked'] = ! empty($field['all']) || ! empty($v['linked']);
            return $out;
        }

        if ($shape === 'dimensions') {
            return [
                'width'  => self::pick($v, 'width'),
                'height' => self::pick($v, 'height'),
                'unit'   => self::pick($v, 'unit', isset($field['unit']) ? $field['unit'] : 'px'),
            ];
        }

        if ($shape === 'link_color') {
            if (array_key_exists('normal', $v) && ! array_key_exists('color', $v)) {
                return $value;
            }
            $out = ['normal' => (string) self::pick($v, 'color')];
            foreach (['hover', 'active', 'visited', 'focus'] as $state) {
                $out[$state] = (string) self::pick($v, $state);
            }
            return $out;
        }

        return $value;
    }

    // =========================================================================
    // 写：组件值（已清洗）→ CSF 存值
    // =========================================================================

    /**
     * @param string $shape csf_shape。
     * @param array  $field 字段定义。
     * @param mixed  $value 清洗后的组件值。
     * @param mixed  $raw   前端提交的原始值（取回 csf_extra 用）。
     * @return mixed
     */
    public static function to_csf($shape, $field, $value, $raw = null)
    {
        if ($shape === 'date' || $shape === 'datetime') {
            return self::date_to_csf($field, $value);
        }

        $v     = is_array($value) ? $value : [];
        $extra = is_array($raw) && isset($raw['csf_extra']) && is_array($raw['csf_extra']) ? $raw['csf_extra'] : [];

        if ($shape === 'typography') {
            $family = (string) self::pick($v, 'family');
            $google = isset($field['csf_google_fonts']) && is_array($field['csf_google_fonts']) ? $field['csf_google_fonts'] : [];
            $weight = (string) self::pick($v, 'weight');
            // 库里原来没写字重、组件里也停在默认的 400：保持「没写」，不往前台多输出一条 font-weight。
            if ($weight === '400' && isset($extra['font-weight']) && $extra['font-weight'] === '') {
                $weight = '';
            }
            $out = [
                'font-family'    => $family,
                'font-weight'    => $weight,
                'font-style'     => self::pick($v, 'style') === 'normal' ? '' : (string) self::pick($v, 'style'),
                'font-size'      => self::scalar(self::pick($v, 'size')),
                'line-height'    => self::scalar(self::pick($v, 'line_height')),
                'letter-spacing' => self::scalar(self::pick($v, 'letter_spacing')),
                'text-align'     => self::pick($v, 'align') === 'inherit' ? '' : (string) self::pick($v, 'align'),
                'text-transform' => self::pick($v, 'transform') === 'none' ? '' : (string) self::pick($v, 'transform'),
                'color'          => (string) self::pick($v, 'color'),
                // CSF 靠 type 判断要不要到前台加载 Google 字体。
                'type'           => $family === '' ? '' : (in_array($family, $google, true) ? 'google' : 'safe'),
                'unit'           => (string) self::pick($v, 'size_unit', 'px'),
            ];
            foreach (['subset', 'text-decoration', 'word-spacing', 'backup-font-family'] as $key) {
                if (isset($extra[$key]) && is_scalar($extra[$key])) {
                    $out[$key] = sanitize_text_field((string) $extra[$key]);
                }
            }
            return $out;
        }

        if ($shape === 'background') {
            $out = [
                'background-color' => (string) self::pick($v, 'color'),
                'background-image' => self::media_array(self::pick($v, 'image')),
            ];
            foreach (self::BACKGROUND_KEYS as $key) {
                $csf_key  = 'background-' . str_replace('_', '-', $key);
                $current  = (string) self::pick($v, $key);
                $posted   = is_array($raw) && isset($raw[$key]) && is_scalar($raw[$key]) ? (string) $raw[$key] : '';
                $original = isset($extra[$csf_key]) && is_scalar($extra[$csf_key]) ? sanitize_text_field((string) $extra[$csf_key]) : '';
                // 清洗后变空、但提交上来的就是库里原来那个值：那是组件下拉里没有的取值，用户没有动过它，原样保留。
                $out[$csf_key] = ($current === '' && $posted !== '' && $posted === $original) ? $original : $current;
            }
            foreach (['background-gradient-color', 'background-gradient-direction', 'background-origin', 'background-clip'] as $key) {
                $out[$key] = isset($extra[$key]) && is_scalar($extra[$key]) ? sanitize_text_field((string) $extra[$key]) : '';
            }
            return $out;
        }

        if ($shape === 'border') {
            $width = isset($v['width']) && is_array($v['width']) ? $v['width'] : [];
            $out   = [];
            if (! empty($field['all'])) {
                $out['all'] = self::scalar(self::pick($width, 'top'));
            } else {
                foreach (['top', 'right', 'bottom', 'left'] as $side) {
                    $out[$side] = self::scalar(self::pick($width, $side));
                }
            }
            $out['style'] = (string) self::pick($v, 'style');
            $out['color'] = (string) self::pick($v, 'color');
            return $out;
        }

        if ($shape === 'spacing') {
            $out = [];
            if (! empty($field['all'])) {
                $out['all'] = self::scalar(self::pick($v, 'top'));
            } else {
                foreach (['top', 'right', 'bottom', 'left'] as $side) {
                    $out[$side] = self::scalar(self::pick($v, $side));
                }
            }
            $out['unit'] = (string) self::pick($v, 'unit', 'px');
            return $out;
        }

        if ($shape === 'dimensions') {
            return [
                'width'  => self::scalar(self::pick($v, 'width')),
                'height' => self::scalar(self::pick($v, 'height')),
                'unit'   => (string) self::pick($v, 'unit', 'px'),
            ];
        }

        if ($shape === 'link_color') {
            // CSF 只存渲染出来的那几个状态。
            $states = isset($field['states']) && is_array($field['states']) ? $field['states'] : ['normal', 'hover'];
            $out    = [];
            foreach ($states as $state) {
                $state = (string) $state;
                $out[$state === 'normal' ? 'color' : $state] = (string) self::pick($v, $state);
            }
            return $out;
        }

        return $value;
    }

    // =========================================================================
    // 前台 CSS 输出（字段的 output 参数）
    // =========================================================================

    /**
     * 按 CSF 的规则，直接用库里的 CSF 存值生成这个字段的前台 CSS。
     *
     * 不能复用 Eva 自己的输出逻辑：那边吃的是组件结构，而组件里没有「未设置」——空值读出来会落在
     * normal / none / cover 这类默认值上，一输出就多出几条声明，可能盖掉主题原本的样式。
     * CSF 的做法是「值为空就不输出」，这里照做。
     *
     * @param array  $field     字段定义（带 csf_shape）。
     * @param mixed  $value     库里的 CSF 存值。
     * @param string $selector  已清洗的选择器文本。
     * @param bool   $important 是否加 !important。
     * @return string           完整的 CSS 规则；没有可输出的内容时为空字符串。
     */
    public static function output_css($field, $value, $selector, $important = false)
    {
        $shape = isset($field['csf_shape']) ? (string) $field['csf_shape'] : '';
        $v     = is_array($value) ? $value : [];
        $bang  = $important ? ' !important' : '';
        $decl  = [];
        $add   = static function ($property, $css_value) use (&$decl, $bang) {
            if ($css_value !== '') {
                $decl[] = $property . ':' . $css_value . $bang . ';';
            }
        };

        if ($shape === 'typography') {
            $unit      = self::css_unit(self::pick($v, 'unit', isset($field['unit']) ? $field['unit'] : 'px'));
            $line_unit = isset($field['line_height_unit']) ? self::css_unit($field['line_height_unit'], true) : $unit;
            $family    = self::css_token(self::pick($v, 'font-family'));
            if ($family !== '') {
                $backup = self::css_token(self::pick($v, 'backup-font-family'));
                // 单个字体名加引号（可能带空格）；已经是一串回退字体（含逗号）的原样输出。
                $add('font-family', (strpos($family, ',') === false ? '"' . str_replace('"', '', $family) . '"' : $family) . ($backup !== '' ? ',' . $backup : ''));
            }
            foreach (['font-weight', 'font-style', 'font-variant', 'text-align', 'text-transform', 'text-decoration'] as $property) {
                $add($property, self::css_token(self::pick($v, $property)));
            }
            $add('font-size', self::css_number(self::pick($v, 'font-size'), $unit));
            $add('line-height', self::css_number(self::pick($v, 'line-height'), $line_unit));
            $add('letter-spacing', self::css_number(self::pick($v, 'letter-spacing'), $unit));
            $add('word-spacing', self::css_number(self::pick($v, 'word-spacing'), $unit));
            $add('color', self::css_token(self::pick($v, 'color')));
        } elseif ($shape === 'background') {
            $color    = self::css_token(self::pick($v, 'background-color'));
            $gradient = self::css_token(self::pick($v, 'background-gradient-color'));
            $image    = self::pick($v, 'background-image');
            $url      = esc_url_raw(is_array($image) ? (string) self::pick($image, 'url') : (string) $image);
            $add('background-color', $color);
            if ($color !== '' && $gradient !== '') {
                $direction = self::css_token(self::pick($v, 'background-gradient-direction')) ?: 'to bottom';
                $add('background-image', 'linear-gradient(' . $direction . ',' . $color . ',' . $gradient . ')');
            } elseif ($url !== '') {
                $add('background-image', 'url("' . $url . '")');
            }
            foreach (['position', 'repeat', 'attachment', 'size', 'origin', 'clip', 'blend-mode'] as $key) {
                $add('background-' . $key, self::css_token(self::pick($v, 'background-' . $key)));
            }
        } elseif ($shape === 'border') {
            $unit = self::css_unit(isset($field['unit']) ? $field['unit'] : 'px');
            if (array_key_exists('all', $v)) {
                $add('border-width', self::css_number($v['all'], $unit));
            } else {
                foreach (['top', 'right', 'bottom', 'left'] as $side) {
                    $add('border-' . $side . '-width', self::css_number(self::pick($v, $side), $unit));
                }
            }
            $add('border-style', self::css_token(self::pick($v, 'style')));
            $add('border-color', self::css_token(self::pick($v, 'color')));
        } elseif ($shape === 'spacing') {
            $mode = isset($field['output_mode']) && in_array($field['output_mode'], ['margin', 'padding'], true) ? $field['output_mode'] : 'margin';
            $unit = self::css_unit(self::pick($v, 'unit', isset($field['unit']) ? $field['unit'] : 'px'));
            if (array_key_exists('all', $v)) {
                $add($mode, self::css_number($v['all'], $unit));
            } else {
                foreach (['top', 'right', 'bottom', 'left'] as $side) {
                    $add($mode . '-' . $side, self::css_number(self::pick($v, $side), $unit));
                }
            }
        } elseif ($shape === 'dimensions') {
            $unit   = self::css_unit(self::pick($v, 'unit', isset($field['unit']) ? $field['unit'] : 'px'));
            // output_prefix（同 CSF）：'min' / 'max' 输出成 min-width、max-height…
            $prefix = isset($field['output_prefix']) && in_array($field['output_prefix'], ['min', 'max'], true) ? $field['output_prefix'] . '-' : '';
            $add($prefix . 'width', self::css_number(self::pick($v, 'width'), $unit));
            $add($prefix . 'height', self::css_number(self::pick($v, 'height'), $unit));
        } elseif ($shape === 'link_color') {
            // 每个状态一条规则：selector{color} / selector:hover{color} …；多个选择器逐个加伪类。
            $css = '';
            foreach (['color' => '', 'hover' => ':hover', 'active' => ':active', 'visited' => ':visited', 'focus' => ':focus'] as $key => $pseudo) {
                $color = self::css_token(self::pick($v, $key));
                if ($color === '') {
                    continue;
                }
                $selectors = array_map(static function ($item) use ($pseudo) {
                    return trim($item) . $pseudo;
                }, explode(',', $selector));
                $css .= implode(',', $selectors) . '{color:' . $color . $bang . ";}\n";
            }
            return $css;
        }

        return $decl ? $selector . '{' . implode('', $decl) . "}\n" : '';
    }

    /**
     * 清洗单个 CSS 值：去标签，去掉能逃出声明的字符。
     *
     * @param mixed $value 原始值。
     * @return string
     */
    private static function css_token($value)
    {
        if (! is_scalar($value)) {
            return '';
        }
        $value = wp_strip_all_tags(trim((string) $value));
        return trim(str_replace([';', '{', '}', '<', '>', "\0", "\r", "\n"], '', $value));
    }

    /**
     * 数字 + 单位；不是数字就不输出。
     *
     * @param mixed  $number 数字。
     * @param string $unit   单位。
     * @return string
     */
    private static function css_number($number, $unit)
    {
        if ($number === '' || $number === null || ! is_numeric($number)) {
            return '';
        }
        $text = rtrim(rtrim(sprintf('%.4F', (float) $number), '0'), '.');
        return ($text === '-0' ? '0' : $text) . $unit;
    }

    /**
     * 单位白名单。
     *
     * @param mixed $unit           单位。
     * @param bool  $allow_unitless 是否允许无单位（行高）。
     * @return string
     */
    private static function css_unit($unit, $allow_unitless = false)
    {
        $unit = strtolower(trim((string) $unit));
        if ($unit === '' && $allow_unitless) {
            return '';
        }
        return in_array($unit, ['px', 'rem', 'em', '%', 'vw', 'vh', 'pt'], true) ? $unit : 'px';
    }

    // =========================================================================
    // 日期
    // =========================================================================

    /**
     * 库里的日期（CSF 格式）→ 组件用的 Y-m-d / Y-m-d H:i:s。
     *
     * @param array $field 字段定义。
     * @param mixed $value 已存值：字符串，或 from_to 时的 ['from' => …, 'to' => …]。
     * @return mixed
     */
    private static function date_to_eva($field, $value)
    {
        $stored = isset($field['csf_date_format']) ? (string) $field['csf_date_format'] : 'Y-m-d';
        $target = isset($field['return_format']) ? (string) $field['return_format'] : 'Y-m-d';

        if (! empty($field['range'])) {
            $value = is_array($value) ? $value : [];
            $from  = isset($value['from']) ? $value['from'] : (isset($value[0]) ? $value[0] : '');
            $to    = isset($value['to']) ? $value['to'] : (isset($value[1]) ? $value[1] : '');
            return [self::reformat_date($from, $stored, $target), self::reformat_date($to, $stored, $target)];
        }
        return self::reformat_date($value, $stored, $target);
    }

    /**
     * 组件的日期 → CSF 格式。
     *
     * @param array $field 字段定义。
     * @param mixed $value 清洗后的组件值。
     * @return mixed
     */
    private static function date_to_csf($field, $value)
    {
        $stored = isset($field['csf_date_format']) ? (string) $field['csf_date_format'] : 'Y-m-d';
        $source = isset($field['return_format']) ? (string) $field['return_format'] : 'Y-m-d';

        if (! empty($field['range'])) {
            $value = is_array($value) ? array_values($value) : [];
            return [
                'from' => self::reformat_date(isset($value[0]) ? $value[0] : '', $source, $stored),
                'to'   => self::reformat_date(isset($value[1]) ? $value[1] : '', $source, $stored),
            ];
        }
        return self::reformat_date($value, $source, $stored);
    }

    /**
     * 把日期字符串从一种 PHP 格式换成另一种；解析不了的原样返回（宁可保留看不懂的旧值，也不把它清空）。
     *
     * @param mixed  $value 日期字符串。
     * @param string $from  源格式（PHP 记号）。
     * @param string $to    目标格式（PHP 记号）。
     * @return string
     */
    private static function reformat_date($value, $from, $to)
    {
        if (! is_scalar($value) || trim((string) $value) === '') {
            return '';
        }
        $value = trim((string) $value);
        // 依次按「声明的格式 → 目标格式（已经转过）→ 常见 ISO 写法」尝试。
        foreach (array_unique([$from, $to, 'Y-m-d H:i:s', 'Y-m-d H:i', 'Y-m-d']) as $format) {
            $date   = \DateTimeImmutable::createFromFormat('!' . $format, $value, wp_timezone());
            $errors = \DateTimeImmutable::getLastErrors();
            if ($date && ($errors === false || ((int) $errors['warning_count'] === 0 && (int) $errors['error_count'] === 0))) {
                return $date->format($to);
            }
        }
        return $value;
    }

    /**
     * jQuery UI datepicker 的 dateFormat → PHP date() 格式。
     *
     * @param string $format 如 mm/dd/yy、yy-mm-dd、d M, y。
     * @return string
     */
    public static function jquery_ui_to_php($format)
    {
        // 长记号在前：先替换 dd 再替换 d，否则 dd 会被拆成两个 d。
        $map = [
            'dd' => 'd', 'd' => 'j', 'DD' => 'l', 'D' => 'D', 'oo' => 'z', 'o' => 'z',
            'mm' => 'm', 'm' => 'n', 'MM' => 'F', 'M' => 'M', 'yy' => 'Y', 'y' => 'y', '@' => 'U',
        ];
        return self::translate_format($format, $map);
    }

    /**
     * flatpickr 的 dateFormat → PHP date() 格式（两者大部分记号相同，只有这几个不一样）。
     *
     * @param string $format 如 Y-m-d H:i、d.m.Y h:i K。
     * @return string
     */
    public static function flatpickr_to_php($format)
    {
        return self::translate_format($format, ['S' => 's', 'K' => 'A', 'J' => 'jS', 'G' => 'h']);
    }

    /**
     * 按「记号 => PHP 记号」表逐段翻译格式串；表里没有的字符原样保留（PHP 里有含义的字母会加反斜杠转义）。
     *
     * @param string $format 源格式。
     * @param array  $map    记号对照表，长记号须排在短记号前面。
     * @return string
     */
    private static function translate_format($format, $map)
    {
        $out    = '';
        $length = strlen($format);
        $i      = 0;
        while ($i < $length) {
            // 单引号里的内容是字面量（jQuery UI 的写法）。
            if ($format[$i] === "'") {
                $end = strpos($format, "'", $i + 1);
                $end = $end === false ? $length : $end;
                $out .= preg_replace('/([A-Za-z])/', '\\\\$1', substr($format, $i + 1, $end - $i - 1));
                $i = $end + 1;
                continue;
            }
            $matched = false;
            foreach ($map as $token => $php) {
                if (substr($format, $i, strlen($token)) === $token) {
                    $out .= $php;
                    $i   += strlen($token);
                    $matched = true;
                    break;
                }
            }
            if (! $matched) {
                $char = $format[$i];
                // 只有 jQuery UI 的表才需要转义多余字母；flatpickr 的表里没列出的字母本来就是 PHP 记号，照抄。
                $out .= (isset($map['dd']) && ctype_alpha($char)) ? '\\' . $char : $char;
                $i++;
            }
        }
        return $out;
    }

    // =========================================================================
    // 工具
    // =========================================================================

    /**
     * 取数组里的键，缺失时给默认值。
     *
     * @param array  $array   数组。
     * @param string $key     键。
     * @param mixed  $default 默认值。
     * @return mixed
     */
    private static function pick($array, $key, $default = '')
    {
        return is_array($array) && array_key_exists($key, $array) && $array[$key] !== null ? $array[$key] : $default;
    }

    /**
     * CSF 把数字也存成字符串；空值保持空字符串。
     *
     * @param mixed $value 数字或空。
     * @return string
     */
    private static function scalar($value)
    {
        return is_scalar($value) ? (string) $value : '';
    }

    /**
     * Eva 上传字段的值（URL / 附件 ID / 对象）→ CSF media 字段的数组结构。
     *
     * @param mixed $image Eva 的图片值。
     * @return array
     */
    private static function media_array($image)
    {
        $id  = 0;
        $url = '';
        if (is_array($image)) {
            $id  = isset($image['id']) ? absint($image['id']) : 0;
            $url = isset($image['url']) ? (string) $image['url'] : '';
        } elseif (is_numeric($image)) {
            $id = absint($image);
        } elseif (is_string($image)) {
            $url = $image;
        }
        if ($id && $url === '') {
            $url = (string) wp_get_attachment_url($id);
        }

        $out = ['url' => esc_url_raw($url), 'id' => $id ? (string) $id : '', 'width' => '', 'height' => '', 'thumbnail' => '', 'alt' => '', 'title' => '', 'description' => ''];
        if ($id && get_post($id)) {
            $meta = wp_get_attachment_metadata($id);
            $out['width']       = isset($meta['width']) ? (string) $meta['width'] : '';
            $out['height']      = isset($meta['height']) ? (string) $meta['height'] : '';
            $out['thumbnail']   = (string) wp_get_attachment_image_url($id, 'thumbnail');
            $out['alt']         = (string) get_post_meta($id, '_wp_attachment_image_alt', true);
            $out['title']       = get_the_title($id);
            $out['description'] = (string) get_post_field('post_content', $id);
        }
        return $out;
    }
}
