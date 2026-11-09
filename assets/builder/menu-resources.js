/** 菜单资源搜索、缓存、批量请求与添加。 */
(function (runtime) {
  'use strict';
  var cfg = runtime.config;

  runtime.menuResources = {
    queueMenuAddSearch: function (type) {
      var state = this.menuAddRequestState(), timerKey = type || 'all';
      if (!type) { this.menuAddQueries = {}; }
      var types = type ? [type] : this.menuAddGroups().filter(function (group) { return group.id !== 'custom'; }).map(function (group) { return group.id; });
      types.forEach(function (id) {
        state.keys[id] = null;
        if (state.queued[id]) { delete state.pending[state.queued[id].key]; delete state.queued[id]; }
        if (state.searchTimers[id]) { clearTimeout(state.searchTimers[id]); delete state.searchTimers[id]; }
        this.menuAddLoading[id] = true;
      }.bind(this));
      this.abortUnusedMenuAddBatches();
      if (state.searchTimers[timerKey]) { clearTimeout(state.searchTimers[timerKey]); }
      state.searchTimers[timerKey] = setTimeout(function () {
        delete state.searchTimers[timerKey];
        if (type) { this.loadMenuAddItems(type); return; }
        this.menuAddGroups().forEach(function (group) {
          if (group.id === 'custom') { return; }
          if (this.menuAddSearch.trim()) { this.menuAddExpanded[group.id] = true; }
          if (this.menuAddExpanded[group.id]) { this.loadMenuAddItems(group.id); }
        }.bind(this));
      }.bind(this), 180);
    },
    menuAddRequestState: function () {
      if (!this._menuAddState) { this._menuAddState = { cache: {}, pending: {}, queued: {}, keys: {}, batches: [], searchTimers: {}, timer: null, disposed: false }; }
      return this._menuAddState;
    },
    menuAddCacheKey: function (type, query) { return JSON.stringify([type, String(query || '').trim()]); },
    menuAddCached: function (type, query) {
      var state = this.menuAddRequestState(), key = this.menuAddCacheKey(type, query), entry = state.cache[key];
      if (entry && Date.now() - entry.time < 30000) { return entry; }
      delete state.cache[key];
      return null;
    },
    cacheMenuAddItems: function (type, query, items) {
      var state = this.menuAddRequestState();
      state.cache[this.menuAddCacheKey(type, query)] = { time: Date.now(), items: items };
      var keys = Object.keys(state.cache);
      if (keys.length > 60) {
        keys.sort(function (a, b) { return state.cache[a].time - state.cache[b].time; });
        keys.slice(0, keys.length - 60).forEach(function (key) { delete state.cache[key]; });
      }
    },
    abortUnusedMenuAddBatches: function () {
      var state = this.menuAddRequestState();
      state.batches.forEach(function (batch) {
        if (batch.entries.some(function (entry) { return state.keys[entry.type] === entry.key; })) { return; }
        batch.controller.abort();
        batch.entries.forEach(function (entry) { if (state.pending[entry.key] === batch) { delete state.pending[entry.key]; } });
      });
    },
    pauseMenuAddRequests: function () {
      var state = this._menuAddState;
      if (!state) { return; }
      if (state.timer) { clearTimeout(state.timer); }
      Object.keys(state.searchTimers).forEach(function (key) { clearTimeout(state.searchTimers[key]); });
      state.timer = null;
      state.searchTimers = {};
      state.keys = {};
      state.queued = {};
      state.pending = {};
      state.batches.forEach(function (batch) { batch.controller.abort(); });
      this.menuAddLoading = {};
    },
    stopMenuAddRequests: function () {
      this.pauseMenuAddRequests();
      if (this._menuAddState) { this._menuAddState.disposed = true; }
    },
    loadMenuAddItems: function (type) {
      if (!cfg.restActions) { this.menuAddErrors[type] = '资源接口不可用'; return; }
      var query = String(this.menuAddQueries[type] || this.menuAddSearch || '').trim();
      var state = this.menuAddRequestState(), key = this.menuAddCacheKey(type, query), cached = this.menuAddCached(type, query);
      if (state.disposed) { return; }
      state.keys[type] = key;
      this.abortUnusedMenuAddBatches();
      var previous = state.queued[type];
      if (previous && previous.key !== key) { delete state.pending[previous.key]; delete state.queued[type]; }
      this.menuAddErrors[type] = '';
      if (cached) { this.menuAddItems[type] = cached.items; this.menuAddLoading[type] = false; return; }
      this.menuAddLoading[type] = true;
      if (state.pending[key]) { return; }
      var entry = { type: type, query: query, key: key };
      state.queued[type] = entry;
      state.pending[key] = entry;
      if (!state.timer) { state.timer = setTimeout(this.fetchMenuAddBatch, 0); }
    },
    fetchMenuAddBatch: function () {
      var state = this.menuAddRequestState();
      state.timer = null;
      var entries = Object.keys(state.queued).map(function (type) { return state.queued[type]; });
      state.queued = {};
      if (state.disposed || !entries.length) { return; }
      var queries = {};
      entries.forEach(function (entry) { queries[entry.type] = entry.query; });
      var batch = { entries: entries, controller: new AbortController() };
      state.batches.push(batch);
      entries.forEach(function (entry) { state.pending[entry.key] = batch; });
      var fd = new FormData();
      fd.append('action', 'eva_fw_builder_menu_resources');
      fd.append('nonce', cfg.nonce || '');
      fd.append('queries', JSON.stringify(queries));
      window.EvaApi.action(fd, { signal: batch.controller.signal }).then(function (json) {
        if (state.disposed || batch.controller.signal.aborted) { return; }
        if (!json || !json.success || !json.data || !json.data.resources) { throw new Error('菜单项读取失败'); }
        entries.forEach(function (entry) {
          var items = json.data.resources[entry.type];
          if (!Array.isArray(items)) { throw new Error('菜单项读取失败'); }
          this.cacheMenuAddItems(entry.type, entry.query, items);
          if (state.keys[entry.type] === entry.key) { this.menuAddItems[entry.type] = items; }
        }.bind(this));
      }.bind(this)).catch(function () {
        if (state.disposed || batch.controller.signal.aborted) { return; }
        entries.forEach(function (entry) { if (state.keys[entry.type] === entry.key) { this.menuAddErrors[entry.type] = '读取失败，请重新展开重试'; } }.bind(this));
      }.bind(this)).finally(function () {
        state.batches = state.batches.filter(function (entry) { return entry !== batch; });
        entries.forEach(function (entry) {
          if (state.pending[entry.key] === batch) {
            delete state.pending[entry.key];
            if (!state.disposed && state.keys[entry.type] === entry.key) { this.menuAddLoading[entry.type] = false; }
          }
        }.bind(this));
      }.bind(this));
    },
    menuAddIsSelected: function (type, item) {
      return (this.menuAddSelected[type] || []).some(function (entry) { return String(entry.value) === String(item.value); });
    },
    menuAddResourceMeta: function (resource) {
      var statuses = { publish: '已发布', draft: '草稿', private: '私密', pending: '待审核', future: '定时发布' };
      return statuses[resource.meta] || resource.meta || '';
    },
    toggleMenuAddSelected: function (type, item, checked) {
      var selected = (this.menuAddSelected[type] || []).filter(function (entry) { return String(entry.value) !== String(item.value); });
      if (checked) { selected.push(item); }
      this.menuAddSelected[type] = selected;
    },
    menuAddAllSelected: function (type) {
      var items = this.menuAddItems[type] || [];
      return items.length > 0 && items.every(function (item) { return this.menuAddIsSelected(type, item); }.bind(this));
    },
    toggleMenuAddAll: function (type, checked) {
      (this.menuAddItems[type] || []).forEach(function (item) { this.toggleMenuAddSelected(type, item, checked); }.bind(this));
    },
    menuAddCustomField: function () {
      return { id: 'new_menu_link', motion: this.menuMotionProps, type: 'link', internal_picker: false, show_url: true, show_text: true, show_target: true, show_rel: false, show_title: false, show_page: false, preview: false, placeholder: 'https://' };
    },
    addMenuEditorItems: function (items) {
      if (!this.menuEditor || !items.length) { return false; }
      var parent = this.menuEditorFind(this.menuAddParentKey), parentId = parent ? Number(parent.id) : 0;
      if (this.menuAddParentKey && !parentId) { this.menuAddErrors[this.menuAddType] = '父菜单项已移除，请重新选择'; return false; }
      if (this.menuEditor.items.length + items.length > 500) { this.menuEditorStatus = '菜单最多支持 500 个项目'; return false; }
      var added = items.map(function (item) {
        var key = 'new-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
        return Object.assign({ id: 0, title: '', url: '', icon: '', type: 'custom', object: 'custom', object_id: 0, resource_type: '', resource_id: 0, status: 'publish', classes: '', target: '_self', rel: '', attr_title: '', client_key: key }, item, { parent: parentId });
      }.bind(this));
      var at = this.menuEditor.items.length;
      if (parent) {
        at = this.menuEditor.items.indexOf(parent) + 1;
        this.menuEditor.items.forEach(function (item, index) { if (this.menuEditorIsDescendant(item, parentId)) { at = index + 1; } }.bind(this));
      }
      this.menuEditor.items.splice.apply(this.menuEditor.items, [at, 0].concat(added));
      this.markMenuEditorDirty();
      return true;
    },
    addMenuCustomLink: function () {
      var value = this.menuAddCustom, url = String(value.url || '').trim(), title = String(value.text || '').trim();
      if (!title || !url || !/^(https?:|mailto:|tel:|#)/i.test(url)) { this.menuAddErrors.custom = '请填写链接文字和有效的链接地址'; return; }
      if (this.addMenuEditorItems([{ title: title, url: url, target: value.target || '_self' }])) {
        this.menuAddCustom = { url: '', text: '', target: '_self', rel: '' };
        this.menuAddErrors.custom = '';
      }
    },
    addMenuResources: function (type) {
      var selected = this.menuAddSelected[type] || [];
      var isTerm = ['category', 'post_tag', 'post_format'].indexOf(type) !== -1;
      var items = selected.map(function (resource) { return { title: resource.label, url: resource.url, type: isTerm ? 'taxonomy' : 'post_type', object: type, object_id: Number(resource.value), resource_type: type, resource_id: Number(resource.value) }; });
      if (this.addMenuEditorItems(items)) { this.menuAddSelected[type] = []; }
    }
  };
})(window.EvaBuilder);
