# Eva-Framework
一个现代化、模块化且易扩展的 WordPress 设置框架，用于快速构建插件和主题的后台配置界面。

独立安装并启用插件后，可在插件列表点击「设置」进入框架内置演示页，也可使用顶部工具栏的「Eva Framework」入口。主题实际设置页与演示页分别注册、分别保存。主题内嵌框架不自动加载演示。可通过 `eva_fw_demo_enabled` 过滤器关闭独立插件的默认演示，此时「设置」链接沿用已注册的实际设置容器。

## JavaScript 目录与职责

框架使用 Vue 3 全局构建，不需要打包工具。入口文件负责组合功能和挂载，不继续承载完整业务与大段模板：

- `Fields/Builder/Builder.js`：构建器入口；`assets/builder/` 按预览、组件拖放、字段编辑、小工具、历史和菜单职责拆分。
- `assets/eva-app.js`：后台外壳状态与挂载；`assets/app/` 管理外观、图标项目、指南、字段依赖、代码预览及设置保存。
- 各入口的 `template.js`：集中维护 Vue 模板，业务方法放在对应功能文件。
- `Eva::script_modules()`：统一声明功能文件及顺序；普通后台、嵌入表单和独立页共用清单，WordPress 入口通过 handle 依赖加载。

新增逻辑放进对应职责模块；模块通过参数显式接收配置与响应式对象，共享 Vue 状态使用原有 ref/reactive 引用，不复制快照代替响应式数据。事件、动画、请求和计时器由所属实例统一清理。保持已保存字段键、组件名、入口 handle 和预览消息协议兼容。

文件内部同样按职责组织具名函数：初始化和保存入口只编排流程，事件入口只分发操作，请求、响应处理、状态同步与清理各有独立方法，并用中文说明用途。回调只保留简短转发或映射，避免将完整业务塞进长 `setup`、事件函数或多层 Promise 回调。

函数体展开为多行，方法之间保留空行；Vue 字段继续按 `data / computed / mounted / beforeUnmount / watch / methods` 分组。较长模板按标签片段逐行排列并使用 `join('')` 连接，不额外改变模板的空白字符。构建器的生命周期入口调用各职责模块的注册、绑定、取消与释放方法；资源选择器的参数组装、网络请求、结果应用和多选操作各自独立。

## 异步请求规范

框架内置 Vue 字段统一复用本地 Axios 1.20.0 和 `window.EvaApi`；新调用使用 WordPress REST API，不直接请求 `admin-ajax.php`。接口地址由 `rest_url()` 生成，兼容子目录和普通固定链接。后台、独立设置页与嵌入式容器加载同一份 `eva-api` 依赖。

- `eva/v1/resources`：文章、分类、标签、用户、菜单和侧栏查询。
- `eva/v1/options`：按注册 schema 清洗并保存设置。
- `eva/v1/builder/history`、`builder/preview`：保存历史与未保存预览。
- `eva/v1/menus`、`menus/resources`、`menus/items`、`menus/assignment`：原生菜单读写。
- `eva/v1/widgets`、`widgets/assignment`：原生小工具读取与分配。
- `eva/v1/preferences/*`：个人外观及全站开关。
- `eva/v1/development/stamp`：仅开发模式注册的指纹接口。

同源 REST 请求统一携带 `X-WP-Nonce`。接口通过 schema 校验参数，按资源或设置容器的 capability 授权，成功直接返回数据，失败使用带 HTTP 状态码的 `WP_Error`。响应中的字段校验错误继续沿用保存层的逐字段回滚逻辑。客户端适配器保留旧组件内部的 `success/data` 结果形状，网络接口不增加 AJAX 包装。

媒体上传和编辑通过 `wp/v2/media`。Lentasy `theme_backup` 字段的写入使用 `eva/v1/integrations/lentasy/backups`，保留原主题的备份记录和自动任务；只有提供 `LF\Modules\Settings\Backups` 的主题可使用。备份文件恢复限定写入该主题自己的设置，不允许文件指定任意 option。地图第三方 REST 与图标 CSS 资源不携带本站 nonce。

旧 `wp_ajax_eva_fw_*` 入口作为第三方兼容层保留，与 REST 复用相同业务方法；内置字段已全部切到 REST。新增业务请直接注册 REST 接口，并复用 `EvaApi.action()` 或 `EvaApi.rest()`。

## 管理 / 设置菜单切换

设置容器配置 `management_menu` 后，Logo 右侧显示切换按钮。切换只替换侧栏菜单，当前内容、设置草稿和页签保持原样，并在当前标签页中记住所选模式。

```php
'management_menu' => [
    ['id' => 'cards', 'label' => '卡密管理', 'icon' => 'ri-key-2-line', 'url' => admin_url('admin.php?page=lf_card_manage')],
    ['id' => 'demo', 'label' => '授权管理示例', 'icon' => 'ri-shield-keyhole-line', 'section' => 'admin-demo'],
],
```

`url` 入口在新标签页打开；`section` 在当前 Eva 容器中打开已注册分区。`capability` 可设置单项权限，默认继承容器权限；`management_menu` 也可传入 callable，在输出页面时读取当前启用扩展等信息。没有可用管理菜单时隐藏按钮。

## 菜单分组样式

在原设置文件的父分区配置中使用 `menu_style`：`default`（默认）沿用原菜单；`heading` 将父分区显示为小号灰色标题，下方排列子菜单，不带父菜单图标和树状连接线。标题右侧箭头提示展开状态，点击或使用 Enter / 空格可折叠、展开。各分组可以混用，未填写时保持原样式。

默认样式统一排列在上方，标题分组统一排列在下方；同一样式内部保留原有排序和子菜单关系，显式菜单和合并展示的容器也遵守此顺序。

```php
\Eva::createSection('Leantasy', [
    'id' => 'Cms',
    'title' => 'Cms模块',
    'menu_style' => 'heading', // 改成 default 即恢复原样式。
]);
```

使用 `createOptions` 的显式 `menu` 数组时，也可在对应菜单项上设置 `menu_style`。标题分组首次默认展开，随后在当前标签页中记住各组的折叠状态；折叠侧栏时用父图标和悬浮子菜单，窄屏下按分组横向排列。

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
