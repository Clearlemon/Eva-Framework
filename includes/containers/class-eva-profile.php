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
 * 渲染：用户资料编辑页（自己 show_user_profile / 他人 edit_user_profile）输出嵌入式挂载点，
 *       并在页面标题旁提供「WP 设置 / Eva 设置」切换器，在原生资料区块与 Eva 字段之间切换显示；
 *       底部的原生提交按钮换成同款 Eva 按钮并挪到标题行右侧（仍是同一个表单的 type=submit）。
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
        // 顶部「WP 设置 / Eva 设置」切换器：首屏前恢复上次停留的页签（自己/他人两个资料页）。
        add_action('admin_head-profile.php', [$this, 'restore_tab']);
        add_action('admin_head-user-edit.php', [$this, 'restore_tab']);
    }

    /**
     * 首屏渲染前恢复切换器上次停留的页签，避免在「Eva 设置」页签保存后先闪一下原生表单。
     *
     * 只处理 eva：给 <html> 加 class 后由 eva.css 隐藏原生区块；Eva 容器保持可见，字段照常在可见状态下挂载。
     * 停在 WP 页签时这里什么都不做，等字段挂载完再由 eva-embed.js 收起 Eva 容器。
     * 带锚点的链接（如 #application-passwords-section）指向原生区块，此时不恢复。
     *
     * @return void
     */
    public function restore_tab()
    {
        if (empty(\Eva::get_profiles())) {
            return;
        }
        ?>
        <script>try { if (!window.location.hash && window.sessionStorage.getItem('eva_profile_tab') === 'eva') { document.documentElement.className += ' eva-profile-tab-eva'; } } catch (e) {}</script>
        <?php
    }

    /**
     * 在用户资料页渲染所有用户容器的字段（含已存值回填）。
     *
     * @param \WP_User $user 当前正在查看/编辑的用户对象。
     * @return void
     */
    public function render($user)
    {
        $profiles = \Eva::get_profiles();
        if (empty($profiles)) {
            return;
        }

        // 顶部切换器：原生资料表单很长，Eva 字段被钩子排在最底部，用页签在两者间切换。
        // 标题（h1）旁没有可用钩子，这里只输出标记（默认 hidden，无 JS 时整页保持原样），
        // 由 eva-embed.js 挪到标题旁并接管切换；两侧同属一个表单，「更新个人资料」一次保存全部。
        echo '<div class="eva-switch-tabs" role="tablist" aria-label="设置切换" data-eva-tabs="profile" hidden>';
        echo '<button type="button" class="eva-switch-tab" role="tab" data-eva-tab="wp"><i class="ri-wordpress-fill"></i><span>WP 设置</span></button>';
        echo '<button type="button" class="eva-switch-tab" role="tab" data-eva-tab="eva"><i class="ri-sparkling-2-fill"></i><span>Eva 设置</span></button>';
        echo '</div>';

        foreach ($profiles as $id => $cfg) {
            wp_nonce_field('eva_profile_' . $id, 'eva_profile_nonce_' . $id);
            // 读取该用户已存值。
            $values = self::read_values($user->ID, $id, $cfg);
            echo '<div class="eva-profile-fields">';
            echo \Eva::embed_markup('profile', $cfg, $values); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo '</div>';
        }

        // 提交按钮不在这里出：原生那枚由 eva-embed.js 的 initFormActions 统一接管——
        // 收起底部的原生按钮，改在标题行右侧摆一枚吸顶的 Eva 按钮，并在表单有改动时升起底部保存条。
        // 分类编辑页、新增分类页走的是同一套，三页的保存入口因此长得一样。
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
            // 嵌入式运行时会把复合字段同步到 hidden input 的 JSON 值；
            // 先还原数组/对象，再交给字段专属清洗器，保持与原生表单数组提交一致。
            $raw = self::decode_embedded_values($raw, $cfg);
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
     * 还原嵌入式字段提交的 JSON 复合值。
     *
     * @param array $raw 原始 POST 字段值。
     * @param array $cfg 用户资料容器配置。
     * @return array
     */
    private static function decode_embedded_values($raw, $cfg)
    {
        $raw = is_array($raw) ? $raw : [];
        $fields = [];
        foreach ((isset($cfg['sections']) ? $cfg['sections'] : []) as $section) {
            foreach ((isset($section['fields']) ? $section['fields'] : []) as $field) {
                if (! empty($field['id'])) {
                    $fields[(string) $field['id']] = true;
                }
            }
        }

        foreach ($fields as $field_id => $_unused) {
            if (! isset($raw[$field_id]) || ! is_string($raw[$field_id])) {
                continue;
            }
            $value = trim($raw[$field_id]);
            if ($value === '' || ($value[0] !== '[' && $value[0] !== '{')) {
                continue;
            }
            $decoded = json_decode($value, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $raw[$field_id] = $decoded;
            }
        }

        return $raw;
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
