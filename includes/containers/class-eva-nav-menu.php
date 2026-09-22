<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 导航菜单项字段容器（对应 CSF::createNavMenuOptions）。
 *
 * 注册：\Eva::createNavMenuOptions($id, [...]) + \Eva::createSection($id, [...])
 * 渲染：wp_nav_menu_item_custom_fields（WP 5.4+）为每个菜单项输出嵌入式挂载点。
 * 保存：wp_update_nav_menu_item 时清洗并写入该菜单项（nav_menu_item）的 post_meta。
 *
 * 注意：菜单一页含多个菜单项，字段 name 需带 item_id：
 *       eva_fields[{id}][{item_id}][{field_id}]。
 *
 * @package Eva\Framework
 */
class NavMenu
{
    /**
     * 挂载菜单项字段的渲染、保存、资源加载钩子。
     */
    public function __construct()
    {
        // 每个菜单项的自定义字段区渲染（参数：item_id、$item、$depth）。
        add_action('wp_nav_menu_item_custom_fields', [$this, 'render'], 10, 3);
        // 每个菜单项保存时触发（参数：menu_id、item_id）。
        add_action('wp_update_nav_menu_item', [$this, 'save'], 10, 2);
        // 后台资源按需加载。
        add_action('admin_enqueue_scripts', [$this, 'enqueue']);
    }

    /**
     * 为单个菜单项渲染所有导航容器的字段。
     *
     * @param int    $item_id 菜单项（nav_menu_item）的 ID。
     * @param object $item    菜单项对象。
     * @param int    $depth   菜单项所在层级，顶级为 0。
     * @return void
     */
    public function render($item_id, $item, $depth = 0)
    {
        foreach (\Eva::get_nav_menus() as $id => $cfg) {
            // 字段上的 menu 键限定它只出现在某些层级的菜单项里；保存时用同一规则过滤（见 save）。
            $cfg['sections'] = self::sections_for_depth(isset($cfg['sections']) ? $cfg['sections'] : [], (int) $depth);
            // nonce 名带上 item_id，确保同一页多个菜单项的字段各自独立校验。
            wp_nonce_field('eva_nav_' . $id, 'eva_nav_nonce_' . $id . '_' . $item_id);
            // 读取本菜单项已存值。
            $values = self::read_values($item_id, $id, $cfg);
            // name 前缀带 item_id，避免一页多项互相覆盖。
            $prefix = 'eva_fields[' . $id . '][' . $item_id . ']';
            echo '<div class="eva-nav-fields description description-wide">';
            echo \Eva::embed_markup('nav_menu', $cfg, $values, $prefix); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo '</div>';
        }
    }

    /**
     * 每个菜单项保存时触发：逐容器校验后写入菜单项 post_meta。
     *
     * @param int $menu_id 所属菜单 ID。
     * @param int $item_id 当前菜单项 ID。
     * @return void
     */
    public function save($menu_id, $item_id)
    {
        foreach (\Eva::get_nav_menus() as $id => $cfg) {
            // 校验本菜单项专属 nonce。
            $nonce_key = 'eva_nav_nonce_' . $id . '_' . $item_id;
            $nonce = isset($_POST[$nonce_key]) ? sanitize_text_field(wp_unslash($_POST[$nonce_key])) : '';
            if (! $nonce || ! wp_verify_nonce($nonce, 'eva_nav_' . $id)) {
                continue;
            }
            // 校验菜单编辑权限。
            if (! current_user_can(isset($cfg['capability']) ? $cfg['capability'] : 'edit_theme_options')) {
                continue;
            }

            // 取本菜单项本容器的提交值（注意三层下标 [id][item_id]）并清洗。
            $raw = isset($_POST['eva_fields'][$id][$item_id])
                ? (array) wp_unslash($_POST['eva_fields'][$id][$item_id])
                : [];
            // 与渲染时同一套层级过滤：这一层没渲染出来的字段不参与清洗，否则会被空值覆盖。
            $sections = self::sections_for_depth(isset($cfg['sections']) ? $cfg['sections'] : [], self::item_depth($item_id));
            // 嵌入式外壳把数组 / 对象类的字段值以 JSON 字符串放在隐藏域里提交，清洗前先还原。
            $raw = Data::decode_embedded_values($raw, $sections);
            $clean = Data::sanitize_by_sections($sections, $raw);

            // 写入该菜单项的 post_meta。
            if ((isset($cfg['data_type']) ? $cfg['data_type'] : 'serialize') === 'direct') {
                foreach ($clean as $k => $v) {
                    update_post_meta($item_id, $k, $v);
                }
            } else {
                update_post_meta($item_id, $id, $clean);
            }
        }
    }

    /**
     * 仅在菜单管理页（nav-menus.php）且存在导航容器时装载运行时。
     *
     * @param string $hook 当前后台页面钩子名。
     * @return void
     */
    public function enqueue($hook)
    {
        if ($hook !== 'nav-menus.php') {
            return;
        }
        if (empty(\Eva::get_nav_menus())) {
            return;
        }
        \Eva::enqueue_runtime();
    }

    /**
     * 读取某菜单项已存的容器值，形态与 data_type 对应。
     *
     * @param int    $item_id 菜单项 ID。
     * @param string $id      容器 id。
     * @param array  $cfg     容器配置。
     * @return array          [field_id => value] 形式的已存值。
     */
    private static function read_values($item_id, $id, $cfg)
    {
        if ((isset($cfg['data_type']) ? $cfg['data_type'] : 'serialize') === 'direct') {
            // direct：逐字段从独立 post_meta 取出再拼装。
            $out = [];
            foreach ((isset($cfg['sections']) ? $cfg['sections'] : []) as $sec) {
                foreach ((isset($sec['fields']) ? $sec['fields'] : []) as $f) {
                    if (! empty($f['id'])) {
                        $out[$f['id']] = get_post_meta($item_id, $f['id'], true);
                    }
                }
            }
            return $out;
        }
        // serialize：整组单键取出，未存过则兜底空数组。
        $v = get_post_meta($item_id, $id, true);
        return is_array($v) ? $v : [];
    }

    /**
     * 按菜单层级过滤字段。
     *
     * 字段上的 menu 键（沿用 Lentasy 给 CSF 加的写法）：'1' 表示只在第 1 级菜单项显示，
     * '1,3' 表示第 1 到第 3 级；不写则所有层级都显示。层级从 1 开始数，WP 的 $depth 从 0 开始。
     * 和 CSF 一样按渲染时的层级判断：在菜单编辑器里把菜单项拖到别的层级后，要保存刷新才会换一批字段。
     *
     * @param array $sections 容器分区。
     * @param int   $depth    菜单项层级（顶级为 0）。
     * @return array
     */
    private static function sections_for_depth($sections, $depth)
    {
        foreach ((array) $sections as $index => $section) {
            if (empty($section['fields']) || ! is_array($section['fields'])) {
                continue;
            }
            $sections[$index]['fields'] = array_values(array_filter($section['fields'], static function ($field) use ($depth) {
                if (! is_array($field) || ! isset($field['menu']) || $field['menu'] === '') {
                    return true;
                }
                $range = array_map('intval', explode(',', (string) $field['menu']));
                $from  = $range[0] - 1;
                $to    = isset($range[1]) ? $range[1] - 1 : $from;
                return $depth >= $from && $depth <= $to;
            }));
        }
        return $sections;
    }

    /**
     * 沿父级链往上数，得到菜单项的层级（顶级为 0）。
     *
     * 保存钩子 wp_update_nav_menu_item 不传层级，只能自己算；此时本项的父级关系已写入 post_meta。
     *
     * @param int $item_id 菜单项 ID。
     * @return int
     */
    private static function item_depth($item_id)
    {
        $depth  = 0;
        $parent = (int) get_post_meta($item_id, '_menu_item_menu_item_parent', true);
        // WP 的菜单编辑器最多允许 11 级，这里多留一点余量并防止脏数据造成死循环。
        while ($parent > 0 && $depth < 20) {
            $depth++;
            $parent = (int) get_post_meta($parent, '_menu_item_menu_item_parent', true);
        }
        return $depth;
    }
}
