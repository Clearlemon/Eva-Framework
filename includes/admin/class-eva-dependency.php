<?php

namespace Eva\Framework\Admin;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 字段依赖规则处理器。
 *
 * 职责：
 * - 兼容 CSF 的 dependency 写法，并转换为前端更容易消费的统一规则。
 * - 支持 Eva 新增的 visible_if / disabled_if / readonly_if 结构化规则。
 * - 解析跨设置页 option 来源，供前端在当前页面初始化时读取外部依赖值。
 * - 在保存时按 save_when_hidden 策略决定隐藏字段是否继续写入。
 */
class Dependency
{
    /**
     * 规范化一组 sections 内所有字段的依赖配置。
     *
     * @param array $sections 原始字段分组。
     * @return array          已追加 eva_dependency 的字段分组。
     */
    public static function prepare_sections($sections)
    {
        $out = [];

        foreach ((array) $sections as $section) {
            if (! empty($section['fields']) && is_array($section['fields'])) {
                foreach ($section['fields'] as $index => $field) {
                    if (is_array($field)) {
                        $section['fields'][$index] = self::prepare_field($field);
                    }
                }
                $section['fields'] = array_values($section['fields']);
            }
            $out[] = $section;
        }

        return array_values($out);
    }

    /**
     * 规范化单个字段的依赖配置。
     *
     * @param array $field 字段 schema。
     * @return array       附带 eva_dependency 的字段 schema。
     */
    public static function prepare_field($field)
    {
        $dependency = [];

        if (! empty($field['dependency'])) {
            $dependency['visible'] = self::normalize_csf_dependency(
                $field['dependency'],
                isset($field['dependency_action']) ? $field['dependency_action'] : ''
            );
        }

        $visible_if = self::first_defined($field, ['visible_if', 'show_if']);
        if ($visible_if !== null) {
            $dependency['visible'] = self::normalize_rule_group($visible_if, [
                'action' => self::sanitize_action(isset($field['dependency_action']) ? $field['dependency_action'] : 'hide'),
                'mode'   => 'visible',
            ]);
        }

        if (isset($field['disabled_if'])) {
            $dependency['disabled'] = self::normalize_rule_group($field['disabled_if'], [
                'mode' => 'disabled',
            ]);
        }

        if (isset($field['readonly_if'])) {
            $dependency['readonly'] = self::normalize_rule_group($field['readonly_if'], [
                'mode' => 'readonly',
            ]);
        }

        $dependency = array_filter($dependency, static function ($group) {
            return is_array($group) && ! empty($group['rules']);
        });

        if ($dependency) {
            $field['eva_dependency'] = $dependency;
        }

        return $field;
    }

    /**
     * 收集并读取依赖规则中声明的外部数据源。
     *
     * 目前先支持 option / site_option，后续可扩展 post_meta、term_meta、user_meta。
     *
     * @param array $sections 已规范化或原始 sections。
     * @return array          前端可直接读取的外部依赖值。
     */
    public static function dependency_sources($sections)
    {
        $sources = [
            'option'      => [],
            'site_option' => [],
        ];

        foreach (self::all_rules($sections) as $rule) {
            $source = isset($rule['source']) ? $rule['source'] : 'field';
            if ($source !== 'option' && $source !== 'site_option') {
                continue;
            }

            $option = isset($rule['option']) ? sanitize_text_field((string) $rule['option']) : '';
            if ($option === '') {
                continue;
            }

            $key = isset($rule['key']) ? sanitize_text_field((string) $rule['key']) : '__value';
            if (! isset($sources[$source][$option])) {
                $sources[$source][$option] = [];
            }
            $sources[$source][$option][$key] = self::read_source_value($source, $option, $key);
        }

        return $sources;
    }

    /**
     * 判断字段在当前提交上下文里是否应参与保存。
     *
     * 默认隐藏字段仍保存，只有显式 save_when_hidden=false 且 visible 依赖不满足时才跳过。
     *
     * @param array $field 字段 schema。
     * @param array $raw   当前提交的原始字段值。
     * @return bool        true=继续保存；false=跳过保存。
     */
    public static function should_save_field($field, $raw)
    {
        if (! array_key_exists('save_when_hidden', $field) || $field['save_when_hidden'] !== false) {
            return true;
        }

        $prepared = self::prepare_field($field);
        if (empty($prepared['eva_dependency']['visible'])) {
            return true;
        }

        return self::evaluate_group($prepared['eva_dependency']['visible'], is_array($raw) ? $raw : []);
    }

    /**
     * 规范化 CSF 的 dependency 数组。
     *
     * @param mixed  $dependency      CSF dependency 配置。
     * @param string $action_override 字段层级的动作覆盖值。
     * @return array                  统一规则组。
     */
    private static function normalize_csf_dependency($dependency, $action_override = '')
    {
        $rows = [];
        if (is_array($dependency) && isset($dependency[0]) && is_array($dependency[0])) {
            $rows = $dependency;
        } else {
            $rows = [$dependency];
        }

        $rules = [];
        $action = 'hide';

        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }

            $controllers = self::split_pipe(isset($row[0]) ? $row[0] : '');
            $conditions  = self::split_pipe(isset($row[1]) ? $row[1] : '');
            $values      = self::split_pipe(isset($row[2]) ? $row[2] : '');
            $global      = ! empty($row[3]);
            $visible     = ! empty($row[4]);

            if ($visible) {
                $action = 'visible';
            }

            foreach ($controllers as $index => $controller) {
                if ($controller === '') {
                    continue;
                }
                $rules[] = [
                    'source'   => 'field',
                    'id'       => sanitize_text_field((string) $controller),
                    'operator' => self::sanitize_operator(isset($conditions[$index]) ? $conditions[$index] : (isset($conditions[0]) ? $conditions[0] : '==')),
                    'value'    => isset($values[$index]) ? $values[$index] : (isset($values[0]) ? $values[0] : ''),
                    'global'   => $global,
                ];
            }
        }

        if ($action_override !== '') {
            $action = self::sanitize_action($action_override);
        }

        return [
            'mode'     => 'visible',
            'action'   => $action,
            'relation' => 'and',
            'rules'    => $rules,
        ];
    }

    /**
     * 规范化 Eva 结构化依赖规则。
     *
     * @param mixed $raw      原始规则。
     * @param array $defaults 默认配置。
     * @return array          统一规则组。
     */
    private static function normalize_rule_group($raw, $defaults = [])
    {
        $relation = isset($defaults['relation']) ? $defaults['relation'] : 'and';
        $action   = isset($defaults['action']) ? $defaults['action'] : 'hide';
        $mode     = isset($defaults['mode']) ? $defaults['mode'] : 'visible';
        $rules_in = $raw;

        if (is_array($raw) && isset($raw['rules'])) {
            $rules_in = $raw['rules'];
            if (isset($raw['relation'])) {
                $relation = $raw['relation'];
            }
            if (isset($raw['action'])) {
                $action = $raw['action'];
            }
        }

        if (self::looks_like_csf_row($rules_in)) {
            $group = self::normalize_csf_dependency($rules_in, $action);
            $group['mode'] = sanitize_key($mode);
            $group['relation'] = self::sanitize_relation($relation);
            return $group;
        }

        if (self::looks_like_single_rule($rules_in)) {
            $rules_in = [$rules_in];
        }

        $rules = [];
        foreach ((array) $rules_in as $rule) {
            if (self::looks_like_csf_row($rule)) {
                $group = self::normalize_csf_dependency($rule);
                $rules = array_merge($rules, $group['rules']);
                continue;
            }

            if (! is_array($rule)) {
                continue;
            }

            $rules[] = self::normalize_rule($rule);
        }

        return [
            'mode'     => sanitize_key($mode),
            'action'   => self::sanitize_action($action),
            'relation' => self::sanitize_relation($relation),
            'rules'    => array_values(array_filter($rules)),
        ];
    }

    /**
     * 规范化单条结构化规则。
     *
     * @param array $rule 原始规则。
     * @return array      统一规则。
     */
    private static function normalize_rule($rule)
    {
        $source = isset($rule['source']) ? sanitize_key($rule['source']) : 'field';
        $id     = isset($rule['id']) ? sanitize_text_field((string) $rule['id']) : '';

        return [
            'source'   => $source ?: 'field',
            'id'       => $id,
            'option'   => isset($rule['option']) ? sanitize_text_field((string) $rule['option']) : '',
            'key'      => isset($rule['key']) ? sanitize_text_field((string) $rule['key']) : '',
            'operator' => self::sanitize_operator(isset($rule['operator']) ? $rule['operator'] : (isset($rule['condition']) ? $rule['condition'] : '==')),
            'value'    => isset($rule['value']) ? self::sanitize_value($rule['value']) : '',
            'global'   => ! empty($rule['global']),
        ];
    }

    /**
     * 在保存阶段评估 visible 规则组。
     *
     * @param array $group  规则组。
     * @param array $values 当前提交值。
     * @return bool         规则是否满足。
     */
    private static function evaluate_group($group, $values)
    {
        $rules = isset($group['rules']) && is_array($group['rules']) ? $group['rules'] : [];
        if (! $rules) {
            return true;
        }

        $relation = isset($group['relation']) ? $group['relation'] : 'and';
        foreach ($rules as $rule) {
            $matched = self::evaluate_rule($rule, $values);
            if ($relation === 'or' || $relation === 'any') {
                if ($matched) {
                    return true;
                }
            } elseif (! $matched) {
                return false;
            }
        }

        return ! ($relation === 'or' || $relation === 'any');
    }

    /**
     * 在保存阶段评估单条规则。
     *
     * @param array $rule   规则。
     * @param array $values 当前提交值。
     * @return bool         是否匹配。
     */
    private static function evaluate_rule($rule, $values)
    {
        $actual = null;
        $source = isset($rule['source']) ? $rule['source'] : 'field';

        if ($source === 'option' || $source === 'site_option') {
            $option = isset($rule['option']) ? $rule['option'] : '';
            $key    = isset($rule['key']) ? $rule['key'] : '__value';
            $actual = self::read_source_value($source, $option, $key);
        } else {
            $id = isset($rule['id']) ? $rule['id'] : '';
            $actual = ($id !== '' && array_key_exists($id, $values)) ? $values[$id] : null;
        }

        return self::compare($actual, isset($rule['operator']) ? $rule['operator'] : '==', isset($rule['value']) ? $rule['value'] : '');
    }

    /**
     * 比较依赖值。
     *
     * @param mixed  $actual   实际值。
     * @param string $operator 运算符。
     * @param mixed  $expected 期望值。
     * @return bool
     */
    private static function compare($actual, $operator, $expected)
    {
        $operator = self::sanitize_operator($operator);

        if ($operator === 'empty') {
            return self::is_empty_value($actual);
        }
        if ($operator === 'not_empty') {
            return ! self::is_empty_value($actual);
        }
        if ($operator === 'truthy') {
            return self::to_bool($actual) === true;
        }
        if ($operator === 'falsy') {
            return self::to_bool($actual) === false;
        }

        if (in_array($operator, ['any', 'in', 'contains'], true)) {
            return self::contains_any($actual, $expected);
        }
        if (in_array($operator, ['not_any', 'not-in', 'not_in', 'not_contains'], true)) {
            return ! self::contains_any($actual, $expected);
        }

        if (in_array($operator, ['>', '>=', '<', '<='], true)) {
            $left  = is_numeric($actual) ? (float) $actual : 0.0;
            $right = is_numeric($expected) ? (float) $expected : 0.0;
            if ($operator === '>') {
                return $left > $right;
            }
            if ($operator === '>=') {
                return $left >= $right;
            }
            if ($operator === '<') {
                return $left < $right;
            }
            return $left <= $right;
        }

        $actual_cmp = self::normalize_compare_value($actual);
        $expect_cmp = self::normalize_compare_value($expected);

        if ($operator === '!=') {
            return $actual_cmp !== $expect_cmp;
        }

        return $actual_cmp === $expect_cmp;
    }

    /**
     * 获取所有依赖规则。
     *
     * @param array $sections 字段分组。
     * @return array<int,array>
     */
    private static function all_rules($sections)
    {
        $rules = [];
        $prepared = self::prepare_sections($sections);

        foreach ($prepared as $section) {
            foreach ((isset($section['fields']) ? (array) $section['fields'] : []) as $field) {
                $dependency = isset($field['eva_dependency']) && is_array($field['eva_dependency']) ? $field['eva_dependency'] : [];
                foreach ($dependency as $group) {
                    foreach ((isset($group['rules']) ? (array) $group['rules'] : []) as $rule) {
                        if (is_array($rule)) {
                            $rules[] = $rule;
                        }
                    }
                }
            }
        }

        return $rules;
    }

    /**
     * 读取外部依赖源的指定键。
     *
     * @param string $source option/site_option。
     * @param string $option 选项名。
     * @param string $key    键路径；空或 __value 表示整项。
     * @return mixed
     */
    private static function read_source_value($source, $option, $key)
    {
        if ($option === '') {
            return null;
        }

        $value = ($source === 'site_option') ? get_site_option($option, null) : get_option($option, null);
        if ($key === '' || $key === '__value') {
            return self::sanitize_value($value);
        }

        return self::sanitize_value(self::get_path_value($value, $key));
    }

    /**
     * 读取数组/对象的点号路径值。
     *
     * @param mixed  $value 数据源。
     * @param string $path  点号路径。
     * @return mixed
     */
    private static function get_path_value($value, $path)
    {
        $current = $value;
        foreach (explode('.', (string) $path) as $part) {
            if ($part === '') {
                continue;
            }
            if (is_array($current) && array_key_exists($part, $current)) {
                $current = $current[$part];
                continue;
            }
            if (is_object($current) && isset($current->{$part})) {
                $current = $current->{$part};
                continue;
            }
            return null;
        }

        return $current;
    }

    /**
     * 取字段数组中第一个存在的键值。
     *
     * @param array $field 字段 schema。
     * @param array $keys  候选键。
     * @return mixed|null
     */
    private static function first_defined($field, $keys)
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $field)) {
                return $field[$key];
            }
        }
        return null;
    }

    /**
     * 判断配置是否像一条结构化规则。
     *
     * @param mixed $value 待检测值。
     * @return bool
     */
    private static function looks_like_single_rule($value)
    {
        return is_array($value) && (
            array_key_exists('id', $value)
            || array_key_exists('source', $value)
            || array_key_exists('option', $value)
            || array_key_exists('operator', $value)
            || array_key_exists('condition', $value)
        );
    }

    /**
     * 判断配置是否像 CSF 的数字索引依赖行。
     *
     * @param mixed $value 待检测值。
     * @return bool
     */
    private static function looks_like_csf_row($value)
    {
        if (! is_array($value) || ! array_key_exists(0, $value) || ! array_key_exists(1, $value)) {
            return false;
        }

        // A list containing two structured Eva rules also has numeric indexes 0 and 1.
        // Do not misclassify that list as one CSF row, otherwise relation/rules groups
        // normalize to an empty dependency and are silently ignored.
        if ((is_array($value[0]) && self::looks_like_single_rule($value[0]))
            || (is_array($value[1]) && self::looks_like_single_rule($value[1]))) {
            return false;
        }

        return true;
    }

    /**
     * 按 CSF 的管道符拆分多控制器配置。
     *
     * @param mixed $value 原始值。
     * @return array
     */
    private static function split_pipe($value)
    {
        if (is_array($value)) {
            return array_map('strval', $value);
        }
        return explode('|', (string) $value);
    }

    /**
     * 清洗 relation。
     *
     * @param mixed $relation 原始 relation。
     * @return string
     */
    private static function sanitize_relation($relation)
    {
        $relation = sanitize_key((string) $relation);
        return in_array($relation, ['or', 'any'], true) ? 'or' : 'and';
    }

    /**
     * 清洗依赖动作。
     *
     * @param mixed $action 原始动作。
     * @return string
     */
    private static function sanitize_action($action)
    {
        $action = sanitize_key((string) $action);
        return in_array($action, ['hide', 'visible', 'disabled', 'readonly'], true) ? $action : 'hide';
    }

    /**
     * 清洗运算符。
     *
     * @param mixed $operator 原始运算符。
     * @return string
     */
    private static function sanitize_operator($operator)
    {
        $operator = trim((string) $operator);
        $aliases = [
            'not-any'      => 'not_any',
            'not-in'       => 'not_in',
            'not contains' => 'not_contains',
            'not-empty'    => 'not_empty',
        ];
        return isset($aliases[$operator]) ? $aliases[$operator] : $operator;
    }

    /**
     * 清洗并限制可注入前端的规则值。
     *
     * @param mixed $value 原始值。
     * @return mixed
     */
    private static function sanitize_value($value)
    {
        if (is_array($value)) {
            $out = [];
            foreach ($value as $key => $item) {
                $out[sanitize_text_field((string) $key)] = self::sanitize_value($item);
            }
            return $out;
        }

        if (is_bool($value) || is_int($value) || is_float($value) || $value === null) {
            return $value;
        }

        return sanitize_text_field((string) $value);
    }

    /**
     * 判断空值。
     *
     * @param mixed $value 待判断值。
     * @return bool
     */
    private static function is_empty_value($value)
    {
        return $value === null || $value === '' || $value === [] || $value === false;
    }

    /**
     * 转布尔，兼容 CSF 对 true/false 字符串的判断方式。
     *
     * @param mixed $value 原始值。
     * @return bool|null
     */
    private static function to_bool($value)
    {
        if ($value === true || $value === 'true' || $value === 1 || $value === '1') {
            return true;
        }
        if ($value === false || $value === 'false' || $value === 0 || $value === '0' || $value === null || $value === '') {
            return false;
        }
        return null;
    }

    /**
     * 归一化等值比较的左右值。
     *
     * @param mixed $value 原始值。
     * @return string
     */
    private static function normalize_compare_value($value)
    {
        $bool = self::to_bool($value);
        if ($bool !== null) {
            return $bool ? 'true' : 'false';
        }

        if (is_array($value)) {
            return implode(',', array_map([self::class, 'normalize_compare_value'], $value));
        }

        return (string) $value;
    }

    /**
     * 判断实际值是否命中期望集合。
     *
     * @param mixed $actual   实际值。
     * @param mixed $expected 期望值。
     * @return bool
     */
    private static function contains_any($actual, $expected)
    {
        $actuals = is_array($actual) ? $actual : explode(',', (string) $actual);
        $expects = is_array($expected) ? $expected : explode(',', (string) $expected);

        $actuals = array_map([self::class, 'normalize_compare_value'], $actuals);
        foreach ($expects as $expect) {
            if (in_array(self::normalize_compare_value($expect), $actuals, true)) {
                return true;
            }
        }

        return false;
    }
}
