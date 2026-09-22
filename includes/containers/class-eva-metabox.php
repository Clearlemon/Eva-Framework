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
        // 皮肤铺满开关：往 body 上挂标记类，eva.css 据此把面板皮肤扩到整条侧栏。
        add_filter('admin_body_class', [$this, 'body_class']);
    }

    /**
     * 主题打开 \Eva::skinAdminBoxes() 时，给文章编辑页的 body 加上标记类。
     *
     * eva.css 据此把 Eva 的面板皮肤从「只管装着 Eva 字段的 postbox」扩到整条侧栏，
     * 让「发布」「分类目录」这些原生面板跟着统一——否则两种外观并排反而更扎眼。
     *
     * @param string $classes 现有的 body class 串。
     * @return string
     */
    public function body_class($classes)
    {
        if (! \Eva::skinsAdminBoxes()) {
            return $classes;
        }
        // 只认文章编辑页（post.php / post-new.php 的 screen base 都是 post），其它后台页不动。
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if (! $screen || $screen->base !== 'post') {
            return $classes;
        }
        return trim($classes . ' eva-skin-boxes');
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
            // exclude_post_types（同 CSF）：post_type 写得很宽时，用它排除个别类型。
            if (in_array($post_type, (array) (isset($cfg['exclude_post_types']) ? $cfg['exclude_post_types'] : []), true)) {
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
                isset($cfg['priority']) ? $cfg['priority'] : 'default',
                [
                    // 不声明这一条，区块编辑器会把 metabox 判为「不兼容」，甩到页面底部的兼容面板里并带警告。
                    // 容器可写 'block_editor_compatible' => false 主动退回那条老路（字段依赖经典编辑器 DOM 时）。
                    '__block_editor_compatible_meta_box' => ! isset($cfg['block_editor_compatible']) || ! empty($cfg['block_editor_compatible']),
                ]
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
        // page_templates / post_formats（同 CSF）：只在选中指定页面模板 / 文章形式时显示这个 metabox。
        // 这里只输出条件，显隐由 eva-embed.js 的 initMetaboxConditions 跟随编辑器里的选择实时切换；
        // 保存不受影响——切到别的模板后，之前填的值仍留在库里。
        $templates = array_values(array_filter(array_map('strval', (array) (isset($cfg['page_templates']) ? $cfg['page_templates'] : []))));
        $formats   = array_values(array_filter(array_map('strval', (array) (isset($cfg['post_formats']) ? $cfg['post_formats'] : []))));
        if ($templates || $formats) {
            echo '<div class="eva-mb-conditions" hidden'
                . ' data-eva-page-templates="' . esc_attr(wp_json_encode($templates)) . '"'
                . ' data-eva-post-formats="' . esc_attr(wp_json_encode($formats)) . '"></div>';
        }

        // 受信任的框架标记（embed_markup 内已转义 JSON）。
        echo \Eva::embed_markup('metabox', $cfg, $values); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

        // show_restore（同 CSF）：勾选后保存文章，就删掉这个 metabox 存的值，回到字段默认值。
        if (! empty($cfg['show_restore']) || ! empty($cfg['show_reset'])) {
            echo '<label class="eva-mb-restore"><input type="checkbox" name="eva_restore[' . esc_attr($id) . ']" value="1"> '
                . '<span>恢复默认值（保存文章后生效）</span></label>';
        }
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

            // 与注册时一致：被 exclude_post_types 排除的类型不保存。
            if (in_array($post->post_type, (array) (isset($cfg['exclude_post_types']) ? $cfg['exclude_post_types'] : []), true)) {
                continue;
            }

            // show_restore：勾了「恢复默认值」就删除已存的值，本次提交的字段值不再写入。
            if (! empty($_POST['eva_restore'][$id]) && (! empty($cfg['show_restore']) || ! empty($cfg['show_reset']))) {
                self::delete_values($post_id, $id, $cfg);
                continue;
            }

            // 取本容器提交的原始值（约定 name 前缀 eva_fields[{id}]）并清洗。
            $raw = isset($_POST['eva_fields'][$id]) ? (array) wp_unslash($_POST['eva_fields'][$id]) : [];
            // 嵌入式外壳把数组 / 对象类的字段值以 JSON 字符串放在隐藏域里提交，清洗前先还原。
            $raw = Data::decode_embedded_values($raw, isset($cfg['sections']) ? $cfg['sections'] : []);
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
     * 删除某文章已存的容器值（show_restore 的「恢复默认值」），形态与 data_type 对应。
     *
     * @param int    $post_id 文章 ID。
     * @param string $id      容器 id。
     * @param array  $cfg     容器配置。
     * @return void
     */
    private static function delete_values($post_id, $id, $cfg)
    {
        if ((isset($cfg['data_type']) ? $cfg['data_type'] : 'serialize') === 'direct') {
            // direct：逐字段删除独立 meta。
            foreach ((isset($cfg['sections']) ? $cfg['sections'] : []) as $sec) {
                foreach ((isset($sec['fields']) ? $sec['fields'] : []) as $f) {
                    if (! empty($f['id'])) {
                        delete_post_meta($post_id, $f['id']);
                    }
                }
            }
            return;
        }
        delete_post_meta($post_id, $id);
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
                    if (empty($f['id'])) {
                        continue;
                    }
                    // 从未保存过的字段不能进返回值：前端靠「键在不在」决定用已存值还是字段 default，
                    // 无条件写入会让 get_post_meta 的空串顶掉 default（button_set 的默认选中就是这么丢的）。
                    // metadata_exists 能区分「存过空值」和「从没存过」，前者仍要按用户存的空值回填。
                    if (! metadata_exists('post', $post_id, $f['id'])) {
                        continue;
                    }
                    $out[$f['id']] = get_post_meta($post_id, $f['id'], true);
                }
            }
            return $out;
        }
        // serialize：整组存于单键，直接取出；非数组（从未保存过）兜底为空数组。
        $v = get_post_meta($post_id, $id, true);
        return is_array($v) ? $v : [];
    }
}
