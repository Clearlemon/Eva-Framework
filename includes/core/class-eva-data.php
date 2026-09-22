<?php

namespace Eva\Framework;

// 直接访问该文件时（未经 WordPress 引导）立即退出，防止源码被当作普通 PHP 执行而泄露逻辑。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 字段数据层（MVP）。
 *
 * 职责：把前端（Vue 外壳）提交上来的字段值，按「已注册的字段 schema」做 type 级清洗（sanitize），
 *       再写入 wp_options。读取（注入前端）那一侧不在这里，而在 \Eva::get_values()。
 *
 * 入口：设置页通过 AJAX(action = eva_fw_save_options) 调到本类的 ajax_save()；
 *       而 metabox / 分类法 / 导航菜单 / 评论 / 用户资料等嵌入式容器，则直接复用这里的
 *       静态方法 sanitize_by_sections() 做清洗，再各自写入对应的 meta 表。
 *
 * @package Eva\Framework
 */
class Data
{
    /**
     * 构造时挂载 AJAX 保存钩子。
     *
     * 仅注册「已登录用户」的 wp_ajax_ 动作（设置页只对后台有权限者开放，无需 nopriv）。
     */
    public function __construct()
    {
        // 设置保存。
        add_action('wp_ajax_eva_fw_save_options', [$this, 'ajax_save']);
    }

    /**
     * AJAX 回调：校验 → 清洗 → 落库，最后回吐清洗后的值给前端。
     *
     * nonce / 权限 / 未知设置页这类「整次请求不成立」的情况用 wp_send_json_error 配 HTTP 状态码返回。
     * 字段级校验不算失败：出错的字段单独回滚成旧值，其余照常保存，错误随 success 一起回传（同 CSF）。
     *
     * @return void 直接以 JSON 响应并结束请求（wp_send_json_* 内部会 die）。
     */
    public function ajax_save()
    {
        // 1) 校验 nonce：用与前端 EvaFW.config.nonce 同名的 'eva_fw_guide' 动作，防 CSRF。
        if (! check_ajax_referer('eva_fw_guide', 'nonce', false)) {
            wp_send_json_error(['msg' => 'bad_nonce'], 403);
        }

        // 2) 反查已注册设置页（已应用 eva_{id}_args / eva_{id}_sections 过滤器，与渲染时是同一份），
        //    并使用该设置页声明的 capability。
        $option_id = isset($_POST['option_id']) ? sanitize_text_field(wp_unslash($_POST['option_id'])) : '';
        $opt = \Eva::get_resolved($option_id);
        if (! $opt) {
            wp_send_json_error(['msg' => 'unknown_option'], 400);
        }
        if (! current_user_can(self::option_capability($opt))) {
            wp_send_json_error(['msg' => 'forbidden'], 403);
        }

        // 4) 解析前端提交的值（JSON 字符串 → 关联数组）；非数组一律视为空，保证后续遍历安全。
        $raw = isset($_POST['values']) ? json_decode(wp_unslash($_POST['values']), true) : [];
        if (! is_array($raw)) {
            $raw = [];
        }

        // 5) 保存前做字段级校验。与 CSF 同语义：校验失败不阻断整次保存，
        //    只把出错的字段单独回滚（见第 6.1 步），其余字段照常落库。
        $errors = self::validate_by_sections($opt['sections'], $raw);

        // 6) 按已注册字段 schema 逐项清洗；schema 之外的键一律丢弃，杜绝越权写入。
        //    带 csf_shape 标记的字段在这一步已转回 CSF 的存值格式。
        $clean = self::sanitize_by_sections($opt['sections'], $raw);

        // 6.1) 逐字段回滚：校验没过的字段丢弃本次提交值，恢复成保存前的状态。
        //      放在 eva_{id}_save 过滤器之前，与 CSF 在字段循环内回滚的时机一致，
        //      过滤器拿到的就已经是最终要落库的那一份。
        if (! empty($errors)) {
            $clean = self::restore_invalid_fields($clean, $errors, \Eva::get_values($option_id));
        }

        // 7) 保存钩子，对应 CSF 的 csf_{id}_save（过滤器）/ csf_{id}_save_before / _saved / _save_after（动作）。
        $clean = apply_filters('eva_' . $option_id . '_save', $clean, $opt, $raw);
        if (! is_array($clean)) {
            $clean = [];
        }
        do_action('eva_' . $option_id . '_save_before', $clean, $opt);

        // 8) 落库：整组以 option_id 为键保存。存到哪里由设置页的 database 参数决定
        //    （默认 wp_options，与 CSF 的 serialize 行为一致；还支持 transient / theme_mod / network）。
        \Eva::write_stored($option_id, $clean);

        do_action('eva_' . $option_id . '_saved', $clean, $opt);
        do_action('eva_' . $option_id . '_save_after', $clean, $opt);

        // 9) 回吐清洗结果，前端可据此刷新本地状态（确认实际入库的值）；库里是 CSF 格式，回给组件前先转回去。
        //    errors 非空表示「已保存，但这几个字段被还原了」，前端据此标红并定位，不再当作整次保存失败。
        $response = ['values' => Csf_Compat::values_to_eva($opt['sections'], $clean)];
        if (! empty($errors)) {
            $response['errors'] = $errors;
        }
        wp_send_json_success($response);
    }

    /**
     * 取设置页保存所需的权限：createOptions 时声明的 capability，未声明或为空时回退 manage_options。
     * 与 Admin / Standalone 打开该页时校验的是同一个 capability。
     *
     * @param array $opt 设置页配置。
     * @return string
     */
    private static function option_capability($opt)
    {
        $capability = isset($opt['capability']) && is_string($opt['capability']) ? trim($opt['capability']) : '';
        return $capability !== '' ? $capability : 'manage_options';
    }

    /**
     * 把校验未通过的字段回滚成「保存前的样子」，其余字段保持本次提交值。
     *
     * 对应 CSF 的 `admin-options.class.php` 在字段循环里做的
     * `$data[$field_id] = $this->options[$field_id] ?? ''`——差别只在「从没存过」这一种情况：
     * CSF 会写入空字符串，Eva 选择删键，让读取时回落到字段 default，
     * 也就是用户在界面上改坏它之前看到的那个值。
     *
     * @param array                $clean  已清洗、准备落库的值（CSF 存值格式）。
     * @param array<string,string> $errors 校验错误，键为字段 id。
     * @param array                $stored 保存前库里的值（CSF 存值格式）。
     * @return array                       回滚后的待落库值。
     */
    private static function restore_invalid_fields($clean, $errors, $stored)
    {
        $stored = is_array($stored) ? $stored : [];

        foreach (array_keys($errors) as $field_id) {
            // 该字段本就不参与存储（纯展示、save=false、依赖隐藏）时无需回滚。
            if (! array_key_exists($field_id, $clean)) {
                continue;
            }
            if (array_key_exists($field_id, $stored)) {
                $clean[$field_id] = $stored[$field_id];
            } else {
                unset($clean[$field_id]);
            }
        }

        return $clean;
    }

    /**
     * 按 sections 执行字段级 validate；返回 [field_id => error_message]。
     *
     * 支持：
     * - `required => true` 快捷必填。
     * - `validate => 'email'|'numeric'|'number'|'required'|'url'|'phone'|'slug'|'uuid'` 内置规则。
     * - `validate => callable` 自定义回调，返回非空字符串即视为错误。
     * - `validate => [rule1, rule2]` 多规则顺序执行。
     *
     * @param array $sections 容器字段分组。
     * @param array $raw      前端提交的原始字段值。
     * @return array<string,string>
     */
    public static function validate_by_sections($sections, $raw)
    {
        $raw    = is_array($raw) ? $raw : [];
        $errors = [];

        foreach ((array) $sections as $section) {
            if (empty($section['fields']) || ! is_array($section['fields'])) {
                continue;
            }

            foreach ($section['fields'] as $field) {
                if (empty($field['id'])) {
                    continue;
                }

                if (! Admin\Dependency::should_save_field($field, $raw)) {
                    continue;
                }

                $id    = (string) $field['id'];
                $value = array_key_exists($id, $raw) ? $raw[$id] : null;
                $error = self::validate_field($field, $value, $raw);
                if ($error !== '') {
                    $errors[$id] = $error;
                }
            }
        }

        return $errors;
    }

    /**
     * 执行单个字段的 validate 规则。
     *
     * @param array $field 字段 schema。
     * @param mixed $value 字段原始值。
     * @param array $raw   当前提交的全部字段值。
     * @return string      错误文案；空字符串表示通过。
     */
    public static function validate_field($field, $value, $raw = [])
    {
        $rules = [];

        if (! empty($field['required'])) {
            $rules[] = 'required';
        }

        if (isset($field['validate'])) {
            $validate = $field['validate'];
            if (is_array($validate) && ! is_callable($validate)) {
                $rules = array_merge($rules, $validate);
            } else {
                $rules[] = $validate;
            }
        }

        $input_type = isset($field['input_type']) ? sanitize_key((string) $field['input_type']) : '';
        if ($input_type === 'email' && ! in_array('email', $rules, true)) {
            $rules[] = 'email';
        }
        if ($input_type === 'url' && ! in_array('url', $rules, true)) {
            $rules[] = 'url';
        }

        $type = \Eva::normalizeFieldType(isset($field['type']) ? $field['type'] : 'text');
        if ($type === 'code_editor') {
            $code_error = Admin\Fields\Code_Editor::validate($value, $field);
            if ($code_error !== '') {
                return sanitize_text_field($code_error);
            }
        }

        foreach ($rules as $rule) {
            $error = self::run_validate_rule($rule, $value, $field, $raw);
            if ($error !== '') {
                return $error;
            }
        }

        $length = is_scalar($value) ? (function_exists('mb_strlen') ? mb_strlen((string) $value, 'UTF-8') : strlen((string) $value)) : 0;
        if ($value !== null && $value !== '' && ! empty($field['minlength']) && $length < absint($field['minlength'])) {
            return '该字段至少需要 ' . absint($field['minlength']) . ' 个字符。';
        }
        if (! empty($field['maxlength']) && $length > absint($field['maxlength'])) {
            return '该字段最多允许 ' . absint($field['maxlength']) . ' 个字符。';
        }

        if ($type === 'textarea' && is_scalar($value)) {
            $text = str_replace(["\r\n", "\r"], "\n", (string) $value);
            $line_count = $text === '' ? 0 : count(explode("\n", $text));
            preg_match_all("/[\x{3400}-\x{9fff}]|[A-Za-z0-9]+(?:[\x{2019}'-][A-Za-z0-9]+)*/u", $text, $word_matches);
            $word_count = isset($word_matches[0]) ? count($word_matches[0]) : 0;

            if ($text !== '' && ! empty($field['min_words']) && $word_count < absint($field['min_words'])) {
                return '该字段至少需要 ' . absint($field['min_words']) . ' 个词。';
            }
            if (! empty($field['max_words']) && $word_count > absint($field['max_words'])) {
                return '该字段最多允许 ' . absint($field['max_words']) . ' 个词。';
            }
            if ($text !== '' && ! empty($field['min_lines']) && $line_count < absint($field['min_lines'])) {
                return '该字段至少需要 ' . absint($field['min_lines']) . ' 行。';
            }
            if (! empty($field['max_lines']) && $line_count > absint($field['max_lines'])) {
                return '该字段最多允许 ' . absint($field['max_lines']) . ' 行。';
            }
        }
        if ($value !== null && $value !== '' && ! empty($field['pattern'])) {
            $pattern = (string) $field['pattern'];
            $matched = @preg_match('~' . str_replace('~', '\~', $pattern) . '~u', (string) $value);
            if ($matched !== 1) {
                return ! empty($field['pattern_message']) ? sanitize_text_field((string) $field['pattern_message']) : '该字段格式不正确。';
            }
        }

        return '';
    }

    /**
     * 执行一条内置或自定义 validate 规则。
     *
     * @param mixed $rule  规则名或 callable。
     * @param mixed $value 字段原始值。
     * @param array $field 字段 schema。
     * @param array $raw   全部原始提交值。
     * @return string      错误文案；空字符串表示通过。
     */
    private static function run_validate_rule($rule, $value, $field, $raw)
    {
        if (is_callable($rule)) {
            $result = call_user_func($rule, $value, $field, $raw);
            return is_string($result) ? sanitize_text_field($result) : '';
        }

        $rule = sanitize_key((string) $rule);
        if ($rule === '') {
            return '';
        }

        $label = isset($field['title']) && is_scalar($field['title']) ? (string) $field['title'] : '该字段';
        $empty = self::is_empty_value($value);

        if ($rule === 'required') {
            return $empty ? $label . '不能为空。' : '';
        }

        if ($empty) {
            return '';
        }

        if ($rule === 'email') {
            return is_email((string) $value) ? '' : $label . '必须是有效邮箱。';
        }

        if ($rule === 'numeric' || $rule === 'number') {
            return is_numeric($value) ? '' : $label . '必须是数字。';
        }

        if ($rule === 'url') {
            return filter_var((string) $value, FILTER_VALIDATE_URL) ? '' : $label . '必须是有效 URL。';
        }

        if ($rule === 'phone') {
            $digits = preg_replace('/\D+/', '', (string) $value);
            return strlen($digits) >= 7 ? '' : $label . '必须是有效电话号码。';
        }

        if ($rule === 'slug') {
            return preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', (string) $value) ? '' : $label . '只能使用小写字母、数字和连字符。';
        }

        if ($rule === 'uuid') {
            return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', (string) $value) ? '' : $label . '必须是有效 UUID。';
        }

        if (function_exists($rule)) {
            $result = call_user_func($rule, $value, $field, $raw);
            return is_string($result) ? sanitize_text_field($result) : '';
        }

        return '';
    }

    /**
     * 判断 validate 语义下的空值。
     *
     * @param mixed $value 待判断值。
     * @return bool
     */
    private static function is_empty_value($value)
    {
        return $value === null || $value === '' || $value === [] || $value === false;
    }

    /**
     * 按一组 sections 的字段 schema 清洗提交值；未在 schema 内的键一律丢弃。
     *
     * 设计为静态方法，供设置页(AJAX) 与 metabox / 分类法 / 导航菜单 / 评论 / 用户资料等
     * 各嵌入式容器共用，保证「能存什么、怎么存」的规则全框架统一。
     *
     * @param array $sections 容器的 sections（每个含 fields[]，字段需带 id / type）。
     * @param array $raw      前端提交的原始键值（[field_id => value]）。
     * @return array          清洗后的 [field_id => value]，仅含 schema 内声明的字段。
     */
    public static function sanitize_by_sections($sections, $raw)
    {
        // 入参兜底：$raw 必须是数组，否则后续 array_key_exists 会报错。
        $raw   = is_array($raw) ? $raw : [];
        $clean = [];

        // 遍历每个分组。
        foreach ((array) $sections as $section) {
            // 没有 fields 的分组（纯标题/占位）直接跳过。
            if (empty($section['fields']) || ! is_array($section['fields'])) {
                continue;
            }
            // 遍历分组内每个字段，按其类型清洗对应的提交值。
            foreach ($section['fields'] as $field) {
                // 无 id、纯展示/操作字段或显式 save=false 的字段不参与存储。
                if (! self::should_store_field($field)) {
                    continue;
                }
                $id   = $field['id'];
                // 字段未声明 type 时按 text；同时兼容 content/media 等 CSF 别名。
                $type = \Eva::normalizeFieldType(isset($field['type']) ? $field['type'] : 'text');
                // 依赖隐藏字段默认保留保存；仅显式 save_when_hidden=false 时按规则跳过。
                if (! Admin\Dependency::should_save_field($field, $raw)) {
                    continue;
                }
                // CSF 的字符串数据源（'options' => 'categories'）先展开成选项数组，
                // 否则 checkbox / radio / button_set 按 options 校验合法值时会把所有提交值都当成非法。
                $field = Csf_Compat::resolve_field($field);
                // 前端没提交该字段时取 null，交由 sanitize_field 决定其空值表现。
                $val  = array_key_exists($id, $raw) ? $raw[$id] : null;
                // 送进来的也可能是库里的 CSF 结构（定制器会把已存值再过一遍 sanitize_callback）：
                // 先统一成组件结构再清洗。转换是幂等的，已经是组件结构的值不会被改动。
                if ($val !== null && ! empty($field['csf_shape'])) {
                    $val = Csf_Compat::value_to_eva($field, $val);
                }
                $value = ($type === 'accordion')
                    ? self::sanitize_accordion($field, $val)
                    : self::sanitize_field($type, $val, $field);
                // 组件值 → CSF 存值（只对带 csf_shape 标记的字段生效）；子字段在各自这一步已经转过。
                $value = Csf_Compat::value_to_csf($field, $value, $val);
                $clean[$id] = self::apply_custom_sanitize($field, $value);
            }
        }
        return $clean;
    }

    /**
     * 还原嵌入式容器提交的 JSON 复合值。
     *
     * 嵌入式外壳（eva-embed.js）用原生表单提交：每个字段一个隐藏域，数组 / 对象类的值
     * （多选、字段组、重复器、排序、颜色组…）被 JSON.stringify 成字符串。这里按分区里声明的字段逐个检查，
     * 形如 [...] / {...} 且能解析成数组的才还原，普通文本（哪怕以方括号开头）不受影响。
     * metabox / 分类法 / 导航菜单 / 评论 / 用户资料的保存流程在清洗前都要先过这一步。
     *
     * @param mixed $raw      $_POST['eva_fields'][容器 id]（已 wp_unslash）。
     * @param array $sections 容器分区。
     * @return array
     */
    public static function decode_embedded_values($raw, $sections)
    {
        $raw = is_array($raw) ? $raw : [];
        foreach ((array) $sections as $section) {
            foreach ((isset($section['fields']) && is_array($section['fields']) ? $section['fields'] : []) as $field) {
                $id = is_array($field) && ! empty($field['id']) ? (string) $field['id'] : '';
                if ($id === '' || ! isset($raw[$id]) || ! is_string($raw[$id])) {
                    continue;
                }
                $value = trim($raw[$id]);
                if ($value === '' || ($value[0] !== '[' && $value[0] !== '{')) {
                    continue;
                }
                $decoded = json_decode($value, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $raw[$id] = $decoded;
                }
            }
        }
        return $raw;
    }

    /**
     * 判断字段是否属于可持久化输入字段。
     *
     * @param array $field 字段定义。
     * @return bool
     */
    private static function should_store_field($field)
    {
        if (! is_array($field) || empty($field['id']) || (array_key_exists('save', $field) && ! $field['save'])) {
            return false;
        }
        $type = \Eva::normalizeFieldType(isset($field['type']) ? $field['type'] : 'text');
        return ! in_array($type, ['html', 'theme_backup', 'callback', 'heading', 'subheading', 'submessage', 'notice'], true);
    }

    /**
     * 执行字段级自定义 sanitize 回调，兼容 CSF 的 `sanitize => callable` 写法。
     *
     * @param array $field 字段 schema。
     * @param mixed $value 已按 type 清洗后的值。
     * @return mixed       自定义清洗后的值。
     */
    private static function apply_custom_sanitize($field, $value)
    {
        if (empty($field['sanitize'])) {
            return $value;
        }

        $callback = $field['sanitize'];
        if (is_callable($callback)) {
            return call_user_func($callback, $value, $field);
        }

        $function = (string) $callback;
        if ($function !== '' && function_exists($function)) {
            return call_user_func($function, $value);
        }

        return $value;
    }

    /**
     * 按字段类型清洗单个值。
     *
     * 复合字段（group / repeater / typography / spacing / dimensions / border / background）
     * 由各自处理器保留结构并逐项清洗；未识别数组也会递归清洗而不会强制转成字符串。
     *
     * @param string $type 字段类型标识。
     * @param mixed  $val  原始值（可能为 null / 标量 / 数组）。
     * @param array  $field 字段 schema，供有限选项类字段校验合法值。
     * @return mixed       清洗后的值。
     */
    public static function sanitize_field($type, $val, $field = [])
    {
        $type = \Eva::normalizeFieldType($type);
        $registered = \Eva::getFieldSanitizer($type);

        if ($registered) {
            $value = call_user_func($registered, $val, $field, $type);
        } else {
            switch ($type) {
                case 'switcher': $value = Admin\Fields\Switcher::sanitize($val, $field); break;
                case 'textarea': $value = Admin\Fields\Textarea::sanitize($val, $field); break;
                case 'checkbox': $value = Admin\Fields\Checkbox::sanitize($val, $field); break;
                case 'radio': $value = Admin\Fields\Radio::sanitize($val, $field); break;
                case 'button_set': $value = Admin\Fields\Button_Set::sanitize($val, $field); break;
                case 'number': $value = Admin\Fields\Number_Field::sanitize($val, $field); break;
                case 'slider': $value = Admin\Fields\Slider::sanitize($val, $field); break;
                case 'spinner': $value = Admin\Fields\Spinner::sanitize($val, $field); break;
                case 'date': $value = Admin\Fields\Date::sanitize($val, $field); break;
                case 'datetime': $value = Admin\Fields\Datetime::sanitize($val, $field); break;
                case 'link': $value = Admin\Fields\Link::sanitize($val, $field); break;
                case 'link_color': $value = Admin\Fields\Link_Color::sanitize($val, $field); break;
                case 'color': $value = Admin\Fields\Color::sanitize($val, $field); break;
                case 'color_group': $value = Admin\Fields\Color_Group::sanitize($val, $field); break;
                case 'group': $value = Admin\Fields\Group::sanitize($val, $field); break;
                case 'repeater': $value = Admin\Fields\Repeater::sanitize($val, $field); break;
                case 'tabbed': $value = Admin\Fields\Tabbed::sanitize($val, $field); break;
                case 'palette': $value = Admin\Fields\Palette::sanitize($val, $field); break;
                case 'color_set': $value = Admin\Fields\Color_Set::sanitize($val, $field); break;
                case 'map': $value = Admin\Fields\Map_Field::sanitize($val, $field); break;
                case 'typography': $value = Admin\Fields\Typography::sanitize($val, $field); break;
                case 'spacing': $value = Admin\Fields\Spacing::sanitize($val, $field); break;
                case 'dimensions': $value = Admin\Fields\Dimensions::sanitize($val, $field); break;
                case 'border': $value = Admin\Fields\Border::sanitize($val, $field); break;
                case 'background': $value = Admin\Fields\Background::sanitize($val, $field); break;
                case 'icon': $value = Admin\Fields\Icon::sanitize($val, $field); break;
                case 'post_selector':
                case 'term_selector':
                case 'taxonomy':
                case 'user_selector':
                case 'user':
                case 'nav_menu':
                case 'menu':
                case 'sidebar':
                case 'sidebars': $value = Admin\Fields\Data_Selector::sanitize($val, $field); break;
                case 'relationship': $value = Admin\Fields\Data_Selector::sanitize_relationship($val, $field); break;
                case 'upload': $value = Admin\Fields\Upload::sanitize($val, $field); break;
                case 'gallery': $value = Admin\Fields\Gallery::sanitize($val, $field); break;
                case 'media': $value = Admin\Fields\Media::sanitize($val, $field); break;
                case 'sorter':
                case 'sortable': $value = Admin\Fields\Sorter::sanitize($val, $field); break;
                case 'wp_editor':
                case 'editor': $value = Admin\Fields\WP_Editor::sanitize($val, $field); break;
                case 'code_editor': $value = Admin\Fields\Code_Editor::sanitize($val, $field); break;
                case 'image_select': $value = Admin\Fields\Image_Select::sanitize($field, $val); break;
                case 'ajax_select': $value = Admin\Fields\Ajax_Select::sanitize($field, $val); break;
                case 'select': $value = Admin\Fields\Select::sanitize($field, $val); break;
                case 'html': $value = Admin\Fields\Html::sanitize($val, $field); break;
                case 'theme_backup': $value = Admin\Fields\Theme_Backup::sanitize($val, $field); break;
                case 'builder': $value = self::sanitize_builder($val, $field); break;
                case 'text': $value = Admin\Fields\Text::sanitize($val, $field); break;
                default:
                    // 未识别数组保留结构并递归清洗，绝不强制落入 Text::sanitize()。
                    if (is_array($val)) {
                        $value = self::deep_clean_values($val);
                    } elseif (is_object($val) || is_resource($val)) {
                        $value = '';
                    } else {
                        $value = Admin\Fields\Text::sanitize($val, $field);
                    }
                    break;
            }
        }

        return apply_filters('eva_sanitize_field_' . $type, $value, $field, $val);
    }

    /**
     * 清洗 builder（页面构建器）字段：值为模块实例数组 [{uid,type,values}]。
     *
     * 外壳阶段做通用递归清洗、保留结构（uid/type 走 sanitize_key，values 递归清洗）。
     * 注意：此处无法获知 JS 端 window.EvaModules 的逐字段类型，故按通用规则清洗；
     * 待模块契约稳定后，可改为按各模块 fields 的 type 调用对应 sanitize 分支以更精细。
     *
     * @param mixed $val   原始值。
     * @param array $field  字段 schema。
     * @return array        清洗后的实例数组。
     */
    private static function sanitize_builder($val, $field = [])
    {
        if (! is_array($val)) {
            return [];
        }

        if (isset($val['slots']) && is_array($val['slots'])) {
            $slots = [];
            foreach ($val['slots'] as $slot => $items) {
                $slot = sanitize_key((string) $slot);
                if ($slot === '') {
                    continue;
                }
                $slots[$slot] = self::sanitize_builder_items($items);
            }
            return ['slots' => $slots];
        }

        return self::sanitize_builder_items($val);
    }

    /**
     * 清洗 builder 单个 slot 内的模块实例数组。
     *
     * @param mixed $items 原始模块实例数组。
     * @return array
     */
    private static function sanitize_builder_items($items)
    {
        if (! is_array($items)) {
            return [];
        }

        $clean = [];
        foreach ($items as $item) {
            if (! is_array($item) || empty($item['type'])) {
                continue;
            }
            $clean[] = [
                'uid'    => isset($item['uid']) ? sanitize_key((string) $item['uid']) : '',
                'type'   => sanitize_key((string) $item['type']),
                'values' => (isset($item['values']) && is_array($item['values'])) ? self::deep_clean_values($item['values']) : [],
            ];
        }

        return $clean;
    }

    /**
     * 递归清洗任意嵌套结构中的标量值：字符串走 wp_kses_post（保留换行与安全 HTML、剔除脚本），
     * 布尔/数值原样保留，数组递归处理。
     *
     * @param mixed $value 待清洗值。
     * @return mixed        清洗后的值。
     */
    private static function deep_clean_values($value)
    {
        if (is_array($value)) {
            $out = [];
            foreach ($value as $k => $v) {
                $key       = is_string($k) ? sanitize_key($k) : $k;
                $out[$key] = self::deep_clean_values($v);
            }
            return $out;
        }

        if (is_bool($value) || is_int($value) || is_float($value)) {
            return $value;
        }

        return wp_kses_post((string) $value);
    }

    /**
     * 清洗 select 字段；支持普通单选、多选，以及 ajax=true 的 ID 单选/多选。
     *
     * @param array $field 字段 schema。
     * @param mixed $val   原始值。
     * @return string|int|array
     */
    public static function sanitize_select($field, $val)
    {
        return Admin\Fields\Select::sanitize($field, $val);
    }

    /**
     * 清洗图像选择字段：只允许保存 options 中声明过的选项值。
     *
     * @param array $field 字段 schema。
     * @param mixed $val   原始选中值。
     * @return string      合法选项值；无效时回退到合法 default 或空字符串。
     */
    public static function sanitize_image_select($field, $val)
    {
        return Admin\Fields\Image_Select::sanitize($field, $val);
    }

    /**
     * 清洗颜色值：仅允许 #RGB/#RRGGBB 或 rgb()/rgba() 字符串，失败返回空。
     *
     * @param mixed $val 原始颜色值。
     * @return string    规范化后的颜色字符串。
     */
    public static function sanitize_color($val)
    {
        return Admin\Fields\Color::sanitize($val);
    }

    /**
     * 清洗颜色组：保留合法 HEX/RGBA 颜色并重排索引。
     *
     * @param mixed $val 原始颜色数组。
     * @return array<int,string> 清洗后的颜色数组。
     */
    public static function sanitize_color_group($val)
    {
        return Admin\Fields\Color_Group::sanitize($val);
    }

    /**
     * 清洗图标值：允许常见图标类名/名称字符，避免写入 HTML 或脚本片段。
     *
     * @param mixed $val 原始图标值。
     * @return string    清洗后的图标字符串。
     */
    public static function sanitize_icon($val)
    {
        return Admin\Fields\Icon::sanitize($val);
    }

    /**
     * 清洗上传字段值：支持 URL / 附件 ID / 附件信息数组。
     *
     * @param mixed $val 原始上传值。
     * @return mixed     清洗后的字符串、整数或数组。
     */
    public static function sanitize_upload($val)
    {
        return Admin\Fields\Upload::sanitize($val);
    }

    /**
     * 清洗 accordion 字段：按每个 panel 的 fields 子 schema 递归清洗。
     *
     * @param array $field accordion 字段 schema。
     * @param mixed $val   原始 accordion 值。
     * @return array       [section_id => [field_id => clean_value]]。
     */
    public static function sanitize_accordion($field, $val)
    {
        return Admin\Fields\Accordion::sanitize($field, $val);
    }
}
