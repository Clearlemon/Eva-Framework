<?php

namespace Eva\Framework\Admin\Fields;

// 阻断对该文件的直接 HTTP 访问，必须经由 WordPress 加载。
if (! defined('ABSPATH')) {
    exit;
}

/**
 * theme_backup 字段的 PHP 处理器。
 *
 * 对应前端 `Fields/ThemeBackup/ThemeBackup.js`，由主题备份 REST 接口维护整站备份数据。
 * 这是操作型字段，本身不写入 options/meta。
 */
class Theme_Backup
{
    /**
     * @param mixed $value 原始字段值。
     * @param array $field 字段配置。
     * @return string
     */
    public static function sanitize($value, $field = [])
    {
        return '';
    }
}
