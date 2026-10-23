<?php

namespace Eva\Framework\Builder;

/**
 * Eva 页面构建器：WordPress 原生导航菜单模块。
 */
class NativeMenu
{
  public static function register()
  {
    \Eva::createBuilderModule('wp_menu', array(
      'label'  => '菜单',
      'icon'   => 'ri-menu-line',
      'group'  => 'WordPress 原生',
      'fields' => array_merge(self::fields(), Native::fields()),
      'render' => array(self::class, 'render'),
    ));
  }

  private static function fields()
  {
    return array(
      array(
        'id'           => 'Native_Menu_ID',
        'type'         => 'select',
        'title'        => '导航菜单',
        'source'       => 'menus',
        'ajax'         => true,
        'searchable'   => true,
        'placeholder'  => '选择 WordPress 导航菜单',
        'default'      => '',
      ),
      array(
        'id'      => 'Native_Menu_Depth',
        'type'    => 'spinner',
        'title'   => '菜单层级',
        'desc'    => '0 表示保留菜单的全部层级。',
        'min'     => 0,
        'max'     => 5,
        'default' => 0,
      ),
    );
  }

  public static function render($values, $item = array())
  {
    $settings = array_merge(array(
      'Native_Menu_ID'    => '',
      'Native_Menu_Depth' => 0,
    ), Native::defaults(), (array) $values);

    if (! Native::can_render($settings)) {
      return '';
    }

    $menu_id = absint($settings['Native_Menu_ID']);
    if ($menu_id < 1 || ! wp_get_nav_menu_object($menu_id)) {
      return '';
    }

    $depth = max(0, min(5, (int) $settings['Native_Menu_Depth']));
    ob_start();
    wp_nav_menu(array(
      'menu'                 => $menu_id,
      'container'            => 'nav',
      'container_class'      => 'eva-builder-native-menu',
      'container_aria_label' => '导航菜单',
      'menu_class'           => 'eva-builder-native-menu-list',
      'depth'                => $depth,
      'fallback_cb'          => false,
    ));
    $html = (string) ob_get_clean();

    return trim($html) === '' ? '' : Native::frame($settings, $item, 'module-menu', $html);
  }
}


