/** 浏览器图标项目、Symbol 脚本加载与偏好保存。 */
(function (app) {
  'use strict';
  app.iconfont = function (t) {

    // Iconfont Symbol 项目管理：保存在当前浏览器，并在图标选择器中即时刷新。
    var iconfontStorageKey = 'eva_fw_iconfont_svg_url';
    var iconfontUrl = Vue.ref('');
    var iconfontProjects = Vue.ref(['']);
    var activeIconfontProject = Vue.ref(0);
    var iconfontMsg = Vue.ref('');

    function normalizeIconfontUrl(url) {
      url = String(url || '').trim();
      if (!url) return '';
      if (url.indexOf('//') === 0) return 'https:' + url;
      if (/^https?:\/\//i.test(url)) return url;
      return '';
    }

    function parseIconfontUrls(value) {
      var seen = {};
      return String(value || '').split(/[\n,]+/).map(normalizeIconfontUrl).filter(function (url) {
        if (!url || seen[url]) return false;
        seen[url] = true;
        return true;
      });
    }

    function iconfontProjectsFromValue(value) {
      var raw = String(value || '').split(/[\n,]+/).map(function (item) { return item.trim(); }).filter(Boolean);
      return raw.length ? raw : [''];
    }

    function syncIconfontUrlFromProjects() {
      iconfontUrl.value = iconfontProjects.value.join('\n').trim();
    }

    function selectIconfontProject(index) {
      activeIconfontProject.value = index;
    }

    function addIconfontProject() {
      iconfontProjects.value.push('');
      activeIconfontProject.value = iconfontProjects.value.length - 1;
      syncIconfontUrlFromProjects();
    }

    function removeIconfontProject(index) {
      iconfontProjects.value.splice(index, 1);
      if (!iconfontProjects.value.length) iconfontProjects.value.push('');
      if (activeIconfontProject.value >= iconfontProjects.value.length) {
        activeIconfontProject.value = iconfontProjects.value.length - 1;
      }
      syncIconfontUrlFromProjects();
    }

    function dispatchIconfontLoaded() {
      var event;
      if (typeof window.CustomEvent === 'function') {
        event = new CustomEvent('eva:iconfont-loaded');
      } else {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent('eva:iconfont-loaded', false, false, {});
      }
      window.dispatchEvent(event);
    }

    function countIconfontSymbols() {
      return document.querySelectorAll('symbol[id]').length;
    }

    function loadIconfontScript(url, index) {
      url = normalizeIconfontUrl(url);
      if (!url) return Promise.resolve(false);
      return new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.id = 'eva-iconfont-symbol-script-' + index;
        script.setAttribute('data-eva-iconfont-symbol', '1');
        script.src = url;
        script.async = true;
        script.onload = function () {
          dispatchIconfontLoaded();
          window.setTimeout(dispatchIconfontLoaded, 120);
          window.setTimeout(dispatchIconfontLoaded, 360);
          resolve(true);
        };
        script.onerror = function () { reject(new Error('Iconfont load failed')); };
        document.head.appendChild(script);
      });
    }

    function clearIconfontScripts() {
      document.querySelectorAll('script[data-eva-iconfont-symbol="1"]').forEach(function (script) {
        if (script.parentNode) script.parentNode.removeChild(script);
      });
    }

    function loadIconfontScripts(urls) {
      clearIconfontScripts();
      var chain = Promise.resolve();
      urls.forEach(function (url, index) {
        chain = chain.then(function () { return loadIconfontScript(url, index); });
      });
      return chain;
    }

    function initIconfontUrl() {
      try {
        iconfontUrl.value = window.localStorage ? (window.localStorage.getItem(iconfontStorageKey) || '') : '';
      } catch (e) {
        iconfontUrl.value = '';
      }
      if (/^http:\/\/at\.alicdn\.com\//i.test(iconfontUrl.value)) {
        iconfontUrl.value = iconfontUrl.value.replace(/^http:\/\//i, 'https://');
        try {
          if (window.localStorage) window.localStorage.setItem(iconfontStorageKey, iconfontUrl.value);
        } catch (e) {}
      }
      iconfontProjects.value = iconfontProjectsFromValue(iconfontUrl.value);
      var urls = parseIconfontUrls(iconfontUrl.value);
      if (urls.length) {
        iconfontUrl.value = urls.join('\n');
        iconfontProjects.value = urls.slice();
        loadIconfontScripts(urls).catch(function () {});
      }
    }

    function saveIconfontUrl() {
      syncIconfontUrlFromProjects();
      var urls = parseIconfontUrls(iconfontUrl.value);
      if (!urls.length) {
        iconfontMsg.value = iconfontUrl.value ? t('iconfont_invalid') : t('iconfont_cleared');
        try {
          if (window.localStorage) window.localStorage.removeItem(iconfontStorageKey);
        } catch (e) {}
        clearIconfontScripts();
        dispatchIconfontLoaded();
        return;
      }
      iconfontUrl.value = urls.join('\n');
      iconfontProjects.value = urls.slice();
      try {
        if (window.localStorage) window.localStorage.setItem(iconfontStorageKey, iconfontUrl.value);
      } catch (e) {}
      iconfontMsg.value = t('loading');
      loadIconfontScripts(urls).then(function () {
        window.setTimeout(function () {
          var count = countIconfontSymbols();
          iconfontMsg.value = count
            ? t('iconfont_loaded').replace('%d', urls.length).replace('%d', count)
            : t('iconfont_no_symbols');
        }, 380);
        window.setTimeout(function () { iconfontMsg.value = ''; }, 1800);
      }).catch(function () {
        iconfontMsg.value = t('load_failed');
      });
    }

    initIconfontUrl();

    return { iconfontUrl: iconfontUrl, iconfontProjects: iconfontProjects, activeIconfontProject: activeIconfontProject, iconfontMsg: iconfontMsg, selectIconfontProject: selectIconfontProject, addIconfontProject: addIconfontProject, removeIconfontProject: removeIconfontProject, saveIconfontUrl: saveIconfontUrl };
  };
})(window.EvaApp = window.EvaApp || {});
