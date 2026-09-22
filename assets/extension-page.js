(function () {
  'use strict';

  if (typeof Vue === 'undefined') { return; }

  var EXTENSION_SCRIPT_URL = (document.currentScript && document.currentScript.src) || (function () {
    var scripts = document.querySelectorAll('script[src*="extension-page.js"]');
    return scripts.length ? scripts[scripts.length - 1].src : '';
  })();
  function extensionAssetUrl(relativePath) {
    try { return new URL(relativePath, EXTENSION_SCRIPT_URL || window.location.href).href; }
    catch (error) { return relativePath; }
  }

  var ICONS = {
    LF_Cms: ['ri-layout-grid-line', 'blue'],
    LF_Forum: ['ri-discuss-line', 'violet'],
    LF_Leantasy_Cloud: ['ri-cloud-line', 'cyan'],
    LF_Optimization: ['ri-leaf-line', 'green'],
    LF_Pay: ['ri-bank-card-line', 'indigo'],
    LF_Test: ['ri-flask-line', 'teal'],
    LF_User: ['ri-user-3-line', 'blue'],
    LF_Widget: ['ri-tools-line', 'rose'],
    LF_Write: ['ri-edit-box-line', 'orange']
  };

  var MARKET_I18N = {
    "zh": {
      "ext_detail_all_versions": "查看所有版本",
      "ext_detail_anchor_notice": "已定位到对应文档章节",
      "ext_detail_auto_update": "自动更新",
      "ext_detail_back": "返回扩展列表",
      "ext_detail_backup": "备份数据",
      "ext_detail_backup_desc": "建议备份数据库和上传文件，防止数据丢失",
      "ext_detail_basic_config": "二、基础配置",
      "ext_detail_basic_info": "基本信息",
      "ext_detail_changelog": "更新日志",
      "ext_detail_changelog_file": "更新日志.md",
      "ext_detail_clear_cache": "清除缓存",
      "ext_detail_clear_cache_desc": "升级完成后，请清除系统缓存和浏览器缓存",
      "ext_detail_column": "栏目",
      "ext_detail_columns": "栏目",
      "ext_detail_comments": "评论",
      "ext_detail_common_ops": "四、常见操作",
      "ext_detail_compat": "兼容版本",
      "ext_detail_compat_check": "兼容性检查",
      "ext_detail_compat_check_desc": "确认当前系统版本满足兼容要求",
      "ext_detail_compat_notes": "兼容性说明",
      "ext_detail_compat_version": "兼容版本：Lentasy v2.0.0 及以上",
      "ext_detail_compatible_state": "兼容",
      "ext_detail_config_fields": "创建栏目并设置层级、封面、SEO 等信息。",
      "ext_detail_config_path": "进入【设置】→【内容设置】配置全局选项。",
      "ext_detail_config_types": "创建内容类型，定义字段与表单。",
      "ext_detail_contact_dev": "联系开发者",
      "ext_detail_content": "内容",
      "ext_detail_content_list": "内容列表",
      "ext_detail_copied": "内容已复制",
      "ext_detail_copy": "复制",
      "ext_detail_current_version": "当前版本",
      "ext_detail_dependencies": "依赖扩展",
      "ext_detail_directory": "目录导航",
      "ext_detail_downloads": "下载次数",
      "ext_detail_draft": "草稿",
      "ext_detail_edit": "编辑",
      "ext_detail_enable_status": "启用状态",
      "ext_detail_every_23_days": "平均 23 天 / 次",
      "ext_detail_example_batch": "批量发布",
      "ext_detail_example_batch_desc": "选择多篇草稿，批量设置状态为“已发布”。",
      "ext_detail_example_manage": "管理分类",
      "ext_detail_example_manage_desc": "在“栏目管理”中创建、编辑或调整栏目层级。",
      "ext_detail_example_new": "新建文章",
      "ext_detail_example_new_desc": "点击“新建内容”，选择栏目并填写内容。",
      "ext_detail_examples": "常见操作示例",
      "ext_detail_faq": "常见问题",
      "ext_detail_faq_1": "如何恢复误删的内容？",
      "ext_detail_faq_1_a": "可在回收站中恢复内容；若已彻底删除，请从最近的数据库备份恢复。",
      "ext_detail_faq_2": "定时发布的内容没有生效怎么办？",
      "ext_detail_faq_2_a": "请检查服务器时区、计划任务和内容状态是否正确。",
      "ext_detail_faq_3": "如何自定义内容列表字段？",
      "ext_detail_faq_3_a": "进入内容设置，在列表字段中添加、排序或隐藏字段后保存。",
      "ext_detail_faq_4": "支持多语言内容吗？",
      "ext_detail_faq_4_a": "支持，可配合系统语言和多语言扩展为不同语言维护独立内容。",
      "ext_detail_feature_category": "栏目与分类",
      "ext_detail_feature_category_desc": "灵活的栏目管理，支持多级分类与自定义排序",
      "ext_detail_feature_create": "内容创建与管理",
      "ext_detail_feature_create_desc": "支持图文、视频等多种内容类型的创建、编辑与管理",
      "ext_detail_feature_integrate": "扩展与集成",
      "ext_detail_feature_integrate_desc": "提供丰富的钩子与 API，便于与其他扩展集成",
      "ext_detail_feature_workflow": "内容发布与工作流",
      "ext_detail_feature_workflow_desc": "支持草稿、审核、定时发布等完整工作流",
      "ext_detail_features": "功能介绍",
      "ext_detail_fix": "修复",
      "ext_detail_flow_1": "新建内容",
      "ext_detail_flow_2": "填写标题、正文及扩展字段",
      "ext_detail_flow_3": "选择栏目与标签",
      "ext_detail_flow_4": "预览并检查内容",
      "ext_detail_flow_5": "发布或设为定时发布",
      "ext_detail_frequency": "更新频率",
      "ext_detail_guide": "使用说明",
      "ext_detail_guide_file": "使用文档.md",
      "ext_detail_installs": "安装量",
      "ext_detail_last_update": "最后更新",
      "ext_detail_latest": "最新版本",
      "ext_detail_license": "许可证",
      "ext_detail_log_batch": "支持内容批量移动栏目与批量设置标签",
      "ext_detail_log_draft": "修复部分情况下草稿保存失败的问题",
      "ext_detail_log_fields": "自定义字段支持条件显示规则",
      "ext_detail_log_import": "新增内容导入导出功能，支持批量操作",
      "ext_detail_log_intro": "持续改进，只为更好的内容管理体验。",
      "ext_detail_log_paging": "修复前台列表页分页不生效的问题",
      "ext_detail_log_paste": "修复内容编辑器粘贴图片时格式错乱的问题",
      "ext_detail_log_perf": "优化内容列表加载性能，提升大数据量下的响应速度",
      "ext_detail_log_permission": "优化权限校验逻辑，提升系统安全性",
      "ext_detail_log_search": "优化搜索索引结构，提升搜索准确性",
      "ext_detail_log_upload": "优化附件上传组件，支持断点续传",
      "ext_detail_major_only": "仅显示重大更新",
      "ext_detail_manage": "扩展管理",
      "ext_detail_module_intro": "一、模块简介",
      "ext_detail_module_intro_desc": "内容管理模块提供内容创建、编辑、管理和发布能力，支持多栏目、多标签、草稿箱、定时发布与评论管理。",
      "ext_detail_new": "新增",
      "ext_detail_new_content": "新建内容",
      "ext_detail_no_legacy": "不兼容低于 v2.0.0 的系统版本",
      "ext_detail_none": "无",
      "ext_detail_note_cache": "升级完成后请清除系统缓存",
      "ext_detail_note_plugins": "如启用了第三方扩展，请确认与新版本兼容",
      "ext_detail_note_support": "如遇问题，请查看使用说明或联系技术支持",
      "ext_detail_notes": "使用注意事项",
      "ext_detail_official": "官方",
      "ext_detail_on": "已开启",
      "ext_detail_op_archive": "归档：将内容归档，可随时恢复。",
      "ext_detail_op_copy": "复制：复制到草稿以便二次编辑。",
      "ext_detail_op_edit": "编辑：在内容列表点击“编辑”。",
      "ext_detail_op_move": "移动：批量选择后移动到其他栏目。",
      "ext_detail_open_settings": "打开设置",
      "ext_detail_operation": "操作",
      "ext_detail_optimize": "优化",
      "ext_detail_overview": "概览",
      "ext_detail_preview": "预览",
      "ext_detail_publish_flow": "三、发布流程",
      "ext_detail_publish_time": "发布时间",
      "ext_detail_published": "已发布",
      "ext_detail_quick_access": "快捷入口",
      "ext_detail_quick_start": "快速开始",
      "ext_detail_rating": "评分",
      "ext_detail_recent_updates": "最近更新",
      "ext_detail_rollback_tip": "如遇升级失败，可通过扩展管理的“回滚版本”功能恢复到上一版本。",
      "ext_detail_runtime": "运行状态",
      "ext_detail_save_tip": "提示：修改配置后请点击“保存并清除缓存”，以使设置生效。",
      "ext_detail_step_category": "配置栏目与标签",
      "ext_detail_step_category_desc": "创建栏目并管理标签，便于内容分类与检索。",
      "ext_detail_step_install": "安装并启用模块",
      "ext_detail_step_install_desc": "在扩展管理中安装模块，然后点击“启用”按钮。",
      "ext_detail_step_publish": "发布第一篇内容",
      "ext_detail_step_publish_desc": "新建内容并填写标题、正文，选择栏目后发布。",
      "ext_detail_step_type": "创建内容类型",
      "ext_detail_step_type_desc": "在设置中创建适合业务的内容类型。",
      "ext_detail_tags": "标签",
      "ext_detail_test_before_update": "建议在升级前，先在测试环境进行验证，确认无误后再更新到生产环境。",
      "ext_detail_times": "次",
      "ext_detail_tip_1": "推荐先阅读“基础配置”。",
      "ext_detail_tip_2": "发布前检查分类与权限设置。",
      "ext_detail_tip_3": "支持快捷键提高操作效率。",
      "ext_detail_tip_4": "可在设置中修改默认行为。",
      "ext_detail_tips": "使用提示",
      "ext_detail_title": "标题",
      "ext_detail_uninstall": "卸载",
      "ext_detail_uninstall_notice": "为避免误删数据，卸载操作需要在扩展设置中再次确认",
      "ext_detail_update": "更新",
      "ext_detail_update_1": "优化内容列表加载性能，提升大数据量下的响应速度",
      "ext_detail_update_2": "修复内容编辑器中图片上传偶发失败的问题",
      "ext_detail_update_3": "新增内容导入导出功能，支持批量操作",
      "ext_detail_update_checked": "已完成更新检查，当前扩展为最新版本",
      "ext_detail_upgrade_intro": "为确保升级过程顺利，建议在升级前完成以下操作：",
      "ext_detail_upgrade_notes": "升级说明",
      "ext_detail_version_history": "版本历史",
      "ext_detail_version_info": "版本信息",
      "ext_detail_versions_notice": "版本历史窗口即将开放",
      "ext_detail_view_docs": "查看文档",
      "ext_detail_view_log": "查看日志",
      "market_title": "扩展市场",
      "ext_grid_view": "卡片视图",
      "ext_list_view": "列表视图",
      "market_search_ph": "搜索扩展名称、关键词或描述…",
      "market_sort_default": "综合排序",
      "market_sort_rating": "评分优先",
      "market_sort_newest": "最新上架",
      "market_all_prices": "全部价格",
      "market_price_free": "免费",
      "market_price_paid": "付费",
      "market_no_notifications": "当前没有新的市场通知",
      "market_help": "帮助中心",
      "market_cat_security_opt": "安全与优化",
      "market_cat_dev_tools": "开发与工具",
      "market_cat_marketing": "营销推广",
      "market_more": "更多",
      "market_hero_title": "Lentasy 扩展生态，让无限想象成为现实",
      "market_hero_desc": "从内容管理到用户体验，丰富的扩展插件让您的网站更加强大",
      "market_explore": "探索扩展",
      "market_become_dev": "成为开发者",
      "market_benefit_safe": "安全可靠",
      "market_benefit_safe_desc": "严格审核机制",
      "market_benefit_quality": "优质扩展",
      "market_benefit_quality_desc": "精选优质扩展",
      "market_benefit_update": "持续更新",
      "market_benefit_update_desc": "紧跟最新版本",
      "market_benefit_support": "专业支持",
      "market_benefit_support_desc": "开发者技术支持",
      "market_benefit_open": "开源兼容",
      "market_benefit_open_desc": "标准接口兼容",
      "market_featured": "精选推荐",
      "market_latest": "最新上架",
      "market_hot_rank": "热门排行",
      "market_sale": "限时优惠",
      "market_filters": "筛选器",
      "market_price": "价格",
      "market_compat": "兼容版本",
      "market_all_versions": "全部版本",
      "market_apply": "筛选",
      "market_reset": "重置",
      "market_details": "查看详情",
      "market_install": "安装",
      "market_installed": "已安装",
      "market_buy_now": "立即购买",
      "market_local_found": "该扩展已安装，已为你定位到本地扩展",
      "market_api_pending": "市场页面已完成，远程安装与购买接口尚未接入",
      "market_preview_notice": "当前展示市场详情预览，远程详情接口尚未接入",
      "market_badge_hot": "热门",
      "market_badge_sale": "热促",
      "market_badge_new": "新品",
      "market_item_forms": "表单大师 2.0",
      "market_item_forms_desc": "更强大的表单构建与数据管理，支持可视化表单构建与智能分析。",
      "market_item_leaf": "Leaf 优化套件",
      "market_item_leaf_desc": "全面优化网站性能、资源加载与数据库，让网站更快更稳定。",
      "market_item_lottery": "社区签到 1.4",
      "market_item_lottery_desc": "互动签到、积分奖励与连续签到功能，提升用户活跃度。",
      "market_item_woo": "WooCommerce 集成",
      "market_item_woo_desc": "无缝集成 WooCommerce，扩展电商功能并优化购物体验。",
      "market_item_images": "图片增强器",
      "market_item_images_desc": "智能图片优化与懒加载，提升页面加载速度与用户体验。",
      "market_item_mail": "邮件模板管理",
      "market_item_mail_desc": "创建和管理自定义邮件模板，支持变量和条件逻辑。",
      "market_item_security": "安全防护增强",
      "market_item_security_desc": "增强网站安全防护，防止暴力破解、SQL 注入等攻击。",
      "market_item_analytics": "数据统计大师",
      "market_item_analytics_desc": "强大的数据统计与分析工具，帮助您更好地了解用户行为。",
      "market_item_devkit": "开发者工具集",
      "market_item_devkit_desc": "调试、接口测试与开发辅助工具，为扩展开发提供完整支持。",
      "market_item_cloud": "云端连接器",
      "market_item_cloud_desc": "连接 Lentasy 云端服务，同步资源、配置与扩展数据。"
    },
    "en": {
      "ext_detail_all_versions": "View all versions",
      "ext_detail_anchor_notice": "Jumped to the selected documentation section",
      "ext_detail_auto_update": "Automatic updates",
      "ext_detail_back": "Back to extensions",
      "ext_detail_backup": "Back up data",
      "ext_detail_backup_desc": "Back up the database and uploads to prevent data loss",
      "ext_detail_basic_config": "2. Basic configuration",
      "ext_detail_basic_info": "Basic Information",
      "ext_detail_changelog": "Changelog",
      "ext_detail_changelog_file": "CHANGELOG.md",
      "ext_detail_clear_cache": "Clear caches",
      "ext_detail_clear_cache_desc": "Clear system and browser caches after upgrading",
      "ext_detail_column": "Category",
      "ext_detail_columns": "Categories",
      "ext_detail_comments": "Comments",
      "ext_detail_common_ops": "4. Common operations",
      "ext_detail_compat": "Compatibility",
      "ext_detail_compat_check": "Compatibility check",
      "ext_detail_compat_check_desc": "Confirm that the current system meets the compatibility requirements",
      "ext_detail_compat_notes": "Compatibility notes",
      "ext_detail_compat_version": "Compatible with Lentasy v2.0.0 and later",
      "ext_detail_compatible_state": "Compatible",
      "ext_detail_config_fields": "Create categories and configure hierarchy, covers, and SEO.",
      "ext_detail_config_path": "Go to Settings → Content Settings to configure global options.",
      "ext_detail_config_types": "Create content types and define fields and forms.",
      "ext_detail_contact_dev": "Contact developer",
      "ext_detail_content": "Content",
      "ext_detail_content_list": "Content List",
      "ext_detail_copied": "Copied",
      "ext_detail_copy": "Copy",
      "ext_detail_current_version": "Current version",
      "ext_detail_dependencies": "Dependencies",
      "ext_detail_directory": "Contents",
      "ext_detail_downloads": "Downloads",
      "ext_detail_draft": "Draft",
      "ext_detail_edit": "Edit",
      "ext_detail_enable_status": "Enabled status",
      "ext_detail_every_23_days": "Every 23 days on average",
      "ext_detail_example_batch": "Batch publishing",
      "ext_detail_example_batch_desc": "Select drafts and publish them together.",
      "ext_detail_example_manage": "Manage categories",
      "ext_detail_example_manage_desc": "Create, edit, and reorder category levels.",
      "ext_detail_example_new": "Create an article",
      "ext_detail_example_new_desc": "Click New Content, choose a category, and enter the article.",
      "ext_detail_examples": "Common Examples",
      "ext_detail_faq": "FAQ",
      "ext_detail_faq_1": "How can I restore deleted content?",
      "ext_detail_faq_1_a": "Restore it from Trash, or use a recent database backup if it was permanently deleted.",
      "ext_detail_faq_2": "Why did scheduled content not publish?",
      "ext_detail_faq_2_a": "Check the server timezone, scheduled tasks, and content status.",
      "ext_detail_faq_3": "How do I customize list fields?",
      "ext_detail_faq_3_a": "Open Content Settings, add, reorder, or hide list fields, then save.",
      "ext_detail_faq_4": "Is multilingual content supported?",
      "ext_detail_faq_4_a": "Yes. System languages and multilingual extensions can maintain separate localized content.",
      "ext_detail_feature_category": "Categories & Taxonomy",
      "ext_detail_feature_category_desc": "Flexible category management with nested levels and custom ordering",
      "ext_detail_feature_create": "Content Creation & Management",
      "ext_detail_feature_create_desc": "Create, edit, and manage text, image, and video content",
      "ext_detail_feature_integrate": "Extensions & Integrations",
      "ext_detail_feature_integrate_desc": "Hooks and APIs make integration with other extensions easy",
      "ext_detail_feature_workflow": "Publishing Workflow",
      "ext_detail_feature_workflow_desc": "Draft, review, scheduled publishing, and complete workflows",
      "ext_detail_features": "Features",
      "ext_detail_fix": "Fixed",
      "ext_detail_flow_1": "Create new content",
      "ext_detail_flow_2": "Enter title, body, and custom fields",
      "ext_detail_flow_3": "Choose categories and tags",
      "ext_detail_flow_4": "Preview and review content",
      "ext_detail_flow_5": "Publish now or schedule publication",
      "ext_detail_frequency": "Update frequency",
      "ext_detail_guide": "User Guide",
      "ext_detail_guide_file": "USER-GUIDE.md",
      "ext_detail_installs": "Installs",
      "ext_detail_last_update": "Last updated",
      "ext_detail_latest": "Latest",
      "ext_detail_license": "License",
      "ext_detail_log_batch": "Added batch category moves and tag assignment",
      "ext_detail_log_draft": "Fixed draft saving failures in some cases",
      "ext_detail_log_fields": "Conditional display rules for custom fields",
      "ext_detail_log_import": "Added content import and export with batch operations",
      "ext_detail_log_intro": "Continuous improvement for a better content management experience.",
      "ext_detail_log_paging": "Fixed pagination on front-end content lists",
      "ext_detail_log_paste": "Fixed formatting issues when pasting images into the editor",
      "ext_detail_log_perf": "Improved content-list performance for large data sets",
      "ext_detail_log_permission": "Improved permission checks and system security",
      "ext_detail_log_search": "Improved search indexing and accuracy",
      "ext_detail_log_upload": "Improved uploads with resumable transfer support",
      "ext_detail_major_only": "Major updates only",
      "ext_detail_manage": "Extension Management",
      "ext_detail_module_intro": "1. Module overview",
      "ext_detail_module_intro_desc": "The content module provides creation, editing, management, and publishing with categories, tags, drafts, scheduling, and comments.",
      "ext_detail_new": "Added",
      "ext_detail_new_content": "New Content",
      "ext_detail_no_legacy": "Versions earlier than v2.0.0 are not supported",
      "ext_detail_none": "None",
      "ext_detail_note_cache": "Clear the system cache after upgrading",
      "ext_detail_note_plugins": "Confirm third-party extensions are compatible with the new version",
      "ext_detail_note_support": "See the guide or contact support if you encounter a problem",
      "ext_detail_notes": "Usage notes",
      "ext_detail_official": "Official",
      "ext_detail_on": "On",
      "ext_detail_op_archive": "Archive: archive content and restore it later.",
      "ext_detail_op_copy": "Copy: duplicate content to a draft.",
      "ext_detail_op_edit": "Edit: click Edit in the content list.",
      "ext_detail_op_move": "Move: select items and move them to another category.",
      "ext_detail_open_settings": "Open Settings",
      "ext_detail_operation": "Actions",
      "ext_detail_optimize": "Improved",
      "ext_detail_overview": "Overview",
      "ext_detail_preview": "Preview",
      "ext_detail_publish_flow": "3. Publishing workflow",
      "ext_detail_publish_time": "Published at",
      "ext_detail_published": "Published",
      "ext_detail_quick_access": "Quick Access",
      "ext_detail_quick_start": "Quick Start",
      "ext_detail_rating": "Rating",
      "ext_detail_recent_updates": "Recent Updates",
      "ext_detail_rollback_tip": "If an upgrade fails, use Roll Back Version in Extension Management to restore the previous version.",
      "ext_detail_runtime": "Runtime Status",
      "ext_detail_save_tip": "Tip: after changing settings, save and clear the cache for them to take effect.",
      "ext_detail_step_category": "Configure Categories & Tags",
      "ext_detail_step_category_desc": "Create categories and tags for organization and search.",
      "ext_detail_step_install": "Install and Enable",
      "ext_detail_step_install_desc": "Install the module in Extension Management, then click Enable.",
      "ext_detail_step_publish": "Publish the First Article",
      "ext_detail_step_publish_desc": "Create content, enter a title and body, select a category, and publish.",
      "ext_detail_step_type": "Create a Content Type",
      "ext_detail_step_type_desc": "Create a content type that fits your workflow.",
      "ext_detail_tags": "Tags",
      "ext_detail_test_before_update": "Validate the upgrade in a test environment before updating production.",
      "ext_detail_times": "times",
      "ext_detail_tip_1": "Read Basic Configuration first.",
      "ext_detail_tip_2": "Check category and permission settings before publishing.",
      "ext_detail_tip_3": "Keyboard shortcuts can speed up common work.",
      "ext_detail_tip_4": "Default behavior can be changed in Settings.",
      "ext_detail_tips": "Tips",
      "ext_detail_title": "Title",
      "ext_detail_uninstall": "Uninstall",
      "ext_detail_uninstall_notice": "To prevent accidental data loss, confirm uninstalling again in extension settings",
      "ext_detail_update": "Update",
      "ext_detail_update_1": "Improved content-list performance for large data sets",
      "ext_detail_update_2": "Fixed occasional image upload failures in the editor",
      "ext_detail_update_3": "Added content import and export with batch operations",
      "ext_detail_update_checked": "Update check complete. This extension is up to date.",
      "ext_detail_upgrade_intro": "Complete the following steps before upgrading:",
      "ext_detail_upgrade_notes": "Upgrade Notes",
      "ext_detail_version_history": "Version History",
      "ext_detail_version_info": "Version Information",
      "ext_detail_versions_notice": "The full version history is coming soon",
      "ext_detail_view_docs": "View Docs",
      "ext_detail_view_log": "View Log",
      "market_title": "Extension Market",
      "ext_grid_view": "Grid view",
      "ext_list_view": "List view",
      "market_search_ph": "Search extensions, keywords, or descriptions…",
      "market_sort_default": "Best match",
      "market_sort_rating": "Top rated",
      "market_sort_newest": "Newest",
      "market_all_prices": "All prices",
      "market_price_free": "Free",
      "market_price_paid": "Paid",
      "market_no_notifications": "No new market notifications",
      "market_help": "Help Center",
      "market_cat_security_opt": "Security & Optimization",
      "market_cat_dev_tools": "Development & Tools",
      "market_cat_marketing": "Marketing",
      "market_more": "More",
      "market_hero_title": "The Lentasy extension ecosystem turns ideas into reality",
      "market_hero_desc": "From content management to user experience, rich extensions make your site more powerful.",
      "market_explore": "Explore Extensions",
      "market_become_dev": "Become a Developer",
      "market_benefit_safe": "Safe & Reliable",
      "market_benefit_safe_desc": "Strict review process",
      "market_benefit_quality": "Quality Extensions",
      "market_benefit_quality_desc": "Carefully curated",
      "market_benefit_update": "Continuous Updates",
      "market_benefit_update_desc": "Ready for new versions",
      "market_benefit_support": "Professional Support",
      "market_benefit_support_desc": "Developer support",
      "market_benefit_open": "Open Compatibility",
      "market_benefit_open_desc": "Standard APIs",
      "market_featured": "Featured",
      "market_latest": "Latest Releases",
      "market_hot_rank": "Popular Ranking",
      "market_sale": "Limited Offer",
      "market_filters": "Filters",
      "market_price": "Price",
      "market_compat": "Compatible Version",
      "market_all_versions": "All versions",
      "market_apply": "Apply",
      "market_reset": "Reset",
      "market_details": "Details",
      "market_install": "Install",
      "market_installed": "Installed",
      "market_buy_now": "Buy Now",
      "market_local_found": "This extension is installed; the local module has been highlighted.",
      "market_api_pending": "The market interface is ready; remote install and purchase APIs are not connected yet.",
      "market_preview_notice": "This is a market detail preview; the remote detail API is not connected yet.",
      "market_badge_hot": "HOT",
      "market_badge_sale": "SALE",
      "market_badge_new": "NEW",
      "market_item_forms": "Form Master 2.0",
      "market_item_forms_desc": "Advanced form building and data management with visual design and smart analytics.",
      "market_item_leaf": "Leaf Optimization Suite",
      "market_item_leaf_desc": "Optimize performance, resource loading, and the database for a faster, steadier site.",
      "market_item_lottery": "Community Check-in 1.4",
      "market_item_lottery_desc": "Interactive check-ins, points, rewards, and streaks that improve engagement.",
      "market_item_woo": "WooCommerce Integration",
      "market_item_woo_desc": "Seamlessly integrate WooCommerce and improve the complete shopping experience.",
      "market_item_images": "Image Enhancer",
      "market_item_images_desc": "Smart image optimization and lazy loading for faster pages and a better experience.",
      "market_item_mail": "Email Template Manager",
      "market_item_mail_desc": "Create and manage custom email templates with variables and conditional logic.",
      "market_item_security": "Security Protection Plus",
      "market_item_security_desc": "Protect against brute force, SQL injection, and other common website attacks.",
      "market_item_analytics": "Analytics Master",
      "market_item_analytics_desc": "Powerful reporting and analytics that help you understand user behavior.",
      "market_item_devkit": "Developer Toolkit",
      "market_item_devkit_desc": "Debugging, API testing, and development helpers for extension authors.",
      "market_item_cloud": "Cloud Connector",
      "market_item_cloud_desc": "Connect to Lentasy cloud services and synchronize resources and configuration."
    },
    "ja": {
      "market_title": "拡張マーケット",
      "ext_grid_view": "グリッド表示",
      "ext_list_view": "リスト表示",
      "market_search_ph": "拡張名、キーワード、説明を検索…",
      "market_sort_default": "総合順",
      "market_sort_rating": "評価順",
      "market_sort_newest": "新着順",
      "market_all_prices": "すべての価格",
      "market_price_free": "無料",
      "market_price_paid": "有料",
      "market_no_notifications": "新しいマーケット通知はありません",
      "market_help": "ヘルプセンター",
      "market_cat_security_opt": "セキュリティと最適化",
      "market_cat_dev_tools": "開発とツール",
      "market_cat_marketing": "マーケティング",
      "market_more": "その他",
      "market_hero_title": "Lentasy 拡張エコシステムでアイデアを現実に",
      "market_hero_desc": "コンテンツ管理からユーザー体験まで、豊富な拡張機能でサイトを強化します。",
      "market_explore": "拡張を探す",
      "market_become_dev": "開発者になる",
      "market_benefit_safe": "安全・信頼",
      "market_benefit_safe_desc": "厳格な審査",
      "market_benefit_quality": "高品質",
      "market_benefit_quality_desc": "厳選された拡張",
      "market_benefit_update": "継続更新",
      "market_benefit_update_desc": "最新バージョン対応",
      "market_benefit_support": "専門サポート",
      "market_benefit_support_desc": "開発者サポート",
      "market_benefit_open": "高い互換性",
      "market_benefit_open_desc": "標準 API 対応",
      "market_featured": "おすすめ",
      "market_latest": "新着拡張",
      "market_hot_rank": "人気ランキング",
      "market_sale": "期間限定",
      "market_filters": "フィルター",
      "market_price": "価格",
      "market_compat": "対応バージョン",
      "market_all_versions": "すべてのバージョン",
      "market_apply": "適用",
      "market_reset": "リセット",
      "market_details": "詳細",
      "market_install": "インストール",
      "market_installed": "インストール済み",
      "market_buy_now": "今すぐ購入",
      "market_local_found": "この拡張はインストール済みです。ローカル拡張を表示しました。",
      "market_api_pending": "マーケット画面は完成していますが、リモートインストール・購入 API は未接続です。",
      "market_preview_notice": "マーケット詳細のプレビューです。リモート詳細 API は未接続です。",
      "market_badge_hot": "人気",
      "market_badge_sale": "セール",
      "market_badge_new": "新着",
      "market_item_forms": "フォームマスター 2.0",
      "market_item_forms_desc": "ビジュアル作成と分析に対応した高度なフォーム・データ管理。",
      "market_item_leaf": "Leaf 最適化スイート",
      "market_item_leaf_desc": "性能、リソース、データベースを最適化してサイトを高速化します。",
      "market_item_lottery": "コミュニティチェックイン 1.4",
      "market_item_lottery_desc": "チェックイン、ポイント、連続記録でユーザー参加を促進します。",
      "market_item_woo": "WooCommerce 連携",
      "market_item_woo_desc": "WooCommerce をシームレスに統合し購入体験を向上します。",
      "market_item_images": "画像エンハンサー",
      "market_item_images_desc": "画像最適化と遅延読み込みでページ表示を高速化します。",
      "market_item_mail": "メールテンプレート管理",
      "market_item_mail_desc": "変数や条件ロジックに対応したメールテンプレート管理。",
      "market_item_security": "セキュリティ強化",
      "market_item_security_desc": "総当たり攻撃や SQL インジェクションなどから保護します。",
      "market_item_analytics": "データ分析マスター",
      "market_item_analytics_desc": "強力なレポートと分析でユーザー行動を把握します。",
      "market_item_devkit": "開発者ツールキット",
      "market_item_devkit_desc": "デバッグ、API テスト、拡張開発を支援します。",
      "market_item_cloud": "クラウドコネクター",
      "market_item_cloud_desc": "Lentasy クラウドに接続しリソースと設定を同期します。"
    },
    "ko": {
      "market_title": "확장 마켓",
      "ext_grid_view": "그리드 보기",
      "ext_list_view": "목록 보기",
      "market_search_ph": "확장 이름, 키워드 또는 설명 검색…",
      "market_sort_default": "종합 정렬",
      "market_sort_rating": "평점순",
      "market_sort_newest": "최신순",
      "market_all_prices": "전체 가격",
      "market_price_free": "무료",
      "market_price_paid": "유료",
      "market_no_notifications": "새로운 마켓 알림이 없습니다",
      "market_help": "도움말 센터",
      "market_cat_security_opt": "보안 및 최적화",
      "market_cat_dev_tools": "개발 및 도구",
      "market_cat_marketing": "마케팅",
      "market_more": "더보기",
      "market_hero_title": "Lentasy 확장 생태계로 아이디어를 현실로",
      "market_hero_desc": "콘텐츠 관리부터 사용자 경험까지 다양한 확장으로 사이트를 강화하세요.",
      "market_explore": "확장 탐색",
      "market_become_dev": "개발자 참여",
      "market_benefit_safe": "안전하고 신뢰성 높음",
      "market_benefit_safe_desc": "엄격한 검토 절차",
      "market_benefit_quality": "고품질 확장",
      "market_benefit_quality_desc": "엄선된 확장",
      "market_benefit_update": "지속 업데이트",
      "market_benefit_update_desc": "최신 버전 지원",
      "market_benefit_support": "전문 지원",
      "market_benefit_support_desc": "개발자 기술 지원",
      "market_benefit_open": "개방형 호환",
      "market_benefit_open_desc": "표준 API 지원",
      "market_featured": "추천 확장",
      "market_latest": "최신 등록",
      "market_hot_rank": "인기 순위",
      "market_sale": "한정 할인",
      "market_filters": "필터",
      "market_price": "가격",
      "market_compat": "호환 버전",
      "market_all_versions": "전체 버전",
      "market_apply": "적용",
      "market_reset": "초기화",
      "market_details": "상세 보기",
      "market_install": "설치",
      "market_installed": "설치됨",
      "market_buy_now": "지금 구매",
      "market_local_found": "이미 설치된 확장입니다. 로컬 확장으로 이동했습니다.",
      "market_api_pending": "마켓 화면은 완료되었지만 원격 설치 및 구매 API는 아직 연결되지 않았습니다.",
      "market_preview_notice": "마켓 상세 미리보기입니다. 원격 상세 API는 아직 연결되지 않았습니다.",
      "market_badge_hot": "인기",
      "market_badge_sale": "할인",
      "market_badge_new": "신규",
      "market_item_forms": "폼 마스터 2.0",
      "market_item_forms_desc": "시각적 제작과 스마트 분석을 지원하는 고급 폼 및 데이터 관리.",
      "market_item_leaf": "Leaf 최적화 도구",
      "market_item_leaf_desc": "성능, 리소스 로딩 및 데이터베이스를 최적화합니다.",
      "market_item_lottery": "커뮤니티 출석 1.4",
      "market_item_lottery_desc": "출석, 포인트, 연속 보상으로 사용자 참여를 높입니다.",
      "market_item_woo": "WooCommerce 통합",
      "market_item_woo_desc": "WooCommerce를 자연스럽게 통합하고 쇼핑 경험을 개선합니다.",
      "market_item_images": "이미지 향상 도구",
      "market_item_images_desc": "이미지 최적화와 지연 로딩으로 페이지 속도를 높입니다.",
      "market_item_mail": "메일 템플릿 관리",
      "market_item_mail_desc": "변수와 조건 로직을 지원하는 맞춤 메일 템플릿 관리.",
      "market_item_security": "보안 보호 강화",
      "market_item_security_desc": "무차별 대입, SQL 인젝션 등 일반적인 공격을 차단합니다.",
      "market_item_analytics": "데이터 분석 마스터",
      "market_item_analytics_desc": "강력한 보고서와 분석으로 사용자 행동을 이해합니다.",
      "market_item_devkit": "개발자 도구 모음",
      "market_item_devkit_desc": "디버깅, API 테스트 및 확장 개발 도구를 제공합니다.",
      "market_item_cloud": "클라우드 커넥터",
      "market_item_cloud_desc": "Lentasy 클라우드에 연결해 리소스와 설정을 동기화합니다."
    }
  };

  var TEMPLATE = `
    <div class="eva-ext" :class="{'is-loading': loading}">
      <transition name="eva-ext-toast"><div v-if="toast.text" class="eva-ext-toast" :class="'is-' + toast.type"><i :class="toastIcon"></i><span>{{ toast.text }}</span></div></transition>

      <template v-if="pageMode === 'overview'">
      <div v-if="!detail" class="eva-ext-toolbar">
        <div class="eva-ext-sort"><span>{{ t('ext_sort') }}</span><eva-select v-model="sortBy" :options="sortOptions" :searchable="false"></eva-select></div>
        <div class="eva-ext-search"><i class="ri-search-line"></i><input v-model.trim="query" :placeholder="t('ext_search_ph')" @keyup.enter="activeFilter='all'"><button type="button">{{ t('ext_search') }}</button></div>
        <button type="button" class="eva-ext-market-btn" @click="openMarket"><i class="ri-shopping-cart-2-line"></i>{{ t('ext_market') }}</button>
      </div>

      <div class="eva-ext-shell" :class="{'is-detail': detail}">
        <aside class="eva-ext-left">
          <nav class="eva-ext-side-card eva-ext-nav">
            <button v-for="item in navItems" :key="item.id" type="button" :class="{'is-active': activeNav === item.id}" @click="selectNav(item.id)"><i :class="item.icon"></i><span>{{ item.label }}</span><em v-if="item.count">{{ item.count }}</em></button>
          </nav>
          <section class="eva-market-developer">
            <strong>{{ t('ext_become_dev') }}</strong><p>{{ t('ext_dev_desc') }}</p><button type="button" @click="openDocs">{{ t('ext_learn_more') }}</button>
          </section>
        </aside>

        <template v-if="!detail">
        <main class="eva-ext-main">
          <section ref="installedSection" class="eva-ext-installed">
            <div class="eva-ext-installed-head"><div><h2>{{ t('ext_installed') }} <span>({{ filtered.length }})</span></h2><p v-if="query || category !== 'all'">{{ t('ext_filtered_from') }} {{ extensions.length }} {{ t('ext_items') }}</p></div><div><button type="button" class="eva-ext-compact-btn" @click="bulkNotice"><i class="ri-stack-line"></i>{{ t('ext_bulk') }}</button><button type="button" class="eva-ext-view" :class="{'is-active': viewMode === 'grid'}" :aria-label="t('ext_grid_view')" :title="t('ext_grid_view')" :aria-pressed="viewMode === 'grid'" @click="viewMode='grid'"><i class="ri-layout-grid-line"></i></button><button type="button" class="eva-ext-view" :class="{'is-active': viewMode === 'list'}" :aria-label="t('ext_list_view')" :title="t('ext_list_view')" :aria-pressed="viewMode === 'list'" @click="viewMode='list'"><i class="ri-list-check"></i></button></div></div>

            <div v-if="loading && !extensions.length" class="eva-ext-loading"><i class="ri-loader-4-line"></i><span>{{ t('ext_loading') }}</span></div>
            <div v-else-if="error" class="eva-ext-empty is-error"><i class="ri-error-warning-line"></i><strong>{{ t('ext_load_failed') }}</strong><p>{{ error }}</p><button type="button" @click="loadExtensions">{{ t('ext_retry') }}</button></div>
            <div v-else-if="!filtered.length" class="eva-ext-empty"><i class="ri-inbox-2-line"></i><strong>{{ t('ext_no_results') }}</strong><p>{{ t('ext_no_results_desc') }}</p><button type="button" @click="clearFilters">{{ t('ext_clear_filters') }}</button></div>
            <div v-else class="eva-ext-card-grid" :class="{'is-list': viewMode === 'list'}">
              <article v-for="ext in paged" :key="ext.slug" class="eva-ext-card" :data-slug="ext.slug" :class="{'is-processing': ext.processing}">
                <div class="eva-ext-card-top">
                  <div class="eva-ext-card-icon" :class="'is-' + moduleVisual(ext)[1]"><img v-if="ext.thumbnail && !ext.thumbnailError" :src="ext.thumbnail" :alt="ext.name" @error="ext.thumbnailError=true"><i v-else :class="moduleVisual(ext)[0]"></i></div>
                  <div class="eva-ext-card-copy"><div><h3>{{ ext.name || ext.slug }}</h3><span class="eva-ext-state" :class="ext.enabled ? 'is-enabled' : 'is-disabled'">{{ ext.enabled ? t('ext_enabled') : t('ext_disabled') }}</span><span v-if="ext.status && ext.status.type !== 'ok'" class="eva-ext-state is-warning">{{ t('ext_attention') }}</span></div><p>{{ ext.desc || t('ext_no_description') }}</p></div>
                </div>
                <div class="eva-ext-card-meta"><span>v{{ moduleVersion(ext) }}</span><span>{{ t('ext_compatible') }}</span><span>{{ moduleAuthor(ext) }}</span></div>
                <div class="eva-ext-card-actions">
                  <button type="button" :disabled="ext.processing" :class="ext.enabled ? 'is-danger' : 'is-enable'" @click="toggleExtension(ext)"><i :class="ext.processing ? 'ri-loader-4-line is-spin' : (ext.enabled ? 'ri-stop-circle-line' : 'ri-play-circle-line')"></i>{{ ext.enabled ? t('ext_disable') : t('ext_enable') }}</button>
                  <button v-if="ext.enabled" type="button" @click="settingsNotice(ext)"><i class="ri-settings-3-line"></i>{{ t('ext_settings') }}</button>
                  <button type="button" @click="showDetail(ext)">{{ t('ext_details') }}</button>
                  <button type="button" class="eva-ext-more" @click="showDetail(ext)"><i class="ri-more-line"></i></button>
                </div>
              </article>
            </div>
            <button v-if="filtered.length > pageSize" type="button" class="eva-ext-show-all" @click="pageSize = filtered.length">{{ t('ext_show_all_installed') }} ({{ filtered.length }})<i class="ri-arrow-right-line"></i></button>
          </section>

          <section class="eva-ext-bottom-grid">
            <article><header><h3>{{ t('ext_attention_list') }} <span>({{ attentionModules.length }})</span></h3><button @click="activeFilter='attention'">{{ t('ext_view_all') }}</button></header><div v-if="attentionModules.length" class="eva-ext-mini-list"><div v-for="ext in attentionModules.slice(0,5)" :key="ext.slug"><i :class="moduleVisual(ext)[0]"></i><span><strong>{{ ext.name }}</strong><small>{{ t('ext_dependency_attention') }}</small></span><button @click="showDetail(ext)">{{ t('ext_check') }}</button></div></div><div v-else class="eva-ext-mini-empty"><i class="ri-checkbox-circle-line"></i>{{ t('ext_all_healthy') }}</div></article>
            <article><header><h3>{{ t('ext_recent_updates') }}</h3><button @click="loadExtensions">{{ t('ext_refresh') }}</button></header><div class="eva-ext-mini-list"><div v-for="ext in recentModules" :key="ext.slug"><i :class="moduleVisual(ext)[0]"></i><span><strong>{{ ext.name }}</strong><small>v{{ moduleVersion(ext) }} · {{ moduleDate(ext) }}</small></span><em>{{ t('ext_system') }}</em></div></div></article>
            <article><header><h3>{{ t('ext_install_log') }}</h3><button @click="logNotice">{{ t('ext_full_log') }}</button></header><div class="eva-ext-log-list"><div><i class="ri-checkbox-circle-fill"></i><span>{{ t('ext_log_loaded') }} {{ extensions.length }} {{ t('ext_modules') }}</span><time>{{ loadTime }}</time></div><div><i class="ri-shield-check-fill"></i><span>{{ t('ext_log_permissions') }}</span><time>{{ t('ext_just_now') }}</time></div><div><i class="ri-refresh-line"></i><span>{{ t('ext_log_status') }}</span><time>{{ t('ext_just_now') }}</time></div></div></article>
          </section>

          <footer class="eva-ext-pagination"><span>{{ t('ext_total') }} {{ filtered.length }} {{ t('ext_items') }}</span><div><button :disabled="page<=1" @click="page--"><i class="ri-arrow-left-s-line"></i></button><button v-for="n in pageCount" :key="n" :class="{'is-active': page===n}" @click="page=n">{{ n }}</button><button :disabled="page>=pageCount" @click="page++"><i class="ri-arrow-right-s-line"></i></button></div><label class="eva-ext-page-size"><span>{{ t('ext_per_page') }}</span><eva-select v-model="pageSize" :options="pageSizeOptions" :searchable="false"></eva-select><span>{{ t('ext_items') }}</span></label></footer>
        </main>

        <aside class="eva-ext-right">
          <div class="eva-ext-right-actions">
            <button type="button" class="eva-ext-link-btn" @click="openDocs"><i class="ri-book-open-line"></i>{{ t('ext_docs') }}</button>
            <button type="button" class="eva-ext-link-btn" :disabled="loading" @click="loadExtensions"><i class="ri-refresh-line" :class="{'is-spin': loading}"></i>{{ t('ext_check_updates') }}</button>
            <button type="button" class="eva-ext-btn is-primary" @click="chooseUpload"><i class="ri-add-line"></i>{{ t('ext_add') }}</button>
            <input ref="uploadInput" class="eva-ext-file" type="file" accept=".zip,application/zip" @change="uploadExtension">
          </div>
          <section class="eva-ext-right-card eva-ext-overview"><header><h3>{{ t('ext_overview') }}</h3><button @click="loadExtensions">{{ t('ext_refresh') }}</button></header><div><span><strong>{{ extensions.length }}</strong><small>{{ t('ext_installed_short') }}</small></span><span><strong class="is-green">{{ enabledCount }}</strong><small>{{ t('ext_enabled_short') }}</small></span><span><strong class="is-orange">{{ attentionModules.length }}</strong><small>{{ t('ext_attention_short') }}</small></span></div></section>
        </aside>
        </template>

        <main v-else class="eva-ext-detail-page">
          <section class="eva-ext-detail-head">
            <div class="eva-ext-detail-title-row">
              <div class="eva-ext-detail-title-copy"><button type="button" class="eva-ext-detail-back" @click="closeDetail" :aria-label="t('ext_detail_back')"><i class="ri-arrow-left-line"></i></button><div><div class="eva-ext-detail-title-line"><h1>{{ detail.name || detail.slug }}</h1><span class="eva-ext-detail-badge is-success">{{ detail.enabled ? t('ext_enabled') : t('ext_disabled') }}</span><span class="eva-ext-detail-badge is-primary">{{ t('ext_detail_official') }}</span><span class="eva-ext-detail-badge">v{{ moduleVersion(detail) }}</span></div><p>{{ detail.desc || t('ext_no_description') }}</p></div></div>
              <div class="eva-ext-detail-actions"><button type="button" :disabled="detail.processing" @click="toggleExtension(detail)"><i :class="detail.processing ? 'ri-loader-4-line is-spin' : 'ri-shut-down-line'"></i>{{ detail.enabled ? t('ext_disable') : t('ext_enable') }}</button><button type="button" class="is-primary-outline" @click="detailActionNotice('update')"><i class="ri-refresh-line"></i>{{ t('ext_detail_update') }}</button><button type="button" @click="settingsNotice(detail)"><i class="ri-settings-3-line"></i>{{ t('ext_settings') }}</button><button type="button" class="is-danger" @click="detailActionNotice('uninstall')"><i class="ri-delete-bin-6-line"></i>{{ t('ext_detail_uninstall') }}</button></div>
            </div>
          </section>

          <section class="eva-ext-detail-hero">
            <article class="eva-ext-detail-profile">
              <div class="eva-ext-detail-logo" :class="'is-' + moduleVisual(detail)[1]"><img v-if="detail.thumbnail && !detail.thumbnailError" :src="detail.thumbnail" :alt="detail.name" @error="detail.thumbnailError=true"><i v-else :class="moduleVisual(detail)[0]"></i></div>
              <dl><div><dt>{{ t('ext_version') }}</dt><dd>v{{ moduleVersion(detail) }}</dd></div><div><dt>{{ t('ext_author') }}</dt><dd>{{ moduleAuthor(detail) }} <i class="ri-checkbox-circle-fill"></i></dd></div><div><dt>{{ t('ext_detail_compat') }}</dt><dd>Lentasy v2.0.0+</dd></div><div><dt>{{ t('ext_detail_last_update') }}</dt><dd>{{ moduleDate(detail) }}</dd></div><div><dt>{{ t('ext_detail_rating') }}</dt><dd class="eva-ext-detail-stars"><span>★★★★<em>★</em></span> 4.5 (128)</dd></div><div><dt>{{ t('ext_detail_installs') }}</dt><dd>2,845 {{ t('ext_detail_times') }}</dd></div></dl>
            </article>
            <article class="eva-ext-detail-preview" aria-label="CMS preview" @mouseenter="stopPreviewAutoplay" @mouseleave="startPreviewAutoplay" @focusin="stopPreviewAutoplay" @focusout="startPreviewAutoplay">
              <div class="eva-ext-detail-preview-bar"><strong><i :class="moduleVisual(detail)[0]"></i>{{ detail.name || detail.slug }}</strong><span><i></i><i></i><i></i></span></div>
              <div class="eva-ext-detail-preview-viewport">
                <div class="eva-ext-detail-preview-track" :style="{transform:'translate3d(-' + (previewSlide * 100) + '%,0,0)'}">
                  <section v-for="(image, index) in previewImages" :key="'preview-image-' + index" class="eva-ext-detail-preview-slide is-image">
                    <img :src="image" :alt="t('ext_detail_preview') + ' ' + (index + 1)" loading="eager" decoding="async" draggable="false">
                  </section>
                </div>
                <button type="button" class="eva-ext-detail-preview-arrow is-prev" :aria-label="t('ext_detail_preview') + ' 1'" @click.stop="changePreviewSlide(-1)"><i class="ri-arrow-left-s-line"></i></button>
                <button type="button" class="eva-ext-detail-preview-arrow is-next" :aria-label="t('ext_detail_preview') + ' 2'" @click.stop="changePreviewSlide(1)"><i class="ri-arrow-right-s-line"></i></button>
                <div class="eva-ext-detail-preview-dots"><button v-for="n in 3" :key="'slide-dot-'+n" type="button" :class="{'is-active':previewSlide===n-1}" :aria-label="t('ext_detail_preview') + ' ' + n" @click.stop="setPreviewSlide(n-1)"></button></div>
              </div>
            </article>
          </section>

          <nav class="eva-ext-detail-tabs">
            <button type="button" :class="{'is-active':detailTab==='overview'}" @click="detailTab='overview'">{{ t('ext_detail_overview') }}</button>
            <button type="button" :class="{'is-active':detailTab==='changelog'}" @click="detailTab='changelog'">{{ t('ext_detail_changelog') }}</button>
          </nav>

          <div v-if="detailTab==='overview'" class="eva-ext-detail-tab is-overview">
            <div class="eva-ext-detail-overview-grid">
              <section class="eva-ext-detail-panel eva-ext-detail-features"><h2>{{ t('ext_detail_features') }}</h2><div><article><i class="ri-settings-4-line"></i><span><strong>{{ t('ext_detail_feature_create') }}</strong><p>{{ t('ext_detail_feature_create_desc') }}</p></span></article><article><i class="ri-list-settings-line"></i><span><strong>{{ t('ext_detail_feature_category') }}</strong><p>{{ t('ext_detail_feature_category_desc') }}</p></span></article><article><i class="ri-shield-check-line"></i><span><strong>{{ t('ext_detail_feature_workflow') }}</strong><p>{{ t('ext_detail_feature_workflow_desc') }}</p></span></article><article><i class="ri-apps-2-line"></i><span><strong>{{ t('ext_detail_feature_integrate') }}</strong><p>{{ t('ext_detail_feature_integrate_desc') }}</p></span></article></div></section>
              <section class="eva-ext-detail-panel eva-ext-detail-basic"><h2>{{ t('ext_detail_basic_info') }}</h2><dl><div><dt>{{ t('ext_version') }}</dt><dd>v{{ moduleVersion(detail) }}</dd></div><div><dt>{{ t('ext_author') }}</dt><dd>{{ moduleAuthor(detail) }} <i class="ri-checkbox-circle-fill"></i></dd></div><div><dt>{{ t('ext_detail_compat') }}</dt><dd>Lentasy v2.0.0+</dd></div><div><dt>{{ t('ext_detail_last_update') }}</dt><dd>{{ moduleDate(detail) }}</dd></div><div><dt>{{ t('ext_detail_license') }}</dt><dd>MIT License</dd></div><div><dt>{{ t('ext_detail_dependencies') }}</dt><dd>{{ t('ext_detail_none') }}</dd></div></dl></section>
              <div class="eva-ext-detail-side-stack"><section class="eva-ext-detail-panel eva-ext-detail-shortcuts"><h2>{{ t('ext_detail_quick_access') }}</h2><div><button @click="settingsNotice(detail)"><i class="ri-settings-3-line"></i><span>{{ t('ext_detail_open_settings') }}</span></button><button @click="detailTab='changelog'"><i class="ri-file-list-3-line"></i><span>{{ t('ext_detail_view_log') }}</span></button><button @click="openDocs"><i class="ri-customer-service-2-line"></i><span>{{ t('ext_detail_contact_dev') }}</span></button></div></section><section class="eva-ext-detail-panel eva-ext-detail-runtime"><h2>{{ t('ext_detail_runtime') }}</h2><dl><div><dt>{{ t('ext_detail_enable_status') }}</dt><dd><i></i>{{ detail.enabled ? t('ext_enabled') : t('ext_disabled') }}</dd></div><div><dt>{{ t('ext_detail_auto_update') }}</dt><dd><i></i>{{ t('ext_detail_on') }}</dd></div><div><dt>{{ t('ext_detail_compat_check') }}</dt><dd><i class="ri-checkbox-circle-fill"></i>{{ t('ext_detail_compatible_state') }}</dd></div></dl></section></div>
            </div>
            <section class="eva-ext-detail-panel eva-ext-detail-recent"><h2>{{ t('ext_detail_recent_updates') }}</h2><div v-if="changelogEntries.length"><article v-for="(entry,index) in changelogEntries.slice(0,3)" :key="entry.version"><i></i><p>v{{ entry.version }}</p><time>{{ entry.date || moduleDate(detail) }}</time><button @click="detailTab='changelog'">v{{ entry.version }}</button></article></div><p v-else class="eva-ext-detail-empty">暂无真实更新日志</p></section>
          </div>

          <div v-else-if="detailTab==='changelog'" class="eva-ext-detail-tab is-changelog">
            <section class="eva-ext-detail-panel eva-ext-detail-history"><header><h2>{{ t('ext_detail_version_history') }}</h2><label><span>{{ t('ext_detail_major_only') }}</span><input v-model="majorOnly" type="checkbox"><i></i></label></header><div v-if="visibleChangelogEntries.length" class="eva-ext-detail-timeline"><article v-for="(entry,index) in visibleChangelogEntries" :key="entry.version" :class="{\'is-current\':index===0}"><header><strong>v{{ entry.version }}</strong><time>{{ entry.date || moduleDate(detail) }}</time><em v-if="index===0">{{ t('ext_detail_latest') }}</em></header><div class="eva-ext-detail-log-html" v-html="entry.html"></div></article></div><div v-else class="eva-ext-detail-empty">暂无真实版本历史</div></section>
            <section class="eva-ext-detail-panel eva-ext-detail-markdown"><header><strong><i class="ri-file-text-line"></i>{{ t('ext_detail_changelog_file') }}</strong><button @click="detailActionNotice('copy')"><i class="ri-file-copy-line"></i>{{ t('ext_detail_copy') }}</button></header><article class="eva-ext-detail-markdown-content"><h1><span>#</span> {{ detail.name || detail.slug }} {{ t('ext_detail_changelog') }}</h1><div v-if="detail.drawer && detail.drawer.update_log" v-html="detail.drawer.update_log"></div><p v-else class="eva-ext-detail-empty">暂无真实更新日志</p></article></section>
            <aside class="eva-ext-detail-changelog-side"><section class="eva-ext-detail-panel"><h2>{{ t('ext_detail_version_info') }}</h2><dl><div><dt>{{ t('ext_detail_current_version') }}</dt><dd>v{{ moduleVersion(detail) }}</dd></div><div><dt>{{ t('ext_detail_publish_time') }}</dt><dd>{{ moduleDate(detail) }}</dd></div><div><dt>{{ t('ext_detail_compat') }}</dt><dd>{{ detail.drawer && detail.drawer.php ? 'PHP ' + (detail.drawer.php.min || '—') + '+' : '—' }}</dd></div><div><dt>{{ t('ext_detail_downloads') }}</dt><dd>—</dd></div><div><dt>{{ t('ext_detail_frequency') }}</dt><dd>—</dd></div></dl><button @click="detailActionNotice('versions')"><i class="ri-time-line"></i>{{ t('ext_detail_all_versions') }}</button></section><section class="eva-ext-detail-panel eva-ext-detail-upgrade"><h2>{{ t('ext_detail_upgrade_notes') }}</h2><p>{{ t('ext_detail_upgrade_intro') }}</p><ul><li><i class="ri-checkbox-circle-line"></i><span><strong>{{ t('ext_detail_backup') }}</strong>{{ t('ext_detail_backup_desc') }}</span></li><li><i class="ri-checkbox-circle-line"></i><span><strong>{{ t('ext_detail_clear_cache') }}</strong>{{ t('ext_detail_clear_cache_desc') }}</span></li><li><i class="ri-checkbox-circle-line"></i><span><strong>{{ t('ext_detail_compat_check') }}</strong>{{ t('ext_detail_compat_check_desc') }}</span></li></ul><aside>{{ t('ext_detail_rollback_tip') }}</aside></section></aside>
          </div>

        </main>
      </div>

      </template>

      <template v-else>
        <div class="eva-market-layout">
          <aside class="eva-market-sidebar">
            <nav class="eva-ext-side-card eva-ext-nav">
              <button v-for="item in navItems" :key="item.id" type="button" :class="{'is-active': activeNav === item.id}" @click="selectNav(item.id)"><i :class="item.icon"></i><span>{{ item.label }}</span><em v-if="item.count">{{ item.count }}</em></button>
            </nav>
            <section class="eva-market-panel eva-market-filter"><h3>{{ t('market_filters') }}</h3><strong>{{ t('market_price') }}</strong><label><input type="radio" value="all" v-model="marketPrice"><span>{{ t('ext_all') }}</span></label><label><input type="radio" value="free" v-model="marketPrice"><span>{{ t('market_price_free') }}</span></label><label><input type="radio" value="paid" v-model="marketPrice"><span>{{ t('market_price_paid') }}</span></label></section>
            <section class="eva-market-developer">
              <strong>{{ t('ext_become_dev') }}</strong><p>{{ t('ext_dev_desc') }}</p><button type="button" @click="openDocs">{{ t('ext_learn_more') }}</button>
            </section>
          </aside>

          <section class="eva-market-content">
            <header class="eva-market-head">
              <div class="eva-market-title"><button type="button" @click="closeMarket" :aria-label="t('ext_my_extensions')"><i class="ri-arrow-left-s-line"></i></button><i class="ri-store-2-line"></i><h1>{{ t('market_title') }}</h1></div>
              <div class="eva-market-head-actions">
                <button type="button" @click="openDocs"><i class="ri-book-open-line"></i>{{ t('ext_docs') }}</button>
                <button type="button" :disabled="loading" @click="loadExtensions"><i class="ri-refresh-line" :class="{'is-spin': loading}"></i>{{ t('ext_check_updates') }}</button>
                <button type="button" class="is-primary" @click="chooseUpload"><i class="ri-add-line"></i>{{ t('ext_add') }}</button>
                <input ref="uploadInput" class="eva-ext-file" type="file" accept=".zip,application/zip" @change="uploadExtension">
              </div>
            </header>

            <div class="eva-market-toolbar">
              <label class="eva-market-search"><i class="ri-search-line"></i><input v-model.trim="marketQuery" :placeholder="t('market_search_ph')"></label>
              <label class="eva-market-select"><select v-model="marketSort"><option value="default">{{ t('market_sort_default') }}</option><option value="rating">{{ t('market_sort_rating') }}</option><option value="newest">{{ t('market_sort_newest') }}</option></select><i class="ri-arrow-down-s-line"></i></label>
              <label class="eva-market-select"><i class="ri-function-line"></i><select v-model="marketCategory"><option v-for="item in marketCategoryTabs" :key="item.id" :value="item.id">{{ item.label }}</option></select><i class="ri-arrow-down-s-line"></i></label>
              <label class="eva-market-select"><select v-model="marketPrice"><option value="all">{{ t('market_all_prices') }}</option><option value="free">{{ t('market_price_free') }}</option><option value="paid">{{ t('market_price_paid') }}</option></select><i class="ri-arrow-down-s-line"></i></label>
              <button type="button" class="eva-market-square" @click="notify(t('market_no_notifications'),'info')"><i class="ri-notification-3-line"></i></button>
              <button type="button" class="eva-market-help" @click="openDocs"><i class="ri-question-line"></i>{{ t('market_help') }}</button>
            </div>

            <nav class="eva-market-tabs">
              <button v-for="item in marketCategoryTabs" :key="item.id" type="button" :class="{'is-active':marketCategory===item.id}" @click="marketCategory=item.id">{{ item.label }}</button>
            </nav>

            <div class="eva-market-body">
              <main class="eva-market-main">
                <section class="eva-market-hero">
                  <button type="button" class="eva-market-hero-arrow is-left" aria-label="Previous"><i class="ri-arrow-left-s-line"></i></button>
                  <div class="eva-market-hero-copy"><h2>{{ t('market_hero_title') }}</h2><p>{{ t('market_hero_desc') }}</p><div><button type="button" class="is-solid" @click="marketCategory='all'">{{ t('market_explore') }}</button><button type="button" @click="openDocs">{{ t('market_become_dev') }}</button></div></div>
                  <div class="eva-market-hero-art" aria-hidden="true"><div class="eva-market-art-window"><span></span><span></span><span></span><i class="ri-layout-grid-fill"></i><b></b><b></b><b></b></div><div class="eva-market-art-card is-one"><i class="ri-file-list-3-fill"></i></div><div class="eva-market-art-card is-two"><i class="ri-leaf-fill"></i></div><div class="eva-market-art-card is-three"><i class="ri-shopping-bag-3-fill"></i></div></div>
                  <button type="button" class="eva-market-hero-arrow is-right" aria-label="Next"><i class="ri-arrow-right-s-line"></i></button>
                  <div class="eva-market-dots"><i class="is-active"></i><i></i><i></i></div>
                </section>

                <section class="eva-market-benefits">
                  <article v-for="item in marketBenefits" :key="item.title"><i :class="item.icon" :style="{color:item.color,background:item.bg}"></i><span><strong>{{ item.title }}</strong><small>{{ item.desc }}</small></span></article>
                </section>

                <section class="eva-market-section">
                  <header><h2>{{ t('market_featured') }}</h2><button type="button" @click="marketCategory='all'">{{ t('ext_view_all') }}<i class="ri-arrow-right-s-line"></i></button></header>
                  <div v-if="marketFeatured.length" class="eva-market-grid">
                    <article v-for="item in marketFeatured" :key="item.id" class="eva-market-card">
                      <div class="eva-market-card-head"><i :class="item.icon" :style="{background:item.gradient}"></i><div><h3>{{ item.title }} <em v-if="item.badge" :class="'is-'+item.badgeType">{{ item.badge }}</em></h3><span>{{ item.categoryLabel }}</span></div></div>
                      <p>{{ item.desc }}</p>
                      <div class="eva-market-card-meta"><span><i class="ri-star-fill"></i>{{ item.rating }}</span><span><i class="ri-download-cloud-line"></i>{{ item.installs }}</span><strong :class="{'is-free':!item.price}">{{ marketPriceLabel(item) }}</strong></div>
                      <footer><button type="button" @click="marketDetails(item)">{{ t('market_details') }}</button><button type="button" class="is-primary" @click="marketAction(item)">{{ isMarketInstalled(item) ? t('market_installed') : (item.price ? t('market_buy_now') : t('market_install')) }}</button></footer>
                    </article>
                  </div>
                  <div v-else class="eva-market-empty"><i class="ri-search-eye-line"></i><strong>{{ t('ext_no_results') }}</strong><p>{{ t('ext_no_results_desc') }}</p></div>
                </section>

                <section class="eva-market-section">
                  <header><h2>{{ t('market_latest') }}</h2><button type="button" @click="marketSort='newest'">{{ t('ext_view_all') }}<i class="ri-arrow-right-s-line"></i></button></header>
                  <div v-if="marketLatest.length" class="eva-market-grid">
                    <article v-for="item in marketLatest" :key="item.id" class="eva-market-card is-compact">
                      <div class="eva-market-card-head"><i :class="item.icon" :style="{background:item.gradient}"></i><div><h3>{{ item.title }} <em class="is-new">NEW</em></h3><span>{{ item.categoryLabel }}</span></div></div>
                      <p>{{ item.desc }}</p>
                      <div class="eva-market-card-meta"><span><i class="ri-star-fill"></i>{{ item.rating }}</span><span><i class="ri-download-cloud-line"></i>{{ item.installs }}</span><strong :class="{'is-free':!item.price}">{{ marketPriceLabel(item) }}</strong></div>
                      <footer><button type="button" class="is-wide" @click="marketAction(item)">{{ isMarketInstalled(item) ? t('market_installed') : (item.price ? t('market_buy_now') : t('market_install')) }}</button></footer>
                    </article>
                  </div>
                </section>
              </main>

              <aside class="eva-market-aside">
                <section v-if="marketSale" class="eva-market-panel eva-market-sale"><header><h3>{{ t('market_sale') }}</h3><time><b>23</b>:<b>59</b>:<b>59</b></time></header><div><i :class="marketSale.icon" :style="{background:marketSale.gradient}"></i><span><strong>{{ marketSale.title }}</strong><small>{{ marketSale.categoryLabel }}</small><em><i class="ri-star-fill"></i>{{ marketSale.rating }}　<i class="ri-download-cloud-line"></i>{{ marketSale.installs }}</em></span></div><footer><b>-30%</b><strong>¥{{ marketSale.price }}</strong><del>¥{{ marketSale.originalPrice }}</del><button type="button" @click="marketAction(marketSale)">{{ t('market_buy_now') }}</button></footer></section>
                <section class="eva-market-panel eva-market-ranking"><header><h3>{{ t('market_hot_rank') }}</h3><button type="button" @click="marketSort='rating'">{{ t('ext_view_all') }}<i class="ri-arrow-right-s-line"></i></button></header><ol><li v-for="(item,index) in marketRanking" :key="item.id"><b>{{ index+1 }}</b><i :class="item.icon" :style="{background:item.gradient}"></i><span><strong>{{ item.title }}</strong><small>{{ item.categoryLabel }}</small><em><i class="ri-star-fill"></i>{{ item.rating }} <i class="ri-download-cloud-line"></i>{{ item.installs }}</em></span></li></ol></section>
              </aside>
            </div>
          </section>
        </div>
      </template>
    </div>`;

  function mount(root) {
    if (!root || root.__evaExtensionMounted) { return; }
    root.__evaExtensionMounted = true;

    var app = Vue.createApp({
      template: TEMPLATE,
      setup: function () {
        var cfg = (window.EvaFW && window.EvaFW.config) || {};
        var extensionStateKey = 'eva_fw_extension_state_v1:' + window.location.pathname;
        function readExtensionState() {
          try {
            var raw = window.sessionStorage.getItem(extensionStateKey);
            return raw ? JSON.parse(raw) : {};
          } catch (e) { return {}; }
        }
        function allowed(value, values, fallback) { return values.indexOf(value) !== -1 ? value : fallback; }
        var savedExtensionState = readExtensionState();
        var extensions = Vue.ref([]);
        var loading = Vue.ref(false);
        var error = Vue.ref('');
        var query = Vue.ref(typeof savedExtensionState.query === 'string' ? savedExtensionState.query : '');
        var activeFilter = Vue.ref(allowed(savedExtensionState.activeFilter, ['all','enabled','attention','disabled'], 'all'));
        // “我的扩展”已经覆盖已安装列表，旧会话若停留在 installed 自动迁移到 mine。
        var savedNav = savedExtensionState.activeNav === 'installed' ? 'mine' : savedExtensionState.activeNav;
        var activeNav = Vue.ref(allowed(savedNav, ['popular','mine','market'], 'popular'));
        var pageMode = Vue.ref(savedExtensionState.pageMode === 'market' || savedExtensionState.activeNav === 'market' ? 'market' : 'overview');
        var marketQuery = Vue.ref(typeof savedExtensionState.marketQuery === 'string' ? savedExtensionState.marketQuery : '');
        var marketCategory = Vue.ref(typeof savedExtensionState.marketCategory === 'string' ? savedExtensionState.marketCategory : 'all');
        var marketSort = Vue.ref(allowed(savedExtensionState.marketSort, ['default','rating','newest'], 'default'));
        var marketPrice = Vue.ref(allowed(savedExtensionState.marketPrice, ['all','free','paid'], 'all'));
        var marketCompat = Vue.ref(allowed(savedExtensionState.marketCompat, ['all','current','legacy'], 'all')); 
        var category = Vue.ref('all');
        var sortBy = Vue.ref(allowed(savedExtensionState.sortBy, ['name','enabled','version'], 'name'));
        var page = Vue.ref(Math.max(1, Number(savedExtensionState.page) || 1));
        var pageSize = Vue.ref([6,9,12].indexOf(Number(savedExtensionState.pageSize)) !== -1 ? Number(savedExtensionState.pageSize) : 9);
        var pageSizeOptions = [{ value: 6, label: '6' }, { value: 9, label: '9' }, { value: 12, label: '12' }];
        var viewMode = Vue.ref(allowed(savedExtensionState.viewMode, ['grid','list'], 'grid'));
        var detail = Vue.ref(null);
        var detailTab = Vue.ref(allowed(savedExtensionState.detailTab, ['overview','changelog'], 'overview'));
        var majorOnly = Vue.ref(savedExtensionState.majorOnly === true);
        var changelogEntries = Vue.computed(function () {
          var html = detail.value && detail.value.drawer && detail.value.drawer.update_log;
          if (!html || /暂无更新日志/.test(String(html))) { return []; }
          var holder = document.createElement('div');
          holder.innerHTML = String(html);
          var headings = holder.querySelectorAll('h2'), entries = [];
          Array.prototype.forEach.call(headings, function (heading) {
            var text = String(heading.textContent || '').trim();
            var match = text.match(/(?:version|版本|v)\s*([0-9]+(?:\.[0-9]+){0,2}(?:[-+][\w.-]+)?)\s*(?:\(([^)]+)\))?/i);
            if (!match) { return; }
            var content = [], node = heading.nextElementSibling;
            while (node && node.tagName !== 'H2') { content.push(node.outerHTML || ''); node = node.nextElementSibling; }
            var contentText = content.join(' ');
            entries.push({ version: match[1], date: match[2] || '', html: content.join(''), major: /新功能|new features|🎉/i.test(contentText) && !/暂无新增功能|no new features/i.test(contentText) });
          });
          return entries;
        });
        var visibleChangelogEntries = Vue.computed(function () {
          return majorOnly.value ? changelogEntries.value.filter(function (entry) { return entry.major; }) : changelogEntries.value;
        });
        var openFaq = Vue.ref(-1);
        var previewSlide = Vue.ref(0);
        var previewImages = [
          extensionAssetUrl('images/extension-detail/preview-content.png'),
          extensionAssetUrl('images/extension-detail/preview-dashboard.png'),
          extensionAssetUrl('images/extension-detail/preview-editor.png')
        ];
        var previewTimer = null;
        var pendingDetailSlug = typeof savedExtensionState.detailSlug === 'string' ? savedExtensionState.detailSlug : '';
        var toast = Vue.reactive({ text: '', type: 'info', timer: null });
        var uploadInput = Vue.ref(null);
        var installedSection = Vue.ref(null);
        var loadTime = Vue.ref('--:--');

        function t(key) {
          var translated = key;
          if (window.EvaI18n && typeof window.EvaI18n.t === 'function') { translated = window.EvaI18n.t(key); }
          if (translated && translated !== key) { return translated; }
          var locale = String(cfg.locale || document.documentElement.lang || navigator.language || 'en').toLowerCase();
          var lang = locale.indexOf('zh') === 0 ? 'zh' : locale.indexOf('ja') === 0 ? 'ja' : locale.indexOf('ko') === 0 ? 'ko' : 'en';
          return (MARKET_I18N[lang] && MARKET_I18N[lang][key]) || (MARKET_I18N.en && MARKET_I18N.en[key]) || translated || key;
        }
        var sortOptions = Vue.computed(function () {
          return { name: t('ext_sort_name'), enabled: t('ext_sort_status'), version: t('ext_sort_version') };
        });
        function notify(text, type) {
          toast.text = text; toast.type = type || 'info';
          if (toast.timer) { clearTimeout(toast.timer); }
          toast.timer = setTimeout(function () { toast.text = ''; }, 3200);
        }
        var toastIcon = Vue.computed(function () {
          return toast.type === 'success' ? 'ri-checkbox-circle-fill' : toast.type === 'error' ? 'ri-error-warning-fill' : 'ri-information-fill';
        });
        function apiUrl(endpoint) { return String(cfg.restUrl || '/wp-json/').replace(/\/$/, '') + '/lf/v2/' + endpoint; }
        function request(endpoint, options) {
          var opts = Object.assign({ credentials: 'same-origin', headers: {} }, options || {});
          opts.headers = Object.assign({ 'X-WP-Nonce': cfg.restNonce || '' }, opts.headers || {});
          return fetch(apiUrl(endpoint), opts).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
              if (!res.ok) { throw new Error(data.message || ('HTTP ' + res.status)); }
              return data;
            });
          });
        }
        function loadExtensions() {
          if (loading.value) { return; }
          loading.value = true; error.value = '';
          return request('getallExtendeds').then(function (data) {
            if (Number(data.code) !== 200 || !Array.isArray(data.modules)) { throw new Error(data.message || t('ext_invalid_response')); }
            extensions.value = data.modules.map(function (ext) { return Object.assign({}, ext, { processing: false, thumbnailError: false }); });
            if (pendingDetailSlug) {
              detail.value = extensions.value.find(function (ext) { return ext.slug === pendingDetailSlug; }) || null;
              pendingDetailSlug = '';
            }
            loadTime.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }).catch(function (err) {
            error.value = err.message || t('ext_unknown_error');
          }).finally(function () { loading.value = false; });
        }
        function moduleVisual(ext) { return ICONS[ext && ext.slug] || ['ri-puzzle-line', 'blue']; }
        function moduleVersion(ext) { return (ext && ext.drawer && ext.drawer.version) || '1.0.0'; }
        function moduleAuthor(ext) {
          var author = ext && ext.drawer && ext.drawer.author;
          return (author && (author.name || author.display_name)) || (typeof author === 'string' ? author : t('ext_official'));
        }
        function modulePhp(ext) {
          var php = ext && ext.drawer && ext.drawer.php;
          if (!php) { return '—'; }
          if (typeof php === 'string') { return php; }
          return (php.min || '—') + (php.max && php.max !== '*' ? ' – ' + php.max : '+');
        }
        function moduleDate(ext) { return (ext && ext.drawer && ext.drawer.update_time) || t('ext_recently'); }
        function categoryOf(ext) {
          var slug = String((ext && ext.slug) || '').toLowerCase();
          if (/cms|write|forum/.test(slug)) { return 'content'; }
          if (/user/.test(slug)) { return 'users'; }
          if (/pay|cloud/.test(slug)) { return 'commerce'; }
          if (/widget/.test(slug)) { return 'ui'; }
          if (/optimization/.test(slug)) { return 'tools'; }
          if (/test/.test(slug)) { return 'dev'; }
          return 'other';
        }
        var enabledCount = Vue.computed(function () { return extensions.value.filter(function (x) { return !!x.enabled; }).length; });
        var attentionModules = Vue.computed(function () { return extensions.value.filter(function (x) { return x.status && x.status.type !== 'ok'; }); });
        var filtered = Vue.computed(function () {
          var q = query.value.toLowerCase();
          var rows = extensions.value.filter(function (ext) {
            var matchesQuery = !q || [ext.name, ext.slug, ext.desc, moduleAuthor(ext)].join(' ').toLowerCase().indexOf(q) !== -1;
            var matchesFilter = activeFilter.value === 'all' || (activeFilter.value === 'enabled' && ext.enabled) || (activeFilter.value === 'disabled' && !ext.enabled) || (activeFilter.value === 'attention' && ext.status && ext.status.type !== 'ok');
            var matchesCategory = category.value === 'all' || categoryOf(ext) === category.value;
            return matchesQuery && matchesFilter && matchesCategory;
          });
          rows.sort(function (a, b) {
            if (sortBy.value === 'enabled') { return Number(b.enabled) - Number(a.enabled) || String(a.name).localeCompare(String(b.name)); }
            if (sortBy.value === 'version') { return String(moduleVersion(b)).localeCompare(String(moduleVersion(a)), undefined, { numeric: true }); }
            return String(a.name || a.slug).localeCompare(String(b.name || b.slug));
          });
          return rows;
        });
        var pageCount = Vue.computed(function () { return Math.max(1, Math.ceil(filtered.value.length / pageSize.value)); });
        var paged = Vue.computed(function () { var start = (page.value - 1) * pageSize.value; return filtered.value.slice(start, start + pageSize.value); });
        var recentModules = Vue.computed(function () { return extensions.value.slice().sort(function (a, b) { return String(moduleDate(b)).localeCompare(String(moduleDate(a))); }).slice(0, 5); });
        Vue.watch([query, activeFilter, category, sortBy, pageSize], function () { page.value = 1; });
        Vue.watch(pageCount, function (n) { if (page.value > n) { page.value = n; } });
        function persistExtensionState() {
          try {
            window.sessionStorage.setItem(extensionStateKey, JSON.stringify({
              query: query.value,
              activeFilter: activeFilter.value,
              activeNav: activeNav.value,
              category: category.value,
              sortBy: sortBy.value,
              page: page.value,
              pageSize: pageSize.value,
              viewMode: viewMode.value,
              detailSlug: detail.value && detail.value.slug ? detail.value.slug : '',
              detailTab: detailTab.value,
              majorOnly: majorOnly.value,
              pageMode: pageMode.value,
              marketQuery: marketQuery.value,
              marketCategory: marketCategory.value,
              marketSort: marketSort.value,
              marketPrice: marketPrice.value,
              marketCompat: marketCompat.value
            }));
          } catch (e) {}
        }
        Vue.watch([query, activeFilter, activeNav, category, sortBy, page, pageSize, viewMode, detail, detailTab, majorOnly, pageMode, marketQuery, marketCategory, marketSort, marketPrice, marketCompat], persistExtensionState);

        var navItems = Vue.computed(function () { return [
          { id: 'popular', icon: 'ri-fire-line', label: t('ext_popular') },
          { id: 'mine', icon: 'ri-user-star-line', label: t('ext_my_extensions') },
          { id: 'market', icon: 'ri-store-2-line', label: t('ext_market') }
        ]; });
        var marketCategoryTabs = Vue.computed(function () { return [
          { id: 'all', label: t('ext_all') },
          { id: 'content', label: t('ext_cat_content') },
          { id: 'users', label: t('ext_cat_users') },
          { id: 'ui', label: t('ext_cat_ui') },
          { id: 'security', label: t('market_cat_security_opt') },
          { id: 'dev', label: t('market_cat_dev_tools') },
          { id: 'commerce', label: t('ext_cat_commerce') },
          { id: 'marketing', label: t('market_cat_marketing') },
          { id: 'more', label: t('market_more') }
        ]; });
        var marketCatalog = Vue.computed(function () {
          var categoryLabels = {};
          marketCategoryTabs.value.forEach(function (item) { categoryLabels[item.id] = item.label; });
          return [
            { id:'forms', slug:'market_forms', title:t('market_item_forms'), desc:t('market_item_forms_desc'), category:'content', icon:'ri-file-list-3-fill', gradient:'linear-gradient(135deg,#a56cff,#7a50e8)', rating:4.9, installs:'2.3K+', price:199, originalPrice:249, badge:t('market_badge_hot'), badgeType:'hot', featured:true, latest:false },
            { id:'leaf', slug:'LF_Optimization', title:t('market_item_leaf'), desc:t('market_item_leaf_desc'), category:'security', icon:'ri-leaf-fill', gradient:'linear-gradient(135deg,#5fd0a1,#23aa79)', rating:4.8, installs:'5.2K+', price:0, badge:t('market_badge_sale'), badgeType:'sale', featured:true, latest:false },
            { id:'lottery', slug:'LF_Forum', title:t('market_item_lottery'), desc:t('market_item_lottery_desc'), category:'users', icon:'ri-message-3-fill', gradient:'linear-gradient(135deg,#66a7ff,#3978ea)', rating:4.7, installs:'1.8K+', price:129, badge:t('market_badge_new'), badgeType:'new', featured:true, latest:false },
            { id:'woo', slug:'market_woocommerce', title:t('market_item_woo'), desc:t('market_item_woo_desc'), category:'commerce', icon:'ri-shopping-cart-2-fill', gradient:'linear-gradient(135deg,#ffca4f,#f49a19)', rating:4.9, installs:'3.7K+', price:0, badge:'', badgeType:'', featured:true, latest:false },
            { id:'images', slug:'LF_Widget', title:t('market_item_images'), desc:t('market_item_images_desc'), category:'ui', icon:'ri-image-2-fill', gradient:'linear-gradient(135deg,#5c9aff,#1861ef)', rating:4.6, installs:'856', price:0, featured:false, latest:true },
            { id:'mail', slug:'LF_Write', title:t('market_item_mail'), desc:t('market_item_mail_desc'), category:'dev', icon:'ri-mail-fill', gradient:'linear-gradient(135deg,#bd76ff,#7b4ae5)', rating:4.7, installs:'623', price:149, featured:false, latest:true },
            { id:'security', slug:'LF_User', title:t('market_item_security'), desc:t('market_item_security_desc'), category:'security', icon:'ri-shield-check-fill', gradient:'linear-gradient(135deg,#72dab0,#3cbf87)', rating:4.8, installs:'1.2K+', price:0, featured:false, latest:true },
            { id:'analytics', slug:'LF_Cms', title:t('market_item_analytics'), desc:t('market_item_analytics_desc'), category:'content', icon:'ri-pie-chart-2-fill', gradient:'linear-gradient(135deg,#ffb04c,#ff7f24)', rating:4.5, installs:'432', price:99, featured:false, latest:true },
            { id:'devkit', slug:'LF_Test', title:t('market_item_devkit'), desc:t('market_item_devkit_desc'), category:'dev', icon:'ri-flow-chart', gradient:'linear-gradient(135deg,#ff7195,#ef4777)', rating:4.8, installs:'1.6K+', price:199, originalPrice:299, featured:false, latest:false, sale:true },
            { id:'cloud', slug:'LF_Leantasy_Cloud', title:t('market_item_cloud'), desc:t('market_item_cloud_desc'), category:'more', icon:'ri-cloud-fill', gradient:'linear-gradient(135deg,#4ac8db,#2c9cc9)', rating:4.6, installs:'980', price:0, featured:false, latest:false }
          ].map(function (item) { item.categoryLabel = categoryLabels[item.category] || item.category; return item; });
        });
        var marketBenefits = Vue.computed(function () { return [
          { icon:'ri-shield-check-line', color:'#377cf4', bg:'#edf4ff', title:t('market_benefit_safe'), desc:t('market_benefit_safe_desc') },
          { icon:'ri-award-line', color:'#f39a22', bg:'#fff6e9', title:t('market_benefit_quality'), desc:t('market_benefit_quality_desc') },
          { icon:'ri-refresh-line', color:'#24af72', bg:'#eafaf2', title:t('market_benefit_update'), desc:t('market_benefit_update_desc') },
          { icon:'ri-customer-service-2-line', color:'#8759f5', bg:'#f3efff', title:t('market_benefit_support'), desc:t('market_benefit_support_desc') },
          { icon:'ri-node-tree', color:'#f08b25', bg:'#fff4e8', title:t('market_benefit_open'), desc:t('market_benefit_open_desc') }
        ]; });
        var marketFiltered = Vue.computed(function () {
          var q = marketQuery.value.toLowerCase();
          var rows = marketCatalog.value.filter(function (item) {
            var matchQuery = !q || [item.title,item.desc,item.categoryLabel].join(' ').toLowerCase().indexOf(q) !== -1;
            var matchCategory = marketCategory.value === 'all' || item.category === marketCategory.value;
            var matchPrice = marketPrice.value === 'all' || (marketPrice.value === 'free' ? !item.price : !!item.price);
            var matchCompat = marketCompat.value === 'all' || marketCompat.value === 'current' || (marketCompat.value === 'legacy' && item.id !== 'analytics');
            return matchQuery && matchCategory && matchPrice && matchCompat;
          });
          rows.sort(function (a,b) {
            if (marketSort.value === 'rating') { return b.rating - a.rating; }
            if (marketSort.value === 'newest') { return Number(b.latest) - Number(a.latest); }
            return Number(b.featured) - Number(a.featured) || b.rating - a.rating;
          });
          return rows;
        });
        var marketFeatured = Vue.computed(function () { return marketFiltered.value.filter(function (item) { return item.featured; }).slice(0,4); });
        var marketLatest = Vue.computed(function () {
          var latest = marketFiltered.value.filter(function (item) { return item.latest; });
          return (latest.length ? latest : marketFiltered.value).slice(0,4);
        });
        var marketRanking = Vue.computed(function () { return marketCatalog.value.slice().sort(function (a,b) { return b.rating - a.rating || String(b.installs).localeCompare(String(a.installs)); }).slice(0,5); });
        var marketSale = Vue.computed(function () { return marketCatalog.value.find(function (item) { return item.sale; }) || null; });

        var detailDirectory = Vue.computed(function () { return [t('ext_detail_module_intro'), t('ext_detail_basic_config'), t('ext_detail_publish_flow'), t('ext_detail_common_ops'), t('ext_detail_faq')]; });
        var detailFaq = Vue.computed(function () { return [
          { q:t('ext_detail_faq_1'), a:t('ext_detail_faq_1_a') },
          { q:t('ext_detail_faq_2'), a:t('ext_detail_faq_2_a') },
          { q:t('ext_detail_faq_3'), a:t('ext_detail_faq_3_a') },
          { q:t('ext_detail_faq_4'), a:t('ext_detail_faq_4_a') }
        ]; });

        function toggleExtension(ext) {
          if (!ext || ext.processing) { return; }
          if (!ext.enabled && ext.status && ext.status.type !== 'ok') { notify(t('ext_dependency_blocked'), 'error'); showDetail(ext); return; }
          var previous = !!ext.enabled;
          ext.processing = true; ext.enabled = !previous;
          return request(previous ? 'disableExtended' : 'enableExtended', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: ext.slug }) }).then(function (data) {
            if (Number(data.code) !== 200) { throw new Error(data.message || t('ext_action_failed')); }
            notify(data.message || (previous ? t('ext_disabled_success') : t('ext_enabled_success')), 'success');
          }).catch(function (err) { ext.enabled = previous; notify(err.message || t('ext_action_failed'), 'error'); }).finally(function () { ext.processing = false; });
        }
        function chooseUpload() { if (uploadInput.value) { uploadInput.value.value = ''; uploadInput.value.click(); } }
        function uploadExtension(event) {
          var file = event.target.files && event.target.files[0];
          if (!file) { return; }
          if (!/\.zip$/i.test(file.name)) { notify(t('ext_zip_only'), 'error'); return; }
          var form = new FormData(); form.append('file', file);
          loading.value = true; notify(t('ext_uploading'), 'info');
          request('uploadExtended', { method: 'POST', body: form }).then(function (data) {
            if (data.status !== 'ok' && Number(data.code) !== 200) { throw new Error(data.message || t('ext_upload_failed')); }
            notify(data.message || t('ext_upload_success'), 'success'); return loadExtensions();
          }).catch(function (err) { notify(err.message || t('ext_upload_failed'), 'error'); }).finally(function () { loading.value = false; });
        }
        function setPreviewSlide(index) { previewSlide.value = ((Number(index) || 0) % 3 + 3) % 3; }
        function changePreviewSlide(step) { setPreviewSlide(previewSlide.value + Number(step || 0)); }
        function stopPreviewAutoplay() { if (previewTimer) { clearInterval(previewTimer); previewTimer = null; } }
        function startPreviewAutoplay() {
          stopPreviewAutoplay();
          if (!detail.value) { return; }
          previewTimer = setInterval(function () { setPreviewSlide(previewSlide.value + 1); }, 4200);
        }
        function showDetail(ext) { detail.value = ext; detailTab.value = 'overview'; openFaq.value = -1; previewSlide.value = 0; Vue.nextTick(function () { root.scrollIntoView({ behavior:'smooth', block:'start' }); }); }
        function closeDetail() { detail.value = null; detailTab.value = 'overview'; openFaq.value = -1; previewSlide.value = 0; Vue.nextTick(function () { root.scrollIntoView({ behavior:'smooth', block:'start' }); }); }
        function detailActionNotice(action) {
          if (action === 'update') { notify(t('ext_detail_update_checked'), 'success'); }
          else if (action === 'uninstall') { notify(t('ext_detail_uninstall_notice'), 'info'); }
          else if (action === 'copy') { notify(t('ext_detail_copied'), 'success'); }
          else if (action === 'versions') { notify(t('ext_detail_versions_notice'), 'info'); }
          else if (action === 'anchor') { notify(t('ext_detail_anchor_notice'), 'info'); }
        }
        function selectNav(id) {
          detail.value = null; detailTab.value = 'overview'; openFaq.value = -1;
          activeNav.value = id;
          if (id === 'market') { openMarket(); return; }
          pageMode.value = 'overview';
          if (id === 'installed' || id === 'mine') { activeFilter.value = 'all'; scrollInstalled(); }
          else if (id === 'official') { query.value = ''; notify(t('ext_showing_official'), 'info'); }
          else if (id === 'license') { licenseNotice(); }
          else if (id === 'logs') { logNotice(); }
          else if (id === 'status') { activeFilter.value = 'attention'; scrollInstalled(); }
          else if (id === 'developer') { openDocs(); }
          else { Vue.nextTick(function () { root.scrollIntoView({ behavior:'smooth', block:'start' }); }); }
        }
        function scrollInstalled(behavior) { Vue.nextTick(function () { if (installedSection.value) { installedSection.value.scrollIntoView({ behavior: behavior || 'smooth', block: 'start' }); } }); }
        function focusModule(slug) { query.value = ''; activeFilter.value = 'all'; category.value = 'all'; scrollInstalled(); Vue.nextTick(function () { var el = root.querySelector('[data-slug="' + slug + '"]'); if (el) { el.classList.add('is-highlight'); setTimeout(function () { el.classList.remove('is-highlight'); }, 1800); } }); }
        function clearFilters() { query.value = ''; activeFilter.value = 'all'; category.value = 'all'; }
        function openDocs() { window.open('https://docs.9wt.cn/', '_blank', 'noopener'); }
        function openMarket(categoryId) {
          pageMode.value = 'market'; activeNav.value = 'market';
          if (typeof categoryId === 'string') { marketCategory.value = categoryId; }
          Vue.nextTick(function () { root.scrollIntoView({ behavior:'smooth', block:'start' }); });
        }
        function closeMarket() {
          pageMode.value = 'overview'; activeNav.value = 'popular';
          Vue.nextTick(function () { root.scrollIntoView({ behavior:'smooth', block:'start' }); });
        }
        function resetMarketFilters() { marketQuery.value=''; marketCategory.value='all'; marketSort.value='default'; marketPrice.value='all'; marketCompat.value='all'; }
        function marketPriceLabel(item) { return item && item.price ? '¥' + item.price : t('market_price_free'); }
        function isMarketInstalled(item) { return !!(item && extensions.value.some(function (ext) { return ext.slug === item.slug; })); }
        function marketAction(item) {
          if (isMarketInstalled(item)) {
            pageMode.value='overview'; activeNav.value='installed';
            Vue.nextTick(function () { focusModule(item.slug); });
            notify(t('market_local_found'), 'success');
            return;
          }
          notify(t('market_api_pending'), 'info');
        }
        function marketDetails(item) { notify((item && item.title ? item.title + '：' : '') + t('market_preview_notice'), 'info'); }
        function marketNotice() { openMarket(); }
        function settingsNotice(ext) { notify((ext.name || ext.slug) + ': ' + t('ext_settings_coming'), 'info'); }
        function bulkNotice() { notify(t('ext_bulk_coming'), 'info'); }
        function logNotice() { notify(t('ext_log_ready'), 'info'); }
        function licenseNotice() { notify(t('ext_license_ready'), 'info'); }

        Vue.watch(detail, function (value) {
          if (value) { previewSlide.value = 0; Vue.nextTick(startPreviewAutoplay); }
          else { stopPreviewAutoplay(); }
        });
        Vue.onMounted(function () {
          loadExtensions().then(function () {
            if (pageMode.value === 'overview' && (activeNav.value === 'installed' || activeNav.value === 'mine' || activeNav.value === 'status')) { scrollInstalled('auto'); }
          });
        });
        Vue.onUnmounted(stopPreviewAutoplay);

        return { t: t, notify: notify, extensions: extensions, loading: loading, error: error, query: query, activeFilter: activeFilter, activeNav: activeNav, category: category, sortBy: sortBy, sortOptions: sortOptions, page: page, pageSize: pageSize, pageSizeOptions: pageSizeOptions, viewMode: viewMode, detail: detail, detailTab: detailTab, majorOnly: majorOnly, changelogEntries: changelogEntries, visibleChangelogEntries: visibleChangelogEntries, openFaq: openFaq, previewSlide: previewSlide, previewImages: previewImages, setPreviewSlide: setPreviewSlide, changePreviewSlide: changePreviewSlide, startPreviewAutoplay: startPreviewAutoplay, stopPreviewAutoplay: stopPreviewAutoplay, detailDirectory: detailDirectory, detailFaq: detailFaq, toast: toast, toastIcon: toastIcon, uploadInput: uploadInput, installedSection: installedSection, loadTime: loadTime, enabledCount: enabledCount, attentionModules: attentionModules, filtered: filtered, pageCount: pageCount, paged: paged, recentModules: recentModules, navItems: navItems, pageMode: pageMode, marketQuery: marketQuery, marketCategory: marketCategory, marketSort: marketSort, marketPrice: marketPrice, marketCompat: marketCompat, marketCategoryTabs: marketCategoryTabs, marketCatalog: marketCatalog, marketBenefits: marketBenefits, marketFiltered: marketFiltered, marketFeatured: marketFeatured, marketLatest: marketLatest, marketRanking: marketRanking, marketSale: marketSale, loadExtensions: loadExtensions, moduleVisual: moduleVisual, moduleVersion: moduleVersion, moduleAuthor: moduleAuthor, moduleDate: moduleDate, toggleExtension: toggleExtension, chooseUpload: chooseUpload, uploadExtension: uploadExtension, showDetail: showDetail, closeDetail: closeDetail, detailActionNotice: detailActionNotice, selectNav: selectNav, focusModule: focusModule, clearFilters: clearFilters, openDocs: openDocs, openMarket: openMarket, closeMarket: closeMarket, resetMarketFilters: resetMarketFilters, marketPriceLabel: marketPriceLabel, isMarketInstalled: isMarketInstalled, marketAction: marketAction, marketDetails: marketDetails, marketNotice: marketNotice, settingsNotice: settingsNotice, bulkNotice: bulkNotice, logNotice: logNotice, licenseNotice: licenseNotice };
      }
    });

    if (window.EvaUI && window.EvaUI.Select) {
      app.component('eva-select', window.EvaUI.Select);
    }
    app.mount(root);
  }

  function scan() { document.querySelectorAll('#extended.extended-page').forEach(mount); }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', scan); } else { scan(); }
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
