<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 评论 metabox 容器（对应 CSF::createCommentMetabox）。
 *
 * 注册：\Eva::createCommentMetabox($id, [...]) + \Eva::createSection($id, [...])
 * 渲染：评论编辑页（add_meta_boxes_comment）输出嵌入式挂载点。
 * 保存：edit_comment 清洗后写入 comment_meta
 *       （data_type=serialize 存单键 $id；direct 逐字段独立 meta）。
 *
 * @package Eva\Framework
 */
class Comment
{
    /**
     * 挂载评论 metabox 的注册、保存、资源加载钩子。
     */
    public function __construct()
    {
        // 评论编辑页构建 metabox。
        add_action('add_meta_boxes_comment', [$this, 'register']);
        // 评论保存时持久化。
        add_action('edit_comment', [$this, 'save']);
        // 后台资源按需加载。
        add_action('admin_enqueue_scripts', [$this, 'enqueue']);
    }

    /**
     * 在评论编辑页为每个评论容器注册 metabox。
     *
     * @param \WP_Comment $comment 当前评论对象（由钩子传入）。
     * @return void
     */
    public function register($comment)
    {
        foreach (\Eva::get_comments() as $id => $cfg) {
            // 渲染闭包捕获容器 id 与配置；评论 metabox 固定 normal/default。
            add_meta_box(
                'eva-comment-' . $id,
                isset($cfg['title']) ? $cfg['title'] : $id,
                function ($comment) use ($id, $cfg) {
                    $this->render($comment, $id, $cfg);
                },
                'comment',
                'normal',
                // priority 同 CSF：high / core / default / low。
                isset($cfg['priority']) && in_array($cfg['priority'], ['high', 'core', 'default', 'low'], true) ? $cfg['priority'] : 'default'
            );
        }
    }

    /**
     * 渲染单个评论 metabox：nonce + 嵌入式挂载点（含已存值）。
     *
     * @param \WP_Comment $comment 当前评论对象。
     * @param string      $id      容器 id。
     * @param array       $cfg     容器配置。
     * @return void
     */
    private function render($comment, $id, $cfg)
    {
        wp_nonce_field('eva_comment_' . $id, 'eva_comment_nonce_' . $id);
        // 读取该评论已存值用于回填。
        $values = self::read_values($comment->comment_ID, $id, $cfg);
        echo \Eva::embed_markup('comment', $cfg, $values); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

        // show_restore / show_reset（同 CSF）：勾选后更新评论，就删掉这个 metabox 存的值，回到字段默认值。
        if (! empty($cfg['show_restore']) || ! empty($cfg['show_reset'])) {
            echo '<label class="eva-mb-restore"><input type="checkbox" name="eva_restore[' . esc_attr($id) . ']" value="1"> '
                . '<span>恢复默认值（更新评论后生效）</span></label>';
        }
    }

    /**
     * 保存回调：逐容器校验 nonce/权限后写入 comment_meta。
     *
     * @param int $comment_id 正在保存的评论 ID。
     * @return void
     */
    public function save($comment_id)
    {
        foreach (\Eva::get_comments() as $id => $cfg) {
            // 校验本容器 nonce。
            $nonce = isset($_POST['eva_comment_nonce_' . $id])
                ? sanitize_text_field(wp_unslash($_POST['eva_comment_nonce_' . $id]))
                : '';
            if (! $nonce || ! wp_verify_nonce($nonce, 'eva_comment_' . $id)) {
                continue;
            }
            // 校验评论编辑权限。
            if (! current_user_can(isset($cfg['capability']) ? $cfg['capability'] : 'edit_comment', $comment_id)) {
                continue;
            }

            // show_restore：勾了「恢复默认值」就删除已存的值，本次提交的字段值不再写入。
            if (! empty($_POST['eva_restore'][$id]) && (! empty($cfg['show_restore']) || ! empty($cfg['show_reset']))) {
                if ((isset($cfg['data_type']) ? $cfg['data_type'] : 'serialize') === 'direct') {
                    foreach ((isset($cfg['sections']) ? $cfg['sections'] : []) as $sec) {
                        foreach ((isset($sec['fields']) ? $sec['fields'] : []) as $f) {
                            if (! empty($f['id'])) {
                                delete_comment_meta($comment_id, $f['id']);
                            }
                        }
                    }
                } else {
                    delete_comment_meta($comment_id, $id);
                }
                continue;
            }

            // 取提交值并清洗。
            $raw = isset($_POST['eva_fields'][$id]) ? (array) wp_unslash($_POST['eva_fields'][$id]) : [];
            // 嵌入式外壳把数组 / 对象类的字段值以 JSON 字符串放在隐藏域里提交，清洗前先还原。
            $raw = Data::decode_embedded_values($raw, isset($cfg['sections']) ? $cfg['sections'] : []);
            $clean = Data::sanitize_by_sections(isset($cfg['sections']) ? $cfg['sections'] : [], $raw);

            // 按 data_type 写入 comment_meta。
            if ((isset($cfg['data_type']) ? $cfg['data_type'] : 'serialize') === 'direct') {
                foreach ($clean as $k => $v) {
                    update_comment_meta($comment_id, $k, $v);
                }
            } else {
                update_comment_meta($comment_id, $id, $clean);
            }
        }
    }

    /**
     * 仅在评论编辑页（comment.php）且存在评论容器时装载运行时。
     *
     * @param string $hook 当前后台页面钩子名。
     * @return void
     */
    public function enqueue($hook)
    {
        if ($hook !== 'comment.php') {
            return;
        }
        if (empty(\Eva::get_comments())) {
            return;
        }
        \Eva::enqueue_runtime();
    }

    /**
     * 读取某评论已存的容器值，形态与 data_type 对应。
     *
     * @param int    $comment_id 评论 ID。
     * @param string $id         容器 id。
     * @param array  $cfg        容器配置。
     * @return array             [field_id => value] 形式的已存值。
     */
    private static function read_values($comment_id, $id, $cfg)
    {
        if ((isset($cfg['data_type']) ? $cfg['data_type'] : 'serialize') === 'direct') {
            // direct：逐字段从独立 comment_meta 取出再拼装。
            $out = [];
            foreach ((isset($cfg['sections']) ? $cfg['sections'] : []) as $sec) {
                foreach ((isset($sec['fields']) ? $sec['fields'] : []) as $f) {
                    if (! empty($f['id'])) {
                        $out[$f['id']] = get_comment_meta($comment_id, $f['id'], true);
                    }
                }
            }
            return $out;
        }
        // serialize：整组单键取出，未存过则兜底空数组。
        $v = get_comment_meta($comment_id, $id, true);
        return is_array($v) ? $v : [];
    }
}
