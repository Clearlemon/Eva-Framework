/** 页面构建器入口：组合状态、各业务方法及模板；加载顺序由 PHP 依赖声明。 */
(function (runtime) {
  'use strict';
  window.EvaFields = window.EvaFields || {};
  window.EvaFields.builder = Object.assign({}, runtime.state, {
    methods: Object.assign({},
      runtime.history,
      runtime.motion,
      runtime.shell,
      runtime.preview,
      runtime.widgets,
      runtime.menuData,
      runtime.menuActions,
      runtime.menuItems,
      runtime.menuDrag,
      runtime.menuPanels,
      runtime.menuResources,
      runtime.modules,
      runtime.drag,
      runtime.fields
    ),
    template: runtime.template
  });
})(window.EvaBuilder);
