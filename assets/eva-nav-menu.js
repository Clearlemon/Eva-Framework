/** WordPress menu-item WP / Eva tabs. No field runtime is needed for legacy CSF fields. */
(function () {
  'use strict';
  var storageKey = 'eva_nav_item_tab';
  var customFields = '.eva-nav-fields, .csf-nav-menu-options';

  function rememberedMode() {
    try { return window.sessionStorage.getItem(storageKey) === 'eva' ? 'eva' : 'wp'; }
    catch (error) { return 'wp'; }
  }

  function classify(element) {
    if (element.tagName === 'INPUT' || element.classList.contains('menu-item-actions') || element.classList.contains('eva-mi-tabs')) { return ''; }
    if (element.matches(customFields) || element.querySelector(customFields)) { return 'custom'; }
    if (element.tagName === 'P' || element.tagName === 'FIELDSET' || element.classList.contains('description-group') || element.classList.contains('field-move-combo')) { return 'native'; }
    return 'custom';
  }

  function setup(settings) {
    if (!settings.querySelector(customFields)) { return; }
    Array.prototype.forEach.call(settings.children, function (element) {
      var kind = classify(element);
      if (kind) { element.classList.add(kind === 'custom' ? 'eva-mi-custom' : 'eva-mi-native'); }
    });
    var existing = settings.querySelector('.eva-mi-tabs');
    if (existing && settings._evaMenuTabs === existing) { return; }
    if (existing) { existing.remove(); }
    var tabs = document.createElement('div');
    tabs.className = 'eva-switch-tabs eva-switch-tabs--block eva-mi-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '菜单项设置切换');
    tabs.innerHTML = '<button type="button" class="eva-switch-tab" role="tab" data-eva-tab="wp"><i class="ri-wordpress-fill" aria-hidden="true"></i><span>WP 设置</span></button>'
      + '<button type="button" class="eva-switch-tab" role="tab" data-eva-tab="eva"><i class="ri-sparkling-2-fill" aria-hidden="true"></i><span>Eva 设置</span></button>';
    var buttons = tabs.querySelectorAll('[data-eva-tab]');

    function select(mode, remember) {
      mode = mode === 'eva' ? 'eva' : 'wp';
      settings.classList.toggle('eva-mi-eva', mode === 'eva');
      settings.classList.toggle('eva-mi-wp', mode === 'wp');
      Array.prototype.forEach.call(buttons, function (button) {
        var active = button.getAttribute('data-eva-tab') === mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        button.tabIndex = active ? 0 : -1;
      });
      if (remember) {
        try { window.sessionStorage.setItem(storageKey, mode); } catch (error) {}
      }
    }

    Array.prototype.forEach.call(buttons, function (button, index) {
      button.addEventListener('click', function () { select(button.getAttribute('data-eva-tab'), true); });
      button.addEventListener('keydown', function (event) {
        var next;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { next = (index + 1) % buttons.length; }
        else if (event.key === 'Home') { next = 0; }
        else if (event.key === 'End') { next = buttons.length - 1; }
        else { return; }
        event.preventDefault();
        buttons[next].focus();
        select(buttons[next].getAttribute('data-eva-tab'), true);
      });
    });
    settings.insertBefore(tabs, settings.firstChild);
    settings._evaMenuTabs = tabs;
    select(rememberedMode(), false);
  }

  function init(root) {
    root = root || document;
    if (root.nodeType === 1) {
      var settings = root.closest('.menu-item-settings');
      if (settings) { setup(settings); }
    }
    root.querySelectorAll('.menu-item-settings').forEach(setup);
  }

  function boot() {
    init();
    var menu = document.getElementById('menu-to-edit');
    if (menu && typeof MutationObserver !== 'undefined') {
      new MutationObserver(function (records) {
        records.forEach(function (record) {
          record.addedNodes.forEach(function (node) { if (node.nodeType === 1) { init(node); } });
        });
      }).observe(menu, { childList: true, subtree: true });
    }
  }
  window.EvaNavMenu = { init: init };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }
})();
