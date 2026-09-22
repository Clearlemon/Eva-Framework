(function () {
  'use strict';
  window.EvaFields = window.EvaFields || {};
  var factory = window.EvaFieldFactories && window.EvaFieldFactories.boxField;
  if (!factory) { return; }
  window.EvaFields.dimensions = factory([
    { key: 'width', label: '宽度' },
    { key: 'height', label: '高度' },
    { key: 'min_width', label: '最小宽度' },
    { key: 'max_width', label: '最大宽度' }
  ], { kind: 'dimensions', linkable: false });
})();
