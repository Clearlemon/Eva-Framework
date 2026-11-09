/** 字段依赖规则求值、行状态与渲染参数。 */
(function (app) {
  'use strict';
  app.fieldDependencies = function (model, dependencySources, fieldCol, Field_Error) {

    // 功能：按逗号字符串或数组生成依赖比较集合。
    function Dependency_List(value) {
      if (Array.isArray(value)) { return value; }
      if (value === null || value === undefined) { return []; }
      return String(value).split(',').map(function (item) { return item.trim(); });
    }

    // 功能：把依赖值转成布尔值，兼容 CSF 的 true/false 字符串。
    function Dependency_Bool(value) {
      if (value === true || value === 'true' || value === 1 || value === '1') { return true; }
      if (value === false || value === 'false' || value === 0 || value === '0' || value === null || value === undefined || value === '') { return false; }
      return null;
    }

    // 功能：归一化依赖等值比较时的实际值。
    function Dependency_Compare_Value(value) {
      var bool = Dependency_Bool(value);
      if (bool !== null) { return bool ? 'true' : 'false'; }
      if (Array.isArray(value)) { return value.map(Dependency_Compare_Value).join(','); }
      if (value && typeof value === 'object') { return JSON.stringify(value); }
      return String(value);
    }

    // 功能：判断依赖值是否为空。
    function Dependency_Is_Empty(value) {
      return value === null || value === undefined || value === '' || value === false || (Array.isArray(value) && !value.length);
    }

    // 功能：读取对象中的点号路径值。
    function Dependency_Path_Value(source, path) {
      if (!path || path === '__value') { return source; }
      var current = source;
      String(path).split('.').forEach(function (part) {
        if (current === null || current === undefined || part === '') { current = undefined; return; }
        current = current[part];
      });
      return current;
    }

    // 功能：读取依赖规则对应的数据源值。
    function Dependency_Source_Value(rule, scope) {
      if (!rule) { return undefined; }
      var source = rule.source || 'field';
      if (source === 'option' || source === 'site_option') {
        var group = dependencySources[source] || {};
        var optionValues = group[rule.option] || {};
        if (rule.key && Object.prototype.hasOwnProperty.call(optionValues, rule.key)) {
          return optionValues[rule.key];
        }
        return Dependency_Path_Value(optionValues.__value, rule.key || '__value');
      }
      var values = scope || model;
      return Object.prototype.hasOwnProperty.call(values, rule.id) ? values[rule.id] : Dependency_Path_Value(values, rule.id);
    }

    // 功能：判断实际值是否命中依赖期望集合。
    function Dependency_Contains_Any(actual, expected) {
      var actuals = Dependency_List(actual).map(Dependency_Compare_Value);
      var expects = Dependency_List(expected).map(Dependency_Compare_Value);
      return expects.some(function (item) { return actuals.indexOf(item) !== -1; });
    }

    // 功能：执行单条依赖规则比较。
    function Dependency_Match_Rule(rule, scope) {
      if (!rule) { return true; }
      var actual = Dependency_Source_Value(rule, scope);
      var expected = rule.value;
      var operator = rule.operator || '==';

      if (operator === 'empty') { return Dependency_Is_Empty(actual); }
      if (operator === 'not_empty' || operator === 'not-empty') { return !Dependency_Is_Empty(actual); }
      if (operator === 'truthy') { return Dependency_Bool(actual) === true; }
      if (operator === 'falsy') { return Dependency_Bool(actual) === false; }

      if (operator === 'any' || operator === 'in' || operator === 'contains') {
        return Dependency_Contains_Any(actual, expected);
      }
      if (operator === 'not_any' || operator === 'not-any' || operator === 'not_in' || operator === 'not-in' || operator === 'not_contains') {
        return !Dependency_Contains_Any(actual, expected);
      }

      if (operator === '>' || operator === '>=' || operator === '<' || operator === '<=') {
        var left = Number(actual);
        var right = Number(expected);
        if (Number.isNaN(left)) { left = 0; }
        if (Number.isNaN(right)) { right = 0; }
        if (operator === '>') { return left > right; }
        if (operator === '>=') { return left >= right; }
        if (operator === '<') { return left < right; }
        return left <= right;
      }

      if (operator === '!=') {
        return Dependency_Compare_Value(actual) !== Dependency_Compare_Value(expected);
      }
      return Dependency_Compare_Value(actual) === Dependency_Compare_Value(expected);
    }

    // 功能：执行一个依赖规则组，relation=or/any 时任一满足即可。
    function Dependency_Match_Group(group, scope) {
      var rules = (group && Array.isArray(group.rules)) ? group.rules : [];
      if (!rules.length) { return true; }
      var relation = group.relation || 'and';
      if (relation === 'or' || relation === 'any') {
        return rules.some(function (rule) { return Dependency_Match_Rule(rule, scope); });
      }
      return rules.every(function (rule) { return Dependency_Match_Rule(rule, scope); });
    }

    // 功能：计算字段当前依赖状态。
    function Field_State(f) {
      var dependency = (f && f.eva_dependency) ? f.eva_dependency : {};
      var visible = dependency.visible || null;
      var visibleMatched = visible ? Dependency_Match_Group(visible) : true;
      var visibleAction = visible ? (visible.action || 'hide') : 'hide';
      var disabledMatched = dependency.disabled ? Dependency_Match_Group(dependency.disabled) : false;
      var readonlyMatched = dependency.readonly ? Dependency_Match_Group(dependency.readonly) : false;

      return {
        hidden: !!(visible && !visibleMatched && visibleAction === 'hide'),
        muted: !!(visible && !visibleMatched && visibleAction === 'visible'),
        disabled: !!(disabledMatched || (visible && !visibleMatched && visibleAction === 'disabled')),
        readonly: !!(readonlyMatched || (visible && !visibleMatched && visibleAction === 'readonly')),
      };
    }

    // 功能：判断字段行是否显示。
    function Field_Row_Show(f) {
      return !Field_State(f).hidden;
    }

    // 功能：过滤出当前可显示字段，供 transition-group 做进入/离开动画。
    function Visible_Fields(fields) {
      return (fields || []).filter(Field_Row_Show);
    }

    // 功能：生成字段行 class，加入依赖状态样式。
    function Field_Row_Class(f) {
      var state = Field_State(f);
      return [
        fieldCol(f),
        f && f.class ? f.class : '',
        {
          'is-dependency-muted': state.muted,
          'is-dependency-disabled': state.disabled,
          'is-dependency-readonly': state.readonly,
          'has-error': !!Field_Error(f),
        }
      ];
    }

    // 功能：为字段组件合并依赖产生的 disabled/readonly 状态。
    function Field_For_Render(f) {
      var state = Field_State(f);
      var rendered = (!state.disabled && !state.readonly) ? f : Object.assign({}, f, {
        disabled: state.disabled || f.disabled,
        readonly: state.readonly || f.readonly,
      });
      if (f && f.type === 'builder' && Array.isArray(f.global_fields)) {
        rendered = Object.assign({}, rendered, { global_values: model });
      }
      if (f && f.type === 'builder' && Array.isArray(f.fixed_structure)) {
        rendered = Object.assign({}, rendered, { structure_values: model });
      }
      if (f && f.type === 'builder' && Array.isArray(f.container_fields)) {
        rendered = Object.assign({}, rendered, { container_values: model });
      }
      return rendered;
    }


    return { Field_Row_Show: Field_Row_Show, Visible_Fields: Visible_Fields, Field_Row_Class: Field_Row_Class, Field_For_Render: Field_For_Render };
  };
})(window.EvaApp = window.EvaApp || {});
