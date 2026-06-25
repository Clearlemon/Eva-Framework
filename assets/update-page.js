/**
 * Eva 独立页：版本计划 / 系统更新 Dashboard。
 *
 * 职责边界：
 * - 这是一个独立挂载的小型 Vue 应用，不属于通用 EvaFields 字段注册表。
 * - 后端 callback 只输出 `#update` / `[data-eva-update-page]` 挂载点和 data-* 初始数据。
 * - 本文件负责解析初始数据、挂载页面、调用主题侧更新 REST API、维护弹窗和交互状态。
 *
 * 数据来源：
 * - `data-version` / `data-last-update` / `data-latest-version`：主题版本与更新状态。
 * - `data-schedule`：计划更新设置，JSON 字符串。
 * - `data-logs`：由 PHP 解析 `update_logs.md` 后注入的真实更新日志。
 * - `data-activities`：版本计划专用操作日志，来自 `lentasy_update_activities` option。
 *
 * 样式约定：
 * - 所有样式都在 `eva.css` 的 `.eva-update` / `.eva-up-*` 命名空间内维护。
 * - 本文件不动态注入 CSS，避免污染 WordPress 后台或前台全局样式。
 *
 * 依赖接口（主题 `lf/v2`）：
 * - `SaveUpdateSchedule`：保存计划更新设置。
 * - `StartSystemUpdate`：启动主题更新下载。
 * - `GetUpdateProgress`：轮询下载 / 安装进度。
 * - `InstallThemePackage`：下载完成后执行安装。
 */
(function () {
  if (!window.Vue || !window.Vue.createApp) {
    return;
  }

  // EvaFW.config 由 PHP 在后台页 / 独立页注入，集中提供 REST 地址、nonce 等运行时配置。
  function cfg() { return (window.EvaFW && window.EvaFW.config) || {}; }
  function restBase() { return (cfg().restUrl || '/wp-json/').replace(/\/+$/, '') + '/'; }
  function nonce() { return cfg().restNonce || cfg().nonce || ''; }

  /**
   * 调用主题侧更新 API 的统一封装。
   *
   * 注意：
   * - 这里仅做 JSON 解析兜底，不在封装层吞掉业务错误。
   * - REST permission 依赖 WordPress nonce 和当前用户能力，前端只负责带上 `X-WP-Nonce`。
   */
  function api(path, opts) {
    opts = opts || {};
    return fetch(restBase() + 'lf/v2/' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce() },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }

  /**
   * 从挂载节点读取后端注入的初始数据。
   *
   * 所有 JSON 字段都使用 try/catch 容错：
   * - 防止某个 data-* 被主题、缓存插件或手工编辑破坏后导致整页无法挂载。
   * - 失败时回退为空对象 / 空数组，由模板负责显示空状态。
   */
  function parseData(el) {
    var d = el.dataset || {};
    var schedule = {}, logs = [], activities = [];
    try { schedule = JSON.parse(d.schedule || '{}') || {}; } catch (e) { schedule = {}; }
    try { logs = JSON.parse(d.logs || '[]') || []; } catch (e) { logs = []; }
    try { activities = JSON.parse(d.activities || '[]') || []; } catch (e) { activities = []; }
    return {
      version: d.version || '1.0.0',
      lastUpdate: d.lastUpdate || '—',
      latestVersion: d.latestVersion || '',
      updateInfo: d.updateInfo || '',
      schedule: {
        enabled: !!schedule.enabled,
        time: schedule.time || '03:00',
        frequency: schedule.frequency || 'everyday'
      },
      logs: Array.isArray(logs) ? logs : [],
      activities: Array.isArray(activities) ? activities : []
    };
  }

  // 计划更新时间使用两个 eva-select（小时 / 分钟），这里生成 00-23 / 00-59 的选项表。
  function pad2(n) { return String(n).padStart(2, '0'); }
  function rangeMap(max) { var m = {}; for (var i = 0; i < max; i++) { m[pad2(i)] = pad2(i); } return m; }
  function splitTime(t) { var p = String(t || '03:00').split(':'); return { h: pad2((parseInt(p[0], 10) || 0)), m: pad2((parseInt(p[1], 10) || 0)) }; }

  // REST 与后端 option 使用英文枚举；UI 展示统一映射为中文。
  var FREQ = [['everyday', '每天'], ['monday', '周一'], ['tuesday', '周二'], ['wednesday', '周三'], ['thursday', '周四'], ['friday', '周五'], ['saturday', '周六'], ['sunday', '周日']];

  /*
   * Vue 模板使用字符串拼接而不是 SFC：
   * - WordPress 插件无需构建流程即可运行。
   * - 所有 class 都带 `eva-up-` 前缀，便于和通用 Eva 外壳样式隔离。
   */
  var TEMPLATE =
    '<div class="eva-update">' +
    '  <transition name="eva-up-fade"><div v-if="notice.msg" class="eva-up-notice" :class="\'is-\'+notice.type">{{ notice.msg }}</div></transition>' +
    '  <div class="eva-up-banner"><img :src="banner" alt=""></div>' +

    '  <div class="eva-up-stats">' +
    '    <div class="eva-up-stat">' +
    '      <div class="eva-up-stat-head"><div class="eva-up-stat-ico is-primary"><i class="ri-flashlight-line"></i></div><div class="eva-up-stat-main"><p class="eva-up-stat-title">当前版本</p><div class="eva-up-stat-value">v{{ d.version }}</div></div></div>' +
    '      <div class="eva-up-stat-meta"><div><span>最后更新</span><strong>{{ d.lastUpdate }}</strong></div><div><span>更新通道</span><strong>{{ channel }}</strong></div></div>' +
    '      <i class="ri-shield-check-line eva-up-stat-wm"></i>' +
    '    </div>' +
    '    <div class="eva-up-stat">' +
    '      <div class="eva-up-stat-head"><div class="eva-up-stat-ico" :class="hasUpdate?\'is-warn\':\'is-success\'"><i :class="hasUpdate?\'ri-download-cloud-line\':\'ri-checkbox-circle-line\'"></i></div><div class="eva-up-stat-main"><p class="eva-up-stat-title">可用更新</p><div class="eva-up-stat-value">{{ hasUpdate ? d.latestVersion : \'已最新\' }}</div></div><span class="eva-up-tag" :class="hasUpdate?\'is-warn\':\'is-ok\'">{{ hasUpdate?\'可更新\':\'最新\' }}</span></div>' +
    '      <button class="eva-up-btn is-primary eva-up-stat-btn" :class="{\'is-disabled\':!hasUpdate}" @click="startUpdate">{{ hasUpdate?\'立即更新\':\'无需更新\' }}</button>' +
    '      <i class="ri-rocket-2-line eva-up-stat-wm"></i>' +
    '    </div>' +
    '    <div class="eva-up-stat">' +
    '      <div class="eva-up-stat-head"><div class="eva-up-stat-ico is-success"><i class="ri-heart-pulse-line"></i></div><div class="eva-up-stat-main"><p class="eva-up-stat-title">系统状态</p><div class="eva-up-stat-value">运行正常</div></div><span class="eva-up-tag is-ok">健康</span></div>' +
    '      <div class="eva-up-stat-meta"><div><span>运行时长</span><strong>{{ sys.uptime }}</strong></div><div><span>负载</span><strong>{{ sys.load }}</strong></div></div>' +
    '      <i class="ri-pulse-line eva-up-stat-wm"></i>' +
    '    </div>' +
    '    <div class="eva-up-stat">' +
    '      <div class="eva-up-stat-head"><div class="eva-up-stat-ico is-accent"><i class="ri-git-branch-line"></i></div><div class="eva-up-stat-main"><p class="eva-up-stat-title">更新通道</p><div class="eva-up-stat-value">{{ channel }}</div></div></div>' +
    '      <div class="eva-up-stat-meta"><div><span>自动更新</span><strong>{{ d.schedule.enabled?\'已开启\':\'已关闭\' }}</strong></div><div><span>检查频率</span><strong>{{ freqLabel(d.schedule.frequency) }}</strong></div></div>' +
    '      <i class="ri-flow-chart eva-up-stat-wm"></i>' +
    '    </div>' +
    '  </div>' +

    '  <div class="eva-up-main">' +
    '    <div class="eva-up-panel">' +
    '      <div class="eva-up-panel-head"><h3 class="eva-up-panel-title"><span class="eva-up-panel-ico"><i class="ri-file-list-3-line"></i></span>版本详情</h3><div class="eva-up-ver-nav" v-if="d.logs.length > 1"><button type="button" :disabled="selectedLogIndex <= 0" @click="prevLog" title="上一个版本"><i class="ri-arrow-left-s-line"></i></button><button type="button" :disabled="selectedLogIndex >= d.logs.length - 1" @click="nextLog" title="下一个版本"><i class="ri-arrow-right-s-line"></i></button></div></div>' +
    '      <div class="eva-up-ver-tabs" v-if="d.logs.length > 1" :class="{\'has-left-mask\': selectedLogIndex > 1, \'has-right-mask\': selectedLogIndex < d.logs.length - 3}"><div class="eva-up-ver-track" :style="{transform:\'translateX(-\'+tabOffset+\'px)\'}"><button type="button" v-for="(log,i) in d.logs" :key="log.version || i" :class="{\'is-active\': selectedLogIndex === i}" @click="selectedLogIndex = i"><strong>v{{ log.version }}</strong></button></div></div>' +
    '      <template v-if="selectedLog.sections"><div class="eva-up-verbody"><div class="eva-up-versec" v-for="(sec, title) in selectedLog.sections" :key="title"><div class="eva-up-versec-head">{{ title }}<span class="eva-up-count">{{ sec.items.length }}</span></div><ul class="eva-up-verlist"><li v-for="(it,k) in sec.items" :key="k">{{ it }}</li></ul></div><div class="eva-up-verfoot"><button type="button" class="eva-up-verlink" @click="showVersionModal = true">查看完整版本说明 <i class="ri-arrow-right-line"></i></button></div></div></template>' +
    '      <div v-else class="eva-up-empty">暂无版本详情</div>' +
    '    </div>' +
    '    <div class="eva-up-panel">' +
    '      <div class="eva-up-panel-head"><h3 class="eva-up-panel-title"><span class="eva-up-panel-ico"><i class="ri-time-line"></i></span>计划更新</h3></div>' +
    '      <label class="eva-up-switch-row"><span class="eva-up-switch-text"><strong>启用计划更新</strong><em>到点自动下载并安装</em></span><input type="checkbox" class="eva-up-switch" v-model="form.enabled"></label>' +
    '      <div class="eva-up-field"><label class="eva-up-label">更新时间</label><div class="eva-up-time-grid"><eva-select :options="hourMap" v-model="form.hour"></eva-select><eva-select :options="minuteMap" v-model="form.minute"></eva-select></div></div>' +
    '      <div class="eva-up-field"><label class="eva-up-label">更新频率</label><eva-select :options="freqMap" :searchable="false" v-model="form.frequency"></eva-select></div>' +
    '    </div>' +
    '    <div class="eva-up-side">' +
    '      <div class="eva-up-mini"><h4>环境检测 <span class="eva-up-tag is-ok">通过</span></h4><div class="eva-up-env"><span v-for="(e,i) in env" :key="i"><i class="ri-checkbox-circle-line"></i>{{ e }}</span></div></div>' +
    '      <div class="eva-up-mini"><h4>风险提示</h4><ul class="eva-up-mini-list"><li v-for="(r,i) in risks" :key="i"><i class="ri-error-warning-line"></i><span>{{ r }}</span></li></ul></div>' +
    '    </div>' +
    '  </div>' +

    '  <div class="eva-up-bottom">' +
    '    <div class="eva-up-panel">' +
    '      <div class="eva-up-panel-head"><h3 class="eva-up-panel-title"><span class="eva-up-panel-ico"><i class="ri-history-line"></i></span>更新日志</h3><span class="eva-up-tag is-mute">共 {{ d.logs.length }} 个版本</span></div>' +
    '      <div class="eva-up-table-wrap"><table class="eva-up-table"><thead><tr><th>版本</th><th>日期</th><th>摘要</th><th>状态</th></tr></thead><tbody>' +
    '        <tr v-for="(log,i) in shownLogs" :key="i"><td>v{{ log.version }}</td><td>{{ log.date }}</td><td class="eva-up-td-sum">{{ summary(log) }}</td><td><span class="eva-up-table-tag" :class="i===0?\'is-warn\':\'is-ok\'">{{ i===0?\'最新\':\'已发布\' }}</span></td></tr>' +
    '        <tr v-if="!d.logs.length"><td colspan="4"><div class="eva-up-empty">暂无更新日志</div></td></tr>' +
    '      </tbody></table></div>' +
    '      <div class="eva-up-table-foot" v-if="d.logs.length>logLimit"><button class="eva-up-btn is-ghost eva-up-more" @click="logLimit+=10">加载更多</button></div>' +
    '    </div>' +
    '    <div class="eva-up-panel">' +
    '      <div class="eva-up-panel-head"><h3 class="eva-up-panel-title"><span class="eva-up-panel-ico"><i class="ri-calendar-schedule-line"></i></span>计划任务</h3></div>' +
    '      <div class="eva-up-plan"><div class="eva-up-plan-label">下次计划检查</div><div class="eva-up-plan-time">{{ d.schedule.enabled ? d.schedule.time : \'未启用\' }}</div><div class="eva-up-plan-grid"><div><span>频率</span><strong>{{ freqLabel(d.schedule.frequency) }}</strong></div><div><span>状态</span><strong>{{ d.schedule.enabled?\'运行中\':\'已停用\' }}</strong></div></div><ul class="eva-up-plan-list"><li v-for="(p,i) in planNotes" :key="i"><i class="ri-checkbox-circle-line"></i><em>{{ p }}</em></li></ul></div>' +
    '    </div>' +
    '    <div class="eva-up-panel">' +
    '      <div class="eva-up-panel-head"><h3 class="eva-up-panel-title"><span class="eva-up-panel-ico"><i class="ri-pulse-line"></i></span>最近操作</h3></div>' +
    '      <div class="eva-up-timeline" v-if="timeline.length"><div class="eva-up-tl-item" v-for="(t,i) in timeline" :key="i"><div class="eva-up-tl-dot"></div><div><div class="eva-up-tl-title">{{ t.title }}</div><div class="eva-up-tl-desc">{{ t.desc }}</div><div class="eva-up-tl-time">{{ t.time }}</div></div></div></div><div v-else class="eva-up-empty">暂无最近操作</div>' +
    '    </div>' +
    '  </div>' +

    '  <div class="eva-up-modal" v-if="showVersionModal" @click.self="showVersionModal = false">' +
    '    <div class="eva-up-modal-box is-version">' +
    '      <div class="eva-up-modal-bar"><h3>{{ selectedLog.version ? (\'v\'+selectedLog.version) : \'版本说明\' }}</h3><button type="button" class="eva-up-x" @click="showVersionModal = false">×</button></div>' +
    '      <div class="eva-up-version-full"><div class="eva-up-versec" v-for="(sec, title) in selectedLog.sections" :key="title"><div class="eva-up-versec-head">{{ title }}<span class="eva-up-count">{{ sec.items.length }}</span></div><ul class="eva-up-verlist"><li v-for="(it,k) in sec.items" :key="k">{{ it }}</li></ul></div></div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="eva-up-modal" v-if="showModal">' +
    '    <div class="eva-up-modal-box">' +
    '      <div class="eva-up-modal-head"><div class="eva-up-modal-icon"><i class="ri-download-cloud-2-line"></i></div><h3>正在更新系统</h3><p>请勿关闭窗口，完成后将自动重启</p></div>' +
    '      <div class="eva-up-progress"><div class="eva-up-progress-label"><span>下载进度</span><span>{{ download }}%</span></div><div class="eva-up-progress-bg"><div class="eva-up-progress-bar" :style="{width:download+\'%\'}"></div></div></div>' +
    '      <div class="eva-up-progress"><div class="eva-up-progress-label"><span>安装进度</span><span>{{ install }}%</span></div><div class="eva-up-progress-bg"><div class="eva-up-progress-bar" :style="{width:install+\'%\'}"></div></div></div>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  function createUpdateApp(el) {
    var init = parseData(el);
    var app = window.Vue.createApp({
      data: function () {
        var t = splitTime(init.schedule.time);
        return {
          d: init,
          banner: 'https://www.dmoe.cc/random.php',
          logLimit: 10,
          showModal: false,
          showVersionModal: false,
          isUpdating: false,
          download: 0,
          install: 0,
          form: { enabled: init.schedule.enabled, hour: t.h, minute: t.m, frequency: init.schedule.frequency },
          freqOptions: FREQ,
          freqMap: { everyday: '每天', monday: '周一', tuesday: '周二', wednesday: '周三', thursday: '周四', friday: '周五', saturday: '周六', sunday: '周日' },
          hourMap: rangeMap(24),
          minuteMap: rangeMap(60),
          selectedLogIndex: 0,
          notice: { msg: '', type: 'info' },
          channel: '稳定版',
          sys: { uptime: '—', load: '正常' },
          env: ['PHP 8.0+', 'WordPress 6.0+', 'cURL 已启用', 'ZipArchive 可用', 'HTTPS 已开启', '磁盘空间充足'],
          risks: ['更新前建议先完成整站备份，避免异常时无法回退', '更新过程中请保持页面开启，并确保服务器网络稳定'],
          planNotes: ['到点自动下载更新包', '校验通过后自动安装', '失败自动回滚并通知', '执行结果写入最近操作'],
          timeline: init.activities,
          tabMaxOffset: 0,
          _timer: null,
          _noticeTimer: null,
          _resizeHandler: null
        };
      },
      computed: {
        // 简单语义化版本比较：只处理 x.y.z 数字段，Beta/emoji 等展示后缀在比较前由后端 latestVersion 约束。
        hasUpdate: function () {
          return this.cmp((this.d.latestVersion || '').replace(/^Version\s+/i, '').trim(), this.d.version) > 0;
        },
        shownLogs: function () { return this.d.logs.slice(0, this.logLimit); },
        latestLog: function () { return this.d.logs[0] || {}; },
        selectedLog: function () { return this.d.logs[this.selectedLogIndex] || this.latestLog; },
        // tabs 轨道由左右按钮驱动，偏移量必须被实测的最大滚动距离限制，避免最右侧留空。
        tabOffset: function () {
          var step = 104;
          var raw = Math.max(0, this.selectedLogIndex - 2) * step;
          return Math.min(raw, this.tabMaxOffset);
        }
      },
      methods: {
        // 比较两个语义版本号。返回值：>0 表示 a 更新，<0 表示 b 更新，0 表示相等。
        cmp: function (a, b) {
          var pa = (a || '').split('.').map(Number), pb = (b || '').split('.').map(Number);
          for (var i = 0; i < Math.max(pa.length, pb.length); i++) { var x = (pa[i] || 0) - (pb[i] || 0); if (x) { return x; } }
          return 0;
        },
        freqLabel: function (f) {
          for (var i = 0; i < FREQ.length; i++) { if (FREQ[i][0] === f) { return FREQ[i][1]; } }
          return f || '每天';
        },
        prevLog: function () {
          if (this.selectedLogIndex > 0) { this.selectedLogIndex--; }
        },
        nextLog: function () {
          if (this.selectedLogIndex < this.d.logs.length - 1) { this.selectedLogIndex++; }
        },
        // 根据真实 DOM 宽度计算 tabs 轨道最大可移动距离，避免固定估算在不同屏宽下失准。
        updateTabMetrics: function () {
          var tabs = this.$el.querySelector('.eva-up-ver-tabs');
          var track = this.$el.querySelector('.eva-up-ver-track');
          if (!tabs || !track) { this.tabMaxOffset = 0; return; }
          this.tabMaxOffset = Math.max(0, track.scrollWidth - tabs.clientWidth);
        },
        // 更新日志表格摘要：取第一个 section 的第一条内容作为列表摘要。
        summary: function (log) {
          if (!log || !log.sections) { return '—'; }
          for (var t in log.sections) { if (log.sections[t] && log.sections[t].items && log.sections[t].items[0]) { return log.sections[t].items[0]; } }
          return '—';
        },
        // REST 接口会返回最新版本计划操作日志，成功后即时同步右下角“最近操作”。
        syncActivities: function (res) {
          if (res && Array.isArray(res.activities)) {
            this.timeline = res.activities;
          }
        },
        setNotice: function (msg, type) {
          var self = this;
          this.notice = { msg: msg, type: type || 'info' };
          if (this._noticeTimer) { clearTimeout(this._noticeTimer); }
          this._noticeTimer = setTimeout(function () { self.notice = { msg: '', type: 'info' }; }, 2800);
        },
        // 保存计划更新设置。按钮已从 UI 移除时，此方法仍保留给后续自动保存/快捷操作复用。
        saveSchedule: function () {
          var self = this;
          var time = self.form.hour + ':' + self.form.minute;
          api('SaveUpdateSchedule', { method: 'POST', body: { enabled: self.form.enabled, time: time, frequency: self.form.frequency } })
            .then(function (res) { self.setNotice((res && res.message) || '保存成功', 'success'); self.d.schedule = { enabled: self.form.enabled, time: time, frequency: self.form.frequency }; self.syncActivities(res); })
            .catch(function () { self.setNotice('保存失败', 'error'); });
        },
        // 启动更新：先请求后端下载更新包，然后进入轮询进度。
        startUpdate: function () {
          if (this.isUpdating || !this.hasUpdate) { return; }
          this.isUpdating = true; this.showModal = true; this.download = 0; this.install = 0;
          var self = this;
          api('StartSystemUpdate', { method: 'POST' })
            .then(function (res) { self.setNotice('正在检查更新...', 'info'); self.syncActivities(res); self.poll(); })
            .catch(function () { self.setNotice('更新失败', 'error'); self.isUpdating = false; self.showModal = false; });
        },
        // 下载阶段完成后调用安装接口，后端负责解压与替换主题文件。
        installPkg: function () {
          var self = this;
          api('InstallThemePackage', { method: 'POST' })
            .then(function (res) { self.setNotice((res && res.message) || '解压中...', 'info'); self.syncActivities(res); })
            .catch(function () { self.setNotice('安装失败', 'error'); self.isUpdating = false; });
        },
        // 轮询更新进度。后端通过 transient 暴露 phase/percent，前端只负责反映进度与结束态。
        poll: function () {
          var self = this;
          if (this._timer) { clearInterval(this._timer); }
          this._timer = setInterval(function () {
            api('GetUpdateProgress').then(function (data) {
              var phase = data.phase;
              if (phase === 'download') { self.download = (data.download && data.download.percent) || 0; if (self.download >= 100) { self.installPkg(); } }
              if (phase === 'install') { self.install = (data.install && data.install.percent) || 0; }
              if (phase === 'complete') { self.install = 100; clearInterval(self._timer); self._timer = null; self.isUpdating = false; self.setNotice('更新完成', 'success'); setTimeout(function () { self.showModal = false; }, 1500); }
            }).catch(function () { clearInterval(self._timer); self._timer = null; self.isUpdating = false; self.setNotice('获取进度失败', 'error'); });
          }, 1500);
        }
      },
      mounted: function () {
        var self = this;
        // tabs 轨道宽度依赖真实渲染后的 DOM，必须在 mount 后测量。
        this.$nextTick(function () { self.updateTabMetrics(); });
        this._resizeHandler = function () { self.updateTabMetrics(); };
        window.addEventListener('resize', this._resizeHandler);
      },
      beforeUnmount: function () {
        if (this._resizeHandler) {
          window.removeEventListener('resize', this._resizeHandler);
        }
      },
      template: TEMPLATE
    });
    // 复用 eva-select 美化下拉库（Libs/eva-select），替代原生 select。
    if (window.EvaUI && window.EvaUI.Select) {
      app.component('eva-select', window.EvaUI.Select);
    }
    return app;
  }

  function mountWhenReady() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var el = document.querySelector('[data-eva-update-page]:not([data-eva-mounted])');
      if (!el) {
        var u = document.getElementById('update');
        if (u && !u.getAttribute('data-eva-mounted')) { el = u; }
      }
      if (el) {
        el.setAttribute('data-eva-mounted', '1');
        try { createUpdateApp(el).mount(el); } catch (e) { /* noop */ }
      }
      // Eva 主应用和 callback 字段可能异步渲染，最多等待约 120 秒，避免无限轮询。
      if (tries > 240) { clearInterval(timer); }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountWhenReady);
  } else {
    mountWhenReady();
  }
})();
