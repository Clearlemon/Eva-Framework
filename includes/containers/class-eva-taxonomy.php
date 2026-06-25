<?php

namespace Eva\Framework;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Eva 分类法字段容器（对应 CSF::createTaxonomyOptions）。
 *
 * 注册：\Eva::createTaxonomyOptions($id, ['taxonomy'=>['category',...]]) + \Eva::createSection($id, [...])
 * 渲染：在分类/标签的「新增」「编辑」表单输出嵌入式挂载点。
 * 保存：created_/edited_ 钩子里清洗并写入 term_meta
 *       （data_type=serialize 存单键 $id；direct 逐字段独立 meta）。
 *
 * @package Eva\Framework
 */
class Taxonomy
{
    /**
     * 挂载钩子。
     *
     * 具体的分类法表单/保存钩子要等所有分类法注册完才能确定，故延迟到 admin_init 再绑定。
     */
    public function __construct()
    {
        // admin_init 时分类法已注册齐全，此时再逐个挂表单与保存钩子。
        add_action('admin_init', [$this, 'hook_taxonomies']);
        // 后台资源按需加载。
        add_action('admin_enqueue_scripts', [$this, 'enqueue']);
    }

    /**
     * 汇总所有容器声明的 taxonomy，逐个挂表单渲染与保存钩子。
     *
     * @return void
     */
    public function hook_taxonomies()
    {
        // 先去重收集所有容器涉及的 taxonomy（多个容器可能指向同一分类法）。
        $taxes = [];
        foreach (\Eva::get_taxonomies() as $cfg) {
            foreach ((array) (isset($cfg['taxonomy']) ? $cfg['taxonomy'] : []) as $tax) {
                $taxes[$tax] = true;
            }
        }
        // 为每个分类法挂上「新增表单 / 编辑表单 / 新建保存 / 编辑保存」四个钩子。
        foreach (array_keys($taxes) as $tax) {
            add_action($tax . '_add_form_fields', [$this, 'render_add']);
            add_action($tax . '_edit_form_fields', [$this, 'render_edit'], 10, 2);
            add_action('created_' . $tax, [$this, 'save']);
            add_action('edited_' . $tax, [$this, 'save']);
        }
    }

    /**
     * 新增分类页渲染（此时尚无 term，值为空）。
     *
     * @param string $taxonomy 当前分类法名。
     * @return void
     */
    public function render_add($taxonomy)
    {
        // 仅渲染适用于该 taxonomy 的容器。
        foreach (self::for_tax($taxonomy) as $id => $cfg) {
            wp_nonce_field('eva_tax_' . $id, 'eva_tax_nonce_' . $id);
            // 新增页用 .form-field 包裹，挂载点不带初始值。
            echo '<div class="form-field eva-tax-field">';
            echo \Eva::embed_markup('taxonomy', $cfg, []); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo '</div>';
        }
    }

    /**
     * 编辑分类页渲染（带 term，需回填已存值）。
     *
     * @param \WP_Term $term     当前分类项。
     * @param string   $taxonomy 当前分类法名。
     * @return void
     */
    public function render_edit($term, $taxonomy)
    {
        foreach (self::for_tax($taxonomy) as $id => $cfg) {
            wp_nonce_field('eva_tax_' . $id, 'eva_tax_nonce_' . $id);
            // 读取该 term 已存值用于回填。
            $values = self::read_values($term->term_id, $id, $cfg);
            // 编辑页是表格布局，用 <tr> 占整行。
            echo '<tr class="form-field eva-tax-field"><th colspan="2">';
            echo \Eva::embed_markup('taxonomy', $cfg, $values); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo '</th></tr>';
        }
    }

    /**
     * created_/edited_ 共用的保存回调：逐容器校验后写入 term_meta。
     *
     * @param int $term_id 正在保存的分类项 ID。
     * @return void
     */
    public function save($term_id)
    {
        foreach (\Eva::get_taxonomies() as $id => $cfg) {
            // 校验本容器 nonce。
            $nonce = isset($_POST['eva_tax_nonce_' . $id])
                ? sanitize_text_field(wp_unslash($_POST['eva_tax_nonce_' . $id]))
                : '';
            if (! $nonce || ! wp_verify_nonce($nonce, 'eva_tax_' . $id)) {
                continue;
            }
            // 校验分类管理权限。
            if (! current_user_can(isset($cfg['capability']) ? $cfg['capability'] : 'manage_categories')) {
                continue;
            }

            // 取提交值并清洗。
            $raw = isset($_POST['eva_fields'][$id]) ? (array) wp_unslash($_POST['eva_fields'][$id]) : [];
            $clean = Data::sanitize_by_sections(isset($cfg['sections']) ? $cfg['sections'] : [], $raw);

            // 按 data_type 写入 term_meta。
            if ((isset($cfg['data_type']) ? $cfg['data_type'] : 'serialize') === 'direct') {
                foreach ($clean as $k => $v) {
                    update_term_meta($term_id, $k, $v);
                }
            } else {
                update_term_meta($term_id, $id, $clean);
            }
        }
    }

    /**
     * 仅在分类/标签管理页（edit-tags.php / term.php）且存在分类法容器时装载运行时。
     *
     * @param string $hook 当前后台页面钩子名。
     * @return void
     */
    public function enqueue($hook)
    {
        if (! in_array($hook, ['edit-tags.php', 'term.php'], true)) {
            return;
        }
        if (empty(\Eva::get_taxonomies())) {
            return;
        }
        \Eva::enqueue_runtime();
    }

    /**
     * 取出适用于某 taxonomy 的容器配置子集。
     *
     * @param string $taxonomy 分类法名。
     * @return array           [id => cfg]，仅含声明了该 taxonomy 的容器。
     */
    private static function for_tax($taxonomy)
    {
        $out = [];
        foreach (\Eva::get_taxonomies() as $id => $cfg) {
            if (in_array($taxonomy, (array) (isset($cfg['taxonomy']) ? $cfg['taxonomy'] : []), true)) {
                $out[$id] = $cfg;
            }
        }
        return $out;
    }

    /**
     * 读取某 term 已存的容器值，形态与 data_type 对应。
     *
     * @param int    $term_id 分类项 ID。
     * @param string $id      容器 id。
     * @param array  $cfg     容器配置。
     * @return array          [field_id => value] 形式的已存值。
     */
    private static function read_values($term_id, $id, $cfg)
    {
        if ((isset($cfg['data_type']) ? $cfg['data_type'] : 'serialize') === 'direct') {
            // direct：逐字段从独立 term_meta 取出再拼装。
            $out = [];
            foreach ((isset($cfg['sections']) ? $cfg['sections'] : []) as $sec) {
                foreach ((isset($sec['fields']) ? $sec['fields'] : []) as $f) {
                    if (! empty($f['id'])) {
                        $out[$f['id']] = get_term_meta($term_id, $f['id'], true);
                    }
                }
            }
            return $out;
        }
        // serialize：整组单键取出，未存过则兜底空数组。
        $v = get_term_meta($term_id, $id, true);
        return is_array($v) ? $v : [];
    }
}
