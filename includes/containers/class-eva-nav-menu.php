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
        // 每个菜单项的自定义字段区渲染（参数：item_id、$item）。
        add_action('wp_nav_menu_item_custom_fields', [$this, 'render'], 10, 2);
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
     * @return void
     */
    public function render($item_id, $item)
    {
        foreach (\Eva::get_nav_menus() as $id => $cfg) {
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
            $clean = Data::sanitize_by_sections(isset($cfg['sections']) ? $cfg['sections'] : [], $raw);

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
}
