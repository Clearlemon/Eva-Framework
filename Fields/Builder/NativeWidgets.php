<?php

namespace Eva\Framework\Builder;

/**
 * Eva 页面构建器：WordPress 原生小工具区域模块。
 */
class NativeWidgets
{
  /** 区域标记仅用于授权预览，自动跟随主题注册的 WordPress 侧栏。 */
  public static function register_preview()
  {
    add_action('dynamic_sidebar_before', array(self::class, 'preview_before'), 10, 2);
    add_action('dynamic_sidebar_after', array(self::class, 'preview_after'), 10, 2);
  }

  public static function preview_before($id, $active = false)
  {
    global $wp_registered_sidebars;
    if (!\Eva::is_builder_preview() || !isset($wp_registered_sidebars[$id])) { return; }
    $name = $wp_registered_sidebars[$id]['name'];
    echo '<div class="eva-builder-widget-area" data-eva-widget-area="' . esc_attr($id) . '" data-eva-widget-label="' . esc_attr($name) . '">';
  }

  public static function preview_after($id, $active = false)
  {
    global $wp_registered_sidebars;
    if (\Eva::is_builder_preview() && isset($wp_registered_sidebars[$id])) {
      echo '</div>';
    }
  }

  /** 只读取区域和小工具摘要，不执行小工具输出或修改配置。 */
  public static function ajax_get()
  {
    check_ajax_referer('eva_fw_guide', 'nonce');
    if (!current_user_can('edit_theme_options')) {
      wp_send_json_error(array('message' => '您没有管理小工具的权限。'), 403);
      return;
    }
    wp_send_json_success(self::data());
  }

  public static function data()
  {
    global $wp_registered_sidebars, $wp_registered_widgets, $wp_widget_factory;

    $assigned = wp_get_sidebars_widgets();
    $areas = array();
    foreach ((array) $wp_registered_sidebars as $id => $sidebar) {
      $items = array();
      foreach ((array) ($assigned[$id] ?? array()) as $widget_id) {
        $widget = $wp_registered_widgets[$widget_id] ?? null;
        if (!$widget) {
          continue;
        }
        $title = '';
        $object = is_array($widget['callback'] ?? null) ? ($widget['callback'][0] ?? null) : null;
        if ($object instanceof \WP_Widget) {
          $settings = $object->get_settings();
          $number = $widget['params'][0]['number'] ?? 0;
          $title = isset($settings[$number]['title']) && is_scalar($settings[$number]['title']) ? wp_strip_all_tags((string) $settings[$number]['title']) : '';
        }
        $items[] = array(
          'id'    => (string) $widget_id,
          'name'  => wp_strip_all_tags((string) $widget['name']),
          'title' => $title,
        );
      }
      $areas[] = array(
        'id'          => (string) $id,
        'name'        => wp_strip_all_tags((string) $sidebar['name']),
        'description' => wp_strip_all_tags((string) ($sidebar['description'] ?? '')),
        'items'       => $items,
      );
    }

    $available = array();
    foreach ((array) ($wp_widget_factory->widgets ?? array()) as $widget) {
      if ($widget instanceof \WP_Widget) {
        $available[] = array('id' => $widget->id_base, 'name' => wp_strip_all_tags((string) $widget->name));
      }
    }
    return array('areas' => $areas, 'available' => $available, 'editor_url' => admin_url('widgets.php'));
  }

  public static function register()
  {
    \Eva::createBuilderModule('wp_widgets', array(
      'label'  => '小工具',
      'icon'   => 'ri-layout-grid-line',
      'group'  => 'WordPress 原生',
      'fields' => array_merge(self::fields(), Native::fields()),
      'render' => array(self::class, 'render'),
    ));
  }

  private static function fields()
  {
    return array(
      array(
        'id'          => 'Native_Widget_Area',
        'type'        => 'select',
        'title'       => '小工具区域',
        'source'      => 'sidebars',
        'ajax'        => true,
        'searchable'  => true,
        'placeholder' => '选择 WordPress 小工具区域',
        'default'     => '',
      ),
    );
  }

  public static function render($values, $item = array())
  {
    $settings = array_merge(array(
      'Native_Widget_Area' => '',
    ), Native::defaults(), (array) $values);

    if (! Native::can_render($settings)) {
      return '';
    }

    $sidebar_id = sanitize_key((string) $settings['Native_Widget_Area']);
    if ($sidebar_id === '' || ! function_exists('dynamic_sidebar')) {
      return '';
    }

    ob_start();
    $rendered = dynamic_sidebar($sidebar_id);
    $html     = (string) ob_get_clean();
    if (! $rendered && trim($html) === '') {
      return '';
    }

    return Native::frame($settings, $item, 'module-widgets', '<div class="eva-builder-native-widgets">' . $html . '</div>');
  }
}


