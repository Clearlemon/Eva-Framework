(function () {
  'use strict';
  window.EvaFields = window.EvaFields || {};
  var factory = window.EvaFieldFactories && window.EvaFieldFactories.boxField;
  if (!factory) { return; }
  window.EvaFields.spacing = factory([
    { key: 'top', label: '上' },
    { key: 'right', label: '右' },
    { key: 'bottom', label: '下' },
    { key: 'left', label: '左' }
  ], { kind: 'spacing', linkable: true });
})();
