<?php

namespace Eva\Framework\Builder;

if (!defined('ABSPATH')) {
  exit;
}

/** 为 WordPress 菜单位置增加仅构建器预览可见的定位标记。 */
class MenuLocations
{
  public static function register()
  {
    add_filter('pre_wp_nav_menu', array(self::class, 'preview_empty'), 20, 2);
    add_filter('wp_nav_menu', array(self::class, 'preview_html'), 20, 2);
  }

  private static function location($args)
  {
    if (!\Eva::is_builder_preview()) {
      return '';
    }
    $id = isset($args->theme_location) ? (string) $args->theme_location : '';
    $registered = get_registered_nav_menus();
    return $id !== '' && isset($registered[$id]) ? $id : '';
  }

  /** 未绑定或没有菜单项的位置，普通前台继续保持无输出。 */
  public static function preview_empty($html, $args)
  {
    $id = self::location($args);
    if ($id === '' || $html !== null || !empty($args->menu)) {
      return $html;
    }

    $locations = get_nav_menu_locations();
    $menu_id = absint($locations[$id] ?? 0);
    if ($menu_id && wp_get_nav_menu_items($menu_id, array('update_post_term_cache' => false))) {
      return $html;
    }

    return '<div' . self::attributes($id) . ' data-eva-menu-empty="1"></div>';
  }

  /** 在现有菜单根节点上标记位置，不额外包一层改变主题布局。 */
  public static function preview_html($html, $args)
  {
    $id = self::location($args);
    if ($id === '' || !is_string($html) || $html === '' || strpos($html, 'data-eva-menu-location=') !== false) {
      return $html;
    }
    return preg_replace_callback('/<([a-z][a-z0-9:-]*)(?=[\\s>])/i', function ($matches) use ($id) {
      return '<' . $matches[1] . self::attributes($id);
    }, $html, 1);
  }

  private static function attributes($id)
  {
    $registered = get_registered_nav_menus();
    return ' data-eva-menu-location="' . esc_attr($id) . '" data-eva-menu-label="' . esc_attr($registered[$id]) . '"';
  }
}
