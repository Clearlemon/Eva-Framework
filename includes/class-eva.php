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

        /** @var array<string,array> 已注册的区块容器（区块名 => 配置）。 */
        protected static $blocks = [];

        /** @var array<string,array> 已注册的 Builder 模块（type => 配置，含 fields/render）。 */
        protected static $builder_modules = [];

        /** @var array<string,callable> 自定义字段类型清理器（type => callable）。 */
        protected static $field_sanitizers = [];

        /** @var array<string,array> 先于容器注册的分区（id => 分区列表），等对应的 create* 调用时再挂上去。 */
        protected static $pending_sections = [];

        /** @var bool 是否把 Eva 的面板皮肤铺满整条文章编辑页侧栏（默认只接管装着 Eva 字段的面板）。 */
        protected static $skin_admin_boxes = false;

        /** @var string 主题指定的品牌主色（十六进制）；空串表示用 eva.css 里的默认粉。 */
        protected static $theme_color = '';

        /** 用户元数据键：设置抽屉里挑的主题色（含 key 与三档色值的数组）。 */
        const USER_ACCENT_META = 'eva_fw_accent';

        /** 用户元数据键：设置抽屉里的暗色模式开关（'1' / '0'；没存过为空串）。 */
        const USER_DARK_META = 'eva_fw_dark';

        /**
         * 创建一个设置页（菜单）。
         *
         * @param string $id   唯一标识，也是将来保存到 wp_options 的键。
         * @param array  $args menu_title / menu_slug / capability / menu_icon /
         *                     menu_position / location(admin_bar|left) / subtitle / sections /
         *                     menu（不传时侧栏由分区的 title / icon / parent 自动生成，同 CSF）/
         *                     csf_compat（true = 该容器内的字段按 CSF 的写法与存值格式处理）
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

            // CSF 的 menu_capability 在 Eva 里叫 capability；迁移过来的写法直接认。
            if (isset($args['menu_capability']) && ! isset($args['capability'])) {
                $args['capability'] = $args['menu_capability'];
            }

            // 合并用户配置并写入注册表；额外记录 option_id 便于保存层用作 wp_options 键。
            self::$options[$id] = array_merge($defaults, $args);
            self::$options[$id]['option_id'] = $id;
            self::finalize_container('options', $id);
        }

        /**
         * 容器注册收尾：归一化随 create* 一起传入的分区，并挂上先于容器注册的分区。
         *
         * CSF 对注册顺序没有要求（它到 init 才统一组装），主题扩展也可能先 createSection 再等容器出现；
         * 这里用一个等待队列达到同样的效果。
         *
         * @param string $store 注册表属性名（不含 $）。
         * @param string $id    容器 id。
         * @return void
         */
        protected static function finalize_container($store, $id)
        {
            // CSF 把「每个字段单独存一条 meta」叫 unserialize（实际上只要不是 serialize 都算），Eva 叫 direct。
            if (isset(self::${$store}[$id]['data_type']) && ! in_array(self::${$store}[$id]['data_type'], ['serialize', 'direct'], true)) {
                self::${$store}[$id]['data_type'] = 'direct';
            }

            $compat   = ! empty(self::${$store}[$id]['csf_compat']);
            $sections = isset(self::${$store}[$id]['sections']) && is_array(self::${$store}[$id]['sections'])
                ? self::${$store}[$id]['sections']
                : [];

            if (! empty(self::$pending_sections[$id])) {
                $sections = array_merge($sections, self::$pending_sections[$id]);
                unset(self::$pending_sections[$id]);
            }

            foreach ($sections as $index => $section) {
                $sections[$index] = \Eva\Framework\Csf_Compat::normalize_section($section, $compat);
            }
            self::${$store}[$id]['sections'] = array_values($sections);
        }

        /**
         * 全部容器注册表的属性名清单（createSection 等通用遍历用）。
         *
         * @return string[] 静态属性名（不含 $ 前缀）。
         */
        protected static function container_stores()
        {
            return ['options', 'metaboxes', 'taxonomies', 'nav_menus', 'profiles', 'comments', 'customizes', 'shortcoders', 'widgets', 'blocks'];
        }

        /**
         * 向任意容器（设置页 / metabox / 分类法 / 导航菜单 / 用户资料 / 评论 / 定制器 / 短代码 / 小工具）
         * 追加一个分组（含字段）。与 CSF 一致：$id 可以是任一 create* 注册过的 id。
         *
         * @param string $id      任一 create* 的 id
         * @param array  $section  id / title / icon / desc / fields[] / parent（父分区 id，设置页侧栏的二级菜单）/
         *                         priority（侧栏排序）/ csf_compat（只给这个分区开 CSF 兼容）
         * @return void
         */
        public static function createSection($id, $section = [])
        {
            // 依次在各注册表里找 $id 所属容器，命中即把分组（经 CSF 兼容层归一化后）追加进它的 sections 并结束。
            foreach (self::container_stores() as $store) {
                if (isset(self::${$store}[$id])) {
                    self::${$store}[$id]['sections'][] = \Eva\Framework\Csf_Compat::normalize_section(
                        $section,
                        ! empty(self::${$store}[$id]['csf_compat'])
                    );
                    return;
                }
            }
            // 容器还没注册：先排队，finalize_container() 里再挂上去。
            self::$pending_sections[$id][] = $section;
        }

        /**
         * 注册 Builder 模块（后端渲染版）。
         *
         * @param string $type 模块类型标识。
         * @param array  $args label/icon/group/fields/render(callable)。
         * @return void
         */
        public static function createBuilderModule($type, $args = [])
        {
            $type = sanitize_key((string) $type);
            if ($type === '') {
                return;
            }

            self::$builder_modules[$type] = array_merge([
                'label'  => $type,
                'icon'   => 'ri-layout-line',
                'group'  => 'basic',
                'fields' => [],
                'render' => null,
            ], (array) $args);
            self::$builder_modules[$type]['type'] = $type;
        }

        /**
         * 指定品牌主色，覆盖 Eva 默认的粉。
         *
         * Eva 的主色令牌集中定义在 eva.css 的 :root（--eva-primary / -600 / -050 / --eva-on-primary），
         * 这里设定后由 theme_color_css() 生成一段同名令牌追加在 eva.css 之后，
         * 深浅两档和「主色之上的文字色」都从这一个值推导，调用方只需要给一个颜色。
         *
         * @param string $color 十六进制颜色（#rgb / #rrggbb）；传空串恢复默认。
         * @return bool 是否设置成功（颜色不合法时返回 false 并保持原值）。
         */
        public static function setThemeColor($color)
        {
            if ($color === '' || $color === null) {
                self::$theme_color = '';
                return true;
            }
            // 只接受十六进制：这个值会被拼进 CSS，必须先过 WordPress 的校验。
            $clean = sanitize_hex_color(is_string($color) ? trim($color) : '');
            if (! $clean) {
                return false;
            }
            self::$theme_color = $clean;
            return true;
        }

        /**
         * 读取品牌主色，并允许外部用过滤器覆盖。
         *
         * @return string 十六进制颜色；空串表示用 eva.css 的默认值。
         */
        public static function themeColor()
        {
            $color = apply_filters('eva_theme_color', self::$theme_color);
            return is_string($color) ? (string) sanitize_hex_color(trim($color)) : '';
        }

        /**
         * 读取当前用户在设置抽屉里挑的主题色。
         *
         * 抽屉那 8 个预设每档的深浅两色都是手调的（不是从主色推出来的），所以这里直接存前端传来的
         * 三个色值，而不是只存一个 key 再在 PHP 里维护第二份色板——两份色板早晚会走样。三个值都会被
         * 原样拼进 CSS，读写两端一律过 sanitize_hex_color。
         *
         * @return array{key:string,color:string,c600:string,c050:string}|array 没挑过时返回空数组。
         */
        public static function userAccent()
        {
            $uid = function_exists('get_current_user_id') ? get_current_user_id() : 0;
            if (! $uid) {
                return [];
            }
            return self::normalize_accent(get_user_meta($uid, self::USER_ACCENT_META, true));
        }

        /**
         * 保存 / 清除当前用户挑的主题色。
         *
         * @param array $accent 含 key 与 color / c600 / c050 的数组；传空数组（或校验不过）即恢复默认。
         * @return array 实际落库的值；空数组表示已恢复默认。
         */
        public static function saveUserAccent($accent)
        {
            $uid = function_exists('get_current_user_id') ? get_current_user_id() : 0;
            if (! $uid) {
                return [];
            }
            $clean = self::normalize_accent($accent);
            if (! $clean) {
                delete_user_meta($uid, self::USER_ACCENT_META);
                return [];
            }
            update_user_meta($uid, self::USER_ACCENT_META, $clean);
            return $clean;
        }

        /**
         * 校验一份主题色：三档色值必须都是合法十六进制，缺一档就整份作废——
         * 宁可整体回落到默认色，也不要让半套令牌把界面搞成花的。
         *
         * @param mixed $accent 待校验的值。
         * @return array{key:string,color:string,c600:string,c050:string}|array
         */
        protected static function normalize_accent($accent)
        {
            if (! is_array($accent)) {
                return [];
            }
            $clean = [];
            foreach (['color', 'c600', 'c050'] as $slot) {
                $hex = isset($accent[$slot]) && is_string($accent[$slot])
                    ? sanitize_hex_color(trim($accent[$slot]))
                    : '';
                if (! $hex) {
                    return [];
                }
                $clean[$slot] = $hex;
            }
            // key 只用来在抽屉里高亮当前色块，不进 CSS。
            $clean['key'] = isset($accent['key']) ? sanitize_key($accent['key']) : '';
            return $clean;
        }

        /**
         * 读取当前用户的暗色模式偏好。
         *
         * @return string '1' / '0'；空串表示没保存过，此时听各设置页注册时的 theme 参数。
         */
        public static function userDarkMode()
        {
            $uid = function_exists('get_current_user_id') ? get_current_user_id() : 0;
            if (! $uid) {
                return '';
            }
            $saved = get_user_meta($uid, self::USER_DARK_META, true);
            return ($saved === '1' || $saved === '0') ? $saved : '';
        }

        /**
         * 保存当前用户的暗色模式偏好。
         *
         * @param bool $dark 是否暗色。
         * @return void
         */
        public static function saveUserDarkMode($dark)
        {
            $uid = function_exists('get_current_user_id') ? get_current_user_id() : 0;
            if ($uid) {
                update_user_meta($uid, self::USER_DARK_META, $dark ? '1' : '0');
            }
        }

        /**
         * 解析当前生效的主色令牌，优先级：用户在抽屉里挑的 > 主题品牌色 > eva.css 的默认粉。
         *
         * 抽屉预设自带三档，直接用；品牌色只给一个值，600（hover 加深）和 050（浅底）用 color-mix
         * 推导，比例照着默认那套粉的关系取：#ff758c → #f0607a 约等于混 12% 黑，
         * #ff758c → #ffe0e8 约等于 20% 主色兑白。
         *
         * @return array<string,string> 令牌名 => 取值；两者都没有时返回空数组（不输出多余样式）。
         */
        public static function theme_color_tokens()
        {
            $accent = self::userAccent();
            if ($accent) {
                return [
                    '--eva-primary'     => $accent['color'],
                    '--eva-primary-600' => $accent['c600'],
                    '--eva-primary-050' => $accent['c050'],
                ];
            }
            $color = self::themeColor();
            if ($color === '') {
                return [];
            }
            return [
                '--eva-primary'     => $color,
                '--eva-primary-600' => 'color-mix(in srgb,' . $color . ' 88%,#000)',
                '--eva-primary-050' => 'color-mix(in srgb,' . $color . ' 20%,#fff)',
            ];
        }

        /**
         * 把 theme_color_tokens() 拼成一段 CSS；没有任何覆盖时返回空串。
         *
         * @param string $selector 令牌挂在哪个选择器上。默认 :root（追加在 eva.css 之后）；
         *                         悬浮窗那种自带作用域、且可能跑在没加载 eva.css 的前台的组件传自己的根节点。
         * @return string
         */
        public static function theme_color_css($selector = ':root')
        {
            $tokens = self::theme_color_tokens();
            if (! $tokens) {
                return '';
            }
            $body = '';
            foreach ($tokens as $name => $value) {
                $body .= $name . ':' . $value . ';';
            }
            return $selector . '{' . $body . '}';
        }

        /**
         * 把主色覆盖追加到 eva-framework 样式句柄后面，一次请求只加一遍。
         *
         * wp_add_inline_style 是累加的，而 enqueue_runtime() 会被每个嵌入式容器各调一次
         * （一篇文章上挂三个 metabox 就是三次），不拦一下同一段 :root 会重复输出。
         *
         * @return void
         */
        public static function add_theme_color_inline_style()
        {
            static $added = false;
            if ($added) {
                return;
            }
            $css = self::theme_color_css();
            if ($css === '') {
                return;
            }
            wp_add_inline_style('eva-framework', $css);
            $added = true;
        }

        /**
         * 是否把 Eva 的面板皮肤铺满整条文章编辑页侧栏。
         *
         * 默认 false：Eva 只接管自己那些装着字段的 postbox，「发布」「分类目录」等原生面板
         * 保持 WordPress 外观——装了 Eva 的站点不一定希望整个后台跟着变样。
         * 主题确定要统一整条侧栏时显式打开它（Eva 的面板和原生面板反差过大时反而更不协调）。
         *
         * @param bool $enabled 是否铺满。
         * @return void
         */
        public static function skinAdminBoxes($enabled = true)
        {
            self::$skin_admin_boxes = (bool) $enabled;
        }

        /**
         * 读取「皮肤铺满整条侧栏」开关，并允许外部用过滤器覆盖。
         *
         * @return bool
         */
        public static function skinsAdminBoxes()
        {
            return (bool) apply_filters('eva_skin_admin_boxes', self::$skin_admin_boxes);
        }

        /**
         * 注册字段类型级清理器。
         *
         * 回调签名：function ($value, array $field, string $type)；返回清理后的值。
         * 自定义清理器优先于框架内置清理器，可用于新增字段类型或覆盖内置类型。
         *
         * @param string   $type     字段类型。
         * @param callable $callback 清理回调。
         * @return bool 是否注册成功。
         */
        public static function registerFieldSanitizer($type, $callback)
        {
            $type = self::normalizeFieldType($type);
            if ($type === '' || ! is_callable($callback)) {
                return false;
            }

            self::$field_sanitizers[$type] = $callback;
            return true;
        }

        /**
         * 移除字段类型级清理器。
         *
         * @param string $type 字段类型。
         * @return void
         */
        public static function unregisterFieldSanitizer($type)
        {
            $type = self::normalizeFieldType($type);
            if ($type !== '') {
                unset(self::$field_sanitizers[$type]);
            }
        }

        /**
         * 获取字段类型级清理器，并允许外部通过 Filter 动态提供。
         *
         * @param string $type 字段类型。
         * @return callable|null
         */
        public static function getFieldSanitizer($type)
        {
            $type = self::normalizeFieldType($type);
            $callback = isset(self::$field_sanitizers[$type]) ? self::$field_sanitizers[$type] : null;
            $callback = apply_filters('eva_field_sanitizer', $callback, $type);
            return is_callable($callback) ? $callback : null;
        }

        /**
         * CSF 字段类型兼容别名。
         *
         * @return array<string,string>
         */
        public static function fieldTypeAliases()
        {
            return (array) apply_filters('eva_field_type_aliases', [
                'content' => 'html',
                'ajax_select' => 'select',
                'post_selector' => 'select',
                'post' => 'select',
                'term_selector' => 'select',
                'term' => 'select',
                'taxonomy' => 'select',
                'user_selector' => 'select',
                'user' => 'select',
                'relationship' => 'select',
                'nav_menu' => 'select',
                'menu' => 'select',
                'sidebar' => 'select',
                'sidebars' => 'select',
            ]);
        }

        /**
         * 标准化字段类型，统一处理 CSF 兼容别名。
         *
         * @param mixed $type 原始类型。
         * @return string
         */
        public static function normalizeFieldType($type)
        {
            $type = sanitize_key((string) $type);
            if ($type === '') {
                return '';
            }

            $aliases = self::fieldTypeAliases();
            return isset($aliases[$type]) ? sanitize_key((string) $aliases[$type]) : $type;
        }

        /**
         * 读取已注册 Builder 模块。
         *
         * @return array<string,array>
         */
        public static function get_builder_modules()
        {
            return self::$builder_modules;
        }

        /**
         * 生成可注入前端的 Builder 模块清单，剔除 PHP callable。
         *
         * @return array<string,array>
         */
        public static function builder_module_manifest()
        {
            $out = [];
            foreach (self::$builder_modules as $type => $module) {
                $out[$type] = [
                    'type'   => $type,
                    'label'  => isset($module['label']) ? $module['label'] : $type,
                    'icon'   => isset($module['icon']) ? $module['icon'] : 'ri-layout-line',
                    'group'  => isset($module['group']) ? $module['group'] : 'basic',
                    'fields' => isset($module['fields']) && is_array($module['fields']) ? $module['fields'] : [],
                ];
                if (isset($module['preview']) && is_string($module['preview'])) {
                    $out[$type]['preview'] = $module['preview'];
                }
            }
            return $out;
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
            self::finalize_container('metaboxes', $id);
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
            self::finalize_container('taxonomies', $id);
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
            self::finalize_container('nav_menus', $id);
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
            self::finalize_container('profiles', $id);
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
            self::finalize_container('comments', $id);
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
            self::finalize_container('customizes', $id);
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
            self::finalize_container('shortcoders', $id);
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
            self::finalize_container('widgets', $id);
        }

        /**
         * 创建区块编辑器区块（Eva 独有，CSF 无对应 API）。
         *
         * 与其它容器的根本差别：区块的值不进数据库，而是作为区块属性写在文章内容里。
         * 因此这里没有 data_type / 保存流程，取而代之的是一个服务端渲染回调——
         * 编辑器侧栏用 Eva 字段收值，前台由 render 把值渲染成 HTML（动态区块）。
         *
         * @param string $name 区块名，必须是 `namespace/name` 形式；只给了 name 时自动补 `eva/` 前缀。
         * @param array  $args title / description / icon（dashicon 名或 SVG 字符串）/ category（不存在时自动注册）/
         *                     category_title（自动注册分类时的显示名）/ keywords / render（callable($values,$content,$block)，
         *                     不给则回退到 filter eva_block_{name}）/ preview（画布内服务端预览，默认跟随 render 是否可用）/
         *                     placement（inspector=字段在右侧栏，默认；content=字段直接画在区块里）/
         *                     inner_blocks（true=支持嵌套子区块，此时画布显示 InnerBlocks 而非预览）/
         *                     supports / example / capability / fields（单分区简写）/ sections
         * @return void
         */
        public static function createBlock($name, $args = [])
        {
            $name = (string) $name;
            // 区块名必须带命名空间，否则 register_block_type 会拒绝；只给了 name 的按 eva/ 处理。
            if (strpos($name, '/') === false) {
                $name = 'eva/' . $name;
            }
            // 统一小写并去掉非法字符，和 WP 对区块名的校验口径一致。
            $name = strtolower(preg_replace('/[^a-z0-9\/_-]/i', '', $name));
            if ($name === '' || substr($name, -1) === '/') {
                return;
            }

            $defaults = [
                'title'        => $name,
                'description'  => '',
                'icon'         => 'screenoptions',
                'category'     => 'widgets',
                'category_title' => '',
                'keywords'     => [],
                'render'       => null,
                'preview'      => null,   // null = 有 render/filter 就预览
                'placement'    => 'inspector',
                'inner_blocks' => false,
                'supports'     => [],
                'example'      => [],
                'capability'   => 'edit_posts',
                'sections'     => [],
            ];
            $args = array_merge($defaults, (array) $args);

            // fields 简写：区块字段通常就一组，允许省掉 sections 这层包装。
            if (! empty($args['fields']) && is_array($args['fields'])) {
                $args['sections'][] = ['fields' => $args['fields']];
                unset($args['fields']);
            }

            self::$blocks[$name] = $args;
            self::$blocks[$name]['container_id'] = $name;
            self::$blocks[$name]['block_name']   = $name;
            self::finalize_container('blocks', $name);
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
            $customizes = self::$customizes;
            // show_in_customizer（同 CSF）：设置页同时出现在「外观 → 自定义」里，共用同一份分区和同一个存储位置。
            // 放在读取时合并而不是注册时复制：分区通常在 createOptions 之后才陆续 createSection 进来。
            foreach (self::$options as $id => $opt) {
                if (empty($opt['show_in_customizer']) || isset($customizes[$id])) {
                    continue;
                }
                $customizes[$id] = [
                    'title'        => $opt['menu_title'],
                    'capability'   => 'edit_theme_options',
                    'sections'     => isset($opt['sections']) ? $opt['sections'] : [],
                    'csf_compat'   => ! empty($opt['csf_compat']),
                    'database'     => isset($opt['database']) ? $opt['database'] : 'option',
                    'transport'    => isset($opt['transport']) ? $opt['transport'] : 'refresh',
                    'container_id' => $id,
                ];
            }
            return $customizes;
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
         * 取全部已注册区块容器。
         *
         * @return array<string,array> 区块名 => 配置。
         */
        public static function get_blocks()
        {
            return self::$blocks;
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
         * - accent / darkMode：当前用户在设置抽屉里的外观偏好（持久化于 user_meta，见 userAccent()）
         * - themeColor：主题用 \Eva::setThemeColor() 指定的品牌色，用户没挑过主题色时的默认值
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
                'accent'          => self::userAccent(),
                'themeColor'      => self::themeColor(),
                'darkMode'        => self::userDarkMode(),
                'ajaxUrl'         => admin_url('admin-ajax.php'),
                'nonce'           => wp_create_nonce('eva_fw_guide'),
                'restUrl'         => esc_url_raw(rest_url()),
                'restNonce'       => wp_create_nonce('wp_rest'),
                'builderPreviewUrl' => esc_url_raw(add_query_arg('eva_builder_preview', '1', home_url('/'))),
                'messages'        => self::load_messages(),
                'languages'       => self::load_languages(),
                'builderModules'  => self::builder_module_manifest(),
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
         * 取「经过外部过滤」的设置页配置：渲染（Admin / Standalone）与保存（Data::ajax_save）都从这里拿，
         * 保证两边看到的是同一份分区，过滤器加进来的字段才存得进去。
         *
         * 过滤器（对应 CSF 的 csf_{id}_args / csf_{id}_sections）：
         * - eva_{id}_args     ：整个容器配置（不含 sections）。
         * - eva_{id}_sections ：分区数组；回调新增的分区可以照 CSF 写法写，这里会再归一化一遍。
         *
         * @param string $id 设置页 id。
         * @return array|null
         */
        public static function get_resolved($id)
        {
            static $cache = [];
            if (isset($cache[$id])) {
                return $cache[$id];
            }
            $opt = self::get($id);
            if (! $opt) {
                return null;
            }

            $sections = isset($opt['sections']) ? $opt['sections'] : [];
            unset($opt['sections']);
            $opt = (array) apply_filters('eva_' . $id . '_args', $opt);
            // 这两个键是保存层定位数据用的，不允许被过滤器改掉。
            $opt['option_id'] = $id;

            $sections = (array) apply_filters('eva_' . $id . '_sections', $sections, $opt);
            $compat   = ! empty($opt['csf_compat']);
            foreach ($sections as $index => $section) {
                $sections[$index] = \Eva\Framework\Csf_Compat::normalize_section($section, $compat);
            }

            // defaults（同 CSF）：在容器上集中改写字段默认值，[字段 id => 默认值]，写法照 CSF 的存值结构。
            if (! empty($opt['defaults']) && is_array($opt['defaults'])) {
                foreach ($sections as $s => $section) {
                    foreach ((isset($section['fields']) && is_array($section['fields']) ? $section['fields'] : []) as $f => $field) {
                        if (is_array($field) && ! empty($field['id']) && array_key_exists($field['id'], $opt['defaults'])) {
                            $sections[$s]['fields'][$f]['default'] = \Eva\Framework\Csf_Compat::value_to_eva($field, $opt['defaults'][$field['id']]);
                        }
                    }
                }
            }

            // contextual_help / contextual_help_sidebar（同 CSF）：WP 的「帮助」选项卡在 Eva 的全屏页和独立页里都看不到，
            // 改成侧栏最后的一个「帮助」页：每个帮助选项卡一段（标题 + 正文），sidebar 内容放在最后的提示条里。
            $help = self::help_section($opt);
            if ($help) {
                $sections[] = \Eva\Framework\Csf_Compat::normalize_section($help, false);
                if (! empty($opt['menu'])) {
                    $opt['menu'][] = ['id' => $help['id'], 'label' => $help['title'], 'icon' => $help['icon']];
                }
            }
            $opt['sections'] = array_values($sections);

            $cache[$id] = $opt;
            return $opt;
        }

        /**
         * 前台加载排版字段选中的 Google 字体（同 CSF 的 enqueue_webfont）。
         *
         * 只认 CSF 存值结构里 type === 'google' 的排版值（csf_compat 容器里的 typography 字段会这样存）；
         * Eva 原生的排版字段存的是一串 CSS 回退字体，不涉及远程字体。
         * 设置页上写 enqueue_webfont => false 可整页关闭。只扫描分区第一层的 typography 字段，与 output 的范围一致。
         *
         * @return void
         */
        public static function enqueue_webfonts()
        {
            $families = [];
            foreach (array_keys(self::$options) as $id) {
                $opt = self::$options[$id];
                if (array_key_exists('enqueue_webfont', $opt) && ! $opt['enqueue_webfont']) {
                    continue;
                }
                $values = null;
                foreach ((isset($opt['sections']) ? $opt['sections'] : []) as $section) {
                    foreach ((isset($section['fields']) && is_array($section['fields']) ? $section['fields'] : []) as $field) {
                        if (! is_array($field) || empty($field['id']) || (isset($field['type']) ? $field['type'] : '') !== 'typography') {
                            continue;
                        }
                        // 真有排版字段才去读库，绝大多数设置页走不到这里。
                        if ($values === null) {
                            $values = self::get_values($id);
                        }
                        $value = isset($values[$field['id']]) && is_array($values[$field['id']]) ? $values[$field['id']] : [];
                        if ((isset($value['type']) ? $value['type'] : '') !== 'google' || empty($value['font-family'])) {
                            continue;
                        }
                        $family = (string) $value['font-family'];
                        $weight = isset($value['font-weight']) && $value['font-weight'] !== '' ? (string) $value['font-weight'] : '400';
                        $weight = $weight === 'normal' ? '400' : ($weight === 'bold' ? '700' : $weight);
                        $italic = isset($value['font-style']) && $value['font-style'] === 'italic';
                        $families[$family][$weight . ($italic ? 'italic' : '')] = true;
                    }
                }
            }
            if (! $families) {
                return;
            }

            $parts = [];
            foreach ($families as $family => $variants) {
                $parts[] = str_replace(' ', '+', $family) . ':' . implode(',', array_keys($variants));
            }
            // fonts.googleapis.com 在部分地区访问不稳定，留一个过滤器方便换成镜像地址，返回空字符串则不加载。
            $url = (string) apply_filters('eva_google_fonts_url', 'https://fonts.googleapis.com/css?family=' . implode('%7C', $parts) . '&display=swap', $families);
            if ($url !== '') {
                wp_enqueue_style('eva-google-web-fonts', $url, [], null);
            }
        }

        /**
         * 把 contextual_help / contextual_help_sidebar 转成一个「帮助」分区。
         *
         * @param array $opt 设置页配置。
         * @return array|null 没有帮助内容时返回 null。
         */
        private static function help_section($opt)
        {
            $tabs    = isset($opt['contextual_help']) && is_array($opt['contextual_help']) ? $opt['contextual_help'] : [];
            $sidebar = isset($opt['contextual_help_sidebar']) && is_string($opt['contextual_help_sidebar']) ? trim($opt['contextual_help_sidebar']) : '';
            $fields  = [];
            foreach ($tabs as $tab) {
                if (! is_array($tab) || (empty($tab['title']) && empty($tab['content']))) {
                    continue;
                }
                if (! empty($tab['title'])) {
                    $fields[] = ['type' => 'heading', 'content' => esc_html(wp_strip_all_tags((string) $tab['title']))];
                }
                if (! empty($tab['content'])) {
                    $fields[] = ['type' => 'html', 'html' => wp_kses_post((string) $tab['content'])];
                }
            }
            if ($sidebar !== '') {
                $fields[] = ['type' => 'notice', 'style' => 'info', 'content' => wp_kses_post($sidebar)];
            }
            if (! $fields) {
                return null;
            }
            // priority 取一个足够大的数：自动生成侧栏时排在所有分区之后。
            return ['id' => 'eva-contextual-help', 'title' => '帮助', 'icon' => 'ri-question-line', 'priority' => 100000, 'fields' => $fields];
        }

        /**
         * 设置页表单下方的页脚文字（同 CSF 的 footer_text / footer_after）。
         *
         * @param array $opt 设置页配置。
         * @return string
         */
        private static function footer_html($opt)
        {
            if (array_key_exists('show_footer', $opt) && ! $opt['show_footer']) {
                return '';
            }
            $html = '';
            if (! empty($opt['footer_text']) && is_string($opt['footer_text'])) {
                $html .= '<div class="eva-form-footer-text">' . wp_kses_post($opt['footer_text']) . '</div>';
            }
            if (! empty($opt['footer_after']) && is_string($opt['footer_after'])) {
                $html .= wp_kses_post($opt['footer_after']);
            }
            return $html;
        }

        /**
         * 组装设置页注入前端的数据：菜单、分区、依赖来源、已存值，以及表单前后的自定义 HTML。
         * 后台全屏页（Admin）与独立页（Standalone）共用。
         *
         * @param array $opt get_resolved() 返回的设置页配置。
         * @return array
         */
        public static function page_payload($opt)
        {
            $id         = $opt['option_id'];
            $registered = isset($opt['sections']) ? $opt['sections'] : [];
            $sections   = self::prepare_sections($registered);

            return [
                'menu'              => self::build_menu($opt, $registered),
                'sections'          => $sections,
                'optionId'          => $id,
                'dependencySources' => \Eva\Framework\Admin\Dependency::dependency_sources($sections),
                // 库里是 CSF 格式的值，转成组件要的结构再回填。
                'values'            => \Eva\Framework\Csf_Compat::values_to_eva($registered, self::get_values($id)),
                // 对应 CSF 的 csf_options_before / csf_options_after：回调里 echo 的 HTML 显示在表单上方 / 下方。
                'beforeHtml'        => self::capture_action('eva_options_before', $id, $opt),
                'afterHtml'         => self::capture_action('eva_options_after', $id, $opt) . self::footer_html($opt),
                // CSF 的界面开关：show_search / show_reset_all / show_reset_section，不写都视为开。
                'ui'                => [
                    'search'       => ! array_key_exists('show_search', $opt) || ! empty($opt['show_search']),
                    'resetAll'     => ! array_key_exists('show_reset_all', $opt) || ! empty($opt['show_reset_all']),
                    'resetSection' => ! array_key_exists('show_reset_section', $opt) || ! empty($opt['show_reset_section']),
                    // framework_class / class：加在外壳根节点上，供主题写自定义样式。
                    'rootClass'    => trim((isset($opt['framework_class']) ? (string) $opt['framework_class'] : '') . ' ' . (isset($opt['class']) ? (string) $opt['class'] : '')),
                    // theme => 'dark'：首次打开（用户还没手动切过）时用暗色。
                    'theme'        => isset($opt['theme']) && $opt['theme'] === 'dark' ? 'dark' : 'light',
                ],
            ];
        }

        /**
         * 触发一个 action 并收集它输出的 HTML（设置页是 Vue 渲染的，PHP 端不能直接 echo 进页面）。
         *
         * @param string $hook action 名。
         * @param mixed  ...$args 透传给回调的参数。
         * @return string
         */
        private static function capture_action($hook, ...$args)
        {
            if (! has_action($hook)) {
                return '';
            }
            ob_start();
            do_action($hook, ...$args);
            return (string) ob_get_clean();
        }

        /**
         * 生成设置页的侧栏菜单。
         *
         * 显式注册过 menu（createOptions 的 menu 参数或 addMenuItem）时原样使用；
         * 没注册时按 CSF 的方式由分区生成：每个分区一项，带 parent 的分区挂到父分区下成为二级菜单，
         * 同级按 priority 升序（未写 priority 的按注册顺序排在后面）。
         *
         * @param array $opt      设置页配置。
         * @param array $sections 已归一化的分区（都有 id）。
         * @return array
         */
        public static function build_menu($opt, $sections)
        {
            if (! empty($opt['menu'])) {
                return array_values($opt['menu']);
            }

            $top      = [];
            $children = [];
            $order    = 100;
            foreach ((array) $sections as $section) {
                if (! is_array($section) || empty($section['id'])) {
                    continue;
                }
                $item = [
                    'id'       => (string) $section['id'],
                    'label'    => isset($section['title']) ? $section['title'] : (string) $section['id'],
                    'icon'     => self::menu_icon(isset($section['icon']) ? $section['icon'] : ''),
                    'priority' => isset($section['priority']) ? (int) $section['priority'] : $order,
                ];
                $order++;
                if (isset($section['parent']) && $section['parent'] !== '') {
                    $children[(string) $section['parent']][] = $item;
                } else {
                    $top[] = $item;
                }
            }

            $by_priority = static function ($a, $b) {
                return $a['priority'] <=> $b['priority'];
            };
            usort($top, $by_priority);

            $menu = [];
            foreach ($top as $item) {
                if (! empty($children[$item['id']])) {
                    usort($children[$item['id']], $by_priority);
                    $item['children'] = array_map(static function ($child) {
                        unset($child['priority']);
                        return $child;
                    }, $children[$item['id']]);
                    unset($children[$item['id']]);
                }
                unset($item['priority']);
                $menu[] = $item;
            }

            // parent 指向了不存在的分区：当作顶级项放在最后，而不是悄悄丢掉。
            foreach ($children as $orphans) {
                foreach ($orphans as $item) {
                    unset($item['priority']);
                    $menu[] = $item;
                }
            }
            return $menu;
        }

        /**
         * 把分区的 icon 转成侧栏 <eva-icon> 能画出来的写法。
         *
         * - 「icon-xxx」：Lentasy 的 iconfont symbol，转成「#icon-xxx」走 <svg><use>（与主题给 CSF 打的补丁一致）。
         * - Font Awesome 类名：Eva 外壳不加载 FA 字体，换成默认图标，避免侧栏出现空白。
         * - 其余（Remix 类名、图片 URL、#symbol、<svg>）原样返回。
         *
         * @param mixed $icon 分区 icon。
         * @return string
         */
        private static function menu_icon($icon)
        {
            $icon = is_string($icon) ? trim($icon) : '';
            if ($icon === '') {
                return 'ri-settings-3-line';
            }
            if (strpos($icon, 'icon-') === 0) {
                return '#' . $icon;
            }
            if (preg_match('/^fa[srbl]?\s+fa-|^fa-/', $icon)) {
                return 'ri-settings-3-line';
            }
            return $icon;
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
            $v = self::read_stored($option_id, []);
            return is_array($v) ? $v : [];
        }

        /**
         * 设置页的存储方式（同 CSF 的 database 参数）：option（默认）/ transient / theme_mod / network。
         *
         * @param string $option_id 设置页 id。
         * @return string
         */
        private static function storage_of($option_id)
        {
            $database = isset(self::$options[$option_id]['database']) ? (string) self::$options[$option_id]['database'] : 'option';
            return in_array($database, ['option', 'transient', 'theme_mod', 'network'], true) ? $database : 'option';
        }

        /**
         * 按设置页声明的存储方式读取原始值。
         *
         * @param string $option_id 设置页 id。
         * @param mixed  $default   没存过时的返回值。
         * @return mixed
         */
        public static function read_stored($option_id, $default = null)
        {
            switch (self::storage_of($option_id)) {
                case 'transient':
                    $value = get_transient($option_id);
                    return $value === false ? $default : $value;
                case 'theme_mod':
                    return get_theme_mod($option_id, $default);
                case 'network':
                    return get_site_option($option_id, $default);
            }
            return get_option($option_id, $default);
        }

        /**
         * 按设置页声明的存储方式写入。transient 的有效期取 transient_time（秒，0 = 不过期）。
         *
         * @param string $option_id 设置页 id。
         * @param array  $values    已清洗、已转成存储格式的值。
         * @return void
         */
        public static function write_stored($option_id, $values)
        {
            switch (self::storage_of($option_id)) {
                case 'transient':
                    $ttl = isset(self::$options[$option_id]['transient_time']) ? absint(self::$options[$option_id]['transient_time']) : 0;
                    set_transient($option_id, $values, $ttl);
                    return;
                case 'theme_mod':
                    set_theme_mod($option_id, $values);
                    return;
                case 'network':
                    update_site_option($option_id, $values);
                    return;
            }
            update_option($option_id, $values);
        }

        /**
         * save_defaults（同 CSF）：设置页从没保存过时，把字段默认值写进库，
         * 这样主题前台第一次读取（_LF_Settings 之类）拿到的就是默认值而不是空。
         *
         * CSF 默认开启；Eva 只对显式写了 save_defaults，或开了 csf_compat 且没有显式关掉的设置页这样做。
         * 默认值走一遍与保存相同的清洗流程，存进去的结构和用户在界面上点一次保存完全一样。
         * 挂在 init 较晚的位置：字符串数据源（分类、文章类型…）要等它们注册完才查得到。
         *
         * @return void
         */
        public static function maybe_save_defaults()
        {
            foreach (array_keys(self::$options) as $id) {
                $raw_opt = self::$options[$id];
                $enabled = array_key_exists('save_defaults', $raw_opt) ? ! empty($raw_opt['save_defaults']) : ! empty($raw_opt['csf_compat']);
                // 先用最便宜的判断挡掉绝大多数请求：已经存过就什么都不做。
                if (! $enabled || self::read_stored($id, null) !== null) {
                    continue;
                }
                $opt      = self::get_resolved($id);
                $defaults = self::default_values(isset($opt['sections']) ? $opt['sections'] : []);
                $clean    = \Eva\Framework\Data::sanitize_by_sections($opt['sections'], $defaults);
                self::write_stored($id, $clean);
            }
        }

        /**
         * 收集一组分区的字段默认值（组件结构）；容器字段没写 default 时由子字段的 default 递归拼出。
         *
         * @param array $sections 已归一化的分区。
         * @return array          [field_id => default]
         */
        public static function default_values($sections)
        {
            $fields = [];
            foreach ((array) $sections as $section) {
                foreach ((isset($section['fields']) && is_array($section['fields']) ? $section['fields'] : []) as $field) {
                    $fields[] = $field;
                }
            }
            return self::field_defaults($fields);
        }

        /**
         * default_values() 的递归部分。
         *
         * @param array $fields 字段定义。
         * @return array
         */
        private static function field_defaults($fields)
        {
            $out = [];
            foreach ((array) $fields as $field) {
                if (! is_array($field) || empty($field['id']) || (array_key_exists('save', $field) && ! $field['save'])) {
                    continue;
                }
                if (array_key_exists('default', $field)) {
                    $out[$field['id']] = $field['default'];
                    continue;
                }
                $type = isset($field['type']) ? $field['type'] : 'text';
                if ($type === 'group') {
                    $nested = self::field_defaults(isset($field['fields']) ? $field['fields'] : (isset($field['items']) ? $field['items'] : []));
                } elseif ($type === 'tabbed') {
                    $nested = [];
                    foreach ((isset($field['tabs']) && is_array($field['tabs']) ? $field['tabs'] : []) as $tab) {
                        $nested = array_merge($nested, self::field_defaults(isset($tab['fields']) ? $tab['fields'] : []));
                    }
                } elseif ($type === 'accordion') {
                    $nested = [];
                    foreach ((isset($field['sections']) && is_array($field['sections']) ? array_values($field['sections']) : []) as $index => $panel) {
                        $panel_defaults = self::field_defaults(isset($panel['fields']) ? $panel['fields'] : []);
                        if ($panel_defaults) {
                            $panel_id = isset($panel['id']) && $panel['id'] !== '' ? $panel['id'] : (isset($panel['key']) && $panel['key'] !== '' ? $panel['key'] : $index);
                            $nested[(string) $panel_id] = $panel_defaults;
                        }
                    }
                } else {
                    continue;
                }
                if ($nested) {
                    $out[$field['id']] = $nested;
                }
            }
            return $out;
        }

        /**
         * 标准化 Builder 保存值：兼容旧数组与新 slots 结构。
         *
         * @param mixed  $value        原始 Builder 值。
         * @param string $default_slot 旧数组归入的默认 slot。
         * @return array
         */
        public static function normalize_builder_value($value, $default_slot = 'main')
        {
            $default_slot = sanitize_key((string) $default_slot);
            if ($default_slot === '') {
                $default_slot = 'main';
            }

            if (is_array($value) && isset($value['slots']) && is_array($value['slots'])) {
                $slots = [];
                foreach ($value['slots'] as $slot => $items) {
                    $slot = sanitize_key((string) $slot);
                    if ($slot === '') {
                        continue;
                    }
                    $slots[$slot] = self::normalize_builder_items($items);
                }
                return ['slots' => $slots];
            }

            return ['slots' => [$default_slot => self::normalize_builder_items($value)]];
        }

        /**
         * 标准化 Builder 模块数组。
         *
         * @param mixed $items 原始模块数组。
         * @return array
         */
        public static function normalize_builder_items($items)
        {
            if (! is_array($items)) {
                return [];
            }

            $out = [];
            foreach ($items as $item) {
                if (! is_array($item) || empty($item['type'])) {
                    continue;
                }
                $out[] = [
                    'uid'    => isset($item['uid']) ? sanitize_key((string) $item['uid']) : '',
                    'type'   => sanitize_key((string) $item['type']),
                    'values' => isset($item['values']) && is_array($item['values']) ? $item['values'] : [],
                ];
            }
            return $out;
        }

        /**
         * 后端渲染单个 Builder 模块。
         *
         * @param array $item 模块实例。
         * @return string
         */
        public static function render_builder_module($item)
        {
            if (! is_array($item) || empty($item['type'])) {
                return '';
            }

            $type = sanitize_key((string) $item['type']);
            if (empty(self::$builder_modules[$type]['render']) || ! is_callable(self::$builder_modules[$type]['render'])) {
                return '';
            }

            $values = isset($item['values']) && is_array($item['values']) ? $item['values'] : [];
            return (string) call_user_func(self::$builder_modules[$type]['render'], $values, $item);
        }

        /**
         * 渲染 iframe 预览专用模块外壳：仅用于后台实时预览，给模块加选中和操作能力。
         *
         * @param array $item 模块实例。
         * @return string
         */
        public static function render_builder_preview_module($item)
        {
            $html = self::render_builder_module($item);
            if ($html === '') {
                return '';
            }

            $uid = isset($item['uid']) ? sanitize_key((string) $item['uid']) : '';
            $type = isset($item['type']) ? sanitize_key((string) $item['type']) : '';

            return '<div class="eva-builder-preview-module" data-eva-builder-module="' . esc_attr($uid) . '" data-eva-builder-type="' . esc_attr($type) . '">'
                . '<div class="eva-builder-preview-tools" aria-hidden="true">'
                . '<button type="button" data-eva-builder-action="up">上移</button>'
                . '<button type="button" data-eva-builder-action="down">下移</button>'
                . '<button type="button" data-eva-builder-action="duplicate">复制</button>'
                . '<button type="button" data-eva-builder-action="remove">删除</button>'
                . '</div>'
                . $html
                . '</div>';
        }

        /**
         * 渲染 Builder 指定 slot 的模块 HTML。
         *
         * @param mixed  $value Builder 保存值。
         * @param string $slot  slot 标识。
         * @return string
         */
        public static function render_builder_slot_value($value, $slot = 'main', $interactive = false)
        {
            $slot = sanitize_key((string) $slot);
            if ($slot === '') {
                $slot = 'main';
            }

            $builder = self::normalize_builder_value($value, 'main');
            $items = isset($builder['slots'][$slot]) ? $builder['slots'][$slot] : [];
            $html = '';
            foreach ($items as $item) {
                $html .= $interactive ? self::render_builder_preview_module($item) : self::render_builder_module($item);
            }
            return $html;
        }

        /**
         * 主题可手动调用：Eva::builder_slot('home_main')。
         *
         * @param string $slot      slot 标识。
         * @param string $option_id 可选：限制某个 option。
         * @param string $field_id  可选：限制某个 builder 字段。
         * @return void
         */
        public static function builder_slot($slot = 'main', $option_id = '', $field_id = '')
        {
            $html = self::builder_slot_html($slot, $option_id, $field_id);
            if (self::is_builder_preview()) {
                echo '<div class="eva-builder-preview-slot" data-eva-builder-slot="' . esc_attr($slot) . '">' . $html . '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
                return;
            }
            echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        }

        /**
         * 获取指定 slot 的 Builder HTML。
         *
         * @param string $slot      slot 标识。
         * @param string $option_id 可选：限制某个 option。
         * @param string $field_id  可选：限制某个 builder 字段。
         * @return string
         */
        public static function builder_slot_html($slot = 'main', $option_id = '', $field_id = '')
        {
            $slot = sanitize_key((string) $slot);
            $html = '';

            foreach (self::$options as $id => $option) {
                if ($option_id !== '' && (string) $option_id !== (string) $id) {
                    continue;
                }
                $values = self::get_values($id);
                foreach (self::builder_fields(isset($option['sections']) ? $option['sections'] : []) as $field) {
                    if ($field_id !== '' && (! isset($field['id']) || (string) $field_id !== (string) $field['id'])) {
                        continue;
                    }
                    if (empty($field['id'])) {
                        continue;
                    }
                    $field_value = array_key_exists((string) $field['id'], $values) ? $values[(string) $field['id']] : (isset($field['default']) ? $field['default'] : []);
                    $html .= self::render_builder_slot_value($field_value, $slot);
                }
            }

            return $html;
        }

        /**
         * 从 sections 中找出 builder 字段。
         *
         * @param array $sections 字段分组。
         * @return array
         */
        private static function builder_fields($sections)
        {
            $out = [];
            foreach ((array) $sections as $section) {
                foreach ((isset($section['fields']) ? (array) $section['fields'] : []) as $field) {
                    if (isset($field['type']) && $field['type'] === 'builder') {
                        $out[] = $field;
                    }
                }
            }
            return $out;
        }

        /**
         * 前台加载 Builder slot 渲染所需的基础样式。
         *
         * @return void
         */
        public static function enqueue_builder_frontend_assets()
        {
            $has_builder = false;
            foreach (self::$options as $option) {
                if (self::builder_fields(isset($option['sections']) ? $option['sections'] : [])) {
                    $has_builder = true;
                    break;
                }
            }

            if (! $has_builder) {
                return;
            }

            wp_enqueue_style('eva-remixicon', 'https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.css', [], '4.5.0');
            wp_enqueue_style('eva-field-Builder', EVA_FW_URL . 'Fields/Builder/Builder.css', [], self::asset_ver('Fields/Builder/Builder.css'));
        }

        /**
         * 判断当前请求是否为 Builder iframe 预览。
         *
         * @return bool
         */
        public static function is_builder_preview()
        {
            return isset($_GET['eva_builder_preview']) && $_GET['eva_builder_preview'] === '1' && current_user_can('manage_options');
        }

        /**
         * Builder 预览请求的前置处理：隐藏 WordPress admin bar，避免 iframe 顶部多一层后台工具栏。
         *
         * @return void
         */
        public static function builder_preview_bootstrap()
        {
            if (! self::is_builder_preview()) {
                return;
            }

            show_admin_bar(false);
        }

        /**
         * Builder 预览页头部样式：修正 admin bar 顶部偏移，并标记可替换 slot 容器。
         *
         * @return void
         */
        public static function builder_preview_head()
        {
            if (! self::is_builder_preview()) {
                return;
            }

            echo '<link rel="stylesheet" id="eva-builder-preview-css" href="' . esc_url(EVA_FW_URL . 'Assets/builder-preview.css?ver=' . self::asset_ver('Assets/builder-preview.css')) . '" />' . "\n";
        }

        /**
         * Builder 预览 iframe 接收后台 postMessage，并替换 slot HTML。
         *
         * @return void
         */
        public static function builder_preview_script()
        {
            if (! self::is_builder_preview()) {
                return;
            }

            echo '<script src="' . esc_url(EVA_FW_URL . 'Assets/builder-preview.js?ver=' . self::asset_ver('Assets/builder-preview.js')) . '"></script>' . "\n";
        }

        /**
         * AJAX：把后台未保存 Builder 值渲染为各 slot HTML，供 iframe 预览替换。
         *
         * @return void
         */
        public static function ajax_render_builder_preview()
        {
            check_ajax_referer('eva_fw_guide', 'nonce');
            if (! current_user_can('manage_options')) {
                wp_send_json_error(['message' => 'forbidden'], 403);
            }

            $raw = isset($_POST['value']) ? wp_unslash((string) $_POST['value']) : '';
            $value = json_decode($raw, true);
            if (! is_array($value)) {
                $value = [];
            }

            $builder = self::normalize_builder_value($value, 'main');
            $slots = [];
            foreach (array_keys(isset($builder['slots']) ? $builder['slots'] : []) as $slot) {
                $slots[$slot] = self::render_builder_slot_value($builder, $slot, true);
            }

            wp_send_json_success(['slots' => $slots]);
        }

        /**
         * 输出所有 options 容器里声明了 output 的字段 CSS。
         *
         * 用法：字段写 `output => '.selector'`，可选 `output_mode => 'background-color'`。
         *
         * @return void
         */
        public static function output_css()
        {
            $css = '';
            foreach (array_keys(self::$options) as $option_id) {
                // 用过滤后的配置：eva_{id}_sections 加进来的字段同样参与输出。
                $option = self::get_resolved($option_id);
                // output_css => false（同 CSF）：整个设置页不往前台输出 CSS。
                if (array_key_exists('output_css', $option) && ! $option['output_css']) {
                    continue;
                }
                $sections = isset($option['sections']) ? $option['sections'] : [];
                // 库里可能是 CSF 的存值结构（csf_compat），生成 CSS 前先转成组件结构；
                // 原始值也一并传下去：复合字段要按 CSF「空值不输出」的规则直接用原始值生成（见 Csf_Shapes::output_css）。
                $stored = self::get_values($option_id);
                $values = \Eva\Framework\Csf_Compat::values_to_eva($sections, $stored);
                $css .= self::build_output_css($sections, $values, $stored);
            }

            if ($css !== '') {
                echo '<style id="eva-framework-output-css">' . "\n" . $css . '</style>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            }
        }

        /**
         * 根据 sections 与已保存值生成 CSS。
         *
         * @param array $sections 字段分组。
         * @param array $values   已保存字段值（组件结构）。
         * @param array $stored   库里的原始值；csf_compat 的复合字段用它按 CSF 的规则输出。
         * @return string         CSS 字符串。
         */
        public static function build_output_css($sections, $values, $stored = [])
        {
            $css = '';
            foreach ((array) $sections as $section) {
                foreach ((isset($section['fields']) ? (array) $section['fields'] : []) as $field) {
                    if (empty($field['id']) || empty($field['output'])) {
                        continue;
                    }

                    $id = (string) $field['id'];

                    // CSF 写法的复合字段：直接用库里的 CSF 存值生成，空值不输出。
                    if (isset($field['csf_shape']) && \Eva\Framework\Csf_Shapes::handles($field['csf_shape']) && ! in_array($field['csf_shape'], ['date', 'datetime'], true)) {
                        $selectors = is_array($field['output']) ? $field['output'] : [$field['output']];
                        $selector  = implode(',', array_filter(array_map([self::class, 'sanitize_css_selector'], $selectors)));
                        if ($selector !== '') {
                            $raw_value = array_key_exists($id, (array) $stored)
                                ? $stored[$id]
                                : \Eva\Framework\Csf_Compat::value_to_csf($field, isset($field['default']) ? $field['default'] : []);
                            $css .= \Eva\Framework\Csf_Shapes::output_css($field, $raw_value, $selector, ! empty($field['output_important']));
                        }
                        continue;
                    }

                    $value = array_key_exists($id, $values)
                        ? $values[$id]
                        : (isset($field['default']) ? $field['default'] : null);

                    $rule = self::field_output_rule($field, $value);
                    if ($rule !== '') {
                        $css .= $rule;
                    }
                }
            }

            return $css;
        }

        /**
         * 生成单个字段的 CSS 输出规则。
         *
         * @param array $field 字段 schema。
         * @param mixed $value 字段值。
         * @return string      CSS 规则。
         */
        private static function field_output_rule($field, $value)
        {
            if (is_object($value) || $value === null) {
                return '';
            }

            $selectors = is_array($field['output']) ? $field['output'] : [$field['output']];
            $selector_text = implode(',', array_filter(array_map([self::class, 'sanitize_css_selector'], $selectors)));
            if ($selector_text === '') {
                return '';
            }

            // output_important（同 CSF）：给这个字段输出的每条声明加 !important。
            $important = ! empty($field['output_important']);
            $finish = static function ($declarations) use ($selector_text, $important) {
                if (! $declarations) {
                    return '';
                }
                if ($important) {
                    $declarations = array_map(static function ($declaration) {
                        return rtrim($declaration, ';') . ' !important;';
                    }, $declarations);
                }
                return $selector_text . '{' . implode('', $declarations) . "}\n";
            };

            if (is_array($value)) {
                $type = self::normalizeFieldType(isset($field['type']) ? $field['type'] : 'text');
                return $finish(self::composite_output_declarations($type, $value, $field));
            }

            if ($value === '') {
                return '';
            }

            $mode = isset($field['output_mode']) ? $field['output_mode'] : self::default_output_mode(isset($field['type']) ? $field['type'] : 'text');
            $properties = is_array($mode) ? $mode : [$mode];
            $declarations = [];
            foreach ($properties as $property) {
                $property = self::sanitize_css_property($property);
                if ($property === '') {
                    continue;
                }
                $clean_value = self::sanitize_css_value($value, $property);
                if ($clean_value !== '') {
                    $declarations[] = $property . ':' . $clean_value . ';';
                }
            }

            return $finish($declarations);
        }

        /**
         * 将复合字段值映射成一组安全 CSS 声明。
         *
         * @param string $type  字段类型。
         * @param array  $value 字段值。
         * @param array  $field 字段 schema。
         * @return array
         */
        private static function composite_output_declarations($type, $value, $field)
        {
            $declarations = [];
            $add = static function (&$items, $property, $css_value) {
                if ($css_value !== '') {
                    $items[] = $property . ':' . $css_value . ';';
                }
            };

            if ($type === 'typography') {
                $add($declarations, 'font-family', self::sanitize_css_token(isset($value['family']) ? $value['family'] : ''));
                $add($declarations, 'font-size', self::css_length(isset($value['size']) ? $value['size'] : '', isset($value['size_unit']) ? $value['size_unit'] : 'px'));
                $add($declarations, 'font-weight', self::css_choice(isset($value['weight']) ? (string) $value['weight'] : '', ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']));
                $add($declarations, 'font-style', self::css_choice(isset($value['style']) ? $value['style'] : '', ['normal', 'italic', 'oblique']));
                $add($declarations, 'line-height', self::css_length(isset($value['line_height']) ? $value['line_height'] : '', isset($value['line_height_unit']) ? $value['line_height_unit'] : '', true));
                $add($declarations, 'letter-spacing', self::css_length(isset($value['letter_spacing']) ? $value['letter_spacing'] : '', isset($value['letter_spacing_unit']) ? $value['letter_spacing_unit'] : 'px'));
                $add($declarations, 'text-transform', self::css_choice(isset($value['transform']) ? $value['transform'] : '', ['none', 'uppercase', 'lowercase', 'capitalize']));
                $add($declarations, 'text-align', self::css_choice(isset($value['align']) ? $value['align'] : '', ['inherit', 'left', 'center', 'right', 'justify']));
                $add($declarations, 'color', self::sanitize_css_token(isset($value['color']) ? $value['color'] : ''));
                return $declarations;
            }

            if ($type === 'spacing') {
                $mode = isset($field['output_mode']) && in_array($field['output_mode'], ['margin', 'padding'], true) ? $field['output_mode'] : 'margin';
                $unit = isset($value['unit']) ? $value['unit'] : 'px';
                foreach (['top', 'right', 'bottom', 'left'] as $side) {
                    $add($declarations, $mode . '-' . $side, self::css_length(isset($value[$side]) ? $value[$side] : '', $unit));
                }
                return $declarations;
            }

            if ($type === 'dimensions') {
                $unit = isset($value['unit']) ? $value['unit'] : 'px';
                foreach (['width' => 'width', 'height' => 'height', 'min_width' => 'min-width', 'max_width' => 'max-width'] as $key => $property) {
                    $add($declarations, $property, self::css_length(isset($value[$key]) ? $value[$key] : '', $unit));
                }
                return $declarations;
            }

            if ($type === 'border') {
                $unit = isset($value['unit']) ? $value['unit'] : 'px';
                $add($declarations, 'border-style', self::css_choice(isset($value['style']) ? $value['style'] : '', ['none', 'solid', 'dashed', 'dotted', 'double']));
                $add($declarations, 'border-color', self::sanitize_css_token(isset($value['color']) ? $value['color'] : ''));
                $width = isset($value['width']) && is_array($value['width']) ? $value['width'] : [];
                foreach (['top', 'right', 'bottom', 'left'] as $side) {
                    $add($declarations, 'border-' . $side . '-width', self::css_length(isset($width[$side]) ? $width[$side] : '', $unit));
                }
                $radius = isset($value['radius']) && is_array($value['radius']) ? $value['radius'] : [];
                foreach (['top_left' => 'border-top-left-radius', 'top_right' => 'border-top-right-radius', 'bottom_right' => 'border-bottom-right-radius', 'bottom_left' => 'border-bottom-left-radius'] as $key => $property) {
                    $add($declarations, $property, self::css_length(isset($radius[$key]) ? $radius[$key] : '', $unit));
                }
                return $declarations;
            }

            if ($type === 'background') {
                $add($declarations, 'background-color', self::sanitize_css_token(isset($value['color']) ? $value['color'] : ''));
                $image_url = self::background_image_url(isset($value['image']) ? $value['image'] : '');
                if ($image_url !== '') {
                    $add($declarations, 'background-image', 'url("' . $image_url . '")');
                }
                $add($declarations, 'background-repeat', self::css_choice(isset($value['repeat']) ? $value['repeat'] : '', ['no-repeat', 'repeat', 'repeat-x', 'repeat-y']));
                $add($declarations, 'background-size', self::css_choice(isset($value['size']) ? $value['size'] : '', ['auto', 'cover', 'contain']));
                $add($declarations, 'background-position', self::css_choice(isset($value['position']) ? $value['position'] : '', ['left top', 'center top', 'right top', 'left center', 'center center', 'right center', 'left bottom', 'center bottom', 'right bottom']));
                $add($declarations, 'background-attachment', self::css_choice(isset($value['attachment']) ? $value['attachment'] : '', ['scroll', 'fixed', 'local']));
                $add($declarations, 'background-blend-mode', self::css_choice(isset($value['blend_mode']) ? $value['blend_mode'] : '', ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten']));
            }

            return $declarations;
        }

        /**
         * 生成数字 CSS 长度值。
         *
         * @param mixed  $number         数字。
         * @param mixed  $unit           单位。
         * @param bool   $allow_unitless 是否允许无单位数值。
         * @return string
         */
        private static function css_length($number, $unit = 'px', $allow_unitless = false)
        {
            if ($number === '' || $number === null || ! is_numeric($number)) {
                return '';
            }
            $allowed_units = ['px', 'rem', 'em', '%', 'vw', 'vh'];
            $unit = strtolower(trim((string) $unit));
            if ($unit === '' && ! $allow_unitless) {
                $unit = 'px';
            } elseif ($unit !== '' && ! in_array($unit, $allowed_units, true)) {
                $unit = 'px';
            }
            $number = rtrim(rtrim(sprintf('%.4F', (float) $number), '0'), '.');
            return ($number === '-0' ? '0' : $number) . $unit;
        }

        /**
         * 仅接受白名单 CSS 值。
         *
         * @param mixed $value   原始值。
         * @param array $allowed 白名单。
         * @return string
         */
        private static function css_choice($value, $allowed)
        {
            $value = (string) $value;
            return in_array($value, $allowed, true) ? $value : '';
        }

        /**
         * 清洗无分号的单个 CSS token/value。
         *
         * @param mixed $value 原始值。
         * @return string
         */
        private static function sanitize_css_token($value)
        {
            $value = wp_strip_all_tags(trim((string) $value));
            return trim(str_replace([';', '{', '}', '<', '>', "\0", "\r", "\n"], '', $value));
        }

        /**
         * 从上传字段值中提取安全图片 URL。
         *
         * @param mixed $image 上传字段值。
         * @return string
         */
        private static function background_image_url($image)
        {
            if (is_array($image)) {
                $image = isset($image['url']) ? $image['url'] : '';
            } elseif (is_numeric($image)) {
                $image = wp_get_attachment_url(absint($image));
            }
            return esc_url_raw((string) $image);
        }

        /**
         * 按字段类型推导默认 CSS 属性。
         *
         * @param string $type 字段类型。
         * @return string      CSS 属性。
         */
        private static function default_output_mode($type)
        {
            return ($type === 'color') ? 'color' : '';
        }

        /**
         * 清洗 CSS selector，阻断花括号等可逃逸字符。
         *
         * @param mixed $selector 原始 selector。
         * @return string
         */
        private static function sanitize_css_selector($selector)
        {
            $selector = wp_strip_all_tags((string) $selector);
            return trim(str_replace(['{', '}', ';'], '', $selector));
        }

        /**
         * 清洗 CSS 属性名。
         *
         * @param mixed $property 原始属性。
         * @return string
         */
        private static function sanitize_css_property($property)
        {
            $property = strtolower((string) $property);
            return preg_replace('/[^a-z0-9\-_]/', '', $property);
        }

        /**
         * 清洗 CSS 属性值。
         *
         * @param mixed  $value    原始值。
         * @param string $property CSS 属性。
         * @return string
         */
        private static function sanitize_css_value($value, $property)
        {
            $value = trim((string) $value);
            if ($property === 'background-image') {
                $url = esc_url_raw($value);
                return $url !== '' ? 'url("' . $url . '")' : '';
            }
            return self::sanitize_css_token($value);
        }

        /**
         * 序列化前预处理分区：执行 callback 字段（PHP 回调输出 HTML），转为可 JSON 的 html 字段；
         * 并清除任何不可序列化的 callable，保证 sections 能安全注入前端。
         * callback 字段写法：['type' => 'callback', 'function' => callable, 'args' => mixed]，回调内 echo 或 return HTML。
         *
         * @param array $sections 原始分区数组。
         * @return array          可安全 JSON 化的分区数组（callback 已转 html、callable 已剔除）。
         */
        public static function prepare_sections($sections)
        {
            $out = [];
            foreach (array_values((array) $sections) as $index => $sec) {
                // 仅处理含字段的分区。
                if (! empty($sec['fields']) && is_array($sec['fields'])) {
                    $sec['fields'] = self::prepare_fields($sec['fields'], 's' . $index);
                }
                $out[] = $sec;
            }
            return \Eva\Framework\Admin\Dependency::prepare_sections(array_values($out));
        }

        /**
         * 递归预处理一组字段，容器字段（group / repeater / tabbed / accordion）的子字段同样处理——
         * 否则嵌在 fieldset、group 里的 callback / content / 字符串数据源到了前端就是坏的。
         *
         * @param array  $fields 字段数组。
         * @param string $path   所在位置的路径标识，用来给没有 id 的字段生成稳定的渲染 key。
         * @return array
         */
        private static function prepare_fields($fields, $path)
        {
            $out = [];
            foreach (array_values((array) $fields) as $i => $f) {
                if (! is_array($f)) {
                    continue;
                }
                $original_type = isset($f['type']) ? sanitize_key((string) $f['type']) : 'text';

                // 识别 callback 字段：执行其回调，把输出（echo 优先，否则返回值）转成 html 字段。
                $is_cb = $original_type === 'callback';
                if ($is_cb && isset($f['function']) && is_callable($f['function'])) {
                    ob_start();
                    $ret  = array_key_exists('args', $f) ? call_user_func($f['function'], $f['args']) : call_user_func($f['function']);
                    $echo = ob_get_clean();
                    $f['type'] = 'html';
                    $f['html'] = ($echo !== '' ? $echo : (is_string($ret) ? $ret : ''));
                } else {
                    // CSF 的 content 以及 heading / subheading / submessage / notice 都把正文写在 content 键；
                    // 这些类型由字段组件自己渲染正文，统一挪到 html 键——外壳会把任意字段的 content
                    // 输出在控件上方，不挪走正文就会出现两遍。
                    $display_types = ['content', 'heading', 'subheading', 'submessage', 'notice'];
                    if (in_array($original_type, $display_types, true) && ! array_key_exists('html', $f)) {
                        $f['html'] = isset($f['content']) ? $f['content'] : '';
                        unset($f['content']);
                    }
                    $f['type'] = self::normalizeFieldType($original_type);
                }

                unset($f['function']); // 闭包/可调用不可 JSON 化，统一清除
                unset($f['args']); // callback 已执行，参数不再需要注入前端
                unset($f['csf_normalized']); // 兼容层的内部幂等标记，前端用不到
                // sanitize 回调只在服务端用；[$object, 'method'] 这种写法进了 JSON 还会把对象的公开属性带到前端。
                unset($f['sanitize']);
                // validate 只保留内置规则名（字符串）给前端做即时提示，回调同样留在服务端。
                if (isset($f['validate']) && ! is_string($f['validate'])) {
                    $rules = is_array($f['validate']) && ! is_callable($f['validate']) ? array_values(array_filter($f['validate'], 'is_string')) : [];
                    if ($rules) {
                        $f['validate'] = $rules;
                    } else {
                        unset($f['validate']);
                    }
                }

                // CSF 的字符串数据源（'options' => 'categories'）在这里查库展开成选项数组。
                $f = \Eva\Framework\Csf_Compat::resolve_field($f);

                // 标题、提示这类纯展示字段在 CSF 里通常不写 id；两个外壳都用 id 当渲染 key，这里补一个且不参与保存。
                if (! isset($f['id']) || $f['id'] === '') {
                    $f['id']   = '_eva_' . $path . '_' . $i;
                    $f['save'] = false;
                }

                // 容器字段的子字段。
                $child_path = $path . '_' . $i;
                if (! empty($f['fields']) && is_array($f['fields'])) {
                    $f['fields'] = self::prepare_fields($f['fields'], $child_path);
                }
                foreach (['tabs', 'sections'] as $list_key) {
                    if (empty($f[$list_key]) || ! is_array($f[$list_key])) {
                        continue;
                    }
                    $f[$list_key] = array_values($f[$list_key]);
                    foreach ($f[$list_key] as $n => $item) {
                        if (is_array($item) && ! empty($item['fields']) && is_array($item['fields'])) {
                            $f[$list_key][$n]['fields'] = self::prepare_fields($item['fields'], $child_path . '_' . $n);
                        }
                    }
                }

                // 容器字段自己没写 default 时，用子字段的 default 拼一个（子字段已先处理，嵌套容器自下而上生效）。
                // 前端用字段的 default 初始化表单值：不拼的话，界面上子字段显示着各自的默认值，
                // 但只要用户没动过这个容器，提交上来的就是空值，存进库里的也是空——所见与所存不一致。
                if (! array_key_exists('default', $f)) {
                    $composite = self::composite_default($f);
                    if ($composite) {
                        $f['default'] = $composite;
                    }
                }

                $out[] = $f;
            }
            return $out;
        }

        /**
         * 由子字段的 default 拼出容器字段的默认值（组件要的结构）。
         *
         * @param array $f 已预处理的容器字段。
         * @return array   group / tabbed：[子字段 id => 默认值]；accordion：[面板 id => [子字段 id => 默认值]]；其它类型为空数组。
         */
        private static function composite_default($f)
        {
            $collect = static function ($fields) {
                $out = [];
                foreach ((array) $fields as $child) {
                    $stored = is_array($child) && ! empty($child['id']) && ! (array_key_exists('save', $child) && ! $child['save']);
                    if ($stored && array_key_exists('default', $child)) {
                        $out[$child['id']] = $child['default'];
                    }
                }
                return $out;
            };

            $type = isset($f['type']) ? $f['type'] : '';
            if ($type === 'group') {
                return $collect(isset($f['fields']) ? $f['fields'] : (isset($f['items']) ? $f['items'] : []));
            }
            if ($type === 'tabbed') {
                $out = [];
                foreach ((isset($f['tabs']) && is_array($f['tabs']) ? $f['tabs'] : []) as $tab) {
                    $out = array_merge($out, $collect(isset($tab['fields']) ? $tab['fields'] : []));
                }
                return $out;
            }
            if ($type === 'accordion') {
                $out = [];
                foreach ((isset($f['sections']) && is_array($f['sections']) ? array_values($f['sections']) : []) as $index => $panel) {
                    $defaults = $collect(isset($panel['fields']) ? $panel['fields'] : []);
                    if ($defaults) {
                        // 面板 id 的取法与 Accordion.js 的 sectionId() 保持一致：id → key → 下标。
                        $panel_id = isset($panel['id']) && $panel['id'] !== '' ? $panel['id'] : (isset($panel['key']) && $panel['key'] !== '' ? $panel['key'] : $index);
                        $out[(string) $panel_id] = $defaults;
                    }
                }
                return $out;
            }
            return [];
        }

        /**
         * 递归扫描 Fields/<name>/<name>.js，返回 [name => url]，供逐个加载。
         *
         * @return array<string,string> 字段名 => 脚本 URL。
         */
        public static function field_scripts()
        {
            return self::field_assets_by_extension('js');
        }

        /**
         * 递归扫描 Fields/<name>/<name>.css，返回 [name => url]，供逐个加载。
         *
         * @return array<string,string> 字段名 => 样式 URL。
         */
        public static function field_styles()
        {
            return self::field_assets_by_extension('css');
        }

        /**
         * 递归读取字段资源；兼容迁移期的根目录文件，但优先使用字段子目录。
         *
         * @param string $extension js|css。
         * @return array<string,string>
         */
        private static function field_assets_by_extension($extension)
        {
            $dir = EVA_FW_DIR . 'Fields/';
            $out = [];
            if (! is_dir($dir)) {
                return $out;
            }
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS)
            );
            $files = [];
            foreach ($iterator as $file) {
                if (! $file->isFile() || strtolower($file->getExtension()) !== $extension) {
                    continue;
                }
                $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($dir)));
                $files[$relative] = $file->getPathname();
            }
            ksort($files, SORT_NATURAL | SORT_FLAG_CASE);
            foreach ($files as $relative => $path) {
                $name = basename($path, '.' . $extension);
                $out[$name] = EVA_FW_URL . 'Fields/' . $relative;
            }
            // 主题 / 扩展可以在这里追加自己的字段资源，或用同名键替换内置字段（对应 CSF 的 csf_fields + csf-override 目录）。
            // 过滤器：eva_field_scripts / eva_field_styles，参数是 [字段名 => URL]。
            return (array) apply_filters($extension === 'js' ? 'eva_field_scripts' : 'eva_field_styles', $out);
        }

        /**
         * 主题注入的自定义图标集（对应 CSF 的 csf_field_icon_add_icons）。
         *
         * 过滤器 eva_field_icon_add_icons 的参数与返回值格式同 CSF：
         * [['title' => '图标集名称', 'icons' => ['类名或 symbol id', …]], …]。
         * 图标字体的 CSS / symbol 脚本由主题自己加载（挂 eva_enqueue 动作）。
         *
         * @return array<int,array{title:string,icons:string[]}>
         */
        public static function icon_sets()
        {
            $sets = [];
            foreach ((array) apply_filters('eva_field_icon_add_icons', []) as $set) {
                if (! is_array($set) || empty($set['icons']) || ! is_array($set['icons'])) {
                    continue;
                }
                $icons = [];
                foreach ($set['icons'] as $icon) {
                    $icon = is_scalar($icon) ? trim((string) $icon) : '';
                    // 与 Icon::sanitize 允许保存的字符保持一致，存不进去的图标就不要出现在选择器里。
                    if ($icon !== '' && preg_match('/^[#A-Za-z0-9_\-\s]+$/', $icon)) {
                        $icons[] = $icon;
                    }
                }
                if ($icons) {
                    $sets[] = [
                        'title' => isset($set['title']) && is_scalar($set['title']) ? wp_strip_all_tags((string) $set['title']) : '',
                        'icons' => array_values(array_unique($icons)),
                    ];
                }
            }
            return $sets;
        }

        /**
         * 把自定义图标集输出成一段可内联的脚本（window.EvaIconSets）；没有图标集时返回空字符串。
         * 两个外壳以及独立页都用它，图标选择器（Libs/Icon-picker）在首次打开时读取。
         *
         * @return string
         */
        public static function icon_sets_script()
        {
            $sets = self::icon_sets();
            if (! $sets) {
                return '';
            }
            return 'window.EvaIconSets = ' . wp_json_encode($sets, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';';
        }

        /** 返回字段资源的新目录相对路径。 */
        public static function field_asset_rel($name, $extension)
        {
            return 'Fields/' . $name . '/' . $name . '.' . $extension;
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
         * 注意：这份清单有近百项，浏览器端不再逐个请求（会把本地单进程 PHP 打满），
         * 只用来在服务端算一个总指纹，见 dev_watch_stamp()。
         *
         * @return string[] 待监听的资源 URL 列表。
         */
        public static function dev_watch_assets()
        {
            // 先放核心外壳样式与脚本。
            $list = [
                EVA_FW_URL . 'assets/eva.css',
                EVA_FW_URL . 'assets/eva-app.js',
                EVA_FW_URL . 'assets/eva-embed.js',
            ];
            // 追加所有字段脚本与样式。
            foreach (self::field_scripts() as $url) {
                $list[] = $url;
            }
            foreach (self::field_styles() as $url) {
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
         * 开发期热刷新的监听总指纹：把全部被监听文件的 mtime / 体积揉成一个 md5。
         *
         * 任何一个文件被改动，指纹就变，浏览器据此刷新页面。
         * 近百次 stat 在同一个请求里完成，比让浏览器发近百个 HEAD 便宜得多。
         *
         * @return string 32 位十六进制指纹。
         */
        public static function dev_watch_stamp()
        {
            $parts = [];
            foreach (self::dev_watch_assets() as $url) {
                // 监听清单给的是 URL，换回插件目录下的真实路径再 stat。
                $rel  = ltrim(str_replace(EVA_FW_URL, '', $url), '/');
                $path = EVA_FW_DIR . $rel;
                $parts[] = file_exists($path)
                    ? $rel . ':' . filemtime($path) . ':' . filesize($path)
                    : $rel . ':0'; // 文件被删也算一次变化。
            }
            return md5(implode('|', $parts));
        }

        /**
         * 注入给 eva-livereload.js 的配置：一个指纹接口地址 + 轮询间隔。
         *
         * 三处注入点（Admin / Standalone / enqueue_runtime）共用，避免各写各的。
         *
         * @return array
         */
        public static function dev_config()
        {
            return [
                'enabled'  => true,
                'url'      => admin_url('admin-ajax.php?action=eva_fw_dev_stamp'),
                'interval' => 2000,
            ];
        }

        /**
         * 开发期热刷新的指纹接口（wp_ajax_eva_fw_dev_stamp）。
         *
         * 只在 EVA_FW_DEV 打开时由 eva-framework.php 注册；纯文本返回，不进缓存。
         *
         * @return void
         */
        public static function ajax_dev_stamp()
        {
            if (! defined('EVA_FW_DEV') || ! EVA_FW_DEV || ! current_user_can('edit_posts')) {
                status_header(403);
                exit;
            }
            nocache_headers();
            header('Content-Type: text/plain; charset=utf-8');
            echo self::dev_watch_stamp();
            exit;
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
            // 媒体库支持：image_select 的“媒体库”按钮用 wp.media 原生弹窗挑图。
            if (function_exists('wp_enqueue_media') && is_admin()) {
                wp_enqueue_media();
            }
            // 基础依赖：Vue3 + 图标字体 + 框架样式。
            wp_enqueue_script('eva-vue3', 'https://cdn.jsdelivr.net/npm/vue@3.4.38/dist/vue.global.prod.js', [], '3.4.38', true);
            wp_enqueue_style('eva-remixicon', 'https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.css', [], '4.5.0');
            wp_enqueue_style('eva-framework', EVA_FW_URL . 'assets/eva.css', [], self::asset_ver('assets/eva.css'));
            // 用户挑了主题色、或主题指定了品牌色，就追加一段令牌覆盖；都没有则什么也不输出。
            self::add_theme_color_inline_style();

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
            // 字段样式逐个登记；依赖框架主样式，方便字段独立维护 UI。
            foreach (self::field_styles() as $name => $url) {
                wp_enqueue_style('eva-field-' . $name, $url, ['eva-framework'], self::asset_ver(self::field_asset_rel($name, 'css')));
            }
            // 字段脚本逐个登记，并累积为外壳依赖。
            foreach (self::field_scripts() as $name => $url) {
                $handle = 'eva-field-' . $name;
                wp_enqueue_script($handle, $url, ['eva-vue3'], self::asset_ver(self::field_asset_rel($name, 'js')), true);
                $deps[] = $handle;
            }
            // 外壳脚本：依赖以上库与字段全部就绪。
            wp_enqueue_script('eva-framework', EVA_FW_URL . 'assets/eva-app.js', $deps, self::asset_ver('assets/eva-app.js'), true);
            // 嵌入式容器（用户资料、文章/分类法/菜单等）没有 #eva-app，
            // 用独立运行时挂载 embed_markup 输出的 .eva-embed-root。
            wp_enqueue_script(
                'eva-embed',
                EVA_FW_URL . 'assets/eva-embed.js',
                ['eva-framework'],
                self::asset_ver('assets/eva-embed.js'),
                true
            );

            // 自定义图标集 + 主题自己的后台资源（对应 CSF 的 csf_enqueue）。
            $icon_sets = self::icon_sets_script();
            if ($icon_sets !== '') {
                wp_add_inline_script('eva-vue3', $icon_sets, 'after');
            }
            do_action('eva_enqueue', null);

            // 开发期热刷新脚本与指纹接口地址。
            if (defined('EVA_FW_DEV') && EVA_FW_DEV) {
                wp_enqueue_script('eva-livereload', EVA_FW_URL . 'assets/eva-livereload.js', [], self::asset_ver('assets/eva-livereload.js'), true);
                wp_localize_script('eva-livereload', 'EvaFWDev', self::dev_config());
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
            $registered = isset($cfg['sections']) ? $cfg['sections'] : [];
            $sections = self::prepare_sections($registered);
            $payload = [
                'container'  => $container,
                'id'         => $id,
                'namePrefix' => $name_prefix !== '' ? $name_prefix : ('eva_fields[' . $id . ']'),
                'sections'   => $sections,
                'dependencySources' => \Eva\Framework\Admin\Dependency::dependency_sources($sections),
                // meta 里存的是 CSF 格式的值，转成组件要的结构再回填。
                'values'     => \Eva\Framework\Csf_Compat::values_to_eva($registered, is_array($values) ? $values : []),
            ];
            // 用安全选项编码为 JSON，内联进挂载点的 <script type="application/json">。
            $json = wp_json_encode($payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

            // metabox 放到右侧栏（context=side）时可用宽度只剩 ~250px，整幅宽度那套表单样式在那里会变成
            // 「卡中卡」并把控件挤扁；把 context 透出到根节点，由 eva.css 的属性选择器切到窄栏变体。
            $context = isset($cfg['context']) ? (string) $cfg['context'] : '';
            $context_attr = in_array($context, ['side', 'normal', 'advanced'], true)
                ? ' data-eva-context="' . esc_attr($context) . '"'
                : '';

            // 输出：根节点（带容器类型标记）+ 内联数据 + 加载占位（前端就绪后替换）。
            $html  = '<div class="eva-embed-root" data-eva-embed="' . esc_attr($container) . '"' . $context_attr . '>';
            $html .= '<script type="application/json" class="eva-embed-data">' . $json . '</script>';
            $html .= '<div class="eva-embed-mount"><div class="eva-boot">Eva 字段加载中…</div></div>';
            $html .= '</div>';
            return $html;
        }
    }
}
