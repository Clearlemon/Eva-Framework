/** Eva UI: media selector/uploader shared by Upload, Gallery and Media. */
(function () {
  'use strict';
  if (typeof window === 'undefined') { return; }
  window.EvaUI = window.EvaUI || {};

  function cfg() { return (window.EvaFW && window.EvaFW.config) || {}; }
  function restBase() { return (cfg().restUrl || '/wp-json/').replace(/\/+$/, '') + '/'; }
  function fileName(url) {
    url = String(url || '');
    try { return decodeURIComponent((url.split('/').pop() || '').split('?')[0] || 'media'); }
    catch (e) { return (url.split('/').pop() || '').split('?')[0] || 'media'; }
  }
  function extOf(value) {
    var source = value && typeof value === 'object' ? (value.filename || value.url || '') : value;
    var match = String(source || '').toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/);
    return match ? match[1] : '';
  }
  function formatBytes(value) {
    var bytes = Number(value || 0);
    if (!bytes || bytes < 0) { return ''; }
    if (bytes < 1024) { return bytes + ' B'; }
    if (bytes < 1048576) { return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + ' KB'; }
    return (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0) + ' MB';
  }

  function isImage(item) {
    var url = item && item.url ? String(item.url) : String(item || '');
    return /\.(png|jpe?g|gif|webp|svg|avif)(?:\?|#|$)/i.test(url) || /^image\//i.test(item && item.mime ? item.mime : '');
  }
  function formatItem(json) {
    var details = json && json.media_details ? json.media_details : {};
    var sizes = details.sizes || {};
    var thumb = sizes.thumbnail && sizes.thumbnail.source_url ? sizes.thumbnail.source_url : '';
    var medium = sizes.medium && sizes.medium.source_url ? sizes.medium.source_url : '';
    var url = json && json.source_url ? json.source_url : '';
    return {
      id: json && json.id ? json.id : '', url: url,
      thumb: thumb || medium || (json && json.media_type === 'image' ? url : ''),
      title: (json && json.title && json.title.rendered) || (json && json.filename) || fileName(url),
      filename: (json && json.filename) || fileName(url), mime: (json && json.mime_type) || '',
      width: details.width || '', height: details.height || '',
      size: (json && (json.filesizeHumanReadable || json.filesize_human_readable)) || formatBytes(details.filesize),
      alt: (json && json.alt_text) || '', caption: (json && json.caption && json.caption.rendered) || '', description: (json && json.description && json.description.rendered) || '',
      sizes: Object.keys(sizes).reduce(function (out, key) { if (sizes[key] && sizes[key].source_url) { out[key] = sizes[key].source_url; } return out; }, {}), focalX: 50, focalY: 50
    };
  }

  window.EvaUI.Media = {
    props: {
      modelValue: { type: [String, Number, Array, Object], default: '' },
      multiple: { type: Boolean, default: false }, mime: { type: String, default: 'image' },
      title: { type: String, default: '选择媒体' }, buttonTitle: { type: String, default: '选择媒体' },
      library: { type: [String, Array], default: '' }, placeholder: { type: String, default: '点击或拖拽文件到此处' },
      returnType: { type: String, default: '' }, maxSize: { type: [Number, String], default: 5 },
      maxItems: { type: [Number, String], default: 0 }, allowedTypes: { type: [String, Array], default: '' },
      preview: { type: Boolean, default: true }, showDrop: { type: Boolean, default: true },
      sortable: { type: Boolean, default: false }, gallery: { type: Boolean, default: false },
      showMeta: { type: Boolean, default: true },
      layout: { type: String, default: 'list' },
      imageSize: { type: String, default: 'full' },
      allowExternal: { type: Boolean, default: false },
      editableMeta: { type: Boolean, default: false },
      groupBy: { type: String, default: '' },
      minWidth: { type: [Number, String], default: 0 },
      maxWidth: { type: [Number, String], default: 0 }
      ,allowBatchUrl: { type: Boolean, default: false }
    },
    emits: ['update:modelValue'],
    data: function () {
      return { drag: false, uploading: false, error: '', browserOpen: false, browserLoading: false,
        browserError: '', browserQuery: '', browserPage: 1, browserTotalPages: 1, browserItems: [],
        browserPicked: [], itemDragIndex: -1, itemDragOver: -1, externalOpen: false, externalUrl: '',
        editItem: null, editForm: { title: '', alt: '', caption: '', description: '', focalX: 50, focalY: 50 }, editSaving: false,
        batchUrlOpen: false, batchUrls: '', batchImporting: false, batchResult: null,
        boxSelecting: false, boxMoved: false, boxAdditive: false,
        boxStart: { left: 0, top: 0 }, boxRect: { left: 0, top: 0, width: 0, height: 0 },
        boxGridRect: { left: 0, top: 0 }, boxGridElement: null, boxBase: [], suppressNextPick: false,
        boxMoveHandler: null, boxEndHandler: null, boxKeyHandler: null,
        messageText: '', messageType: 'warning', messageTimer: null, galleryLayout: '' };
    },
    mounted: function () {
      this.boxMoveHandler = this.updateBoxSelect.bind(this);
      this.boxEndHandler = this.endBoxSelect.bind(this);
      this.boxKeyHandler = this.selectAllBrowserItems.bind(this);
      document.addEventListener('mousemove', this.boxMoveHandler);
      document.addEventListener('mouseup', this.boxEndHandler);
      document.addEventListener('keydown', this.boxKeyHandler);
    },
    beforeUnmount: function () {
      if (this.boxMoveHandler) { document.removeEventListener('mousemove', this.boxMoveHandler); }
      if (this.boxEndHandler) { document.removeEventListener('mouseup', this.boxEndHandler); }
      if (this.boxKeyHandler) { document.removeEventListener('keydown', this.boxKeyHandler); }
      if (this.messageTimer) { clearTimeout(this.messageTimer); }
    },
    computed: {
      mode: function () {
        var raw = Array.isArray(this.library) ? this.library.join(',') : (this.library || this.mime || 'image');
        raw = String(raw).toLowerCase(); return raw === 'media' ? 'all' : raw;
      },
      items: function () {
        var value = this.modelValue;
        if (value === '' || value === null || typeof value === 'undefined') { return []; }
        return (Array.isArray(value) ? value : [value]).map(this.normalizeItem).filter(Boolean);
      },
      maxCount: function () { var n = parseInt(this.maxItems || 0, 10); return Number.isFinite(n) && n > 0 ? n : 0; },
      maxBytes: function () { return Math.max(0, Number(this.maxSize || 0)) * 1024 * 1024; },
      typeTokens: function () {
        var value = this.allowedTypes;
        var list = Array.isArray(value) ? value.slice() : String(value || '').split(/[\s,|]+/);
        return list.map(function (token) { return String(token || '').trim().toLowerCase().replace(/^\./, ''); }).filter(Boolean);
      },
      accept: function () {
        if (this.typeTokens.length) {
          return this.typeTokens.map(function (token) {
            if (token.indexOf('/') !== -1) { return token; }
            if (token === 'jpg') { token = 'jpeg'; }
            if (['jpeg', 'png', 'gif', 'webp', 'svg+xml', 'avif'].indexOf(token) !== -1) { return 'image/' + token; }
            return '.' + token;
          }).join(',');
        }
        if (this.mode === 'image') { return 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif'; }
        if (this.mode === 'video') { return 'video/*'; }
        if (this.mode === 'audio') { return 'audio/*'; }
        if (this.mode === 'document' || this.mode === 'application') { return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv'; }
        return 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv';
      },
      selectedIds: function () { return this.browserPicked.map(function (item) { return String(item.id || item.url); }); },
      browserGroups: function () {
        if (!this.groupBy) { return [{ key: '', label: '', items: this.browserItems }]; }
        var groups = {}, order = [];
        this.browserItems.forEach(function (item) {
          var key = this.groupKey(item);
          if (!groups[key]) { groups[key] = []; order.push(key); }
          groups[key].push(item);
        }, this);
        return order.map(function (key) { return { key: key, label: key || '未分组', items: groups[key] }; });
      },
      galleryLayouts: function () {
        return [
          { value: 'list', label: '列表', icon: 'ri-list-check-2' },
          { value: 'card', label: '卡片', icon: 'ri-layout-grid-line' },
          { value: 'masonry', label: '瀑布流', icon: 'ri-gallery-line' }
        ];
      },
      currentLayout: function () { return this.gallery ? (this.galleryLayout || this.layout || 'masonry') : this.layout; },
      boxStyle: function () {
        return { left: this.boxRect.left + 'px', top: this.boxRect.top + 'px', width: this.boxRect.width + 'px', height: this.boxRect.height + 'px' };
      },
      dropHint: function () {
        var type = this.mode === 'image' ? '图片' : (this.mode === 'video' ? '视频' : (this.mode === 'audio' ? '音频' : '文件'));
        return '支持' + type + '，单个最大 ' + this.maxSize + 'MB' + (this.maxCount ? '，最多 ' + this.maxCount + ' 个' : '');
      }
    },
    methods: {
      normalizeItem: function (value) {
        if (value && typeof value === 'object') {
          var url = value.url || value.source_url || '';
          return { id: value.id || value.ID || '', url: url, thumb: value.thumb || value.thumbnail || (isImage(value) ? url : ''),
            title: value.title || value.filename || fileName(url), filename: value.filename || fileName(url),
            mime: value.mime || value.mime_type || '', width: value.width || '', height: value.height || '', size: value.size || '',
            alt: value.alt || value.alt_text || '', caption: value.caption || '', description: value.description || '',
            focalX: value.focalX === undefined ? 50 : Number(value.focalX), focalY: value.focalY === undefined ? 50 : Number(value.focalY), sizes: value.sizes || {} };
        }
        if (typeof value === 'number' || /^[0-9]+$/.test(String(value))) {
          return { id: value, url: '', thumb: '', title: '#' + value, filename: '#' + value, mime: '', width: '', height: '', size: '' };
        }
        var text = String(value || '');
        return text ? { id: '', url: text, thumb: isImage(text) ? text : '', title: fileName(text), filename: fileName(text), mime: '', width: '', height: '', size: '', alt: '', caption: '', description: '', focalX: 50, focalY: 50, sizes: {} } : null;
      },
      displayUrl: function (item) {
        var size = String(this.imageSize || 'full').toLowerCase();
        if (item && item.sizes && item.sizes[size]) { return item.sizes[size]; }
        return item && (item.url || item.thumb) ? (item.url || item.thumb) : '';
      },
      groupKey: function (item) {
        if (this.groupBy === 'type') { return (item.mime || 'unknown').split('/')[0] || 'unknown'; }
        if (this.groupBy === 'extension') { return extOf(item) || 'unknown'; }
        return '';
      },
      setGalleryLayout: function (layout) {
        if (!this.gallery || ['list', 'card', 'masonry'].indexOf(layout) === -1) { return; }
        this.galleryLayout = layout;
      },
      serializeItem: function (item) {
        var type = String(this.returnType || (this.multiple ? 'array' : 'url')).toLowerCase();
        if (type === 'id') { return item.id || ''; }
        if (type === 'array' || type === 'object' || type === 'full') { return item; }
        return this.displayUrl(item) || '';
      },
      emitItems: function (items) {
        var next = (items || []).map(this.normalizeItem).filter(Boolean);
        if (this.maxCount) { next = next.slice(0, this.maxCount); }
        this.$emit('update:modelValue', this.multiple ? next.map(this.serializeItem) : (next.length ? this.serializeItem(next[0]) : ''));
      },
      itemAllowed: function (item) {
        var mime = String(item && item.mime || '').toLowerCase(), ext = extOf(item), tokens = this.typeTokens;
        if (tokens.length) {
          return tokens.some(function (token) {
            if (token.indexOf('/') !== -1) { return /\/\*$/.test(token) ? mime.indexOf(token.slice(0, -1)) === 0 : mime === token; }
            return ext === token || (token === 'jpg' && ext === 'jpeg') || (token === 'jpeg' && ext === 'jpg');
          });
        }
        var modes = this.mode.split(',').map(function (mode) { return mode.trim(); });
        if (modes.indexOf('all') !== -1 || modes.indexOf('') !== -1) { return true; }
        return modes.some(function (mode) {
          if (mode === 'image') { return isImage(item); }
          if (mode === 'video') { return /^video\//.test(mime) || ['mp4','webm','mov','m4v','avi'].indexOf(ext) !== -1; }
          if (mode === 'audio') { return /^audio\//.test(mime) || ['mp3','wav','ogg','m4a','aac','flac'].indexOf(ext) !== -1; }
          if (mode === 'document' || mode === 'application') { return /^(application|text)\//.test(mime) || ['pdf','doc','docx','xls','xlsx','ppt','pptx','zip','txt','csv'].indexOf(ext) !== -1; }
          return true;
        });
      },
      openLibrary: function () { this.browserOpen = true; this.browserPicked = this.items.slice(); this.browserPage = 1; this.loadLibrary(); },
      closeLibrary: function () { this.browserOpen = false; this.browserError = ''; },
      loadLibrary: function () {
        var self = this;
        if (!window.fetch) { this.browserError = '当前浏览器不支持媒体库接口。'; return; }
        var params = new URLSearchParams(); params.set('per_page', '24'); params.set('page', String(this.browserPage));
        if (['image','video','audio'].indexOf(this.mode) !== -1) { params.set('media_type', this.mode); }
        if (this.mode === 'document' || this.mode === 'application') { params.set('media_type', 'application'); }
        if (this.browserQuery.trim()) { params.set('search', this.browserQuery.trim()); }
        this.browserLoading = true; this.browserError = '';
        window.fetch(restBase() + 'wp/v2/media?' + params.toString(), { credentials: 'same-origin', headers: { 'X-WP-Nonce': cfg().restNonce || '' } })
          .then(function (res) {
            self.browserTotalPages = Math.max(1, parseInt(res.headers.get('X-WP-TotalPages') || '1', 10) || 1);
            return res.json().then(function (json) {
              if (!res.ok) { throw new Error(json && json.message ? json.message : '媒体库加载失败'); }
            self.browserItems = (Array.isArray(json) ? json.map(formatItem) : []).filter(function (item) { return self.itemAllowed(item); });
            });
          }).catch(function (err) { self.browserItems = []; self.browserError = err && err.message ? err.message : '媒体库加载失败'; })
          .finally(function () { self.browserLoading = false; });
      },
      searchLibrary: function () { this.browserPage = 1; this.loadLibrary(); },
      setLibraryPage: function (page) { page = Math.min(this.browserTotalPages, Math.max(1, page)); if (page !== this.browserPage) { this.browserPage = page; this.loadLibrary(); } },
      isPicked: function (item) { return this.selectedIds.indexOf(String(item.id || item.url)) !== -1; },
      startBoxSelect: function (event) {
        if (!this.multiple || !event || event.button !== 0 || !event.currentTarget) { return; }
        var rect = event.currentTarget.getBoundingClientRect();
        this.boxGridElement = event.currentTarget;
        this.boxGridRect = { left: rect.left, top: rect.top };
        this.boxStart = { left: event.clientX - rect.left, top: event.clientY - rect.top };
        this.boxRect = { left: this.boxStart.left, top: this.boxStart.top, width: 0, height: 0 };
        this.boxBase = this.browserPicked.slice();
        this.boxAdditive = !!(event.ctrlKey || event.metaKey);
        this.boxMoved = false;
        this.boxSelecting = true;
      },
      updateBoxSelect: function (event) {
        if (!this.boxSelecting || !event) { return; }
        var dx = event.clientX - (this.boxGridRect.left + this.boxStart.left);
        var dy = event.clientY - (this.boxGridRect.top + this.boxStart.top);
        if (!this.boxMoved && Math.abs(dx) < 4 && Math.abs(dy) < 4) { return; }
        this.boxMoved = true;
        if (event.preventDefault) { event.preventDefault(); }
        var left = Math.min(this.boxStart.left, this.boxStart.left + dx), top = Math.min(this.boxStart.top, this.boxStart.top + dy);
        var right = Math.max(this.boxStart.left, this.boxStart.left + dx), bottom = Math.max(this.boxStart.top, this.boxStart.top + dy);
        this.boxRect = { left: left, top: top, width: right - left, height: bottom - top };
        var gridLeft = this.boxGridRect.left + left, gridTop = this.boxGridRect.top + top;
        var gridRight = this.boxGridRect.left + right, gridBottom = this.boxGridRect.top + bottom;
        var cards = Array.prototype.slice.call((this.boxGridElement || document).querySelectorAll('.eva-media-browser-card'));
        var hit = {};
        cards.forEach(function (card) {
          var cardRect = card.getBoundingClientRect();
          if (cardRect.right >= gridLeft && cardRect.left <= gridRight && cardRect.bottom >= gridTop && cardRect.top <= gridBottom) {
            hit[String(card.getAttribute('data-media-key') || '')] = true;
          }
        });
        var base = this.boxAdditive ? this.boxBase.slice() : [], seen = {};
        base.forEach(function (item) { seen[String(item.id || item.url)] = true; });
        var self = this, matched = 0;
        this.browserItems.forEach(function (item) {
          var key = String(item.id || item.url);
          if (!hit[key] || seen[key]) { return; }
          matched += 1;
          if (!self.maxCount || base.length < self.maxCount) { base.push(item); seen[key] = true; }
        });
        if (this.maxCount && matched && base.length >= this.maxCount && matched > (this.maxCount - (this.boxAdditive ? this.boxBase.length : 0))) {
          this.browserError = '最多只能选择 ' + this.maxCount + ' 个文件。';
          this.showMessage(this.browserError, 'warning');
        } else {
          this.browserError = '';
        }
        this.browserPicked = base;
      },
      selectAllBrowserItems: function (event) {
        if (!this.browserOpen || !this.multiple || !event || !(event.ctrlKey || event.metaKey) || String(event.key || '').toLowerCase() !== 'a') { return; }
        var target = event.target, tag = target && target.tagName ? String(target.tagName).toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable)) { return; }
        if (event.preventDefault) { event.preventDefault(); }
        var next = this.browserItems.slice(), total = next.length;
        if (this.maxCount) { next = next.slice(0, this.maxCount); }
        this.browserPicked = next;
        if (this.maxCount && total > this.maxCount) {
          this.browserError = '最多只能选择 ' + this.maxCount + ' 个文件。';
          this.showMessage(this.browserError, 'warning');
        } else { this.browserError = ''; }
      },
      showMessage: function (message, type) {
        var self = this, text = String(message || ''), nextType = type || 'warning';
        if (!text) { return; }
        if (this.messageText === text && this.messageType === nextType) { return; }
        this.messageText = text; this.messageType = nextType;
        if (this.messageTimer) { clearTimeout(this.messageTimer); }
        this.messageTimer = setTimeout(function () { self.messageText = ''; self.messageTimer = null; }, 2800);
      },
      clearBrowserSelection: function (event) {
        var target = event && event.target;
        if (target && target.closest && target.closest('.eva-media-browser-card')) { return; }
        this.browserPicked = [];
        this.browserError = '';
      },
      endBoxSelect: function (event) {
        if (!this.boxSelecting) { return; }
        var target = event && event.target;
        this.suppressNextPick = !!(this.boxMoved && target && target.closest && target.closest('.eva-media-browser-card'));
        this.boxSelecting = false;
        this.boxMoved = false;
        this.boxGridElement = null;
        this.boxRect = { left: 0, top: 0, width: 0, height: 0 };
      },
      togglePick: function (item, event) {
        if (this.suppressNextPick) { this.suppressNextPick = false; return; }
        var key = String(item.id || item.url);
        if (!this.multiple) { this.browserPicked = [item]; this.browserError = ''; return; }
        if (!(event && (event.ctrlKey || event.metaKey))) { this.browserPicked = [item]; this.browserError = ''; return; }
        var next = this.browserPicked.slice();
        var index = next.findIndex(function (picked) { return String(picked.id || picked.url) === key; });
        if (index >= 0) { next.splice(index, 1); }
        else { if (this.maxCount && next.length >= this.maxCount) { this.browserError = '最多只能选择 ' + this.maxCount + ' 个文件。'; this.showMessage(this.browserError, 'warning'); return; } next.push(item); }
        this.browserError = ''; this.browserPicked = next;
      },
      applyLibrary: function () { var self = this; var picked = this.browserPicked.filter(function (item) { return self.itemAllowed(item); }); if (this.maxCount) { picked = picked.slice(0, this.maxCount); } this.emitItems(picked); this.closeLibrary(); },
      openExternal: function () { this.externalUrl = ''; this.externalOpen = true; },
      closeExternal: function () { this.externalOpen = false; this.externalUrl = ''; },
      addExternal: function () {
        var url = String(this.externalUrl || '').trim();
        if (!/^https?:\/\//i.test(url)) { this.error = '请输入有效的 http(s) 地址。'; return; }
        var item = this.normalizeItem(url);
        if (!this.itemAllowed(item)) { this.error = '该地址的文件类型不受当前字段限制。'; return; }
        this.emitItems(this.multiple ? this.items.concat([item]) : [item]);
        this.closeExternal();
      },
      copyUrl: function (url) {
        if (navigator.clipboard && url) { navigator.clipboard.writeText(String(url)); }
      },
      openBatchUrl: function () { this.batchUrlOpen = true; this.batchUrls = ''; this.batchResult = null; },
      closeBatchUrl: function () { if (!this.batchImporting) { this.batchUrlOpen = false; this.batchResult = null; } },
      importBatchUrls: function () {
        var self = this, urls = String(this.batchUrls || '').split(/\r\n|\r|\n/).map(function (url) { return url.trim(); }).filter(Boolean);
        if (!urls.length) { this.error = '请至少输入一个 URL。'; return; }
        if (!window.fetch) { this.error = '当前浏览器不支持批量导入。'; return; }
        this.batchImporting = true; this.error = '';
        var form = new FormData(); form.append('action', 'eva_fw_import_media_urls'); form.append('nonce', cfg().nonce || ''); form.append('urls', JSON.stringify(urls));
        window.fetch(cfg().ajaxUrl || '/wp-admin/admin-ajax.php', { method: 'POST', credentials: 'same-origin', body: form }).then(function (res) { return res.json(); }).then(function (json) {
          if (!json || !json.success) { throw new Error(json && json.data && json.data.msg ? json.data.msg : '批量导入失败'); }
          var imported = (json.data && Array.isArray(json.data.items)) ? json.data.items : [], failed = (json.data && Array.isArray(json.data.failed)) ? json.data.failed : [];
          if (imported.length) { self.emitItems(self.multiple ? self.items.concat(imported) : imported.slice(0, 1)); }
          self.batchResult = { imported: imported.length, failed: failed };
          self.batchUrls = failed.map(function (row) { return row.url; }).join('\n');
          if (!failed.length) { self.batchUrlOpen = false; }
        }).catch(function (err) { self.error = err && err.message ? err.message : '批量导入失败'; }).finally(function () { self.batchImporting = false; });
      },
      openEdit: function (item) {
        this.editItem = item;
        this.editForm = { title: item.title || '', alt: item.alt || '', caption: item.caption || '', description: item.description || '', focalX: item.focalX === undefined ? 50 : item.focalX, focalY: item.focalY === undefined ? 50 : item.focalY };
      },
      closeEdit: function () { this.editItem = null; this.editSaving = false; },
      saveEdit: function () {
        var item = this.editItem, self = this;
        if (!item) { return; }
        var key = String(item.id || item.url || '');
        var next = this.items.map(function (current) { return String(current.id || current.url || '') === key ? Object.assign({}, current, self.editForm) : current; });
        if (!item.id || !window.fetch) { this.emitItems(next); this.closeEdit(); return; }
        this.editSaving = true;
        window.fetch(restBase() + 'wp/v2/media/' + encodeURIComponent(item.id), { method: 'POST', credentials: 'same-origin', headers: { 'X-WP-Nonce': cfg().restNonce || '', 'Content-Type': 'application/json' }, body: JSON.stringify({ title: self.editForm.title, alt_text: self.editForm.alt, caption: self.editForm.caption, description: self.editForm.description }) })
          .then(function (res) { return res.json().then(function (json) { if (!res.ok) { throw new Error(json && json.message ? json.message : '媒体信息保存失败'); } return json; }); })
          .then(function () { self.emitItems(next); self.closeEdit(); })
          .catch(function (err) { self.error = err && err.message ? err.message : '媒体信息保存失败'; })
          .finally(function () { self.editSaving = false; });
      },
      chooseFile: function () { if (this.$refs.file) { this.$refs.file.click(); } },
      onFileChange: function (event) { this.uploadFiles(event.target.files); event.target.value = ''; },
      onDrop: function (event) { this.drag = false; this.uploadFiles(event.dataTransfer.files); },
      uploadFiles: function (files) {
        var self = this; files = Array.prototype.slice.call(files || []); if (!files.length) { return; }
        files = files.filter(function (file) { if (self.itemAllowed({ filename: file.name, mime: file.type })) { return true; } self.error = '文件类型不受支持：' + file.name; return false; });
        if (!this.multiple) { files = files.slice(0, 1); }
        if (this.maxCount) { var room = Math.max(0, this.maxCount - (this.multiple ? this.items.length : 0)); if (files.length > room) { this.error = '最多只能上传 ' + this.maxCount + ' 个文件。'; } files = files.slice(0, room); }
        if (!files.length || !window.fetch) { return; }
        this.uploading = true;
        Promise.all(files.map(function (file) { return self.uploadFile(file); })).then(function (uploaded) {
          self.emitItems(self.multiple ? self.items.concat(uploaded.filter(Boolean)) : uploaded.filter(Boolean).slice(0, 1)); if (self.browserOpen) { self.closeLibrary(); }
        }).catch(function (err) { self.error = err && err.message ? err.message : '上传失败'; }).finally(function () { self.uploading = false; });
      },
      validateImageDimensions: function (file) {
        var min = Number(this.minWidth || 0), max = Number(this.maxWidth || 0);
        if (!/^image\//i.test(file && file.type || '') || (!min && !max) || !window.URL || !window.Image) { return Promise.resolve(); }
        return new Promise(function (resolve, reject) {
          var url = URL.createObjectURL(file), image = new Image();
          image.onload = function () { URL.revokeObjectURL(url); if ((min && image.width < min) || (max && image.width > max)) { reject(new Error('图片宽度不符合限制：' + image.width + 'px')); return; } resolve(); };
          image.onerror = function () { URL.revokeObjectURL(url); resolve(); };
          image.src = url;
        });
      },
      uploadFile: function (file) {
        var self = this;
        if (this.maxBytes && file.size > this.maxBytes) { return Promise.reject(new Error('文件大小超过限制：' + this.maxSize + 'MB')); }
        var headers = { 'X-WP-Nonce': cfg().restNonce || '', 'Content-Disposition': 'attachment; filename="' + encodeURIComponent(file.name) + '"' };
        if (file.type) { headers['Content-Type'] = file.type; }
        return this.validateImageDimensions(file).then(function () { return window.fetch(restBase() + 'wp/v2/media', { method: 'POST', headers: headers, credentials: 'same-origin', body: file }); }).then(function (res) {
          return res.json().then(function (json) { if (!res.ok) { throw new Error(json && json.message ? json.message : '上传失败'); } var item = formatItem(json); item.filename = item.filename || file.name; item.size = item.size || Math.round(file.size / 1024) + ' KB'; return item; });
        });
      },
      removeAt: function (index) { var next = this.items.slice(); next.splice(index, 1); this.emitItems(next); },
      metaText: function (item) { var p = []; if (item.width && item.height) { p.push(item.width + ' × ' + item.height); } if (item.size) { p.push(item.size); } if (item.mime) { p.push(item.mime); } return p.join(' · '); },
      isImage: isImage,
      fileIcon: function (item) { var mime = String(item && item.mime || ''); if (isImage(item)) { return 'ri-image-line'; } if (/^video\//.test(mime)) { return 'ri-video-line'; } if (/^audio\//.test(mime)) { return 'ri-music-2-line'; } if (/pdf/.test(mime) || extOf(item) === 'pdf') { return 'ri-file-pdf-2-line'; } return 'ri-file-line'; },
      onItemDragStart: function (index, event) { if (!this.sortable) { return; } this.itemDragIndex = index; this.itemDragOver = index; if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); } },
      onItemDragOver: function (index) { if (this.sortable && this.itemDragIndex >= 0) { this.itemDragOver = index; } },
      onItemDrop: function (index) { if (!this.sortable || this.itemDragIndex < 0 || index === this.itemDragIndex) { this.onItemDragEnd(); return; } var next = this.items.slice(); var moved = next.splice(this.itemDragIndex, 1)[0]; next.splice(index, 0, moved); this.emitItems(next); this.onItemDragEnd(); },
      onItemDragEnd: function () { this.itemDragIndex = -1; this.itemDragOver = -1; },
      moveItem: function (index, delta) { var target = index + delta; if (target < 0 || target >= this.items.length) { return; } var next = this.items.slice(); var moved = next.splice(index, 1)[0]; next.splice(target, 0, moved); this.emitItems(next); }
    },
    template: [
      '<div class="eva-media" :class="{ \'is-drag\': drag, \'is-uploading\': uploading, \'is-gallery\': gallery, \'is-sortable\': sortable, \'is-box-selecting\': boxSelecting, [\'is-\' + currentLayout]: true }">',
      '<input ref="file" class="eva-media-file" type="file" :accept="accept" :multiple="multiple" @change="onFileChange">',
      '<div v-if="gallery" class="eva-media-view-switcher"><span>展示方式</span><div><button v-for="view in galleryLayouts" :key="view.value" type="button" :class="{ \'is-active\': currentLayout === view.value }" @click="setGalleryLayout(view.value)"><i :class="view.icon"></i>{{ view.label }}</button></div></div>',
      '<div class="eva-media-list" v-if="items.length"><div class="eva-media-item" v-for="(item, i) in items" :key="item.url || item.id || i" :class="{ \'is-over\': itemDragOver === i }" :draggable="sortable" @dragstart.stop="onItemDragStart(i, $event)" @dragover.prevent.stop="onItemDragOver(i)" @drop.prevent.stop="onItemDrop(i)" @dragend="onItemDragEnd">',
      '<span v-if="sortable" class="eva-media-sort-handle" title="拖拽排序"><i class="ri-drag-move-2-line"></i></span><div class="eva-media-thumb"><img v-if="preview && item.url && isImage(item)" :src="displayUrl(item)" :alt="item.alt || item.title || item.filename" :style="{objectPosition:(item.focalX || 50) + \'% \' + (item.focalY || 50) + \'%\'}"><i v-else :class="fileIcon(item)"></i></div>',
      '<div class="eva-media-info"><strong>{{ item.title || item.filename }}</strong><span v-if="showMeta">{{ metaText(item) || item.filename || item.url }}</span></div><div class="eva-media-actions"><button v-if="editableMeta && item.id" type="button" title="编辑媒体信息" @click="openEdit(item)"><i class="ri-edit-line"></i><span v-if="!gallery">编辑</span></button><button v-if="item.url" type="button" title="复制 URL" @click="copyUrl(item.url)"><i class="ri-link"></i><span v-if="!gallery">复制</span></button><button v-if="sortable" type="button" title="上移" :disabled="i === 0" @click="moveItem(i,-1)"><i class="ri-arrow-up-line"></i></button><button v-if="sortable" type="button" title="下移" :disabled="i === items.length-1" @click="moveItem(i,1)"><i class="ri-arrow-down-line"></i></button><button v-if="!multiple" type="button" @click="openLibrary"><i class="ri-edit-line"></i>替换</button><button type="button" @click="removeAt(i)"><i class="ri-delete-bin-line"></i><span v-if="!gallery">删除</span></button></div></div></div>',
      '<div v-else class="eva-media-empty"><button type="button" class="eva-media-primary" @click="chooseFile"><i class="ri-upload-cloud-2-line"></i>{{ buttonTitle }}</button><button type="button" class="eva-media-secondary" @click="openLibrary">从媒体库选择</button><button v-if="allowExternal" type="button" class="eva-media-secondary" @click="openExternal"><i class="ri-link"></i>添加 URL</button><button v-if="allowBatchUrl" type="button" class="eva-media-secondary" @click="openBatchUrl"><i class="ri-download-cloud-2-line"></i>批量 URL</button></div>',
      '<div v-if="gallery && items.length && (!maxCount || items.length < maxCount)" class="eva-media-gallery-add"><button type="button" class="eva-media-primary" @click="chooseFile"><i class="ri-add-line"></i>{{ buttonTitle }}</button><button type="button" class="eva-media-secondary" @click="openLibrary">从媒体库选择</button></div>',
      '<div v-if="showDrop && (!maxCount || items.length < maxCount)" class="eva-media-drop" @dragenter.prevent="drag=true" @dragover.prevent="drag=true" @dragleave.prevent="drag=false" @drop.prevent="onDrop"><i class="ri-upload-cloud-2-line"></i><strong>{{ uploading ? \'正在上传...\' : placeholder }}</strong><span>{{ dropHint }}</span><div><button type="button" @click="chooseFile">从本地选择</button><button v-if="allowExternal" type="button" @click="openExternal">添加 URL</button><button v-if="allowBatchUrl" type="button" @click="openBatchUrl">批量 URL</button></div></div>',
      '<div v-if="browserOpen" class="eva-media-browser" role="dialog" aria-modal="true"><transition name="eva-media-message"><div v-if="messageText" class="eva-media-message" :class="\'is-\' + messageType"><i class="ri-error-warning-fill"></i><span>{{ messageText }}</span></div></transition><div class="eva-media-browser-panel"><div class="eva-media-browser-head"><div><strong>{{ title }}</strong></div><button type="button" class="eva-media-browser-close" @click="closeLibrary"><i class="ri-close-line"></i></button></div>',
      '<div class="eva-media-browser-toolbar"><label class="eva-media-browser-search"><i class="ri-search-line"></i><input v-model="browserQuery" type="search" placeholder="搜索媒体..." @keydown.enter.prevent="searchLibrary"></label><button type="button" class="eva-media-secondary" @click="searchLibrary">搜索</button><button type="button" class="eva-media-primary" @click="chooseFile"><i class="ri-upload-cloud-2-line"></i>上传新文件</button><button v-if="allowBatchUrl" type="button" class="eva-media-secondary" @click="openBatchUrl"><i class="ri-download-cloud-2-line"></i>批量 URL</button></div>',
      '<div class="eva-media-browser-body"><div v-if="browserLoading" class="eva-media-browser-state">媒体库加载中...</div><div v-else-if="browserError && !browserItems.length" class="eva-media-browser-state is-error">{{ browserError }}</div><div v-else-if="!browserItems.length" class="eva-media-browser-state">没有找到媒体文件</div><div v-else class="eva-media-browser-grid" @mousedown="startBoxSelect($event)" @dblclick="clearBrowserSelection($event)"><div v-if="boxSelecting" class="eva-media-select-box" :style="boxStyle"></div><template v-for="group in browserGroups" :key="group.key"><h4 v-if="group.label" class="eva-media-browser-group">{{ group.label }}</h4><button v-for="item in group.items" :key="item.id || item.url" type="button" class="eva-media-browser-card" :data-media-key="String(item.id || item.url)" :class="{ \'is-picked\': isPicked(item) }" @click="togglePick(item, $event)"><span class="eva-media-browser-thumb"><img v-if="item.url && isImage(item)" :src="item.thumb || item.url" :alt="item.title"><i v-else :class="fileIcon(item)"></i></span><span class="eva-media-browser-name">{{ item.title || item.filename }}</span><small>{{ item.mime || item.filename }}</small><em v-if="isPicked(item)" class="eva-media-browser-check"><i class="ri-check-line"></i></em></button></template></div></div>',
      '<div class="eva-media-browser-foot"><div class="eva-media-browser-pages"><button type="button" :disabled="browserPage<=1||browserLoading" @click="setLibraryPage(browserPage-1)">上一页</button><span>{{ browserPage }} / {{ browserTotalPages }}</span><button type="button" :disabled="browserPage>=browserTotalPages||browserLoading" @click="setLibraryPage(browserPage+1)">下一页</button></div><div class="eva-media-browser-submit"><span>已选 {{ browserPicked.length }}<template v-if="maxCount"> / {{ maxCount }}</template> 个</span><button type="button" class="eva-media-primary" :disabled="!browserPicked.length" @click="applyLibrary">应用选择</button></div></div></div></div>',
      '<div v-if="externalOpen" class="eva-media-modal" @click.self="closeExternal"><div class="eva-media-modal-panel"><header><strong>添加外部媒体 URL</strong><button type="button" @click="closeExternal"><i class="ri-close-line"></i></button></header><label><span>媒体地址</span><input v-model.trim="externalUrl" type="url" placeholder="https://example.com/image.jpg" @keydown.enter.prevent="addExternal"></label><footer><button type="button" class="eva-media-secondary" @click="closeExternal">取消</button><button type="button" class="eva-media-primary" @click="addExternal">添加</button></footer></div></div>',
      '<div v-if="batchUrlOpen" class="eva-media-modal" @click.self="closeBatchUrl"><div class="eva-media-modal-panel eva-media-batch-panel"><header><div><strong>批量 URL 拉取到本地</strong><small>每行一个 http(s) 地址，最多 30 个；成功后会注册到 WordPress 媒体库。</small></div><button type="button" @click="closeBatchUrl"><i class="ri-close-line"></i></button></header><textarea v-model="batchUrls" rows="8" placeholder="https://example.com/image-1.jpg\nhttps://example.com/image-2.png"></textarea><p v-if="batchResult" class="eva-media-batch-result">成功导入 {{ batchResult.imported }} 个<span v-if="batchResult.failed.length">，失败 {{ batchResult.failed.length }} 个，失败地址已保留在输入框</span></p><footer><button type="button" class="eva-media-secondary" :disabled="batchImporting" @click="closeBatchUrl">取消</button><button type="button" class="eva-media-primary" :disabled="batchImporting" @click="importBatchUrls">{{ batchImporting ? \'正在拉取...\' : \'开始拉取\' }}</button></footer></div></div>',
      '<div v-if="editItem" class="eva-media-modal" @click.self="closeEdit"><div class="eva-media-modal-panel"><header><strong>编辑媒体信息</strong><button type="button" @click="closeEdit"><i class="ri-close-line"></i></button></header><label><span>标题</span><input v-model.trim="editForm.title" type="text"></label><label><span>替代文字</span><input v-model.trim="editForm.alt" type="text"></label><label><span>说明</span><textarea v-model="editForm.caption" rows="2"></textarea></label><label v-if="editItem && isImage(editItem)"><span>焦点位置</span><div class="eva-media-focal"><input v-model.number="editForm.focalX" type="range" min="0" max="100"><input v-model.number="editForm.focalY" type="range" min="0" max="100"></div></label><footer><button type="button" class="eva-media-secondary" @click="closeEdit">取消</button><button type="button" class="eva-media-primary" :disabled="editSaving" @click="saveEdit">{{ editSaving ? \'保存中...\' : \'保存\' }}</button></footer></div></div>',
      '<p v-if="error" class="eva-media-error">{{ error }}</p></div>'
    ].join('\n')
  };
})();
