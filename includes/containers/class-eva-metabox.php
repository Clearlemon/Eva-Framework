<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 文章/页面 metabox 容器（对应 CSF::createMetabox）。
 *
 * 注册：\Eva::createMetabox($id, [...]) + \Eva::createSection($id, ['fields'=>[...]])
 * 渲染：在文章编辑页输出嵌入式挂载点（\Eva::embed_markup），由 eva-app 渲染字段。
 * 保存：save_post 时按字段 schema 清洗并写入 post_meta
 *       （data_type=serialize 存单键 $id；direct 逐字段独立 meta）。
 *
 * @package Eva\Framework
 */
class Metabox
{
    /**
     * 挂载 metabox 的注册、保存、资源加载三组钩子。
     */
    public function __construct()
    {
        // 编辑页构建 metabox 时注册各容器。
        add_action('add_meta_boxes', [$this, 'register']);
        // 文章保存时持久化字段（传入 $post 便于按 post_type 过滤）。
        add_action('save_post', [$this, 'save'], 10, 2);
        // 后台资源按需加载。
        add_action('admin_enqueue_scripts', [$this, 'enqueue']);
    }

    /**
     * 按各容器声明的 post_type 注册 metabox。
     *
     * @param string $post_type 当前正在构建 metabox 的文章类型（由 add_meta_boxes 传入）。
     * @return void
     */
    public function register($post_type)
    {
        foreach (\Eva::get_metaboxes() as $id => $cfg) {
            // 容器的 post_type 可为字符串或数组，统一成数组再判断。
            $types = (array) (isset($cfg['post_type']) ? $cfg['post_type'] : 'post');
            // 当前文章类型不在容器声明范围内则跳过。
            if (! in_array($post_type, $types, true)) {
                continue;
            }
            // 注册一个 metabox，渲染回调闭包捕获该容器的 id 与配置。
            add_meta_box(
                'eva-mb-' . $id,
                isset($cfg['title']) ? $cfg['title'] : $id,
                function ($post) use ($id, $cfg) {
                    $this->render($post, $id, $cfg);
                },
                $post_type,
                isset($cfg['context']) ? $cfg['context'] : 'advanced',
                isset($cfg['priority']) ? $cfg['priority'] : 'default'
            );
        }
    }

    /**
     * 渲染单个 metabox：输出安全 nonce + Eva 嵌入式挂载点（含当前文章已存值）。
     *
     * @param \WP_Post $post 当前文章对象。
     * @param string   $id   容器 id。
     * @param array    $cfg  容器配置。
     * @return void
     */
    private function render($post, $id, $cfg)
    {
        // 为本容器输出独立 nonce，保存时据此校验来源。
        wp_nonce_field('eva_mb_' . $id, 'eva_mb_nonce_' . $id);
        // 读取该文章已保存的值，注入挂载点供前端回填。
        $values = self::read_values($post->ID, $id, $cfg);
        // 受信任的框架标记（embed_markup 内已转义 JSON）。
        echo \Eva::embed_markup('metabox', $cfg, $values); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
    }

    /**
     * save_post 回调：逐容器校验 nonce/权限后清洗并写入 post_meta。
     *
     * @param int      $post_id 正在保存的文章 ID。
     * @param \WP_Post $post    文章对象（用于按 post_type 过滤）。
     * @return void
     */
    public function save($post_id, $post)
    {
        // 自动保存阶段不处理（此时 $_POST 不含完整表单）。
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }
        // 修订版本不写 meta。
        if (wp_is_post_revision($post_id)) {
            return;
        }

        foreach (\Eva::get_metaboxes() as $id => $cfg) {
            // 仅处理适用于当前文章类型的容器。
            $types = (array) (isset($cfg['post_type']) ? $cfg['post_type'] : 'post');
            if (! in_array($post->post_type, $types, true)) {
                continue;
            }

            // 校验本容器的 nonce；缺失或不匹配则跳过该容器（不影响其它容器）。
            $nonce = isset($_POST['eva_mb_nonce_' . $id])
                ? sanitize_text_field(wp_unslash($_POST['eva_mb_nonce_' . $id]))
                : '';
            if (! $nonce || ! wp_verify_nonce($nonce, 'eva_mb_' . $id)) {
                continue;
            }
            // 校验当前用户对该文章的编辑权限。
            if (! current_user_can(isset($cfg['capability']) ? $cfg['capability'] : 'edit_post', $post_id)) {
                continue;
            }

            // 取本容器提交的原始值（约定 name 前缀 eva_fields[{id}]）并清洗。
            $raw = isset($_POST['eva_fields'][$id]) ? (array) wp_unslash($_POST['eva_fields'][$id]) : [];
            $clean = Data::sanitize_by_sections(isset($cfg['sections']) ? $cfg['sections'] : [], $raw);

            // 按 data_type 决定存储形态。
            if ((isset($cfg['data_type']) ? $cfg['data_type'] : 'serialize') === 'direct') {
                // direct：每个字段各存一条独立 post_meta（便于 meta_query）。
                foreach ($clean as $k => $v) {
                    update_post_meta($post_id, $k, $v);
                }
            } else {
                // serialize：整组以容器 id 为键存单条 post_meta。
                update_post_meta($post_id, $id, $clean);
            }
        }
    }

    /**
     * 仅在文章编辑页（post.php / post-new.php）且存在 metabox 容器时装载 Eva 运行时。
     *
     * @param string $hook 当前后台页面钩子名。
     * @return void
     */
    public function enqueue($hook)
    {
        // 非文章编辑页不加载，避免污染其它后台页。
        if (! in_array($hook, ['post.php', 'post-new.php'], true)) {
            return;
        }
        // 没有任何 metabox 容器则无需加载资源。
        if (empty(\Eva::get_metaboxes())) {
            return;
        }
        \Eva::enqueue_runtime();
    }

    /**
     * 读取某文章已存的容器值，形态与 data_type 对应。
     *
     * @param int    $post_id 文章 ID。
     * @param string $id      容器 id。
     * @param array  $cfg     容器配置。
     * @return array          [field_id => value] 形式的已存值。
     */
    private static function read_values($post_id, $id, $cfg)
    {
        if ((isset($cfg['data_type']) ? $cfg['data_type'] : 'serialize') === 'direct') {
            // direct：逐字段从独立 meta 读取，重新拼成关联数组。
            $out = [];
            foreach ((isset($cfg['sections']) ? $cfg['sections'] : []) as $sec) {
                foreach ((isset($sec['fields']) ? $sec['fields'] : []) as $f) {
                    if (! empty($f['id'])) {
                        $out[$f['id']] = get_post_meta($post_id, $f['id'], true);
                    }
                }
            }
            return $out;
        }
        // serialize：整组存于单键，直接取出；非数组（从未保存过）兜底为空数组。
        $v = get_post_meta($post_id, $id, true);
        return is_array($v) ? $v : [];
    }
}
