/** 主题色与字体偏好，含保存失败回滚。 */
(function (app) {
  'use strict';
  app.appearance = function (cfg, savePref) {

    // 主题色：选中后覆盖 --eva-primary 系列变量到根节点
    var accents = [
      { key: 'coral', label: '珊瑚粉', color: '#ff758c', c600: '#f0607a', c050: '#ffe0e8' },
      { key: 'blue', label: '蓝', color: '#3b82f6', c600: '#2563eb', c050: '#eff6ff' },
      { key: 'cyan', label: '青', color: '#06b6d4', c600: '#0891b2', c050: '#ecfeff' },
      { key: 'emerald', label: '绿', color: '#10b981', c600: '#059669', c050: '#ecfdf5' },
      { key: 'amber', label: '橙', color: '#f59e0b', c600: '#d97706', c050: '#fffbeb' },
      { key: 'rose', label: '玫红', color: '#f43f5e', c600: '#e11d48', c050: '#fff1f2' },
      { key: 'violet', label: '紫', color: '#8b5cf6', c600: '#7c3aed', c050: '#f5f3ff' },
      { key: 'indigo', label: '靛紫', color: '#6366f1', c600: '#4f46e5', c050: '#eef0fe' },
    ];
    // 默认值来自服务端：用户挑过就是他挑的那档；没挑过则去匹配主题用 \Eva::setThemeColor()
    // 指定的品牌色——品牌色不在这 8 档里就一档都不高亮（颜色本身由 PHP 输出的 :root 令牌负责）。
    var savedAccent = (cfg.accent && cfg.accent.key) ? String(cfg.accent.key) : '';
    var brandColor = String(cfg.themeColor || '').toLowerCase();
    var brandAccent = accents.filter(function (a) { return a.color.toLowerCase() === brandColor; })[0];
    var accent = Vue.ref(savedAccent || (brandAccent ? brandAccent.key : (brandColor ? '' : 'coral')));

    // 令牌写在 <html> 的行内样式上，而不是 .eva-admin 上：行内样式盖得过 PHP 输出的 :root 规则，
    // 且同一页里 #eva-app 之外的 Eva 界面（postbox 皮肤、短代码弹窗、嵌入式容器…）也都吃得到。
    function applyAccent(a) {
      var root = document.documentElement;
      if (!root || !root.style) { return; }
      root.style.setProperty('--eva-primary', a.color);
      root.style.setProperty('--eva-primary-600', a.c600);
      root.style.setProperty('--eva-primary-050', a.c050);
    }

    function clearAccent() {
      var root = document.documentElement;
      if (!root || !root.style) { return; }
      root.style.removeProperty('--eva-primary');
      root.style.removeProperty('--eva-primary-600');
      root.style.removeProperty('--eva-primary-050');
    }

    function setAccent(a) {
      var prev = accent.value;
      accent.value = a.key; // 乐观更新
      applyAccent(a);
      savePref(
        'action=eva_fw_set_accent' +
        '&key=' + encodeURIComponent(a.key) +
        '&color=' + encodeURIComponent(a.color) +
        '&c600=' + encodeURIComponent(a.c600) +
        '&c050=' + encodeURIComponent(a.c050),
        function () {
          // 保存失败回滚：连颜色一起退回上一档，没有上一档就把行内令牌撤掉交还给 :root。
          accent.value = prev;
          var back = accents.filter(function (x) { return x.key === prev; })[0];
          if (back) { applyAccent(back); } else { clearAccent(); }
        }
      );
    }

    // 界面字体：默认使用系统字体，可切换为主题同款的荆南麦圆体。
    // 该偏好只属于当前浏览器，不随业务设置表单提交。
    var fontStorageKey = 'eva_fw_ui_font';
    var fontOptions = [
      { key: 'default', labelKey: 'font_default', icon: 'ri-font-size-2' },
      { key: 'jingnan', labelKey: 'font_jingnan', icon: 'ri-quill-pen-line' },
    ];
    var storedFont = '';
    try { storedFont = window.localStorage.getItem(fontStorageKey) || ''; } catch (e) {}
    var uiFont = Vue.ref(fontOptions.some(function (font) { return font.key === storedFont; }) ? storedFont : 'default');
    function setFont(font) {
      if (!font || !fontOptions.some(function (item) { return item.key === font.key; })) return;
      uiFont.value = font.key;
      try { window.localStorage.setItem(fontStorageKey, font.key); } catch (e) {}
    }


    return { accents: accents, accent: accent, setAccent: setAccent, fontOptions: fontOptions, uiFont: uiFont, setFont: setFont };
  };
})(window.EvaApp = window.EvaApp || {});
