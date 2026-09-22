(function () {
  document.body.classList.add('eva-builder-preview');

  function ensureSlot(id) {
    var el = document.querySelector('[data-eva-builder-slot="' + id + '"]');
    if (!el) {
      el = document.createElement('div');
      el.className = 'eva-builder-preview-slot';
      el.setAttribute('data-eva-builder-slot', id);
      el.setAttribute('data-eva-builder-slot-title', id);
      document.body.appendChild(el);
    }
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
    if (event.origin !== window.location.origin || !event.data) { return; }
    if (event.data.type === 'eva-builder-drag-state') {
      document.body.classList.toggle('eva-builder-is-dragging', !!event.data.active);
      return;
    }
    if (event.data.type !== 'eva-builder-preview-html') { return; }
    var slots = event.data.slots || {};
    Object.keys(slots).forEach(function (slot) {
      ensureSlot(slot).innerHTML = slots[slot] || '';
    });
    setSelected(event.data.selectedUid || '');
  });

  document.addEventListener('click', function (event) {
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

  window.parent && window.parent.postMessage({ type: 'eva-builder-preview-ready' }, window.location.origin);
}());
