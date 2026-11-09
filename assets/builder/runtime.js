/** 构建器公共数据工具、模块注册和可取消动画；先于各业务模块加载。 */
(function () {
  'use strict';
  window.EvaModules = window.EvaModules || {};
  var UID_SEED = 0;
  var MENU_ADD_SEED = 0;
  var cfg = (window.EvaFW && window.EvaFW.config) || {};
  var gsapPromise = null;

  // 功能：按需加载 GSAP，页面构建器折叠/展开动画复用。
  function loadGsap() {
    if (window.gsap) { return Promise.resolve(window.gsap); }
    if (gsapPromise) { return gsapPromise; }
    var url = new URL(cfg.gsapUrl || 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js', document.baseURI).href;
    gsapPromise = new Promise(function (resolve, reject) {
      var script = Array.from(document.scripts).find(function (item) { return item.src === url; });
      var created = !script;
      if (!script) { script = document.createElement('script'); script.src = url; script.async = true; }
      var timer = window.setTimeout(function () { finish(new Error('GSAP load timed out')); }, 8000);

      function finish(error) {
        window.clearTimeout(timer);
        script.removeEventListener('load', loaded); script.removeEventListener('error', failed);
        if (error) { if (created) { script.remove(); } reject(error); } else { resolve(window.gsap); }
      }

      function loaded() { finish(window.gsap ? null : new Error('GSAP unavailable')); }

      function failed() { finish(new Error('GSAP load failed')); }
      script.addEventListener('load', loaded, { once: true }); script.addEventListener('error', failed, { once: true });
      if (created) { document.head.appendChild(script); }
    }).catch(function (error) { gsapPromise = null; throw error; });
    return gsapPromise;
  }


  // Top-level tab transitions are cancellable and owned by the builder instance.
  function menuReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function clearMenuMotion(el) {
    ['opacity', 'transform', 'willChange', 'pointerEvents'].forEach(function (name) { el.style[name] = ''; });
    el.inert = false;
    if (el.classList.contains('eva-pb-tab-content')) { ['position', 'top', 'left', 'width'].forEach(function (name) { el.style[name] = ''; }); }
  }

  function stopMenuMotion(el, clear) {
    var state = el && el._evaMenuMotion;
    if (state) {
      state.cancelled = true;
      if (state.frame) { window.cancelAnimationFrame(state.frame); }
      if (state.timer) { window.clearTimeout(state.timer); }
      if (state.tween) { state.tween.kill(); }
      if (state.owner._menuMotionElements) { state.owner._menuMotionElements.delete(el); }
      el._evaMenuMotion = null;
    }
    if (el && clear) { clearMenuMotion(el); }
  }

  function runModuleTabMotion(owner, el, done, entering, options) {
    options = options || {};
    stopMenuMotion(el, false);
    var state = { owner: owner, cancelled: false, tween: null, frame: 0, timer: 0 };
    el._evaMenuMotion = state;
    owner._menuMotionElements = owner._menuMotionElements || new Set();
    owner._menuMotionElements.add(el);

    function finish() {
      if (state.cancelled || el._evaMenuMotion !== state) { return; }
      stopMenuMotion(el, true);
      if (done) { done(); }
      if (options.onComplete) { options.onComplete(); }
    }
    state.finish = finish;
    if (owner._menuMotionDisposed || menuReducedMotion()) { finish(); return; }
    if (!entering) { el.style.pointerEvents = 'none'; el.inert = true; }
    // A slow or failed dependency must never leave controls invisible or block Vue removal.
    state.timer = window.setTimeout(finish, 400);
    loadGsap().then(function (gsap) {
      if (state.cancelled || !gsap) { if (!state.cancelled) { finish(); } return; }
      window.clearTimeout(state.timer);
      state.frame = window.requestAnimationFrame(function () {
        if (state.cancelled || owner._menuMotionDisposed || !el.isConnected) { finish(); return; }
        el.style.willChange = 'opacity,transform';
        var vars = { opacity: entering ? 1 : 0, duration: entering ? .3 : .2, ease: entering ? 'power3.out' : 'power2.in', x: entering ? 0 : -options.direction * options.distance, y: 0, overwrite: 'auto', onComplete: finish };
        if (entering) {
          state.tween = gsap.fromTo(el, { opacity: 0, x: options.direction * options.distance, y: 0 }, vars);
        } else { state.tween = gsap.to(el, vars); }
      });
    }).catch(finish);
  }

  // 功能：生成模块实例唯一 id。
  function genUid() {
    UID_SEED += 1;
    return 'm' + Date.now().toString(36) + UID_SEED.toString(36);
  }

  // 功能：深拷贝纯数据（实例值均可 JSON 序列化）。
  function clone(value) {
    if (value === null || value === undefined) { return value; }
    try { return JSON.parse(JSON.stringify(value)); } catch (e) { return value; }
  }

  // 功能：判断对象自有属性。
  function hasOwn(obj, key) {
    return obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  // 功能：判断 Builder 模块字段的 CSF/Eva dependency 是否成立。
  function dependencyRuleMatches(rule, values) {
    if (!Array.isArray(rule) || !rule.length) { return true; }
    var source = String(rule[0] || '');
    var operator = String(rule[1] || '==').toLowerCase();
    var expected = rule.length > 2 ? rule[2] : '';
    var actual = hasOwn(values, source) ? values[source] : '';
    var actualList = Array.isArray(actual) ? actual.map(String) : [String(actual === null || actual === undefined ? '' : actual)];
    var expectedList = Array.isArray(expected) ? expected.map(String) : [String(expected === null || expected === undefined ? '' : expected)];
    var intersects = expectedList.some(function (value) { return actualList.indexOf(value) !== -1; });

    if (operator === '!=' || operator === '!==' || operator === 'not' || operator === 'neq' || operator === 'not-any' || operator === 'not_in') {
      return !intersects;
    }
    if (operator === 'empty') {
      return actualList.length === 0 || (actualList.length === 1 && actualList[0] === '');
    }
    if (operator === 'not-empty' || operator === 'not_empty') {
      return actualList.length > 0 && !(actualList.length === 1 && actualList[0] === '');
    }
    return intersects;
  }

  // 功能：支持单条依赖和多条依赖；多条规则默认全部成立才显示。
  function dependencyVisible(field, values) {
    var dependency = field && field.dependency;
    if (!Array.isArray(dependency) || !dependency.length) { return true; }
    var rules = Array.isArray(dependency[0]) ? dependency : [dependency];
    return rules.every(function (rule) { return dependencyRuleMatches(rule, values || {}); });
  }

  // 功能：转义预览中的文本，避免模块预览直接拼接用户输入。
  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Builder 不再内置示例模块；模块由 PHP manifest 或用户脚本显式注册。

  var runtimeModules = cfg.builderModules || {};
  Object.keys(runtimeModules).forEach(function (key) {
    var existing = window.EvaModules[key] || {};
    window.EvaModules[key] = Object.assign({}, runtimeModules[key], existing);
  });

  function storedPanelOpacity() {
    var value = 88;
    try {
      var stored = parseInt(window.localStorage.getItem('eva_fw_panel_opacity'), 10);
      if (!isNaN(stored)) value = stored;
    } catch (e) {}
    return Math.max(40, Math.min(100, value));
  }

  function previewRoleOptions() {
    var roles = Array.isArray(cfg.builderPreviewRoles) ? cfg.builderPreviewRoles : [];
    return roles.length ? roles : [
      { value: 'current', label: '当前用户' },
      { value: 'guest', label: '游客' }
    ];
  }

  function storedPreviewRole() {
    var roles = previewRoleOptions();
    var value = cfg.builderPreviewRole || 'current';
    try {
      var stored = window.localStorage.getItem('eva_fw_builder_preview_role') || '';
      if (roles.some(function (role) { return String(role.value) === String(stored); })) {
        value = stored;
      }
    } catch (e) {}
    return roles.some(function (role) { return String(role.value) === String(value); }) ? String(value) : 'current';
  }

  function genMenuAddId() { return 'eva-menu-add-' + (++MENU_ADD_SEED); }

  window.EvaBuilder = {
    config: cfg,
    loadGsap: loadGsap,
    menuReducedMotion: menuReducedMotion,
    clearMenuMotion: clearMenuMotion,
    stopMenuMotion: stopMenuMotion,
    runModuleTabMotion: runModuleTabMotion,
    genUid: genUid,
    clone: clone,
    hasOwn: hasOwn,
    dependencyVisible: dependencyVisible,
    esc: esc,
    storedPanelOpacity: storedPanelOpacity,
    previewRoleOptions: previewRoleOptions,
    storedPreviewRole: storedPreviewRole,
    genMenuAddId: genMenuAddId
  };
})();
