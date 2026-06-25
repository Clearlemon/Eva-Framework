<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 用户资料字段容器（对应 CSF::createProfileOptions）。
 *
 * 注册：\Eva::createProfileOptions($id, [...]) + \Eva::createSection($id, [...])
 * 渲染：用户资料编辑页（自己 show_user_profile / 他人 edit_user_profile）输出嵌入式挂载点。
 * 保存：personal_options_update / edit_user_profile_update 清洗后写入 user_meta
 *       （data_type=serialize 存单键 $id；direct 逐字段独立 meta）。
 *
 * @package Eva\Framework
 */
class Profile
{
    /**
     * 挂载用户资料字段的渲染（自己/他人两处）、保存（自己/他人两处）与资源加载钩子。
     */
    public function __construct()
    {
        // 渲染：查看自己的资料页。
        add_action('show_user_profile', [$this, 'render']);
        // 渲染：编辑他人的资料页。
        add_action('edit_user_profile', [$this, 'render']);
        // 保存：自己更新资料。
        add_action('personal_options_update', [$this, 'save']);
        // 保存：更新他人资料。
        add_action('edit_user_profile_update', [$this, 'save']);
        // 后台资源按需加载。
        add_action('admin_enqueue_scripts', [$this, 'enqueue']);
    }

    /**
     * 在用户资料页渲染所有用户容器的字段（含已存值回填）。
     *
     * @param \WP_User $user 当前正在查看/编辑的用户对象。
     * @return void
     */
    public function render($user)
    {
        foreach (\Eva::get_profiles() as $id => $cfg) {
            wp_nonce_field('eva_profile_' . $id, 'eva_profile_nonce_' . $id);
            // 读取该用户已存值。
            $values = self::read_values($user->ID, $id, $cfg);
            echo '<div class="eva-profile-fields">';
            echo \Eva::embed_markup('profile', $cfg, $values); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo '</div>';
        }
    }

    /**
     * 保存回调：先做整体权限校验，再逐容器校验 nonce 后写入 user_meta。
     *
     * @param int $user_id 正在保存的用户 ID。
     * @return void
     */
    public function save($user_id)
    {
        // 整体权限闸门：无权编辑该用户则直接返回。
        if (! current_user_can('edit_user', $user_id)) {
            return;
        }
        foreach (\Eva::get_profiles() as $id => $cfg) {
            // 校验本容器 nonce。
            $nonce = isset($_POST['eva_profile_nonce_' . $id])
                ? sanitize_text_field(wp_unslash($_POST['eva_profile_nonce_' . $id]))
                : '';
            if (! $nonce || ! wp_verify_nonce($nonce, 'eva_profile_' . $id)) {
                continue;
            }

            // 取提交值并清洗。
            $raw = isset($_POST['eva_fields'][$id]) ? (array) wp_unslash($_POST['eva_fields'][$id]) : [];
            $clean = Data::sanitize_by_sections(isset($cfg['sections']) ? $cfg['sections'] : [], $raw);

            // 按 data_type 写入 user_meta。
            if ((isset($cfg['data_type']) ? $cfg['data_type'] : 'serialize') === 'direct') {
                foreach ($clean as $k => $v) {
                    update_user_meta($user_id, $k, $v);
                }
            } else {
                update_user_meta($user_id, $id, $clean);
            }
        }
    }

    /**
     * 仅在资料页（profile.php / user-edit.php）且存在用户容器时装载运行时。
     *
     * @param string $hook 当前后台页面钩子名。
     * @return void
     */
    public function enqueue($hook)
    {
        if (! in_array($hook, ['profile.php', 'user-edit.php'], true)) {
            return;
        }
        if (empty(\Eva::get_profiles())) {
            return;
        }
        \Eva::enqueue_runtime();
    }

    /**
     * 读取某用户已存的容器值，形态与 data_type 对应。
     *
     * @param int    $user_id 用户 ID。
     * @param string $id      容器 id。
     * @param array  $cfg     容器配置。
     * @return array          [field_id => value] 形式的已存值。
     */
    private static function read_values($user_id, $id, $cfg)
    {
        if ((isset($cfg['data_type']) ? $cfg['data_type'] : 'serialize') === 'direct') {
            // direct：逐字段从独立 user_meta 取出再拼装。
            $out = [];
            foreach ((isset($cfg['sections']) ? $cfg['sections'] : []) as $sec) {
                foreach ((isset($sec['fields']) ? $sec['fields'] : []) as $f) {
                    if (! empty($f['id'])) {
                        $out[$f['id']] = get_user_meta($user_id, $f['id'], true);
                    }
                }
            }
            return $out;
        }
        // serialize：整组单键取出，未存过则兜底空数组。
        $v = get_user_meta($user_id, $id, true);
        return is_array($v) ? $v : [];
    }
}
