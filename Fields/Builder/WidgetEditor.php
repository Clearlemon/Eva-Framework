<?php

namespace Eva\Framework\Builder;

if (!defined('ABSPATH')) {
  exit;
}

/** 增删和拖放仅修改原生小工具分配，不把小工具保存成 Builder 组件。 */
class WidgetEditor
{
  public static function ajax_change()
  {
    check_ajax_referer('eva_fw_guide', 'nonce');
    if (!current_user_can('edit_theme_options')) {
      wp_send_json_error(array('message' => '您没有管理小工具的权限。'), 403);
      return;
    }
    $args = array();
    foreach (array('operation', 'area', 'widget', 'before') as $key) {
      $args[$key] = isset($_POST[$key]) && is_string($_POST[$key]) ? sanitize_key(wp_unslash($_POST[$key])) : '';
    }
    $result = self::change($args['operation'], $args['area'], $args['widget'], $args['before']);
    if (is_wp_error($result)) {
      wp_send_json_error(array('message' => $result->get_error_message()), 400);
      return;
    }
    wp_send_json_success($result);
  }

  public static function change($operation, $area, $widget_id, $before = '')
  {
    global $wp_registered_sidebars, $wp_registered_widgets, $wp_widget_factory;
    if (!in_array($operation, array('add', 'move', 'remove'), true) || !isset($wp_registered_sidebars[$area])) {
      return new \WP_Error('invalid_area', '请选择有效的小工具区域。');
    }
    $factory_widget = null;
    if ($operation === 'add') {
      foreach ((array) ($wp_widget_factory->widgets ?? array()) as $widget) {
        if ($widget instanceof \WP_Widget && $widget->id_base === $widget_id) {
          $factory_widget = clone $widget;
          break;
        }
      }
      if (!$factory_widget) { return new \WP_Error('invalid_widget', '这个小工具类型不存在。'); }
    } elseif (!isset($wp_registered_widgets[$widget_id])) {
      return new \WP_Error('invalid_widget', '这个小工具不存在，请刷新内容。');
    }

    // 同一时刻只分配一次实例编号，避免并发拖放覆盖已有小工具设置。
    $lock_key = 'eva_fw_widget_editor_lock';
    $previous = get_option($lock_key);
    if (is_array($previous) && (int) ($previous['expires'] ?? 0) < time()) { delete_option($lock_key); }
    $lock = array('token' => wp_generate_uuid4(), 'expires' => time() + 30);
    if (!add_option($lock_key, $lock, '', false)) {
      return new \WP_Error('busy', '小工具正在保存，请稍后重试。');
    }
    try {
      $areas = wp_get_sidebars_widgets();
      if ($operation === 'remove' && !in_array($widget_id, (array) ($areas[$area] ?? array()), true)) {
        return new \WP_Error('invalid_widget', '这个小工具已不在当前区域，请刷新内容。');
      }
      if ($operation !== 'remove' && $before !== '' && !in_array($before, (array) ($areas[$area] ?? array()), true)) {
        return new \WP_Error('invalid_position', '排序位置已变化，请刷新后重试。');
      }
      if ($operation === 'add') {
        $settings = (array) $factory_widget->get_settings();
        $numbers = array_filter(array_keys($settings), static function ($key) { return ctype_digit((string) $key); });
        $number = max(array_merge(array(1), array_map('intval', $numbers))) + 1;
        $settings[$number] = array();
        $factory_widget->save_settings($settings);
        $factory_widget->_set($number);
        $factory_widget->_register_one($number);
        $widget_id = $factory_widget->id;
      }
      if ($operation === 'remove' || $widget_id !== $before) {
        foreach ($areas as $id => $items) {
          if (is_array($items)) { $areas[$id] = array_values(array_diff($items, array($widget_id))); }
        }
        if ($operation === 'remove') {
          // 移入原生未启用区域，保留实例配置，方便在小工具编辑器中恢复。
          $areas['wp_inactive_widgets'] = array_merge((array) ($areas['wp_inactive_widgets'] ?? array()), array($widget_id));
        } else {
          $items = (array) ($areas[$area] ?? array());
          $at = $before !== '' ? array_search($before, $items, true) : count($items);
          array_splice($items, $at, 0, array($widget_id));
          $areas[$area] = $items;
        }
        wp_set_sidebars_widgets($areas);
      }
      return array_merge(NativeWidgets::data(), array('widget_id' => $widget_id, 'area_id' => $area));
    } finally {
      if (get_option($lock_key) === $lock) { delete_option($lock_key); }
    }
  }
}
