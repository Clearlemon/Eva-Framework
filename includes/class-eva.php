<?php

/**
 * Eva 门面：对外注册 API（可在主题或插件中调用，类似 CSF 的 CSF::createOptions）。
 * 置于全局命名空间，使用方式：Eva::createOptions(...) / Eva::createSection(...)。
 *
 * 设计要点：
 * - 所有 create* 只是把「配置」写进静态注册表（$options/$metaboxes/...），不直接产生副作用；
 *   真正的渲染/保存由各容器类（Admin/Metabox/Taxonomy/...）在恰当的 WP 钩子里读取注册表完成。
 * - 各容器配置统一带 container_id，便于渲染层（embed_markup）与保存层定位。
 */

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

// 幂等守卫：避免主题/插件多处 require 时重复定义 Eva 类。
if (! class_exists('Eva')) {
    class Eva
    {
        /** @var array<string,array> 已注册的设置页（id => 配置，含 sections） */
        protected static $options = [];

        /** @var array<string,array> 已注册的文章/页面 metabox 容器（id => 配置）。 */
        protected static $metaboxes = [];

        /** @var array<string,array> 已注册的分类法字段容器（id => 配置）。 */
        protected static $taxonomies = [];

        /** @var array<string,array> 已注册的导航菜单字段容器（id => 配置）。 */
        protected static $nav_menus = [];

        /** @var array<string,array> 已注册的用户资料字段容器（id => 配置）。 */
        protected static $profiles = [];

        /** @var array<string,array> 已注册的评论 metabox 容器（id => 配置）。 */
        protected static $comments = [];

        /** @var array<string,array> 已注册的定制器容器（id => 配置）。 */
        protected static $customizes = [];

        /** @var array<string,array> 已注册的短代码生成器容器（id => 配置）。 */
        protected static $shortcoders = [];

        /** @var array<string,array> 已注册的小工具容器（id => 配置）。 */
        protected static $widgets = [];

        /**
         * 创建一个设置页（菜单）。
         *
         * @param string $id   唯一标识，也是将来保存到 wp_options 的键。
         * @param array  $args menu_title / menu_slug / capability / menu_icon /
         *                     menu_position / location(admin_bar|left) / subtitle / sections
         * @return void
         */
        public static function createOptions($id, $args = [])
        {
            // 设置页的全部可选项及其缺省值；未传的键回退到这里。
            $defaults = [
                'menu_title'    => $id,
                'menu_slug'     => $id,
                'capability'    => 'manage_options',
                'menu_icon'     => 'dashicons-admin-customizer',
                'menu_position' => 59,
                'location'      => 'admin_bar', // admin_bar = 顶部工具栏；left = 左侧菜单
                'standalone'    => true,        // true = 独立页(脱离 /wp-admin/)；false = 后台全屏页
                'path'          => '',          // 独立页 URL 的 slug 段（默认用 menu_slug）
                'brand'         => '',          // 侧栏品牌名（默认用 menu_title）
                'subtitle'      => '',
                'menu'          => [],          // 左侧主菜单项（API 注册，见 addMenuItem）
                'sections'      => [],
            ];

            // 合并用户配置并写入注册表；额外记录 option_id 便于保存层用作 wp_options 键。
            self::$options[$id] = array_merge($defaults, $args);
            self::$options[$id]['option_id'] = $id;
        }

        /**
         * 全部容器注册表的属性名清单（createSection 等通用遍历用）。
         *
         * @return string[] 静态属性名（不含 $ 前缀）。
         */
        protected static function container_stores()
        {
            return ['options', 'metaboxes', 'taxonomies', 'nav_menus', 'profiles', 'comments', 'customizes', 'shortcoders', 'widgets'];
        }

        /**
         * 向任意容器（设置页 / metabox / 分类法 / 导航菜单 / 用户资料 / 评论 / 定制器 / 短代码 / 小工具）
         * 追加一个分组（含字段）。与 CSF 一致：$id 可以是任一 create* 注册过的 id。
         *
         * @param string $id      任一 create* 的 id
         * @param array  $section  id / title / icon / desc / fields[]
         * @return void
         */
        public static function createSection($id, $section = [])
        {
            // 依次在各注册表里找 $id 所属容器，命中即把分组追加进它的 sections 并结束。
            foreach (self::container_stores() as $store) {
                if (isset(self::${$store}[$id])) {
                    self::${$store}[$id]['sections'][] = $section;
                    return;
                }
            }
        }

        /**
         * 创建一个文章/页面 metabox 容器（对应 CSF::createMetabox）。
         *
         * @param string $id   唯一标识，也是 serialize 模式下保存到 post_meta 的键。
         * @param array  $args title / post_type(string|array) / context(normal|advanced|side) /
         *                     priority / data_type(serialize|direct) / capability / sections
         * @return void
         */
        public static function createMetabox($id, $args = [])
        {
            $defaults = [
                'title'      => $id,
                'post_type'  => 'post',
                'context'    => 'advanced',
                'priority'   => 'default',
                'data_type'  => 'serialize', // serialize=单键存 $id；direct=逐字段独立 meta
                'capability' => 'edit_posts',
                'sections'   => [],
            ];
            // 合并写入注册表，并记录 container_id 供渲染/保存层定位。
            self::$metaboxes[$id] = array_merge($defaults, $args);
            self::$metaboxes[$id]['container_id'] = $id;
        }

        /**
         * 创建分类法（分类/标签等）字段容器（对应 CSF::createTaxonomyOptions）。
         *
         * @param string $id   唯一标识，也是 serialize 模式下保存到 term_meta 的键。
         * @param array  $args taxonomy(string|array) / data_type(serialize|direct) / capability / sections
         * @return void
         */
        public static function createTaxonomyOptions($id, $args = [])
        {
            $defaults = [
                'taxonomy'   => ['category', 'post_tag'],
                'data_type'  => 'serialize',
                'capability' => 'manage_categories',
                'sections'   => [],
            ];
            self::$taxonomies[$id] = array_merge($defaults, $args);
            self::$taxonomies[$id]['container_id'] = $id;
        }

        /**
         * 创建导航菜单项字段容器（对应 CSF::createNavMenuOptions）。
         * 值按菜单项（nav_menu_item）保存到 post_meta。
         *
         * @param string $id   唯一标识，也是 serialize 模式下保存到菜单项 post_meta 的键。
         * @param array  $args data_type(serialize|direct) / capability / sections
         * @return void
         */
        public static function createNavMenuOptions($id, $args = [])
        {
            $defaults = [
                'data_type'  => 'serialize',
                'capability' => 'edit_theme_options',
                'sections'   => [],
            ];
            self::$nav_menus[$id] = array_merge($defaults, $args);
            self::$nav_menus[$id]['container_id'] = $id;
        }

        /**
         * 创建用户资料字段容器（对应 CSF::createProfileOptions）。值存 user_meta。
         *
         * @param string $id   唯一标识，serialize 模式下即 user_meta 的键。
         * @param array  $args data_type(serialize|direct) / capability / sections
         * @return void
         */
        public static function createProfileOptions($id, $args = [])
        {
            $defaults = [
                'data_type'  => 'serialize',
                'capability' => 'edit_user',
                'sections'   => [],
            ];
            self::$profiles[$id] = array_merge($defaults, $args);
            self::$profiles[$id]['container_id'] = $id;
        }

        /**
         * 创建评论 metabox 容器（对应 CSF::createCommentMetabox）。值存 comment_meta。
         *
         * @param string $id   唯一标识，serialize 模式下即 comment_meta 的键。
         * @param array  $args title / data_type(serialize|direct) / capability / sections
         * @return void
         */
        public static function createCommentMetabox($id, $args = [])
        {
            $defaults = [
                'title'      => $id,
                'data_type'  => 'serialize',
                'capability' => 'edit_comment',
                'sections'   => [],
            ];
            self::$comments[$id] = array_merge($defaults, $args);
            self::$comments[$id]['container_id'] = $id;
        }

        /**
         * 创建定制器容器（对应 CSF::createCustomizeOptions）。值默认存 option($id)。
         *
         * @param string $id   唯一标识，也是保存到 wp_options 的键。
         * @param array  $args title / capability / sections
         * @return void
         */
        public static function createCustomizeOptions($id, $args = [])
        {
            $defaults = [
                'title'      => $id,
                'capability' => 'edit_theme_options',
                'sections'   => [],
            ];
            self::$customizes[$id] = array_merge($defaults, $args);
            self::$customizes[$id]['container_id'] = $id;
        }

        /**
         * 创建短代码生成器容器（对应 CSF::createShortcoder）。
         * 注册同名短代码（前台输出），后台编辑器提供生成器入口。
         *
         * @param string $id   唯一标识。
         * @param array  $args title / shortcode(标签，默认=$id) / capability / sections
         * @return void
         */
        public static function createShortcoder($id, $args = [])
        {
            $defaults = [
                'title'      => $id,
                'shortcode'  => $id,
                'capability' => 'edit_posts',
                'sections'   => [],
            ];
            self::$shortcoders[$id] = array_merge($defaults, $args);
            self::$shortcoders[$id]['container_id'] = $id;
        }

        /**
         * 创建小工具容器（对应 CSF::createWidget）。注册为 WP_Widget。
         *
         * @param string $id   唯一标识（widget id_base）。
         * @param array  $args title / description / sections
         * @return void
         */
        public static function createWidget($id, $args = [])
        {
            $defaults = [
                'title'       => $id,
                'description' => '',
                'sections'    => [],
            ];
            self::$widgets[$id] = array_merge($defaults, $args);
            self::$widgets[$id]['container_id'] = $id;
        }

        /**
         * 向某设置页追加一个左侧主菜单项。
         *
         * @param string $option_id createOptions 的 id
         * @param array  $item      id / label / icon(remix 类名) / arrow(bool) / url
         * @return void
         */
        public static function addMenuItem($option_id, $item = [])
        {
            // 目标设置页不存在则忽略，避免写入孤立配置。
            if (! isset(self::$options[$option_id])) {
                return;
            }
            self::$options[$option_id]['menu'][] = $item;
        }

        /**
         * 取全部已注册设置页。
         *
         * @return array<string,array>
         */
        public static function get_options()
        {
            return self::$options;
        }

        /**
         * 取全部已注册 metabox 容器。
         *
         * @return array<string,array>
         */
        public static function get_metaboxes()
        {
            return self::$metaboxes;
        }

        /**
         * 取全部已注册分类法字段容器。
         *
         * @return array<string,array>
         */
        public static function get_taxonomies()
        {
            return self::$taxonomies;
        }

        /**
         * 取全部已注册导航菜单字段容器。
         *
         * @return array<string,array>
         */
        public static function get_nav_menus()
        {
            return self::$nav_menus;
        }

        /**
         * 取全部已注册用户资料字段容器。
         *
         * @return array<string,array>
         */
        public static function get_profiles()
        {
            return self::$profiles;
        }

        /**
         * 取全部已注册评论 metabox 容器。
         *
         * @return array<string,array>
         */
        public static function get_comments()
        {
            return self::$comments;
        }

        /**
         * 取全部已注册定制器容器。
         *
         * @return array<string,array>
         */
        public static function get_customizes()
        {
            return self::$customizes;
        }

        /**
         * 取全部已注册短代码生成器容器。
         *
         * @return array<string,array>
         */
        public static function get_shortcoders()
        {
            return self::$shortcoders;
        }

        /**
         * 取全部已注册小工具容器。
         *
         * @return array<string,array>
         */
        public static function get_widgets()
        {
            return self::$widgets;
        }

        /**
         * 按 slug 取单个设置页配置。
         *
         * @param string $slug 设置页 menu_slug。
         * @return array|null   命中的配置，未找到返回 null。
         */
        public static function get_by_slug($slug)
        {
            // 线性查找 menu_slug 匹配的设置页（页数量很少，无需建索引）。
            foreach (self::$options as $opt) {
                if ($opt['menu_slug'] === $slug) {
                    return $opt;
                }
            }
            return null;
        }

        /**
         * 当前登录用户的展示信息（用于右上角用户菜单）。
         *
         * @return array|null 用户展示数据；未登录返回 null。
         */
        public static function current_user()
        {
            // 未登录（无有效用户对象/ID）直接返回 null。
            $u = wp_get_current_user();
            if (! $u || ! $u->ID) {
                return null;
            }

            // 展示名优先用 display_name，缺省退回登录名。
            $name = $u->display_name ?: $u->user_login;

            // 角色名：取首个角色并翻译为可读名；找不到则用角色 slug 兜底。
            $role = '用户';
            if (! empty($u->roles)) {
                $slug = $u->roles[0];
                $roles = wp_roles();
                $role = isset($roles->roles[$slug]['name'])
                    ? translate_user_role($roles->roles[$slug]['name'])
                    : $slug;
            }
            // 超管单独标注。
            if (is_super_admin($u->ID)) {
                $role = '超级管理员';
            }

            // 汇总成前端可直接用的结构（含首字母、头像、资料页与登出地址）。
            return [
                'name'       => $name,
                'email'      => $u->user_email,
                'role'       => $role,
                'initials'   => function_exists('mb_substr') ? mb_substr($name, 0, 1) : substr($name, 0, 1),
                'avatar'     => get_avatar_url($u->ID, ['size' => 96]),
                'profileUrl' => admin_url('profile.php'),
                'logoutUrl'  => wp_logout_url(),
            ];
        }

        /**
         * 运行时状态：注入到前端 EvaFW.config，供 Vue 外壳读取。
         * - isAdmin：是否管理员（仅其可开关固定菜单等全局项）
         * - guideVisible：《EVA框架使用指南》固定菜单的全站显隐（持久化于 wp_options）
         * - ajaxUrl / nonce：固定菜单显隐等设置的保存凭据
         *
         * @return array 运行时配置（会被 array_merge 进各页 config）。
         */
        public static function runtime()
        {
            return [
                'isAdmin'         => current_user_can('manage_options'),
                'guideVisible'    => (get_option('eva_fw_guide_visible', '1') !== '0'),
                'floatingEnabled' => (get_option('eva_fw_floating', '1') !== '0'),
                'ajaxUrl'         => admin_url('admin-ajax.php'),
                'nonce'           => wp_create_nonce('eva_fw_guide'),
                'restUrl'         => esc_url_raw(rest_url()),
                'restNonce'       => wp_create_nonce('wp_rest'),
                'messages'        => self::load_messages(),
                'languages'       => self::load_languages(),
                'guideEnvironment' => self::guide_environment(),
            ];
        }

        /**
         * 使用指南侧栏的运行环境：从当前请求读取真实版本，避免前端硬编码。
         *
         * @return array<int,array{name:string,value:string,ok:bool,runtime?:string}>
         */
        public static function guide_environment()
        {
            return [
                [
                    'name'  => 'WordPress',
                    'value' => get_bloginfo('version'),
                    'ok'    => true,
                ],
                [
                    'name'  => 'PHP',
                    'value' => PHP_VERSION,
                    'ok'    => true,
                ],
                [
                    'name'    => 'Vue',
                    'value'   => '运行时检测中',
                    'ok'      => true,
                    'runtime' => 'vue',
                ],
                [
                    'name'  => '构建工具',
                    'value' => '无需构建',
                    'ok'    => true,
                ],
            ];
        }

        /**
         * 扫描插件根 Languages/ 下的语言文件（一语言一文件，文件名即语言 code，文件 return 关联数组）。
         * 返回 [code => [key => 文案]]，注入前端 EvaFW.config.messages 供 t() 使用。
         *
         * @return array<string,array<string,string>>
         */
        public static function load_messages()
        {
            $dir = EVA_FW_DIR . 'Languages/';
            $out = [];
            if (is_dir($dir)) {
                $files = glob($dir . '*.php');
                if (is_array($files)) {
                    foreach ($files as $file) {
                        $code = basename($file, '.php');
                        $data = include $file;
                        if (is_array($data)) {
                            $out[$code] = $data;
                        }
                    }
                }
            }
            return $out;
        }

        /**
         * 由 Languages/ 生成可用语言列表（文件名即 code，文件内 '_label' 为该语言自称）。
         * 返回 [['code'=>'zh','label'=>'中文'], ...]，注入前端 EvaFW.config.languages 供语言切换器使用。
         * 新增语言：在 Languages/ 加个 xx.php（含 '_label'）即自动出现在切换器里，无需改前端。
         *
         * @return array<int,array{code:string,label:string}>
         */
        public static function load_languages()
        {
            $out = [];
            foreach (self::load_messages() as $code => $data) {
                $label = (is_array($data) && ! empty($data['_label'])) ? $data['_label'] : $code;
                $flag = (is_array($data) && ! empty($data['_flag'])) ? $data['_flag'] : '';
                $out[] = ['code' => $code, 'label' => $label, 'flag' => $flag];
            }
            return $out;
        }

        /**
         * 按注册 id 取设置页配置（id 即 createOptions 的第一个参数 / option_id）。
         *
         * @param string $id 设置页 id。
         * @return array|null
         */
        public static function get($id)
        {
            return isset(self::$options[$id]) ? self::$options[$id] : null;
        }

        /**
         * 取某设置页已保存的字段值（wp_options，键为 option_id）。
         *
         * @param string $option_id 设置页 id。
         * @return array            已存值；从未保存过则为空数组。
         */
        public static function get_values($option_id)
        {
            // 非数组（未保存/被改坏）一律兜底空数组，保证前端拿到可遍历结构。
            $v = get_option($option_id, []);
            return is_array($v) ? $v : [];
        }

        /**
         * 序列化前预处理分区：执行 callback 字段（PHP 回调输出 HTML），转为可 JSON 的 html 字段；
         * 并清除任何不可序列化的 callable，保证 sections 能安全注入前端。
         * callback 字段写法：['type' => 'callback', 'function' => callable]，回调内 echo 或 return HTML。
         *
         * @param array $sections 原始分区数组。
         * @return array          可安全 JSON 化的分区数组（callback 已转 html、callable 已剔除）。
         */
        public static function prepare_sections($sections)
        {
            $out = [];
            foreach ((array) $sections as $sec) {
                // 仅处理含字段的分区。
                if (! empty($sec['fields']) && is_array($sec['fields'])) {
                    foreach ($sec['fields'] as $i => $f) {
                        // 识别 callback 字段：执行其回调，把输出（echo 优先，否则返回值）转成 html 字段。
                        $is_cb = isset($f['type']) && $f['type'] === 'callback';
                        if ($is_cb && isset($f['function']) && is_callable($f['function'])) {
                            ob_start();
                            $ret  = call_user_func($f['function']);
                            $echo = ob_get_clean();
                            $f['type'] = 'html';
                            $f['html'] = ($echo !== '' ? $echo : (is_string($ret) ? $ret : ''));
                        }
                        unset($f['function']); // 闭包/可调用不可 JSON 化，统一清除
                        $sec['fields'][$i] = $f;
                    }
                    // 重排索引，避免删改后出现稀疏数组（JSON 会变成对象）。
                    $sec['fields'] = array_values($sec['fields']);
                }
                $out[] = $sec;
            }
            return array_values($out);
        }

        /**
         * 扫描 Fields/ 下的字段脚本（一字段一文件），返回 [name => url]，供逐个加载。
         *
         * @return array<string,string> 字段名 => 脚本 URL。
         */
        public static function field_scripts()
        {
            $dir  = EVA_FW_DIR . 'Fields/';
            $base = EVA_FW_URL . 'Fields/';
            $out  = [];
            if (is_dir($dir)) {
                // 取目录下所有 .js；排序保证加载顺序稳定（与文件名一致）。
                $files = glob($dir . '*.js');
                if (is_array($files)) {
                    sort($files);
                    foreach ($files as $file) {
                        // 文件名（去扩展名）即字段类型名。
                        $name = basename($file, '.js');
                        $out[$name] = $base . $name . '.js';
                    }
                }
            }
            return $out;
        }

        /**
         * 扫描 Libs/ 下的 UI 库（一库一文件夹，含同名 .js / .css）。
         * 返回 [name => ['js' => url|null, 'css' => url|null, 'jsRel' => 相对路径, 'cssRel' => 相对路径]]。
         *
         * @return array<string,array{js:?string,css:?string,jsRel:?string,cssRel:?string}>
         */
        public static function lib_assets()
        {
            $dir  = EVA_FW_DIR . 'Libs/';
            $base = EVA_FW_URL . 'Libs/';
            $out  = [];
            if (is_dir($dir)) {
                // 只取子目录（一库一文件夹）；排序保证顺序稳定。
                $folders = glob($dir . '*', GLOB_ONLYDIR);
                if (is_array($folders)) {
                    sort($folders);
                    foreach ($folders as $folder) {
                        $name  = basename($folder);
                        // 默认四项皆空，存在同名 js/css 才填充（绝对 URL + 相对路径，相对路径供版本号计算）。
                        $entry = ['js' => null, 'css' => null, 'jsRel' => null, 'cssRel' => null];
                        if (file_exists($folder . '/' . $name . '.js')) {
                            $entry['js']    = $base . $name . '/' . $name . '.js';
                            $entry['jsRel'] = 'Libs/' . $name . '/' . $name . '.js';
                        }
                        if (file_exists($folder . '/' . $name . '.css')) {
                            $entry['css']    = $base . $name . '/' . $name . '.css';
                            $entry['cssRel'] = 'Libs/' . $name . '/' . $name . '.css';
                        }
                        $out[$name] = $entry;
                    }
                }
            }
            return $out;
        }

        /**
         * 开发期热刷新要监听的资源 URL 列表（外壳 + 字段脚本 + UI 库 js/css）。
         *
         * @return string[] 待监听的资源 URL 列表。
         */
        public static function dev_watch_assets()
        {
            // 先放核心外壳样式与脚本。
            $list = [
                EVA_FW_URL . 'assets/eva.css',
                EVA_FW_URL . 'assets/eva-app.js',
            ];
            // 追加所有字段脚本。
            foreach (self::field_scripts() as $url) {
                $list[] = $url;
            }
            // 追加所有 UI 库的 js/css（存在才加）。
            foreach (self::lib_assets() as $lib) {
                if (! empty($lib['js'])) { $list[] = $lib['js']; }
                if (! empty($lib['css'])) { $list[] = $lib['css']; }
            }
            return $list;
        }

        /**
         * 资源版本号：开发期用文件 mtime 击穿缓存（改动即换号，强制取最新）；生产用固定版本。
         *
         * @param string $rel 相对插件根目录的资源路径。
         * @return string      版本号字符串。
         */
        public static function asset_ver($rel)
        {
            $path = EVA_FW_DIR . $rel;
            // 开发期且文件存在：用最后修改时间作为版本号，改一次就换一次。
            if (defined('EVA_FW_DEV') && EVA_FW_DEV && file_exists($path)) {
                return (string) filemtime($path);
            }
            // 生产：固定版本号，配合 CDN/浏览器缓存。
            return EVA_FW_VERSION;
        }

        /**
         * 嵌入式容器（metabox / 分类法 / 导航菜单）共用的资源装载：
         * Vue3 + Remixicon + eva.css + UI 库 + 字段脚本 + eva-app 外壳。
         * 与全屏设置页的 Admin::enqueue 并存；嵌入式数据走 embed_markup 的内联 JSON（支持一页多实例）。
         *
         * @return void
         */
        public static function enqueue_runtime()
        {
            // 基础依赖：Vue3 + 图标字体 + 框架样式。
            wp_enqueue_script('eva-vue3', 'https://cdn.jsdelivr.net/npm/vue@3.4.38/dist/vue.global.prod.js', [], '3.4.38', true);
            wp_enqueue_style('eva-remixicon', 'https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.css', [], '4.5.0');
            wp_enqueue_style('eva-framework', EVA_FW_URL . 'assets/eva.css', [], self::asset_ver('assets/eva.css'));

            // UI 库：css 依赖框架样式，js 依赖 Vue；js 句柄逐个累积为外壳依赖。
            $deps = ['eva-vue3'];
            foreach (self::lib_assets() as $name => $lib) {
                if ($lib['css']) {
                    wp_enqueue_style('eva-lib-' . $name, $lib['css'], ['eva-framework'], self::asset_ver($lib['cssRel']));
                }
                if ($lib['js']) {
                    wp_enqueue_script('eva-lib-' . $name, $lib['js'], ['eva-vue3'], self::asset_ver($lib['jsRel']), true);
                    $deps[] = 'eva-lib-' . $name;
                }
            }
            // 字段脚本逐个登记，并累积为外壳依赖。
            foreach (self::field_scripts() as $name => $url) {
                $handle = 'eva-field-' . $name;
                wp_enqueue_script($handle, $url, ['eva-vue3'], self::asset_ver('Fields/' . $name . '.js'), true);
                $deps[] = $handle;
            }
            // 外壳脚本：依赖以上库与字段全部就绪。
            wp_enqueue_script('eva-framework', EVA_FW_URL . 'assets/eva-app.js', $deps, self::asset_ver('assets/eva-app.js'), true);

            // 开发期热刷新脚本与监听清单。
            if (defined('EVA_FW_DEV') && EVA_FW_DEV) {
                wp_enqueue_script('eva-livereload', EVA_FW_URL . 'assets/eva-livereload.js', [], EVA_FW_VERSION, true);
                wp_localize_script('eva-livereload', 'EvaFWDev', [
                    'enabled' => true,
                    'assets'  => self::dev_watch_assets(),
                ]);
            }
        }

        /**
         * 生成嵌入式容器的挂载点 + 内联数据（供前端 eva-app 扫描 .eva-embed-root 渲染）。
         *
         * 约定：字段以原生 input 提交，name = {namePrefix}[{field_id}]，
         * 由前端按 namePrefix 生成，后端各容器的 save() 从 $_POST['eva_fields'] 读取。
         *
         * @param string $container   metabox|taxonomy|nav_menu
         * @param array  $cfg         容器配置（含 container_id / sections）
         * @param array  $values      当前对象已存值
         * @param string $name_prefix 表单 name 前缀（默认 eva_fields[{id}]）
         * @return string
         */
        public static function embed_markup($container, $cfg, $values = [], $name_prefix = '')
        {
            // 容器 id（缺失则空串，前端据此定位实例）。
            $id = isset($cfg['container_id']) ? $cfg['container_id'] : '';
            // 组装注入前端的数据负载：name 前缀缺省为 eva_fields[{id}]；sections 先做可序列化预处理。
            $payload = [
                'container'  => $container,
                'id'         => $id,
                'namePrefix' => $name_prefix !== '' ? $name_prefix : ('eva_fields[' . $id . ']'),
                'sections'   => self::prepare_sections(isset($cfg['sections']) ? $cfg['sections'] : []),
                'values'     => is_array($values) ? $values : [],
            ];
            // 用安全选项编码为 JSON，内联进挂载点的 <script type="application/json">。
            $json = wp_json_encode($payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

            // 输出：根节点（带容器类型标记）+ 内联数据 + 加载占位（前端就绪后替换）。
            $html  = '<div class="eva-embed-root" data-eva-embed="' . esc_attr($container) . '">';
            $html .= '<script type="application/json" class="eva-embed-data">' . $json . '</script>';
            $html .= '<div class="eva-embed-mount"><div class="eva-boot">Eva 字段加载中…</div></div>';
            $html .= '</div>';
            return $html;
        }
    }
}
