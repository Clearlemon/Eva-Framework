<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * CSF 兼容层：让「按 CSF 写法注册的分区」在 Eva 里原样可用，且存库格式与 CSF 保持一致。
 *
 * 三件事，分三个时机做（开销从小到大）：
 * 1. 注册期 normalize_*：纯数组改写，不查库。把 CSF 的字段类型 / 键名映射到 Eva 的组件
 *    （fieldset→group、accordions→sections、image_select 的 text→label、CSF 写法的 sorter…），
 *    并给「存值格式与 Eva 不同」的字段打上 csf_shape 标记。
 * 2. 渲染 / 保存期 resolve_*：把 'options' => 'categories' 这类字符串数据源查库解析成选项数组。
 *    注册期可能早于 init（分类法尚未注册），且前台每次请求都会注册，所以不能放在注册期做。
 * 3. 读 / 写期 to_eva / to_csf：带 csf_shape 标记的字段，读出时把 CSF 存值转成组件要的结构，
 *    写入前再转回 CSF 结构——库里的数据始终是 CSF 格式，主题的 _LF_Settings() 等读取层不用改。
 *
 * 开关：容器或分区上写 'csf_compat' => true。只有「同名但语义相反」的映射受它控制
 * （group→repeater、gallery 存逗号串、color_group 按键存）；其余映射只在出现 CSF 独有写法时才触发，
 * 对 Eva 原生写法没有影响，因此始终开启。
 *
 * @package Eva\Framework
 */
class Csf_Compat
{
    /** @var array<string,array> 字符串数据源的解析结果缓存（同一请求内复用）。 */
    private static $source_cache = [];

    // =========================================================================
    // 1. 注册期：结构归一化
    // =========================================================================

    /**
     * 归一化一个分区：补 id、递归归一化字段。
     *
     * @param array $section 原始分区（CSF 或 Eva 写法）。
     * @param bool  $compat  所属容器是否开启 csf_compat。
     * @return array
     */
    public static function normalize_section($section, $compat = false)
    {
        if (! is_array($section)) {
            return [];
        }
        // 分区级开关可以单独打开，方便「迁一个分区、开一个分区」。
        $compat = $compat || ! empty($section['csf_compat']);

        // CSF 的分区可以不写 id（它用标题生成 tab id）；Eva 的侧栏和页签都靠 id 定位，这里补一个稳定的。
        if (! isset($section['id']) || $section['id'] === '') {
            $seed = (isset($section['parent']) ? (string) $section['parent'] : '') . '|' . self::plain_text(isset($section['title']) ? $section['title'] : '');
            $section['id'] = 'sec-' . substr(md5($seed), 0, 8);
        }

        if (! empty($section['fields']) && is_array($section['fields'])) {
            $section['fields'] = self::normalize_fields($section['fields'], $compat);
        }
        return $section;
    }

    /**
     * 归一化一组字段。
     *
     * @param array $fields 字段数组。
     * @param bool  $compat 是否按 CSF 语义处理同名字段。
     * @return array
     */
    public static function normalize_fields($fields, $compat = false)
    {
        $out = [];
        foreach ((array) $fields as $field) {
            if (is_array($field)) {
                $out[] = self::normalize_field($field, $compat);
            }
        }
        return $out;
    }

    /**
     * 归一化单个字段（递归处理容器字段的子字段）。
     *
     * @param array $field  原始字段。
     * @param bool  $compat 是否按 CSF 语义处理同名字段。
     * @return array
     */
    public static function normalize_field($field, $compat = false)
    {
        // 幂等：分区在 createSection 时归一化一次，Eva::get_resolved() 应用过滤器后还会再走一遍
        //（为了处理过滤器新加进来的原始分区）。已处理过的字段必须跳过——否则 fieldset 第一遍变成 group，
        // 第二遍又会被当成 CSF 的 group 转成 repeater。
        if (! empty($field['csf_normalized'])) {
            return $field;
        }
        $field['csf_normalized'] = true;

        $type = isset($field['type']) ? sanitize_key((string) $field['type']) : 'text';

        // ---- 类型映射 ----
        if ($type === 'fieldset') {
            // CSF fieldset = 固定的一组子字段、值为对象，正是 Eva 的 group。
            $type = 'group';
        } elseif ($type === 'backup') {
            $type = 'theme_backup';
        } elseif ($type === 'group' && $compat) {
            // CSF group = 可增删的行（值为数组），对应 Eva 的 repeater；Eva 自己的 group 是固定对象，语义相反。
            $type = 'repeater';
            $field = self::map_group_args($field);
        } elseif ($type === 'color_group' && $compat && ! empty($field['options']) && is_array($field['options'])) {
            // CSF color_group = 一组带名字的颜色，值按选项键存；Eva 的 color_group 是可增删的颜色列表。
            $type = 'color_set';
        }
        $field['type'] = $type;

        // ---- 键名映射 ----
        if ($type === 'accordion' && empty($field['sections']) && ! empty($field['accordions']) && is_array($field['accordions'])) {
            // CSF 用 accordions，且所有面板的子字段值平铺在同一层；Eva 用 sections，值按面板分组。
            $field['sections'] = [];
            foreach (array_values($field['accordions']) as $index => $panel) {
                if (! is_array($panel)) {
                    continue;
                }
                $panel['id'] = isset($panel['id']) && $panel['id'] !== '' ? (string) $panel['id'] : 'panel-' . $index;
                $field['sections'][] = $panel;
            }
            unset($field['accordions']);
            $field['csf_shape'] = 'flat';
            // CSF 的面板不能拖拽排序，平铺的值里也没地方存顺序。
            $field['sortable'] = false;
        }

        if ($type === 'image_select' && ! empty($field['options']) && is_array($field['options'])) {
            // Lentasy 给 CSF 打的补丁：选项写成 ['url' => …, 'text' => …]；Eva 读 label。
            foreach ($field['options'] as $key => $option) {
                if (is_array($option) && isset($option['text']) && ! isset($option['label'])) {
                    $field['options'][$key]['label'] = $option['text'];
                }
            }
        }

        if (($type === 'sorter' || $type === 'sortable') && empty($field['options']) && empty($field['items']) && self::is_csf_sorter_value(isset($field['default']) ? $field['default'] : null)) {
            // CSF 的 sorter 没有 options：选项来自 default 里 enabled / disabled 两组「键 => 标题」，值也照这个结构存。
            $default = $field['default'];
            $field['options'] = array_merge(
                isset($default['enabled']) && is_array($default['enabled']) ? $default['enabled'] : [],
                isset($default['disabled']) && is_array($default['disabled']) ? $default['disabled'] : []
            );
            $field['csf_shape'] = 'sorter';
            $field['default'] = self::value_to_eva($field, $default);
        }

        if ($type === 'gallery' && $compat) {
            // CSF 的 gallery 存「1,2,3」这样的附件 ID 逗号串。
            $field['csf_shape'] = 'gallery';
            if (isset($field['default'])) {
                $field['default'] = self::value_to_eva($field, $field['default']);
            }
        }

        if ($compat && Csf_Shapes::handles($type)) {
            // typography / background / border / spacing / dimensions / link_color / date / datetime：
            // 注册参数和存值结构都与 Eva 不同，交给 Csf_Shapes 映射参数，default 也换成组件要的结构。
            $field = Csf_Shapes::map_args($field, $type);
            if (array_key_exists('default', $field)) {
                $field['default'] = self::value_to_eva($field, $field['default']);
            }
        }

        // CSF 的 pseudo：字段照常渲染，但不进存值（CSF 里是不给它加容器前缀的 name）。
        if (! empty($field['pseudo']) && ! array_key_exists('save', $field)) {
            $field['save'] = false;
        }

        // ---- 递归子字段 ----
        if (! empty($field['fields']) && is_array($field['fields'])) {
            $field['fields'] = self::normalize_fields($field['fields'], $compat);
        }
        foreach (['tabs', 'sections'] as $list_key) {
            if (empty($field[$list_key]) || ! is_array($field[$list_key])) {
                continue;
            }
            foreach ($field[$list_key] as $index => $item) {
                if (is_array($item) && ! empty($item['fields']) && is_array($item['fields'])) {
                    $field[$list_key][$index]['fields'] = self::normalize_fields($item['fields'], $compat);
                }
            }
        }

        return $field;
    }

    /**
     * 把 CSF group 的参数映射到 Eva repeater 的参数。
     *
     * @param array $field CSF group 字段。
     * @return array
     */
    private static function map_group_args($field)
    {
        // 行标题前缀：accordion_title_prefix → item_title。
        if (! isset($field['item_title']) && isset($field['accordion_title_prefix'])) {
            $field['item_title'] = $field['accordion_title_prefix'];
        }
        // CSF 默认用第一个子字段的值当行标题（accordion_title_auto，默认开）；也可用 accordion_title_by 指定。
        if (! isset($field['title_field'])) {
            $auto = ! array_key_exists('accordion_title_auto', $field) || ! empty($field['accordion_title_auto']);
            $by   = isset($field['accordion_title_by']) ? (array) $field['accordion_title_by'] : [];
            if ($by) {
                $field['title_field'] = (string) reset($by);
            } elseif ($auto && ! empty($field['fields']) && is_array($field['fields'])) {
                foreach ($field['fields'] as $child) {
                    if (is_array($child) && ! empty($child['id'])) {
                        $field['title_field'] = (string) $child['id'];
                        break;
                    }
                }
            }
        }
        return $field;
    }

    // =========================================================================
    // 2. 渲染 / 保存期：字符串数据源
    // =========================================================================

    /**
     * 解析字段上的字符串数据源（'options' => 'categories' 等），返回 options 已是数组的字段。
     *
     * 只处理非 ajax 的情况；'ajax' => true 时改走 Eva 的远程搜索（source）。
     *
     * @param array $field 字段。
     * @return array
     */
    public static function resolve_field($field)
    {
        if (! is_array($field) || ! isset($field['options']) || ! is_string($field['options']) || $field['options'] === '') {
            return $field;
        }

        $source     = $field['options'];
        $query_args = isset($field['query_args']) && is_array($field['query_args']) ? $field['query_args'] : [];

        if (! empty($field['ajax'])) {
            $remote = self::remote_source($source, $query_args);
            if ($remote) {
                unset($field['options']);
                return array_merge($field, $remote);
            }
        }

        $field['options'] = self::resolve_options($source, $query_args);
        return $field;
    }

    /**
     * 把 CSF 的数据源名映射到 Eva 远程搜索的 source 参数。
     *
     * @param string $source     CSF 数据源名。
     * @param array  $query_args CSF query_args。
     * @return array|null        要合并进字段的参数；不支持远程搜索的数据源返回 null。
     */
    private static function remote_source($source, $query_args)
    {
        switch ($source) {
            case 'page':
            case 'pages':
                return ['source' => 'posts', 'post_type' => isset($query_args['post_type']) ? $query_args['post_type'] : 'page'];
            case 'post':
            case 'posts':
                return ['source' => 'posts', 'post_type' => isset($query_args['post_type']) ? $query_args['post_type'] : 'post'];
            case 'category':
            case 'categories':
                return ['source' => 'terms', 'taxonomy' => isset($query_args['taxonomy']) ? $query_args['taxonomy'] : 'category'];
            case 'tag':
            case 'tags':
                return ['source' => 'terms', 'taxonomy' => isset($query_args['taxonomy']) ? $query_args['taxonomy'] : 'post_tag'];
            case 'menu':
            case 'menus':
                return ['source' => 'menus'];
            case 'user':
            case 'users':
                return ['source' => 'users'];
        }
        return null;
    }

    /**
     * 按 CSF 的数据源名查出选项，返回 [['value' => …, 'label' => …], …]。
     *
     * 用列表而不是「值 => 标题」的关联数组：键是数字 ID 时，JSON 到了浏览器里会按数值重新排序，
     * 分类的层级顺序就乱了。
     *
     * @param string $source     pages / posts / categories / tags / menus / users / sidebars / roles /
     *                           post_types / locations，或一个可调用的函数名。
     * @param array  $query_args 透传给对应查询的参数（同 CSF 的 query_args）。
     * @return array<int,array{value:string,label:string}>
     */
    public static function resolve_options($source, $query_args = [])
    {
        $cache_key = md5($source . '|' . wp_json_encode($query_args));
        if (isset(self::$source_cache[$cache_key])) {
            return self::$source_cache[$cache_key];
        }

        $options = [];
        switch ($source) {
            case 'page':
            case 'pages':
            case 'post':
            case 'posts':
                $post_type = in_array($source, ['page', 'pages'], true) ? 'page' : 'post';
                $query = new \WP_Query(wp_parse_args($query_args, [
                    'post_type'      => $post_type,
                    'post_status'    => 'publish',
                    'posts_per_page' => 200,
                    'no_found_rows'  => true,
                ]));
                foreach ($query->posts as $post) {
                    $options[] = ['value' => (string) $post->ID, 'label' => $post->post_title !== '' ? $post->post_title : '#' . $post->ID];
                }
                break;

            case 'category':
            case 'categories':
            case 'tag':
            case 'tags':
            case 'menu':
            case 'menus':
                $taxonomy = in_array($source, ['category', 'categories'], true) ? 'category'
                    : (in_array($source, ['tag', 'tags'], true) ? 'post_tag' : 'nav_menu');
                $terms = get_terms(wp_parse_args($query_args, [
                    'taxonomy'   => $taxonomy,
                    'hide_empty' => false,
                ]));
                if (! is_wp_error($terms) && is_array($terms)) {
                    $options = self::hierarchical_term_options($terms);
                }
                break;

            case 'user':
            case 'users':
                $users = get_users(wp_parse_args($query_args, ['fields' => ['ID', 'display_name'], 'number' => 200]));
                foreach ($users as $user) {
                    $options[] = ['value' => (string) $user->ID, 'label' => $user->display_name];
                }
                break;

            case 'sidebar':
            case 'sidebars':
                global $wp_registered_sidebars;
                foreach ((array) $wp_registered_sidebars as $sidebar) {
                    $options[] = ['value' => (string) $sidebar['id'], 'label' => $sidebar['name']];
                }
                break;

            case 'role':
            case 'roles':
                foreach (wp_roles()->roles as $role_key => $role) {
                    $options[] = ['value' => (string) $role_key, 'label' => translate_user_role($role['name'])];
                }
                break;

            case 'post_type':
            case 'post_types':
                foreach (get_post_types(['show_in_nav_menus' => true], 'objects') as $post_type) {
                    $options[] = ['value' => $post_type->name, 'label' => $post_type->labels->name];
                }
                break;

            case 'location':
            case 'locations':
                foreach (get_registered_nav_menus() as $location => $label) {
                    $options[] = ['value' => (string) $location, 'label' => $label];
                }
                break;

            default:
                // CSF 允许把 options 写成函数名，返回「值 => 标题」。
                if (is_callable($source)) {
                    foreach ((array) call_user_func($source, '', $query_args) as $value => $label) {
                        $options[] = ['value' => (string) $value, 'label' => is_scalar($label) ? (string) $label : (string) $value];
                    }
                }
                break;
        }

        self::$source_cache[$cache_key] = $options;
        return $options;
    }

    /**
     * 把一批 term 排成「父在前、子紧随其后」的顺序，子级标题前加「— 」缩进（与 Lentasy 给 CSF 打的补丁一致）。
     *
     * @param \WP_Term[] $terms term 列表。
     * @return array<int,array{value:string,label:string}>
     */
    private static function hierarchical_term_options($terms)
    {
        $by_parent = [];
        $ids       = [];
        foreach ($terms as $term) {
            $ids[$term->term_id] = true;
        }
        foreach ($terms as $term) {
            // 父级不在结果集里（被 query_args 过滤掉）时，当作顶级处理，避免整枝丢失。
            $parent = isset($ids[$term->parent]) ? (int) $term->parent : 0;
            $by_parent[$parent][] = $term;
        }

        $options = [];
        $walk = static function ($parent, $depth) use (&$walk, &$options, $by_parent) {
            if (empty($by_parent[$parent])) {
                return;
            }
            foreach ($by_parent[$parent] as $term) {
                $options[] = ['value' => (string) $term->term_id, 'label' => str_repeat('— ', $depth) . $term->name];
                $walk((int) $term->term_id, $depth + 1);
            }
        };
        $walk(0, 0);
        return $options;
    }

    // =========================================================================
    // 3. 读 / 写期：存值格式转换
    // =========================================================================

    /**
     * 把一个容器里读出的已存值（CSF 格式）整体转成组件要的格式。
     *
     * @param array $sections 已归一化的分区。
     * @param mixed $values   [field_id => value]。
     * @return array
     */
    public static function values_to_eva($sections, $values)
    {
        $values = is_array($values) ? $values : [];
        foreach ((array) $sections as $section) {
            if (! empty($section['fields']) && is_array($section['fields'])) {
                $values = self::fields_to_eva($section['fields'], $values);
            }
        }
        return $values;
    }

    /**
     * 按字段定义逐个转换一层值。
     *
     * @param array $fields 字段定义。
     * @param array $values 这一层的 [field_id => value]。
     * @return array
     */
    private static function fields_to_eva($fields, $values)
    {
        foreach ((array) $fields as $field) {
            if (! is_array($field) || empty($field['id']) || ! array_key_exists($field['id'], $values)) {
                continue;
            }
            $values[$field['id']] = self::value_to_eva($field, $values[$field['id']]);
        }
        return $values;
    }

    /**
     * 单个字段：CSF 存值 → 组件值（容器字段递归处理子字段）。
     *
     * @param array $field 字段定义（已归一化）。
     * @param mixed $value 已存值。
     * @return mixed
     */
    public static function value_to_eva($field, $value)
    {
        $type  = isset($field['type']) ? (string) $field['type'] : 'text';
        $shape = isset($field['csf_shape']) ? (string) $field['csf_shape'] : '';

        if (Csf_Shapes::handles($shape)) {
            return Csf_Shapes::to_eva($shape, $field, $value);
        }

        if ($shape === 'sorter') {
            // ['enabled' => [键 => 标题]] → ['enabled' => [键, …]]；已经是列表的（Eva 存过）原样返回。
            if (! self::is_csf_sorter_value($value)) {
                return $value;
            }
            $out = [];
            foreach (['enabled', 'disabled'] as $zone) {
                $list = isset($value[$zone]) && is_array($value[$zone]) ? $value[$zone] : [];
                $out[$zone] = self::is_list($list) ? array_values(array_map('strval', $list)) : array_map('strval', array_keys($list));
            }
            return $out;
        }

        if ($shape === 'gallery') {
            if (is_string($value)) {
                return array_values(array_filter(array_map('absint', explode(',', $value))));
            }
            return is_array($value) ? $value : [];
        }

        if ($type === 'accordion' && ! empty($field['sections']) && is_array($field['sections'])) {
            $value = is_array($value) ? $value : [];
            // 平铺存储的字段拿到的却已经是「按面板分组」的结构（值被重复转换，例如定制器把已处理过的值再送进来）：原样返回。
            if ($shape === 'flat') {
                foreach (array_values($field['sections']) as $index => $panel) {
                    $panel_id = isset($panel['id']) && $panel['id'] !== '' ? (string) $panel['id'] : (string) $index;
                    if (isset($value[$panel_id]) && is_array($value[$panel_id])) {
                        return $value;
                    }
                }
            }
            $out   = [];
            foreach (array_values($field['sections']) as $index => $panel) {
                $panel_id     = isset($panel['id']) && $panel['id'] !== '' ? (string) $panel['id'] : (string) $index;
                $panel_fields = isset($panel['fields']) && is_array($panel['fields']) ? $panel['fields'] : [];
                // 平铺存储时每个面板都从同一层取值；分组存储时各取各的。
                $source = $shape === 'flat' ? $value : (isset($value[$panel_id]) && is_array($value[$panel_id]) ? $value[$panel_id] : []);
                $picked = [];
                foreach ($panel_fields as $child) {
                    if (is_array($child) && ! empty($child['id']) && array_key_exists($child['id'], $source)) {
                        $picked[$child['id']] = $source[$child['id']];
                    }
                }
                $out[$panel_id] = self::fields_to_eva($panel_fields, $picked);
            }
            if ($shape !== 'flat' && isset($value['_order'])) {
                $out['_order'] = $value['_order'];
            }
            return $out;
        }

        if ($type === 'group' && is_array($value)) {
            return self::fields_to_eva(self::child_fields($field), $value);
        }

        if ($type === 'tabbed' && is_array($value)) {
            foreach ((isset($field['tabs']) && is_array($field['tabs']) ? $field['tabs'] : []) as $tab) {
                if (is_array($tab) && ! empty($tab['fields']) && is_array($tab['fields'])) {
                    $value = self::fields_to_eva($tab['fields'], $value);
                }
            }
            return $value;
        }

        if ($type === 'repeater' && is_array($value)) {
            $children = self::child_fields($field);
            foreach ($value as $index => $row) {
                if (is_array($row)) {
                    $value[$index] = self::fields_to_eva($children, $row);
                }
            }
            return $value;
        }

        return $value;
    }

    /**
     * 单个字段：组件值（已清洗）→ CSF 存值。
     *
     * 只处理本字段这一层：容器字段的子字段在各自清洗时（Data::sanitize_by_sections 递归）已经转过了。
     *
     * @param array $field 字段定义（已归一化）。
     * @param mixed $value 清洗后的组件值。
     * @param mixed $raw   前端提交的原始值；复合字段靠它取回随值携带的 csf_extra（见 Csf_Shapes）。
     * @return mixed
     */
    public static function value_to_csf($field, $value, $raw = null)
    {
        $shape = isset($field['csf_shape']) ? (string) $field['csf_shape'] : '';
        if ($shape === '') {
            return $value;
        }
        if (Csf_Shapes::handles($shape)) {
            return Csf_Shapes::to_csf($shape, $field, $value, $raw);
        }

        if ($shape === 'flat') {
            $flat = [];
            foreach ((array) $value as $panel_id => $panel_values) {
                if ($panel_id === '_order' || ! is_array($panel_values)) {
                    continue;
                }
                $flat = array_merge($flat, $panel_values);
            }
            return $flat;
        }

        if ($shape === 'sorter') {
            // Sorter::sanitize 回来的键已过 sanitize_key，这里按同样规则建索引，再还原成注册时写的原始键。
            $labels = [];
            foreach (self::option_labels(isset($field['options']) ? $field['options'] : []) as $key => $label) {
                $labels[sanitize_key($key)] = [$key, $label];
            }
            $out = ['enabled' => [], 'disabled' => []];
            foreach (['enabled', 'disabled'] as $zone) {
                foreach ((isset($value[$zone]) && is_array($value[$zone]) ? $value[$zone] : []) as $key) {
                    $key = (string) $key;
                    if (isset($labels[$key])) {
                        $out[$zone][$labels[$key][0]] = $labels[$key][1];
                    }
                }
            }
            return $out;
        }

        if ($shape === 'gallery') {
            $ids = [];
            foreach ((array) $value as $item) {
                $id = is_array($item) ? (isset($item['id']) ? absint($item['id']) : 0) : absint($item);
                if ($id) {
                    $ids[] = $id;
                }
            }
            return implode(',', array_unique($ids));
        }

        return $value;
    }

    // =========================================================================
    // 工具
    // =========================================================================

    /**
     * 取容器字段的子字段定义（fields，兼容 Eva 的 items 写法）。
     *
     * @param array $field 容器字段。
     * @return array
     */
    private static function child_fields($field)
    {
        if (isset($field['fields']) && is_array($field['fields'])) {
            return $field['fields'];
        }
        return isset($field['items']) && is_array($field['items']) ? $field['items'] : [];
    }

    /**
     * 是否是 CSF sorter 的值结构：含 enabled / disabled，且其中至少一组是「键 => 标题」的关联数组。
     *
     * @param mixed $value 待判断值。
     * @return bool
     */
    private static function is_csf_sorter_value($value)
    {
        if (! is_array($value) || (! isset($value['enabled']) && ! isset($value['disabled']))) {
            return false;
        }
        foreach (['enabled', 'disabled'] as $zone) {
            if (isset($value[$zone]) && is_array($value[$zone]) && $value[$zone] !== [] && ! self::is_list($value[$zone])) {
                return true;
            }
        }
        return false;
    }

    /**
     * 把各种写法的 options 统一成「值 => 标题」。
     *
     * @param mixed $options 选项。
     * @return array<string,string>
     */
    private static function option_labels($options)
    {
        $out = [];
        foreach ((array) $options as $key => $option) {
            if (is_array($option)) {
                $value = isset($option['value']) ? $option['value'] : (isset($option['id']) ? $option['id'] : $key);
                $label = isset($option['label']) ? $option['label'] : (isset($option['title']) ? $option['title'] : $value);
            } else {
                $value = is_int($key) ? $option : $key;
                $label = $option;
            }
            if (is_scalar($value)) {
                $out[(string) $value] = self::plain_text($label);
            }
        }
        return $out;
    }

    /**
     * 是否是从 0 开始的连续下标数组。
     *
     * @param array $value 数组。
     * @return bool
     */
    private static function is_list($value)
    {
        return $value === [] || array_keys($value) === range(0, count($value) - 1);
    }

    /**
     * 取可用作标识 / 标题的纯文本：多语言数组取第一个值，去掉 HTML。
     *
     * @param mixed $value 字符串或多语言数组。
     * @return string
     */
    public static function plain_text($value)
    {
        if (is_array($value)) {
            $value = $value ? reset($value) : '';
        }
        return is_scalar($value) ? trim(wp_strip_all_tags((string) $value)) : '';
    }
}
