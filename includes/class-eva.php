<?php

/**
 * Eva 门面：对外注册 API（可在主题或插件中调用，类似 CSF 的 CSF::createOptions）。
 * 置于全局命名空间，使用方式：Eva::createOptions(...) / Eva::createSection(...)。
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! class_exists('Eva')) {
    class Eva
    {
        /** @var array<string,array> 已注册的设置页（id => 配置，含 sections） */
        protected static $options = [];

        /**
         * 创建一个设置页（菜单）。
         *
         * @param string $id   唯一标识，也是将来保存到 wp_options 的键。
         * @param array  $args menu_title / menu_slug / capability / menu_icon /
         *                     menu_position / location(admin_bar|left) / subtitle / sections
         */
        public static function createOptions($id, $args = [])
        {
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

            self::$options[$id] = array_merge($defaults, $args);
            self::$options[$id]['option_id'] = $id;
        }

        /**
         * 向某个设置页追加一个分组（含字段）。
         *
         * @param string $option_id createOptions 的 id
         * @param array  $section   id / title / icon / desc / fields[]
         */
        public static function createSection($option_id, $section = [])
        {
            if (! isset(self::$options[$option_id])) {
                return;
            }
            self::$options[$option_id]['sections'][] = $section;
        }

        /**
         * 向某设置页追加一个左侧主菜单项。
         *
         * @param string $option_id createOptions 的 id
         * @param array  $item      id / label / icon(remix 类名) / arrow(bool) / url
         */
        public static function addMenuItem($option_id, $item = [])
        {
            if (! isset(self::$options[$option_id])) {
                return;
            }
            self::$options[$option_id]['menu'][] = $item;
        }

        /** 取全部已注册设置页。 */
        public static function get_options()
        {
            return self::$options;
        }

        /** 按 slug 取单个设置页配置。 */
        public static function get_by_slug($slug)
        {
            foreach (self::$options as $opt) {
                if ($opt['menu_slug'] === $slug) {
                    return $opt;
                }
            }
            return null;
        }

        /** 当前登录用户的展示信息（用于右上角用户菜单）。 */
        public static function current_user()
        {
            $u = wp_get_current_user();
            if (! $u || ! $u->ID) {
                return null;
            }

            $name = $u->display_name ?: $u->user_login;

            $role = '用户';
            if (! empty($u->roles)) {
                $slug = $u->roles[0];
                $roles = wp_roles();
                $role = isset($roles->roles[$slug]['name'])
                    ? translate_user_role($roles->roles[$slug]['name'])
                    : $slug;
            }
            if (is_super_admin($u->ID)) {
                $role = '超级管理员';
            }

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
         */
        public static function runtime()
        {
            return [
                'isAdmin'         => current_user_can('manage_options'),
                'guideVisible'    => (get_option('eva_fw_guide_visible', '1') !== '0'),
                'floatingEnabled' => (get_option('eva_fw_floating', '1') !== '0'),
                'ajaxUrl'         => admin_url('admin-ajax.php'),
                'nonce'           => wp_create_nonce('eva_fw_guide'),
            ];
        }

        /** 按注册 id 取设置页配置（id 即 createOptions 的第一个参数 / option_id）。 */
        public static function get($id)
        {
            return isset(self::$options[$id]) ? self::$options[$id] : null;
        }

        /** 取某设置页已保存的字段值（wp_options，键为 option_id）。 */
        public static function get_values($option_id)
        {
            $v = get_option($option_id, []);
            return is_array($v) ? $v : [];
        }

        /**
         * 序列化前预处理分区：执行 callback 字段（PHP 回调输出 HTML），转为可 JSON 的 html 字段；
         * 并清除任何不可序列化的 callable，保证 sections 能安全注入前端。
         * callback 字段写法：['type' => 'callback', 'function' => callable]，回调内 echo 或 return HTML。
         */
        public static function prepare_sections($sections)
        {
            $out = [];
            foreach ((array) $sections as $sec) {
                if (! empty($sec['fields']) && is_array($sec['fields'])) {
                    foreach ($sec['fields'] as $i => $f) {
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
                    $sec['fields'] = array_values($sec['fields']);
                }
                $out[] = $sec;
            }
            return array_values($out);
        }

        /** 扫描 assets/fields/ 下的字段脚本（一字段一文件），返回 [name => url]，供逐个加载。 */
        public static function field_scripts()
        {
            $dir  = EVA_FW_DIR . 'assets/fields/';
            $base = EVA_FW_URL . 'assets/fields/';
            $out  = [];
            if (is_dir($dir)) {
                $files = glob($dir . '*.js');
                if (is_array($files)) {
                    sort($files);
                    foreach ($files as $file) {
                        $name = basename($file, '.js');
                        $out[$name] = $base . $name . '.js';
                    }
                }
            }
            return $out;
        }

        /**
         * 扫描 assets/libs/ 下的 UI 库（一库一文件夹，含同名 .js / .css）。
         * 返回 [name => ['js' => url|null, 'css' => url|null, 'jsRel' => 相对路径, 'cssRel' => 相对路径]]。
         */
        public static function lib_assets()
        {
            $dir  = EVA_FW_DIR . 'assets/libs/';
            $base = EVA_FW_URL . 'assets/libs/';
            $out  = [];
            if (is_dir($dir)) {
                $folders = glob($dir . '*', GLOB_ONLYDIR);
                if (is_array($folders)) {
                    sort($folders);
                    foreach ($folders as $folder) {
                        $name  = basename($folder);
                        $entry = ['js' => null, 'css' => null, 'jsRel' => null, 'cssRel' => null];
                        if (file_exists($folder . '/' . $name . '.js')) {
                            $entry['js']    = $base . $name . '/' . $name . '.js';
                            $entry['jsRel'] = 'assets/libs/' . $name . '/' . $name . '.js';
                        }
                        if (file_exists($folder . '/' . $name . '.css')) {
                            $entry['css']    = $base . $name . '/' . $name . '.css';
                            $entry['cssRel'] = 'assets/libs/' . $name . '/' . $name . '.css';
                        }
                        $out[$name] = $entry;
                    }
                }
            }
            return $out;
        }

        /** 资源版本号：开发期用文件 mtime 击穿缓存（改动即换号，强制取最新）；生产用固定版本。 */
        public static function asset_ver($rel)
        {
            $path = EVA_FW_DIR . $rel;
            if (defined('EVA_FW_DEV') && EVA_FW_DEV && file_exists($path)) {
                return (string) filemtime($path);
            }
            return EVA_FW_VERSION;
        }
    }
}
