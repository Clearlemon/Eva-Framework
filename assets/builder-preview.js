(function () {
  document.body.classList.add('eva-builder-preview');

  var menuState = { active: false, location: '', dragging: false, target: '' };
  var selectedStructure = '';
  var widgetState = { active: false, area: '', dragging: false, target: '' };

  function updateWidgetAreas() {
    document.body.classList.toggle('eva-builder-widget-mode', widgetState.active);
    document.body.classList.toggle('eva-builder-widget-dragging', widgetState.dragging);
    document.querySelectorAll('[data-eva-widget-area]').forEach(function (node) {
      var id = node.getAttribute('data-eva-widget-area');
      node.classList.toggle('eva-builder-widget-selected', widgetState.active && id === widgetState.area);
      node.classList.toggle('eva-builder-widget-drop-target', widgetState.dragging && id === widgetState.target);
      node.setAttribute('tabindex', widgetState.active ? '0' : '-1');
    });
  }

  function updateStructures() {
    document.querySelectorAll('[data-eva-builder-structure]').forEach(function (node) {
      node.classList.toggle('eva-builder-structure-selected', node.getAttribute('data-eva-builder-structure') === selectedStructure);
      node.setAttribute('tabindex', '0');
    });
  }

  function selectStructure(node) {
    selectedStructure = node.getAttribute('data-eva-builder-structure') || '';
    setSelected('');
    updateStructures();
    window.parent.postMessage({ type: 'eva-builder-structure-select', id: selectedStructure }, window.location.origin);
  }

  function updateMenuLocations() {
    document.body.classList.toggle('eva-builder-menu-mode', menuState.active);
    document.body.classList.toggle('eva-builder-menu-dragging', menuState.dragging);
    document.querySelectorAll('[data-eva-menu-location]').forEach(function (node) {
      var id = node.getAttribute('data-eva-menu-location');
      node.classList.toggle('eva-builder-menu-selected', menuState.active && id === menuState.location);
      node.classList.toggle('eva-builder-menu-drop-target', menuState.dragging && id === menuState.target);
      if (node.hasAttribute('data-eva-menu-empty')) {
        node.setAttribute('role', 'button');
        node.setAttribute('aria-label', '选择菜单位置：' + node.getAttribute('data-eva-menu-label'));
        node.setAttribute('tabindex', menuState.active ? '0' : '-1');
      }
    });
  }

  function selectMenuLocation(node) {
    var id = node.getAttribute('data-eva-menu-location') || '';
    if (!id) { return; }
    menuState.location = id;
    updateMenuLocations();
    window.parent.postMessage({ type: 'eva-builder-menu-location-select', location: id }, window.location.origin);
  }

  function ensureSlot(id) {
    var el = document.querySelector('[data-eva-builder-slot="' + id + '"]');
    return el;
  }

  function setSelected(uid) {
    document.querySelectorAll('.eva-builder-preview-module.is-selected').forEach(function (el) {
      el.classList.remove('is-selected');
    });
    if (!uid) { return; }
    var active = document.querySelector('[data-eva-builder-module="' + uid + '"]');
    if (active) { active.classList.add('is-selected'); }
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin || event.source !== window.parent || !event.data) { return; }
    if (event.data.type === 'eva-builder-drag-state') {
      document.body.classList.toggle('eva-builder-is-dragging', !!event.data.active);
      menuState.dragging = !!event.data.active && event.data.moduleType === 'wp_menu';
      menuState.target = menuState.dragging ? String(event.data.menuLocation || '') : '';
      updateMenuLocations();
      widgetState.dragging = !!event.data.widgetDragging;
      widgetState.target = widgetState.dragging ? String(event.data.widgetArea || '') : '';
      updateWidgetAreas();
      return;
    }
    if (event.data.type === 'eva-builder-widget-state') {
      widgetState.active = !!event.data.active;
      widgetState.area = String(event.data.area || '');
      updateWidgetAreas();
      return;
    }
    if (event.data.type === 'eva-builder-menu-state') {
      menuState.active = !!event.data.active;
      menuState.location = String(event.data.location || '');
      updateMenuLocations();
      return;
    }
    if (event.data.type !== 'eva-builder-preview-html') { return; }
    var slots = event.data.slots || {};
    Object.keys(slots).forEach(function (slot) {
      var target = ensureSlot(slot);
      var html = slots[slot] || '';
      if (target && target.innerHTML !== html) { target.innerHTML = html; }
    });
    var structures = event.data.structures || {};
    Object.keys(structures).forEach(function (id) {
      var target = Array.from(document.querySelectorAll('[data-eva-builder-structure]')).find(function (node) { return node.getAttribute('data-eva-builder-structure') === id; });
      if (target && typeof structures[id] === 'string' && structures[id] && target.outerHTML !== structures[id]) {
        target.outerHTML = structures[id];
      }
    });
    selectedStructure = event.data.selectedStructure || '';
    setSelected(event.data.selectedUid || '');
    updateStructures();
    updateMenuLocations();
    updateWidgetAreas();
  });

  document.addEventListener('click', function (event) {
    var widgetArea = event.target.closest('[data-eva-widget-area]');
    if (widgetArea && widgetState.active) {
      event.preventDefault();
      event.stopPropagation();
      widgetState.area = widgetArea.getAttribute('data-eva-widget-area');
      updateWidgetAreas();
      window.parent.postMessage({ type: 'eva-builder-widget-area-select', area: widgetState.area }, window.location.origin);
      return;
    }
    var structure = event.target.closest('[data-eva-builder-structure]');
    if (structure) {
      event.preventDefault();
      event.stopPropagation();
      selectStructure(structure);
      return;
    }
    var menu = event.target.closest('[data-eva-menu-location]');
    if (menu && menuState.active) {
      event.preventDefault();
      event.stopPropagation();
      selectMenuLocation(menu);
      return;
    }
    var actionButton = event.target.closest('[data-eva-builder-action]');
    var module = event.target.closest('[data-eva-builder-module]');
    if (!module) { return; }
    event.preventDefault();
    event.stopPropagation();
    var uid = module.getAttribute('data-eva-builder-module') || '';
    setSelected(uid);
    window.parent && window.parent.postMessage({
      type: 'eva-builder-module-action',
      uid: uid,
      action: actionButton ? actionButton.getAttribute('data-eva-builder-action') : 'select'
    }, window.location.origin);
  }, true);

  document.addEventListener('keydown', function (event) {
    var widgetArea = event.target.closest('[data-eva-widget-area]');
    if (widgetArea && widgetState.active && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      widgetState.area = widgetArea.getAttribute('data-eva-widget-area');
      updateWidgetAreas();
      window.parent.postMessage({ type: 'eva-builder-widget-area-select', area: widgetState.area }, window.location.origin);
      return;
    }
    var structure = event.target.closest('[data-eva-builder-structure]');
    if (structure && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      selectStructure(structure);
      return;
    }
    var menu = event.target.closest('[data-eva-menu-empty]');
    if (menu && menuState.active && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      selectMenuLocation(menu);
    }
  });

  updateStructures();
  window.parent && window.parent.postMessage({ type: 'eva-builder-preview-ready' }, window.location.origin);
}());
