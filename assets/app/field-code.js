/** 字段 schema 的 PHP 代码预览和复制。 */
(function (app) {
  'use strict';
  app.fieldCode = function (currentSection) {
    var fieldCodeOpen = Vue.ref('');
    // 功能：仅在图像选择演示页显示字段代码入口。
    function Show_Field_Code(f) {
      return !!(currentSection.value && currentSection.value.id === 'field-image-select' && f && f.id);
    }

    function Field_Code_String(value, depth, key) {
      var indent = new Array(depth + 1).join('  ');
      var childIndent = new Array(depth + 2).join('  ');
      if (value === null) { return 'null'; }
      if (typeof value === 'boolean') { return value ? 'true' : 'false'; }
      if (typeof value === 'number') { return String(value); }
      if (typeof value === 'string') {
        // 图像选择的 data URI 很长，代码预览保留语义但避免撑爆浮层。
        var text = value;
        if (key === 'url' && text.indexOf('data:image/') === 0) { text = '[preview image]'; }
        if (text.length > 180) { text = text.slice(0, 177) + '…'; }
        return "'" + text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'";
      }
      if (Array.isArray(value)) {
        if (!value.length) { return '[]'; }
        return '[\n' + value.map(function (item) {
          return childIndent + Field_Code_String(item, depth + 1, key);
        }).join(',\n') + '\n' + indent + ']';
      }
      if (typeof value === 'object') {
        var keys = Object.keys(value);
        if (!keys.length) { return '[]'; }
        return '[\n' + keys.map(function (itemKey) {
          return childIndent + "'" + itemKey.replace(/'/g, "\\'") + "' => " + Field_Code_String(value[itemKey], depth + 1, itemKey);
        }).join(',\n') + '\n' + indent + ']';
      }
      return "'" + String(value) + "'";
    }

    // 功能：把字段 schema 格式化为可直接参考的 PHP 数组片段。
    function Field_Code(f) {
      if (!f) { return ''; }
      var keys = Object.keys(f).filter(function (key) { return key.charAt(0) !== '_' && typeof f[key] !== 'function'; });
      return '[\n' + keys.map(function (key) {
        return "  '" + key.replace(/'/g, "\\'") + "' => " + Field_Code_String(f[key], 1, key);
      }).join(',\n') + '\n]';
    }

    function Toggle_Field_Code(id) {
      fieldCodeOpen.value = fieldCodeOpen.value === id ? '' : id;
    }

    function Copy_Field_Code(f) {
      var code = Field_Code(f);
      if (navigator.clipboard && code) { navigator.clipboard.writeText(code); }
    }


    return { fieldCodeOpen: fieldCodeOpen, Show_Field_Code: Show_Field_Code, Field_Code: Field_Code, Toggle_Field_Code: Toggle_Field_Code, Copy_Field_Code: Copy_Field_Code };
  };
})(window.EvaApp = window.EvaApp || {});
