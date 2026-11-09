(function () {
  document.body.classList.add('eva-builder-preview');

  var menuState = { active: false, location: '', dragging: false, target: '' };
  var selectedStructure = '';
  var widgetState = { active: false, area: '', dragging: false, target: '' };
  var slotState = { dragging: false, target: '', uid: '', labels: {} };
  var appliedSlotHtml = new WeakMap();
  var modulePointer = null;
  var moduleScrollFrame = 0;
  var suppressModuleClickUntil = 0;

  function postModulePointer(phase, pointer) {
    window.parent.postMessage({ type: 'eva-builder-module-drag', phase: phase, uid: pointer.uid, x: pointer.x, y: pointer.y }, window.location.origin);
  }

  function finishModulePointer(phase, notify) {
    var pointer = modulePointer;
    if (!pointer) { return; }
    modulePointer = null;
    cancelAnimationFrame(moduleScrollFrame);
    moduleScrollFrame = 0;
    if (pointer.active) { suppressModuleClickUntil = Date.now() + 500; }
    if (pointer.handle.hasPointerCapture(pointer.id)) { pointer.handle.releasePointerCapture(pointer.id); }
    if (notify && pointer.active) { postModulePointer(phase, pointer); }
  }

  function scrollModulePointer() {
    moduleScrollFrame = 0;
    var pointer = modulePointer;
    if (!pointer || !pointer.active) { return; }
    var page = document.scrollingElement;
    if (page && pointer.x >= 0 && pointer.x <= window.innerWidth) {
      var delta = pointer.y < 56 ? -Math.min(20, (56 - pointer.y) / 3) : (pointer.y > window.innerHeight - 56 ? Math.min(20, (pointer.y - window.innerHeight + 56) / 3) : 0);
      var top = page.scrollTop;
      if (delta) { page.scrollTop += delta; }
      if (page.scrollTop !== top) { postModulePointer('move', pointer); }
    }
    moduleScrollFrame = requestAnimationFrame(scrollModulePointer);
  }

  document.addEventListener('pointerdown', function (event) {
    var handle = event.target.closest('[data-eva-builder-drag-handle]');
    var module = handle && handle.closest('[data-eva-builder-module]');
    if (!module || event.button !== 0 || !event.isPrimary) { return; }
    event.preventDefault();
    event.stopPropagation();
    finishModulePointer('cancel', true);
    handle.focus({ preventScroll: true });
    modulePointer = { id: event.pointerId, handle: handle, uid: module.getAttribute('data-eva-builder-module'), startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false };
    handle.setPointerCapture(event.pointerId);
  }, true);

  document.addEventListener('pointermove', function (event) {
    var pointer = modulePointer;
    if (!pointer || event.pointerId !== pointer.id) { return; }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    // 轻点手柄仍然只选中组件，移动超过 6px 才进入跨插槽拖动。
    if (!pointer.active && Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) < 6) { return; }
    event.preventDefault();
    event.stopPropagation();
    var phase = pointer.active ? 'move' : 'start';
    pointer.active = true;
    postModulePointer(phase, pointer);
    if (!moduleScrollFrame) { moduleScrollFrame = requestAnimationFrame(scrollModulePointer); }
  }, true);

  document.addEventListener('pointerup', function (event) {
    if (!modulePointer || event.pointerId !== modulePointer.id) { return; }
    modulePointer.x = event.clientX;
    modulePointer.y = event.clientY;
    if (modulePointer.active) { event.preventDefault(); event.stopPropagation(); }
    finishModulePointer('drop', true);
  }, true);

  function cancelModulePointer(event) {
    if (modulePointer && (event.pointerId === undefined || event.pointerId === modulePointer.id)) { finishModulePointer('cancel', true); }
  }
  document.addEventListener('pointercancel', cancelModulePointer, true);
  document.addEventListener('lostpointercapture', cancelModulePointer, true);
  window.addEventListener('blur', cancelModulePointer);
  window.addEventListener('pagehide', cancelModulePointer);
  document.addEventListener('dragstart', function (event) {
    if (event.target.closest('[data-eva-builder-module]')) { event.preventDefault(); }
  }, true);

  // 空区域始终显示名称；当前命中区域与真正投放使用同一套坐标判定。
  function updateSlots() {
    document.body.classList.toggle('eva-builder-module-dragging', slotState.dragging);
    document.querySelectorAll('[data-eva-builder-slot]').forEach(function (node) {
      var id = node.getAttribute('data-eva-builder-slot');
      node.setAttribute('data-eva-builder-slot-title', slotState.labels[id] || id);
      node.classList.toggle('eva-builder-slot-drop-target', slotState.dragging && id === slotState.target);
    });
    document.querySelectorAll('[data-eva-builder-module]').forEach(function (node) {
      node.classList.toggle('eva-builder-module-moving', slotState.dragging && node.getAttribute('data-eva-builder-module') === slotState.uid);
    });
  }

  var observedMenuLabels = new WeakSet();
  var menuLabelObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(function (entries) {
    entries.forEach(function (entry) {
      var node = entry.target.closest('[data-eva-menu-empty]');
      if (node) { updateMenuLabel(node); }
    });
  }) : null;

  function updateMenuLabel(node) {
    var label = node.querySelector('.eva-builder-menu-empty-label');
    var text = label && label.firstElementChild;
    if (!text) { return; }
    var distance = Math.max(0, text.scrollWidth - label.clientWidth);
    node.classList.toggle('eva-builder-menu-label-overflow', distance > 1);
    node.style.setProperty('--eva-menu-marquee-distance', -distance + 'px');
    node.style.setProperty('--eva-menu-marquee-duration', Math.max(3, distance / 30 + 1) + 's');
    if (menuLabelObserver && !observedMenuLabels.has(label)) {
      observedMenuLabels.add(label);
      menuLabelObserver.observe(label);
    }
  }

  window.addEventListener('resize', function () {
    document.querySelectorAll('[data-eva-menu-empty]').forEach(updateMenuLabel);
  });

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
        updateMenuLabel(node);
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
    if (event.data.type === 'eva-builder-module-move') {
      var destination = ensureSlot(event.data.slot);
      var module = Array.from(document.querySelectorAll('[data-eva-builder-module]')).find(function (node) { return node.getAttribute('data-eva-builder-module') === event.data.uid; });
      if (!destination || !module) { return; }
      var source = module.closest('[data-eva-builder-slot]');
      var siblings = Array.from(destination.children).filter(function (node) { return node !== module && node.hasAttribute('data-eva-builder-module'); });
      destination.insertBefore(module, siblings[event.data.index] || null);
      if (source) { appliedSlotHtml.delete(source); }
      appliedSlotHtml.delete(destination);
      updateSlots();
      return;
    }
    if (event.data.type === 'eva-builder-drag-state') {
      document.body.classList.toggle('eva-builder-is-dragging', !!event.data.active);
      slotState.dragging = !!event.data.active && !!event.data.moduleType && !event.data.widgetDragging;
      slotState.target = slotState.dragging ? String(event.data.slot || '') : '';
      slotState.uid = slotState.dragging ? String(event.data.uid || '') : '';
      if (!slotState.dragging && modulePointer && modulePointer.active) { finishModulePointer('cancel', false); }
      updateSlots();
      menuState.dragging = !!event.data.active && event.data.moduleType === 'wp_menu' && !event.data.uid;
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
    slotState.labels = event.data.slotLabels || {};
    var slots = event.data.slots || {};
    Object.keys(slots).forEach(function (slot) {
      var target = ensureSlot(slot);
      var html = slots[slot] || '';
      // Vue/Flickity 会增强已渲染 DOM；相同服务端内容不能因此重复重建。
      if (target && target.innerHTML !== html && appliedSlotHtml.get(target) !== html) {
        target.innerHTML = html;
        appliedSlotHtml.set(target, html);
      }
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
    updateSlots();
  });

  document.addEventListener('click', function (event) {
    if (Date.now() < suppressModuleClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
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
    // 原生控件继续交给组件；链接仍由编辑器拦截，避免离开预览页。
    if (!actionButton && !event.target.closest('[data-eva-builder-drag-handle]') && event.target.closest('button, input, select, textarea, [role="button"], [contenteditable="true"]')) { return; }
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
    if (event.key === 'Escape' && modulePointer) {
      event.preventDefault();
      event.stopPropagation();
      finishModulePointer('cancel', true);
      return;
    }
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

  updateSlots();
  updateStructures();
  window.parent && window.parent.postMessage({ type: 'eva-builder-preview-ready' }, window.location.origin);
}());
