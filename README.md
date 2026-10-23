# Eva-Framework
一个现代化、模块化且易扩展的 WordPress 设置框架，用于快速构建插件和主题的后台配置界面。

## 手风琴字段

「字段 → 手风琴折叠」按功能提供 10 个独立示例，每个示例只开启对应功能，并附有操作说明。配置集中在 `includes/demo-accordion.php`，由 `demo-options.php` 加载。

字段的 `remember`、`toolbar`、`searchable`、`resettable`、`summary`、`dirty_mark` 默认开启，可分别设为 `false`。工具栏内的 `mode_switch` 和 `bulk_actions` 可分别关闭模式切换和批量展开按钮；设置 `default_open => false` 可从全部折叠开始。`multiple` 决定初始模式，工具栏允许用户切换；展开全部自动进入多开模式。搜索命中多个分组或多个分组校验失败时可临时多开，不覆盖浏览器保存的展开偏好。偏好按页面、设置容器和字段路径隔离；`storage_key` 可覆盖字段部分。

分组可增加以下配置：

```php
[
    'id'             => 'advanced',
    'title'          => '高级配置',
    'help'           => '通知邮箱在保存时校验，隐藏时保留已有值。',
    'visible_if'     => ['basic.advanced_mode', '==', true],
    'summary_fields' => ['notification_email'],
    'fields'         => [
        ['id' => 'notification_email', 'type' => 'text', 'title' => '通知邮箱',
         'input_type' => 'email', 'required' => true, 'default' => 'admin@example.com'],
    ],
]
```

`summary_switch` 可指定本组开关字段，在摘要中显示「已启用 / 未启用」；`summary_fields` 显示本组字段当前值及选项文案。帮助支持鼠标悬停和键盘焦点。分组恢复默认前显示范围说明，只重置当前组可编辑字段（含隐藏项），需要保存才会持久化。

保存时递归校验可见且可编辑的子字段，错误以 `accordion_id/panel_id/child_id` 返回。出错叶子回滚到原值，其它修改及排序正常保存；分组标题显示错误数并自动展开，优先定位当前设置页的错误。全局搜索和手风琴内搜索均可打开命中分组并高亮字段。

独立回归与预览位于主题目录外的 `work/accordion-check.php`、`work/accordion-check.js`，依次运行 `php work/accordion-check.php`、`node work/accordion-check.js`。预览复用实际演示 schema、组件及校验逻辑，不读取或写入 WordPress 数据库。

设置容器可通过 `embedded_options => ['other_option_id']` 将另一个容器的菜单、字段和已存值展示在同一外壳中。字段 ID 必须互不冲突，各容器沿用自己的权限与保存 schema；只向有修改的容器提交保存。Len 使用此配置将「字段展示」放在主题设置内，演示值继续保存在 `eva_demo`，不混入 `len_options`。旧展示页地址会跳转到主题设置。运行 `php work/showcase-check.php`、`node work/showcase-check.js` 可验证集成和保存隔离。
