/**
 * Eva 字段：backup —— 备份恢复中心。
 *
 * 迁移说明：
 * - 该字段直接承载主题侧“备份恢复中心”的核心交互，并改造成 EvaFields 字段组件。
 * - 原主题实现中的 axios / Qmsg / Element 弹窗依赖被移除，统一使用 fetch / alert / confirm。
 * - FontAwesome 图标改为 Remix Icon，样式统一放在 `eva.css` 的 `.eva-backup` 命名空间。
 *
 * 多语言：
 * - 所有可见文案走全局 window.EvaI18n（组件内以 this.t('bk_*') 调用），词条见 Languages/*.php。
 * - 频率、保留数量等“存储值”保持中文不变（后端契约），仅在显示时翻译（见 freqLabel / select label）。
 *
 * 数据接口：
 * - `GET  lf/v2/backupData`：读取统计卡、历史备份、自动备份、活动记录等页面数据。
 * - `GET  lf/v2/downloadBackup?id=...`：下载指定备份文件。
 * - `POST admin-ajax.php?action=create_backup`：创建手动备份。
 * - `POST admin-ajax.php?action=delete_backup`：删除备份。
 * - `POST admin-ajax.php?action=restore_backup`：从历史备份恢复。
 * - `POST admin-ajax.php?action=restore_backup_from_file`：从上传文件恢复。
 * - `POST admin-ajax.php?action=save_auto_backup_settings`：保存自动备份设置。
 *
 * 注意：
 * - 这是整页型字段，通常搭配 section 的 `flush` 布局铺满内容区。
 * - 组件自身不依赖 `modelValue` 保存字段值，所有状态都由主题侧备份接口维护。
 */
(function () {
  window.EvaFields = window.EvaFields || {};

  // 读取 Eva 注入的运行时配置，主要用于 REST 根地址、REST nonce 和 admin-ajax 地址。
  function cfg() { return (window.EvaFW && window.EvaFW.config) || {}; }
  function restBase() { return (cfg().restUrl || '/wp-json/').replace(/\/+$/, '') + '/'; }

  window.EvaFields.backup = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    data: function () {
      return {
        // 页面数据状态：loading 控制骨架/加载态，error 用于展示请求或操作错误。
        loading: true,
        data: null,
        error: '',
        // 创建备份表单状态。
        backupName: '',
        backupItems: ['main'],
        // 上传恢复文件状态。
        pendingFile: null,
        selectedFile: { name: '', size: '' },
        // 历史记录筛选状态。
        activeTab: 'all',
        searchKey: '',
        // 自动备份设置，接口返回后会覆盖这里的默认值。frequency 存中文值（后端契约）。
        settings: { enabled: false, frequency: '每天', time: '00:00', keep: 5 },
        bannerUrl: 'https://www.dmoe.cc/random.php'
      };
    },
    computed: {
      // 小时 / 分钟选项由计算属性生成，避免在 data 里维护重复数组。
      hourOptions: function () { var a = []; for (var i = 0; i < 24; i++) { a.push(('0' + i).slice(-2)); } return a; },
      minuteOptions: function () { var a = []; for (var i = 0; i < 60; i++) { a.push(('0' + i).slice(-2)); } return a; },
      // 自动备份时间拆分为两个 eva-select（小时 + 分钟）编辑，最终仍写回 settings.time。
      hour: {
        get: function () { return ('0' + (parseInt((this.settings.time || '00:00').split(':')[0], 10) || 0)).slice(-2); },
        set: function (v) { var m = (this.settings.time || '00:00').split(':')[1] || '00'; this.settings.time = v + ':' + m; }
      },
      minute: {
        get: function () { return ('0' + (parseInt((this.settings.time || '00:00').split(':')[1], 10) || 0)).slice(-2); },
        set: function (v) { var h = (this.settings.time || '00:00').split(':')[0] || '00'; this.settings.time = h + ':' + v; }
      },
      // 接口返回的 card 聚合统计，模板中的统计卡都从这里派生。
      card: function () { return (this.data && this.data.card) || {}; },
      latest: function () { return this.card.latest || {}; },
      autoCard: function () { return this.card.auto || {}; },
      available: function () { return this.card.available || {}; },
      list: function () { return (this.data && this.data.list) || []; },
      // 历史备份列表的展示增强：补充类型文案和备份内容标签（按当前语言翻译）。
      parsedList: function () {
        var self = this;
        var typeMap = { main: self.t('bk_theme'), nav: self.t('bk_t_nav'), widgets: self.t('bk_t_widgets'), customizer: self.t('bk_t_customizer') };
        return this.list.map(function (item) {
          var items = item.items || [];
          return Object.assign({}, item, {
            typeLabel: item.type === 'automatic' ? self.t('bk_auto_created') : self.t('bk_manual_created'),
            itemTypes: items.map(function (i) { return typeMap[i] || i; }).join('、')
          });
        });
      },
      // 历史备份列表筛选：按 tab 区分全部/手动/自动，并按名称关键字过滤。
      filteredList: function () {
        var self = this;
        return this.parsedList.filter(function (item) {
          var okTab = self.activeTab === 'all'
            || (self.activeTab === 'manual' && item.type !== 'automatic')
            || (self.activeTab === 'auto' && item.type === 'automatic');
          var okKey = !self.searchKey || (item.name && String(item.name).indexOf(self.searchKey) !== -1);
          return okTab && okKey;
        });
      },
      storage: function () { return this.card.storage || {}; },
      trend: function () { return this.card.trend || []; },
      counts: function () { return this.card.counts || {}; },
      health: function () { return this.card.health || []; },
      queue: function () { return this.card.queue || []; },
      activities: function () { return this.card.activities || []; },
      latestItemsLabel: function () {
        var self = this;
        var typeMap = { main: self.t('bk_theme'), nav: self.t('bk_t_nav'), widgets: self.t('bk_t_widgets'), customizer: self.t('bk_t_customizer') };
        var items = (this.latest && this.latest.items) || [];
        return items.length ? items.map(function (i) { return typeMap[i] || i; }).join('、') : '—';
      },
      // 备份趋势折线图 polyline 坐标。只负责把接口数据转换成 SVG points 字符串。
      trendPoints: function () {
        var t = this.trend; if (!t.length) { return ''; }
        var max = 1; t.forEach(function (d) { if ((d.count || 0) > max) { max = d.count; } });
        var w = 280, h = 70, n = t.length;
        return t.map(function (d, i) {
          var x = n > 1 ? (i / (n - 1)) * w : w / 2;
          var y = h - ((d.count || 0) / max) * (h - 10) - 5;
          return Math.round(x) + ',' + Math.round(y);
        }).join(' ');
      },
      // 存储分布环形图中“自动备份”占比。
      distAuto: function () {
        var m = this.counts.manual || 0, a = this.counts.automatic || 0, total = m + a;
        return total ? Math.round(a / total * 100) : 0;
      },
      estimate: function () { return this.card.estimate || {}; }
    },
    mounted: function () { this.fetchData(); },
    methods: {
      // 全局 i18n 代理：模板与逻辑统一用 this.t('key')；内部读 EvaI18nState.lang，切换语言自动重渲染。
      t: function (k) { return window.EvaI18n.t(k); },
      // 把存储的中文频率值映射为当前语言显示（值不变、仅显示翻译）。
      freqLabel: function (v) {
        var m = { '每天': 'bk_freq_day', '每周': 'bk_freq_week', '每月': 'bk_freq_month', '每季度': 'bk_freq_quarter' };
        return m[v] ? this.t(m[v]) : (v || this.t('bk_freq_day'));
      },
      // 系统健康项：接口按中文返回，前端对已知固定值做映射翻译，未知值原样显示。
      healthName: function (v) {
        var m = { '备份服务状态': 'bk_h_service', '存储空间状态': 'bk_h_storage', '数据库连接': 'bk_h_db', '文件系统权限': 'bk_h_fs' };
        return m[v] ? this.t(m[v]) : v;
      },
      healthLabel: function (v) {
        var m = { '正常': 'bk_h_normal', '良好': 'bk_good', '异常': 'bk_h_error', '警告': 'bk_h_warn' };
        return m[v] ? this.t(m[v]) : v;
      },
      // 拉取完整备份面板数据，成功后同步自动备份设置；失败时只显示错误，不破坏旧数据。
      fetchData: function () {
        var self = this; self.loading = true;
        fetch(restBase() + 'lf/v2/backupData', { credentials: 'same-origin', headers: { 'X-WP-Nonce': cfg().restNonce || '' } })
          .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
          .then(function (j) {
            self.data = (j && j[0]) ? j[0] : { card: {}, list: [], auto: {} };
            var a = self.data.auto || {};
            self.settings = {
              enabled: !!a.enabled,
              frequency: a.frequency || '每天',
              time: a.time || '00:00',
              keep: (a.keep != null ? a.keep : 5)
            };
            self.error = '';
          })
          .catch(function (e) { self.error = self.t('bk_read_fail') + (e && e.message ? e.message : e); })
          .then(function () { self.loading = false; });
      },
      // admin-ajax POST 统一封装。支持普通字段和数组字段（自动追加 []）。
      post: function (action, payload) {
        var fd = new FormData();
        fd.append('action', action);
        Object.keys(payload || {}).forEach(function (k) {
          var v = payload[k];
          if (Array.isArray(v)) { v.forEach(function (x) { fd.append(k + '[]', x); }); }
          else { fd.append(k, v); }
        });
        return fetch(cfg().ajaxUrl, { method: 'POST', credentials: 'same-origin', body: fd })
          .then(function (r) { return r.json().catch(function () { return {}; }); });
      },
      // 创建手动备份；成功后刷新面板数据，失败时在页面顶部显示错误。
      createBackup: function () {
        var self = this;
        this.post('create_backup', { name: this.backupName || this.t('bk_unnamed'), items: this.backupItems })
          .then(function (res) {
            if (res && res.success) { self.backupName = ''; self.fetchData(); }
            else { self.error = self.t('bk_backup_fail') + ((res && res.data && res.data.message) || (res && res.data) || self.t('bk_unknown')); }
          })
          .catch(function (e) { self.error = self.t('bk_backup_fail') + e; });
      },
      // 把字节数格式化为适合 UI 展示的 B / KB / MB。
      formatSize: function (bytes) {
        if (bytes === null || bytes === undefined || bytes === '') { return ''; }
        if (bytes < 1024) { return bytes + ' B'; }
        if (bytes < 1048576) { return (bytes / 1024).toFixed(1) + ' KB'; }
        return (bytes / 1048576).toFixed(1) + ' MB';
      },
      // 记录用户选择的本地备份文件，真正上传在 startRestore 中进行。
      handleFileUpload: function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) { return; }
        this.pendingFile = file;
        this.selectedFile = { name: file.name, size: this.formatSize(file.size) };
      },
      // 从本地上传文件恢复。恢复是破坏性操作，必须二次确认。
      startRestore: function () {
        var self = this;
        if (!self.pendingFile) { return; }
        if (!window.confirm(self.t('bk_confirm_restore_file'))) { return; }
        self.post('restore_backup_from_file', { backup_file: self.pendingFile })
          .then(function (res) {
            if (res && res.success) { window.alert(self.t('bk_restore_ok')); self.clearSelected(); self.fetchData(); }
            else { self.error = self.t('bk_restore_fail') + ((res && res.data) || self.t('bk_unknown')); }
          })
          .catch(function () { self.error = self.t('bk_req_fail'); });
      },
      clearSelected: function () {
        this.pendingFile = null;
        this.selectedFile = { name: '', size: '' };
      },
      // 下载备份文件：接口返回 blob 后临时创建 <a download> 触发浏览器下载。
      downloadBackup: function (id, name) {
        var self = this;
        fetch(restBase() + 'lf/v2/downloadBackup?id=' + encodeURIComponent(id), {
          credentials: 'same-origin', headers: { 'X-WP-Nonce': cfg().restNonce || '' }
        })
          .then(function (r) { return r.blob(); })
          .then(function (blob) {
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = (name + '_' + id || self.t('bk_backup_noun')) + '.json';
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
          })
          .catch(function () { window.alert(self.t('bk_download_fail')); });
      },
      // 从历史备份恢复。恢复成功后不强制刷新页面，避免打断用户继续查看。
      restoreBackup: function (id, name) {
        var self = this;
        if (!window.confirm(self.t('bk_confirm_restore_1') + name + self.t('bk_confirm_restore_2'))) { return; }
        this.post('restore_backup', { id: id })
          .then(function (res) {
            if (res && res.success) { window.alert(self.t('bk_restore_ok')); }
            else { self.error = self.t('bk_restore_fail') + ((res && res.message) || self.t('bk_unknown')); }
          })
          .catch(function () { self.error = self.t('bk_restore_req_fail'); });
      },
      // 删除历史备份。删除成功后刷新列表和统计卡。
      deleteBackup: function (id, name) {
        var self = this;
        if (!window.confirm(self.t('bk_confirm_delete_1') + name + self.t('bk_confirm_delete_2'))) { return; }
        this.post('delete_backup', { id: id })
          .then(function (res) {
            if (res && res.success) { self.fetchData(); }
            else { self.error = self.t('bk_delete_fail') + ((res && res.message) || ''); }
          })
          .catch(function () { self.error = self.t('bk_delete_req_fail'); });
      },
      // 保存自动备份设置，并刷新接口返回的最新状态。
      saveSettings: function () {
        var self = this;
        this.post('save_auto_backup_settings', {
          enabled: this.settings.enabled ? '1' : '0',
          frequency: this.settings.frequency,
          time: this.settings.time,
          keep: this.settings.keep
        })
          .then(function (res) {
            if (res && res.success) { window.alert(self.t('bk_save_ok')); self.fetchData(); }
            else { self.error = self.t('bk_save_fail') + ((res && res.data) || self.t('bk_unknown')); }
          })
          .catch(function () { self.error = self.t('bk_req_fail'); });
      }
    },
    template: [
      '<div class="eva-backup">',
      '  <div class="backup-banner"><img :src="bannerUrl" alt=""></div>',
      '  <p v-if="error" class="backup-error">{{ error }}</p>',
      '  <div v-if="loading" class="backup-loading" role="status" aria-live="polite">',
      '    <span class="backup-loading-spinner"></span>',
      '    <strong>{{ t(\'bk_loading_title\') }}</strong>',
      '    <span>{{ t(\'bk_loading_sub\') }}</span>',
      '    <div class="backup-loading-grid">',
      '      <i></i><i></i><i></i>',
      '    </div>',
      '  </div>',
      '  <template v-else>',
      '    <div class="backup-content">',
      '    <div class="card-group">',
      '      <div class="backup-card backup-stat">',
      '        <div class="backup-stat-head">',
      '          <div class="backup-icon backup-icon-primary"><i class="ri-database-2-line backup-icon-inner"></i></div>',
      '          <div class="backup-stat-main"><h3 class="backup-stat-label">{{ t(\'bk_recent\') }}</h3><p class="backup-stat-value">{{ latest.time || t(\'bk_none\') }}</p></div>',
      '          <span class="backup-badge backup-badge-success">{{ t(\'bk_success\') }}</span>',
      '        </div>',
      '        <p class="backup-stat-sub">{{ latest.name || t(\'bk_no_backup_yet\') }}</p>',
      '        <svg class="backup-spark backup-spark-primary" viewBox="0 0 280 70" preserveAspectRatio="none"><polyline :points="trendPoints"></polyline></svg>',
      '        <div class="backup-stat-cells">',
      '          <div class="backup-stat-cell"><span>{{ t(\'bk_type\') }}</span><strong>{{ latest.type === "automatic" ? t(\'bk_auto\') : (latest.time ? t(\'bk_manual\') : "—") }}</strong></div>',
      '          <div class="backup-stat-cell"><span>{{ t(\'bk_size\') }}</span><strong>{{ latest.size_mb || "—" }}</strong></div>',
      '          <div class="backup-stat-cell"><span>{{ t(\'bk_content\') }}</span><strong>{{ latestItemsLabel }}</strong></div>',
      '        </div>',
      '      </div>',
      '      <div class="backup-card backup-stat">',
      '        <div class="backup-stat-head">',
      '          <div class="backup-icon backup-icon-secondary"><i class="ri-calendar-check-line backup-icon-inner"></i></div>',
      '          <div class="backup-stat-main"><h3 class="backup-stat-label">{{ t(\'bk_auto_backup\') }}</h3><p class="backup-stat-value">{{ freqLabel(autoCard.frequency) }}</p></div>',
      '          <span class="backup-badge" :class="autoCard.enabled ? \'backup-badge-success\' : \'backup-badge-muted\'">{{ autoCard.enabled ? t(\'bk_enabled\') : t(\'bk_disabled\') }}</span>',
      '        </div>',
      '        <p class="backup-stat-sub">{{ autoCard.enabled ? t(\'bk_running\') : t(\'bk_not_enabled_auto\') }}</p>',
      '        <div class="backup-bars backup-bars-secondary"><i v-for="(d, i) in trend" :key="i" :style="{ height: (d.count ? Math.min(100, 22 + d.count * 26) : 6) + \'%\' }"></i></div>',
      '        <div class="backup-stat-cells">',
      '          <div class="backup-stat-cell"><span>{{ t(\'bk_next_run\') }}</span><strong>{{ autoCard.next_time || t(\'bk_not_scheduled\') }}</strong></div>',
      '          <div class="backup-stat-cell"><span>{{ t(\'bk_keep\') }}</span><strong>{{ settings.keep }} {{ t(\'bk_unit\') }}</strong></div>',
      '          <div class="backup-stat-cell"><span>{{ t(\'bk_status\') }}</span><strong>{{ autoCard.enabled ? t(\'bk_running2\') : t(\'bk_stopped\') }}</strong></div>',
      '        </div>',
      '      </div>',
      '      <div class="backup-card backup-stat">',
      '        <div class="backup-stat-head">',
      '          <div class="backup-icon backup-icon-info"><i class="ri-cloud-line backup-icon-inner"></i></div>',
      '          <div class="backup-stat-main"><h3 class="backup-stat-label">{{ t(\'bk_available\') }}</h3><p class="backup-stat-value">{{ available.count || 0 }} {{ t(\'bk_unit\') }}</p></div>',
      '          <span class="backup-badge backup-badge-info">{{ (available.count || 0) > 0 ? t(\'bk_ample\') : t(\'bk_empty_state\') }}</span>',
      '        </div>',
      '        <p class="backup-stat-sub">{{ t(\'bk_manual_auto\') }}</p>',
      '        <svg class="backup-spark backup-spark-info" viewBox="0 0 280 70" preserveAspectRatio="none"><polyline :points="trendPoints"></polyline></svg>',
      '        <div class="backup-stat-cells">',
      '          <div class="backup-stat-cell"><span>{{ t(\'bk_manual\') }}</span><strong>{{ counts.manual || 0 }} {{ t(\'bk_unit\') }}</strong></div>',
      '          <div class="backup-stat-cell"><span>{{ t(\'bk_auto\') }}</span><strong>{{ counts.automatic || 0 }} {{ t(\'bk_unit\') }}</strong></div>',
      '          <div class="backup-stat-cell"><span>{{ t(\'bk_total_size\') }}</span><strong>{{ available.total_size || 0 }} MB</strong></div>',
      '        </div>',
      '      </div>',
      '      <div class="backup-card backup-stat">',
      '        <div class="backup-stat-head">',
      '          <div class="backup-icon backup-icon-warning"><i class="ri-pie-chart-2-line backup-icon-inner"></i></div>',
      '          <div class="backup-stat-main"><h3 class="backup-stat-label">{{ t(\'bk_storage_rate\') }}</h3><p class="backup-stat-value">{{ storage.percent || 0 }}%</p></div>',
      '          <span class="backup-badge" :class="(storage.percent || 0) < 90 ? \'backup-badge-success\' : \'backup-badge-muted\'">{{ (storage.percent || 0) < 90 ? t(\'bk_good\') : t(\'bk_tight\') }}</span>',
      '        </div>',
      '        <div class="backup-stat-ringrow">',
      '          <div class="backup-ring" :style="{ \'--ring\': (storage.percent || 0) }"><span>{{ storage.percent || 0 }}%</span></div>',
      '          <div class="backup-ring-info"><p class="backup-stat-value">{{ storage.percent || 0 }}%</p><p class="backup-stat-sub">{{ t(\'bk_used\') }} {{ storage.used_gb || 0 }} / {{ storage.total_gb || 0 }} GB</p></div>',
      '        </div>',
      '        <div class="backup-stat-cells">',
      '          <div class="backup-stat-cell"><span>{{ t(\'bk_used\') }}</span><strong>{{ storage.used_gb || 0 }} GB</strong></div>',
      '          <div class="backup-stat-cell"><span>{{ t(\'bk_free\') }}</span><strong>{{ storage.free_gb || 0 }} GB</strong></div>',
      '          <div class="backup-stat-cell"><span>{{ t(\'bk_total\') }}</span><strong>{{ storage.total_gb || 0 }} GB</strong></div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div class="setting-group">',
      '      <div class="backup-card">',
      '        <h2 class="backup-card-title"><i class="ri-upload-cloud-2-line backup-title-icon backup-color-primary"></i>{{ t(\'bk_create\') }}</h2>',
      '        <div class="backup-section">',
      '          <div class="backup-form-group"><label class="backup-label">{{ t(\'bk_name\') }}</label><div class="backup-input-wrap"><input type="text" class="backup-input" maxlength="50" :placeholder="t(\'bk_name_ph\')" v-model="backupName"><span class="backup-input-count">{{ backupName.length }}/50</span></div></div>',
      '          <div class="backup-form-group"><label class="backup-label">{{ t(\'bk_content_label\') }}</label>',
      '            <div class="backup-opt-grid">',
      '              <label class="backup-opt-card" :class="{ \'is-on\': backupItems.indexOf(\'main\') > -1 }"><input type="checkbox" value="main" v-model="backupItems"><span class="backup-opt-check"><i class="ri-check-line"></i></span><span class="backup-opt-text">{{ t(\'bk_theme\') }}</span></label>',
      '              <label class="backup-opt-card" :class="{ \'is-on\': backupItems.indexOf(\'users\') > -1 }"><input type="checkbox" value="users" v-model="backupItems"><span class="backup-opt-check"><i class="ri-check-line"></i></span><span class="backup-opt-text">{{ t(\'bk_users\') }}</span></label>',
      '              <label class="backup-opt-card" :class="{ \'is-on\': backupItems.indexOf(\'system\') > -1 }"><input type="checkbox" value="system" v-model="backupItems"><span class="backup-opt-check"><i class="ri-check-line"></i></span><span class="backup-opt-text">{{ t(\'bk_system\') }}</span></label>',
      '              <label class="backup-opt-card" :class="{ \'is-on\': backupItems.indexOf(\'media\') > -1 }"><input type="checkbox" value="media" v-model="backupItems"><span class="backup-opt-check"><i class="ri-check-line"></i></span><span class="backup-opt-text">{{ t(\'bk_media\') }}</span></label>',
      '              <label class="backup-opt-card" :class="{ \'is-on\': backupItems.indexOf(\'config\') > -1 }"><input type="checkbox" value="config" v-model="backupItems"><span class="backup-opt-check"><i class="ri-check-line"></i></span><span class="backup-opt-text">{{ t(\'bk_config\') }}</span></label>',
      '            </div>',
      '          </div>',
      '          <div class="backup-estimate"><span><i class="ri-database-2-line"></i> {{ t(\'bk_est_size\') }} {{ estimate.size || "—" }}</span><span><i class="ri-time-line"></i> {{ t(\'bk_est_time\') }} {{ estimate.duration || t(\'bk_seconds\') }}</span></div>',
      '          <div class="backup-form-group"><button class="backup-button-primary backup-button-block" @click.prevent="createBackup"><i class="ri-refresh-line"></i> {{ t(\'bk_create_now\') }}</button></div>',
      '        </div>',
      '      </div>',
      '      <div class="backup-card">',
      '        <h2 class="backup-card-title"><i class="ri-download-cloud-2-line backup-title-icon backup-color-secondary"></i>{{ t(\'bk_restore\') }}</h2>',
      '        <div class="backup-section">',
      '          <label class="backup-upload">',
      '            <div class="backup-upload-area">',
      '              <div class="backup-upload-badge"><i class="ri-add-line"></i></div>',
      '              <p class="backup-upload-main">{{ t(\'bk_upload_main\') }} <span class="backup-upload-link">{{ t(\'bk_upload_link\') }}</span></p>',
      '              <p class="backup-upload-tip">{{ t(\'bk_upload_tip\') }}</p>',
      '            </div>',
      '            <input type="file" class="backup-upload-input" @change.prevent="handleFileUpload" accept=".bak,.json">',
      '          </label>',
      '          <div class="backup-selected" v-if="selectedFile.name">',
      '            <p class="backup-selected-label">{{ t(\'bk_selected\') }}</p>',
      '            <div class="backup-selected-file">',
      '              <div class="backup-selected-icon"><i class="ri-file-text-line"></i></div>',
      '              <span class="backup-selected-name">{{ selectedFile.name }}</span>',
      '              <span class="backup-selected-size">{{ selectedFile.size }}</span>',
      '              <i class="ri-close-line backup-selected-clear" @click.prevent="clearSelected"></i>',
      '            </div>',
      '          </div>',
      '          <div class="backup-warning"><i class="ri-error-warning-line"></i> {{ t(\'bk_restore_warning\') }}</div>',
      '          <div class="backup-form-group"><button class="backup-button-primary backup-button-block" :disabled="!selectedFile.name" @click.prevent="startRestore"><i class="ri-arrow-go-back-line"></i> {{ t(\'bk_start_restore\') }}</button></div>',
      '        </div>',
      '      </div>',
      '      <div class="backup-aside">',
      '        <div class="backup-card">',
      '          <h2 class="backup-card-title"><i class="ri-lightbulb-line backup-title-icon backup-color-primary"></i>{{ t(\'bk_advice\') }}</h2>',
      '          <div class="backup-advice">',
      '            <div class="backup-advice-item"><div class="backup-advice-icon backup-advice-icon-warning"><i class="ri-alarm-warning-line"></i></div><div class="backup-advice-body"><p class="backup-advice-title">{{ t(\'bk_advice1_t\') }}</p><p class="backup-advice-desc">{{ t(\'bk_advice1_d\') }}</p></div><button class="backup-advice-btn">{{ t(\'bk_goto_set\') }}</button></div>',
      '            <div class="backup-advice-item"><div class="backup-advice-icon backup-advice-icon-info"><i class="ri-delete-bin-line"></i></div><div class="backup-advice-body"><p class="backup-advice-title">{{ t(\'bk_advice2_t\') }}</p><p class="backup-advice-desc">{{ t(\'bk_advice2_d\') }}</p></div><button class="backup-advice-btn">{{ t(\'bk_goto_clean\') }}</button></div>',
      '            <div class="backup-advice-item"><div class="backup-advice-icon backup-advice-icon-success"><i class="ri-cloud-line"></i></div><div class="backup-advice-body"><p class="backup-advice-title">{{ t(\'bk_advice3_t\') }}</p><p class="backup-advice-desc">{{ t(\'bk_advice3_d\') }}</p></div><button class="backup-advice-btn">{{ t(\'bk_goto_config\') }}</button></div>',
      '          </div>',
      '        </div>',
      '        <div class="backup-card">',
      '          <h2 class="backup-card-title"><i class="ri-pulse-line backup-title-icon backup-color-secondary"></i>{{ t(\'bk_recent_activity\') }}</h2>',
      '          <div class="backup-activity">',
      '            <div class="backup-activity-item" v-for="(a, i) in activities" :key="i"><span class="backup-activity-dot" :class="a.level === \'info\' ? \'backup-activity-dot-info\' : \'backup-activity-dot-success\'"></span><div class="backup-activity-body"><p class="backup-activity-title">{{ a.title }}</p><p class="backup-activity-time">{{ a.desc }}</p></div><span class="backup-activity-tag">{{ t(\'bk_done\') }}</span></div>',
      '            <div v-if="!activities.length" class="backup-activity-empty">{{ t(\'bk_no_activity\') }}</div>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div class="history-row">',
      '      <div class="backup-history">',
      '        <div class="backup-history-header">',
      '          <h2 class="backup-history-title"><i class="ri-history-line backup-history-title-icon"></i>{{ t(\'bk_history\') }}</h2>',
      '          <div class="backup-history-tools">',
      '            <div class="backup-tabs">',
      '              <button :class="{ \'is-active\': activeTab === \'all\' }" @click.prevent="activeTab = \'all\'">{{ t(\'bk_all\') }}</button>',
      '              <button :class="{ \'is-active\': activeTab === \'manual\' }" @click.prevent="activeTab = \'manual\'">{{ t(\'bk_manual\') }}</button>',
      '              <button :class="{ \'is-active\': activeTab === \'auto\' }" @click.prevent="activeTab = \'auto\'">{{ t(\'bk_auto\') }}</button>',
      '            </div>',
      '            <div class="backup-search"><i class="ri-search-line"></i><input type="text" :placeholder="t(\'bk_search_ph\')" v-model="searchKey"></div>',
      '          </div>',
      '        </div>',
      '        <div class="backup-table-wrapper">',
      '          <table class="backup-table">',
      '            <thead><tr><th>{{ t(\'bk_th_name\') }}</th><th>{{ t(\'bk_th_time\') }}</th><th>{{ t(\'bk_th_size\') }}</th><th>{{ t(\'bk_th_type\') }}</th><th>{{ t(\'bk_th_action\') }}</th></tr></thead>',
      '            <tbody>',
      '              <tr v-for="item in filteredList" :key="item.id">',
      '                <td><div class="backup-file"><div class="backup-file-icon"><i class="ri-file-text-line"></i></div><div><div class="backup-filename">{{ item.name }}_{{ item.id }}</div><div class="backup-filesub">{{ item.typeLabel }}</div></div></div></td>',
      '                <td>{{ item.time }}</td>',
      '                <td>{{ item.size_mb }}</td>',
      '                <td><span class="backup-tag backup-tag-blue">{{ item.itemTypes }}</span></td>',
      '                <td class="backup-actions">',
      '                  <button class="backup-action-primary" @click.prevent="downloadBackup(item.id, item.name)"><i class="ri-download-2-line"></i> {{ t(\'bk_download\') }}</button>',
      '                  <button class="backup-action-secondary" @click.prevent="restoreBackup(item.id, item.name)"><i class="ri-arrow-go-back-line"></i> {{ t(\'bk_do_restore\') }}</button>',
      '                  <button class="backup-action-danger" @click.prevent="deleteBackup(item.id, item.name)"><i class="ri-delete-bin-line"></i> {{ t(\'bk_delete\') }}</button>',
      '                </td>',
      '              </tr>',
      '              <tr v-if="filteredList.length === 0"><td colspan="5"><div class="backup-empty"><div class="backup-empty-icon"><i class="ri-inbox-line"></i></div><p class="backup-empty-title">{{ t(\'bk_no_record\') }}</p><p class="backup-empty-sub">{{ t(\'bk_no_record_sub\') }}</p></div></td></tr>',
      '            </tbody>',
      '          </table>',
      '        </div>',
      '        <div class="backup-pagination"><div class="backup-pagination-info">{{ t(\'bk_total1\') }} {{ filteredList.length }} {{ t(\'bk_records\') }}</div></div>',
      '      </div>',
      '      <div class="backup-aside">',
      '        <div class="aside-charts">',
      '          <div class="backup-card">',
      '          <h2 class="backup-card-title"><i class="ri-line-chart-line backup-title-icon backup-color-primary"></i>{{ t(\'bk_trend7\') }}</h2>',
      '          <svg class="backup-trend" viewBox="0 0 280 70" preserveAspectRatio="none"><polyline :points="trendPoints"></polyline></svg>',
      '          <div class="backup-trend-axis"><span v-for="(d, i) in trend" :key="i">{{ d.label }}</span></div>',
      '        </div>',
      '        <div class="backup-card">',
      '          <h2 class="backup-card-title"><i class="ri-pie-chart-line backup-title-icon backup-color-secondary"></i>{{ t(\'bk_storage_dist\') }}</h2>',
      '          <div class="backup-dist">',
      '            <div class="backup-donut" :style="{ background: \'conic-gradient(var(--eva-primary) 0 \' + distAuto + \'%, var(--eva-accent) 0 100%)\' }"><span>{{ available.count || 0 }} <small>{{ t(\'bk_unit\') }}</small></span></div>',
      '            <div class="backup-dist-legend">',
      '              <div class="backup-dist-item"><span class="backup-dot backup-dot-1"></span>{{ t(\'bk_auto_backup\') }}<strong>{{ counts.automatic || 0 }} {{ t(\'bk_unit\') }}</strong></div>',
      '              <div class="backup-dist-item"><span class="backup-dot" style="background:var(--eva-accent)"></span>{{ t(\'bk_manual_backup\') }}<strong>{{ counts.manual || 0 }} {{ t(\'bk_unit\') }}</strong></div>',
      '              <div class="backup-dist-item"><span class="backup-dot backup-dot-3"></span>{{ t(\'bk_total_size\') }}<strong>{{ available.total_size || 0 }} MB</strong></div>',
      '              <div class="backup-dist-item"><span class="backup-dot backup-dot-4"></span>{{ t(\'bk_disk_usage\') }}<strong>{{ storage.percent || 0 }}%</strong></div>',
      '            </div>',
      '          </div>',
      '        </div>',
      '        </div>',
      '        <div class="backup-trio">',
      '          <div class="backup-card">',
      '            <h2 class="backup-card-title"><i class="ri-list-check-2 backup-title-icon backup-color-primary"></i>{{ t(\'bk_queue\') }}</h2>',
      '            <div class="backup-queue">',
      '              <div class="backup-queue-item" v-for="(q, i) in queue" :key="i"><span class="backup-queue-dot backup-queue-dot-primary"></span><span class="backup-queue-name">{{ q.name }}</span><span class="backup-queue-tag backup-queue-tag-active">{{ q.status }}</span></div>',
      '              <div v-if="!queue.length" class="backup-queue-empty">{{ t(\'bk_no_queue\') }}</div>',
      '            </div>',
      '          </div>',
      '          <div class="backup-card">',
      '            <h2 class="backup-card-title"><i class="ri-heart-pulse-line backup-title-icon backup-color-secondary"></i>{{ t(\'bk_health\') }}</h2>',
      '            <div class="backup-health">',
      '              <div class="backup-health-item" v-for="(h, i) in health" :key="i"><span class="backup-health-name"><i :class="h.ok ? \'ri-checkbox-circle-fill\' : \'ri-error-warning-fill backup-health-warnicon\'"></i> {{ healthName(h.name) }}</span><span :class="h.ok ? \'backup-health-ok\' : \'backup-health-warn\'">{{ healthLabel(h.label) }}</span></div>',
      '            </div>',
      '          </div>',
      '          <div class="backup-card">',
      '            <h2 class="backup-card-title"><i class="ri-error-warning-line backup-title-icon backup-color-warning"></i>{{ t(\'bk_restore_notice\') }}</h2>',
      '            <ul class="backup-notice">',
      '              <li><i class="ri-alert-line"></i> {{ t(\'bk_notice1\') }}</li>',
      '              <li><i class="ri-alert-line"></i> {{ t(\'bk_notice2\') }}</li>',
      '              <li><i class="ri-alert-line"></i> {{ t(\'bk_notice3\') }}</li>',
      '              <li><i class="ri-alert-line"></i> {{ t(\'bk_notice4\') }}</li>',
      '              <li><i class="ri-alert-line"></i> {{ t(\'bk_notice5\') }}</li>',
      '            </ul>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div class="footer-row">',
      '      <div class="backup-auto-card">',
      '      <h2 class="backup-auto-title"><i class="ri-settings-4-line backup-auto-title-icon"></i>{{ t(\'bk_auto_settings\') }}</h2>',
      '      <div class="backup-auto-section">',
      '        <div class="backup-toggle-group">',
      '          <input id="eva-bk-auto" type="checkbox" v-model="settings.enabled">',
      '          <div class="backup-toggle-text"><label for="eva-bk-auto" class="backup-label">{{ t(\'bk_enable_auto\') }}</label><p class="backup-hint">{{ t(\'bk_enable_auto_hint\') }}</p></div>',
      '        </div>',
      '        <div class="backup-grid-3">',
      '          <div class="backup-form-group"><label class="backup-label">{{ t(\'bk_frequency\') }}</label><eva-select v-model="settings.frequency" :options="{ \'每天\': t(\'bk_freq_day\'), \'每周\': t(\'bk_freq_week\'), \'每月\': t(\'bk_freq_month\'), \'每季度\': t(\'bk_freq_quarter\') }"></eva-select></div>',
      '          <div class="backup-form-group"><label class="backup-label">{{ t(\'bk_time\') }}</label>',
      '            <div class="backup-time-row">',
      '              <eva-select v-model="hour" :options="hourOptions"></eva-select>',
      '              <span class="backup-time-colon">:</span>',
      '              <eva-select v-model="minute" :options="minuteOptions"></eva-select>',
      '            </div>',
      '          </div>',
      '          <div class="backup-form-group"><label class="backup-label">{{ t(\'bk_keep_count\') }}</label><eva-select v-model="settings.keep" :options="{ 5: \'5 \' + t(\'bk_unit\'), 10: \'10 \' + t(\'bk_unit\'), 20: \'20 \' + t(\'bk_unit\') }"></eva-select></div>',
      '        </div>',
      '        <div class="backup-form-group"><button class="backup-button-primary" @click.prevent="saveSettings">{{ t(\'bk_save\') }}</button></div>',
      '      </div>',
      '      </div>',
      '      <div class="backup-aside">',
      '      <div class="backup-card">',
      '        <h2 class="backup-card-title"><i class="ri-information-line backup-title-icon backup-color-secondary"></i>{{ t(\'bk_rules\') }}</h2>',
      '        <ul class="backup-rules">',
      '          <li>{{ t(\'bk_rule1\') }}</li>',
      '          <li>{{ t(\'bk_rule2\') }}</li>',
      '          <li>{{ t(\'bk_rule3\') }}</li>',
      '          <li>{{ t(\'bk_rule4\') }}</li>',
      '        </ul>',
      '      </div>',
      '      </div>',
      '    </div>',
      '    </div>',
      '  </template>',
      '</div>'
    ].join('\n')
  };
})();
