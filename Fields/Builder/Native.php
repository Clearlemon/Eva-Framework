<?php

namespace Eva\Framework\Builder;

/**
 * WordPress 原生 Builder 模块的公共字段与可见性逻辑。
 */
class Native
{
  public static function fields()
  {
    return array(
      array('type' => 'subheading', 'content' => '模块设置'),
      array(
        'id'      => 'Module_Title',
        'type'    => 'text',
        'title'   => '模块标题',
        'default' => '',
      ),
      array(
        'id'      => 'Module_Intro',
        'type'    => 'textarea',
        'title'   => '模块描述',
        'default' => '',
      ),
      array('type' => 'subheading', 'content' => '模块可见性'),
      array(
        'id'         => 'Module_Visible',
        'type'       => 'button_set',
        'title'      => '设备可见性',
        'options'    => array(
          '1' => '仅 PC',
          '2' => '仅移动端',
          '3' => '隐藏',
          '4' => '全部设备',
        ),
        'full_width' => true,
        'default'    => '4',
      ),
      array(
        'id'         => 'Module_Visible_User',
        'type'       => 'select',
        'title'      => '可展示用户',
        'options'    => self::role_options(),
        'multiple'   => true,
        'searchable' => false,
        'default'    => array('all'),
      ),
    );
  }

  public static function defaults()
  {
    return array(
      'Module_Title'       => '',
      'Module_Intro'       => '',
      'Module_Visible'     => '4',
      'Module_Visible_User' => array('all'),
    );
  }

  public static function can_render($settings)
  {
    $visibility = (string) ($settings['Module_Visible'] ?? '4');
    if ($visibility === '1' && function_exists('wp_is_mobile') && wp_is_mobile()) {
      return false;
    }
    if ($visibility === '2' && function_exists('wp_is_mobile') && ! wp_is_mobile()) {
      return false;
    }
    if ($visibility === '3') {
      return false;
    }

    $allowed = (array) ($settings['Module_Visible_User'] ?? array('all'));
    $allowed = array_values(array_filter(array_map('sanitize_key', $allowed)));
    if (empty($allowed) || in_array('all', $allowed, true)) {
      return true;
    }

    $user  = function_exists('wp_get_current_user') ? wp_get_current_user() : null;
    $roles = $user ? array_map('sanitize_key', (array) $user->roles) : array();
    if (empty($roles)) {
      $roles = array('guest');
    }

    return (bool) array_intersect($roles, $allowed);
  }

  public static function frame($settings, $item, $module_class, $content)
  {
    $uid = sanitize_key((string) ($item['uid'] ?? ''));
    $id  = $uid !== '' ? ' id="eva-builder-native-' . esc_attr($uid) . '"' : '';

    $heading = '';
    $title   = trim((string) ($settings['Module_Title'] ?? ''));
    $intro   = trim((string) ($settings['Module_Intro'] ?? ''));
    if ($title !== '' || $intro !== '') {
      $heading = '<header class="module-head">';
      if ($title !== '') {
        $heading .= '<h2>' . esc_html($title) . '</h2>';
      }
      if ($intro !== '') {
        $heading .= '<div class="desc">' . wp_kses_post($intro) . '</div>';
      }
      $heading .= '</header>';
    }

    $class = sanitize_html_class($module_class, 'module-native');
    return '<section' . $id . ' class="home-item eva-builder-native-module ' . esc_attr($class) . '">'
      . '<div class="wrapper">' . $heading . $content . '</div>'
      . '</section>';
  }

  private static function role_options()
  {
    $options = array(
      'all'   => '所有用户',
      'guest' => '游客',
    );

    if (function_exists('wp_roles')) {
      foreach ((array) wp_roles()->roles as $role_key => $role) {
        if ($role_key === 'guest') {
          continue;
        }
        $label = isset($role['name']) ? $role['name'] : $role_key;
        $options[$role_key] = function_exists('translate_user_role')
          ? translate_user_role($label)
          : $label;
      }
    }

    return $options;
  }
}


