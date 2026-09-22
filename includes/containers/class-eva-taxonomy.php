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
 * 渲染：在分类/标签的「新增」「编辑」表单输出嵌入式挂载点；编辑页（term.php）另在页面标题旁提供
 *       「WP 设置 / Eva 设置」切换器（与用户资料页同一套），在原生字段行与 Eva 字段之间切换显示。
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
        // 「WP 设置 / Eva 设置」切换器：首屏前恢复上次停留的页签（编辑页 + 新增页）。
        add_action('admin_head-term.php', [$this, 'restore_tab']);
        add_action('admin_head-edit-tags.php', [$this, 'restore_tab']);
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
        // 为每个分类法挂上「新增表单 / 编辑表单 / 新建保存 / 编辑保存」四个钩子，外加两个页面的切换器标记：
        // *_add_form 在新增表单末尾、*_edit_form 在 .form-table 之后，都是各自表单的直接子元素。
        foreach (array_keys($taxes) as $tax) {
            add_action($tax . '_add_form_fields', [$this, 'render_add']);
            add_action($tax . '_edit_form_fields', [$this, 'render_edit'], 10, 2);
            add_action($tax . '_add_form', [$this, 'render_add_tabs']);
            add_action($tax . '_edit_form', [$this, 'render_tabs'], 10, 2);
            add_action('created_' . $tax, [$this, 'save']);
            add_action('edited_' . $tax, [$this, 'save']);
        }
    }

    /**
     * 首屏渲染前恢复切换器上次停留的页签，避免在「Eva 设置」页签保存后先闪一下原生表单。
     *
     * 编辑页（term.php）和新增页（edit-tags.php 左栏）各记各的，因此 key 与 class 按当前屏幕取。
     * 只处理 eva：给 <html> 加 class 后由 eva.css 隐藏原生字段；Eva 那块保持可见，
     * 字段照常在可见状态下挂载。停在 WP 页签时这里什么都不做，等字段挂载完再由 eva-embed.js 收起。
     *
     * @return void
     */
    public function restore_tab()
    {
        $screen   = function_exists('get_current_screen') ? get_current_screen() : null;
        $taxonomy = ($screen && ! empty($screen->taxonomy)) ? $screen->taxonomy : '';
        if (! $taxonomy || empty(self::for_tax($taxonomy))) {
            return;
        }
        // term.php 是编辑单项，edit-tags.php 左栏是新增表单。
        $is_edit = ($screen->base === 'term');
        $key     = $is_edit ? 'eva_term_tab' : 'eva_addtag_tab';
        $class   = $is_edit ? 'eva-term-tab-eva' : 'eva-addtag-tab-eva';
        ?>
        <script>try { if (!window.location.hash && window.sessionStorage.getItem('<?php echo esc_js($key); ?>') === 'eva') { document.documentElement.className += ' <?php echo esc_js($class); ?>'; } } catch (e) {}</script>
        <?php
    }

    /**
     * 编辑分类页的「WP 设置 / Eva 设置」切换器标记。
     *
     * 原生字段行（名称/别名/父级/描述）和 Eva 字段同在 #edittag 一个表单里，用页签在两者间切换显示。
     * 标题（h1）旁没有可用的 PHP 钩子，这里只输出标记（默认 hidden，无 JS 时整页保持原样），
     * 由 eva-embed.js 挪到标题旁并接管切换；底部原生的「更新」按钮两个页签共用，一次保存全部。
     *
     * @param \WP_Term $term     当前分类项。
     * @param string   $taxonomy 当前分类法名。
     * @return void
     */
    public function render_tabs($term, $taxonomy)
    {
        if (empty(self::for_tax($taxonomy))) {
            return;
        }
        self::tabs_markup('term');
    }

    /**
     * 新增分类页的「WP 设置 / Eva 设置」切换器标记。
     *
     * 新增表单是一摞平铺的 .form-field，Eva 的字段由 *_add_form_fields 输出，只能排在原生字段之后；
     * 这里在表单末尾（*_add_form）补一份标记，由 eva-embed.js 挪到「添加新分类」这个 h2 旁边，
     * 两侧同属 #addtag 一个表单，底部原生的「添加分类」按钮两个页签共用。
     *
     * @param string $taxonomy 当前分类法名。
     * @return void
     */
    public function render_add_tabs($taxonomy)
    {
        if (empty(self::for_tax($taxonomy))) {
            return;
        }
        self::tabs_markup('add_term');
    }

    /**
     * 切换器标记本体：编辑页与新增页只差一个 data-eva-tabs 作用域名。
     *
     * 默认 hidden，无 JS 时整页保持原样；由 eva-embed.js 挪到标题旁并接管切换。
     *
     * @param string $scope eva-embed.js 里的作用域名（term / add_term）。
     * @return void
     */
    private static function tabs_markup($scope)
    {
        echo '<div class="eva-switch-tabs" role="tablist" aria-label="设置切换" data-eva-tabs="' . esc_attr($scope) . '" hidden>';
        echo '<button type="button" class="eva-switch-tab" role="tab" data-eva-tab="wp"><i class="ri-wordpress-fill"></i><span>WP 设置</span></button>';
        echo '<button type="button" class="eva-switch-tab" role="tab" data-eva-tab="eva"><i class="ri-sparkling-2-fill"></i><span>Eva 设置</span></button>';
        echo '</div>';
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
            // 挂载点不带初始值。刻意不加 WP 的 .form-field：那是给原生表单控件用的，
            // 带上它 `.form-field input[type=text]` 会把 Eva 的输入框改成 95% 宽 + 1px 边框（见 eva.css 的隔离层说明）。
            echo '<div class="eva-tax-field">';
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
            // 同样不加 WP 的 .form-field，理由见 render_add()。
            echo '<tr class="eva-tax-field"><th colspan="2">';
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
            // 嵌入式外壳把数组 / 对象类的字段值以 JSON 字符串放在隐藏域里提交，清洗前先还原。
            $raw = Data::decode_embedded_values($raw, isset($cfg['sections']) ? $cfg['sections'] : []);
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
