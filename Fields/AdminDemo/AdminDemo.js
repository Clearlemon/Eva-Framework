/** Authorization workspace preview. All mutations are component-local; no API or storage. */
(function () {
  'use strict';
  window.EvaFields = window.EvaFields || {};
  function rows() {
    var names = ['青柠的日常', '晴空放映室', '森屿手记', '星河档案', '晚风书屋', '一间工作室', '云间笔记', '微光收藏', '夏日来信', '北岛见闻', '拾光相册', '小满生活', '漫游指南', '南风杂志', '月亮电台', '山海随笔'];
    return names.map(function (name, i) {
      return { id: 1024 + i, user: ['clearlemon', 'haruka', 'forest', 'stella'][i % 4], userId: 100 + i, name: name,
        domain: ['lime', 'sky', 'forest', 'stella', 'breeze', 'studio', 'cloud', 'glimmer', 'summer', 'island', 'photo', 'life', 'travel', 'south', 'moon', 'sea'][i] + '.example',
        theme: i % 3 === 0 ? 'Len' : 'Lentasy', status: i === 3 || i === 11 ? 'flagged' : i % 4 === 2 ? 'pending' : 'active',
        ip: '192.0.2.' + (10 + i), date: '2026-10-' + String(26 - i).padStart(2, '0'), code: 'DEMO-' + (1024 + i) + '-PREVIEW' };
    });
  }
  window.EvaFields.admin_demo = {
    props: ['field', 'modelValue'],
    data: function () {
      return { records: rows(), search: '', status: 'all', theme: 'all', view: 'table', page: 1, selected: [], batchOpen: false,
        batchText: '', batchError: '', message: '', detailId: null, returnFocus: null,
        themeOptions: { all: '全部主题', Lentasy: 'Lentasy', Len: 'Len' },
        statusNames: { all: '全部授权', active: '正常授权', pending: '待激活', flagged: '异常记录' } };
    },
    computed: {
      counts: function () { var c = { all: this.records.length, active: 0, pending: 0, flagged: 0 }; this.records.forEach(function (r) { c[r.status]++; }); return c; },
      stats: function () { return [
        { key: 'all', label: '授权总数', icon: 'ri-shield-keyhole-line', note: '当前全部授权记录' },
        { key: 'active', label: '正常授权', icon: 'ri-checkbox-circle-line', note: '站点授权状态正常' },
        { key: 'pending', label: '待激活', icon: 'ri-time-line', note: '等待站点完成激活' },
        { key: 'flagged', label: '异常记录', icon: 'ri-error-warning-line', note: '需要进一步核查' }
      ]; },
      filtered: function () { var self = this, q = this.search.trim().toLowerCase(); return this.records.filter(function (r) {
        return (self.status === 'all' || r.status === self.status) && (self.theme === 'all' || r.theme === self.theme) &&
          (!q || [r.domain, r.name, r.user, String(r.id), String(r.userId)].join(' ').toLowerCase().includes(q));
      }); },
      pages: function () { return Math.max(1, Math.ceil(this.filtered.length / 6)); },
      visible: function () { return this.filtered.slice((this.page - 1) * 6, this.page * 6); },
      allSelected: function () { var self = this; return !!this.visible.length && this.visible.every(function (r) { return self.selected.includes(r.id); }); },
      someSelected: function () { var self = this; return !this.allSelected && this.visible.some(function (r) { return self.selected.includes(r.id); }); },
      detail: function () { var id = this.detailId; return this.records.find(function (r) { return r.id === id; }); },
      sites: function () { return this.records.slice(0, 3); }
    },
    watch: { search: function () { this.page = 1; }, status: function () { this.page = 1; }, theme: function () { this.page = 1; } },
    methods: {
      reset: function () { this.closeDetail(); this.records = rows(); this.search = ''; this.status = 'all'; this.theme = 'all'; this.page = 1; this.selected = []; this.batchOpen = false; this.batchText = ''; this.batchError = ''; this.message = '演示数据已重置。'; },
      selectPage: function (checked) { var ids = this.visible.map(function (r) { return r.id; }); this.selected = checked ? Array.from(new Set(this.selected.concat(ids))) : this.selected.filter(function (id) { return !ids.includes(id); }); },
      activateSelected: function () { var ids = this.selected; this.records.forEach(function (r) { if (ids.includes(r.id)) { r.status = 'active'; } }); this.message = '已在演示中启用 ' + ids.length + ' 条授权。'; this.selected = []; this.page = Math.min(this.page, this.pages); },
      clearFilters: function () { this.search = ''; this.status = 'all'; this.theme = 'all'; },
      addBatch: function () {
        var lines = this.batchText.trim().split(/\r?\n/).filter(function (line) { return line.trim(); });
        if (!lines.length || lines.length > 50) { this.batchError = '请填写 1–50 行授权数据。'; return; }
        var next = [], max = Math.max.apply(null, this.records.map(function (r) { return r.id; }));
        for (var i = 0; i < lines.length; i++) {
          var p = lines[i].split('|').map(function (s) { return s.trim(); });
          var ip = p[2] && p[2].split('.');
          if (p.length !== 4 || !/^[1-9]\d*$/.test(p[0]) || !['Len', 'Lentasy'].includes(p[1]) || !ip || ip.length !== 4 || !ip.every(function (v) { return /^\d{1,3}$/.test(v) && Number(v) <= 255; }) || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(p[3])) {
            this.batchError = '第 ' + (i + 1) + ' 行格式不正确，请检查用户ID、主题、IPv4 和域名。'; return;
          }
          if (this.records.concat(next).some(function (r) { return r.domain.toLowerCase() === p[3].toLowerCase(); })) { this.batchError = '第 ' + (i + 1) + ' 行域名已存在。'; return; }
          next.push({ id: max + i + 1, userId: Number(p[0]), user: 'user_' + p[0], name: '新授权站点', theme: p[1], ip: p[2], domain: p[3].toLowerCase(), status: 'pending', date: new Date().toISOString().slice(0, 10), code: 'DEMO-' + (max + i + 1) + '-PREVIEW' });
        }
        this.records = next.concat(this.records); this.clearFilters(); this.page = 1; this.batchText = ''; this.batchError = ''; this.batchOpen = false; this.message = '已添加 ' + next.length + ' 条演示授权，刷新页面后恢复。';
      },
      fillExample: function () { this.batchText = '128|Lentasy|192.0.2.80|new-site.example\n129|Len|192.0.2.81|another-site.example'; this.batchError = ''; },
      openBatch: function () { this.batchOpen = !this.batchOpen; if (this.batchOpen) { this.$nextTick(function () { this.$refs.batchInput.focus(); }); } },
      openDetail: function (row, event) { this.returnFocus = event.currentTarget; this.detailId = row.id; this.$nextTick(function () { this.$refs.detailClose.focus(); }); },
      closeDetail: function () { this.detailId = null; var target = this.returnFocus; this.returnFocus = null; if (target && target.isConnected) { this.$nextTick(function () { target.focus(); }); } },
      toggleDetail: function () { this.detail.status = this.detail.status === 'active' ? 'pending' : 'active'; this.message = '授权状态已在演示中更新。'; this.page = Math.min(this.page, this.pages); },
      trapFocus: function (event) { if (event.key === 'Escape') { event.preventDefault(); this.closeDetail(); } else if (event.key === 'Tab') { var list = Array.from(this.$refs.dialog.querySelectorAll('button:not(:disabled), [href], input, textarea')); var first = list[0], last = list[list.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }
    },
    template: `
<div class="eva-admin-demo">
  <header class="eva-ad-heading"><div><div class="eva-ad-eyebrow"><i class="ri-shield-keyhole-line" aria-hidden="true"></i> 授权工作台 <span>交互示例</span></div><h1>授权管理</h1><p>集中管理站点授权，快速掌握运行状态。</p></div><div class="eva-ad-heading-actions"><button type="button" class="eva-ad-button" @click="reset"><i class="ri-refresh-line" aria-hidden="true"></i>重置示例</button><button type="button" class="eva-ad-button is-primary" :aria-expanded="batchOpen" @click="openBatch"><i class="ri-add-line" aria-hidden="true"></i>添加授权</button></div></header>
  <div class="eva-ad-notice"><i class="ri-information-line" aria-hidden="true"></i><span>当前为演示数据，可体验筛选、批量录入及状态切换。刷新后重置，不写入真实授权。</span></div>
  <div class="eva-ad-stats"><button v-for="stat in stats" :key="stat.key" type="button" class="eva-ad-stat" :class="'is-' + stat.key" @click="status = stat.key" :aria-pressed="status === stat.key"><span class="eva-ad-stat-icon"><i :class="stat.icon" aria-hidden="true"></i></span><span class="eva-ad-stat-body"><span>{{ stat.label }}</span><strong>{{ counts[stat.key] }}<small>条</small></strong><span class="eva-ad-muted">{{ stat.note }}</span></span><i class="ri-arrow-right-up-line eva-ad-stat-arrow" aria-hidden="true"></i></button></div>
  <section v-if="batchOpen" class="eva-ad-panel eva-ad-batch" aria-label="批量添加授权"><header class="eva-ad-panel-head"><div><h2>批量添加授权</h2><p>每行一条，按格式录入后统一校验。</p></div><button type="button" class="eva-ad-icon" aria-label="关闭批量添加" @click="batchOpen = false"><i class="ri-close-line" aria-hidden="true"></i></button></header><label for="eva-ad-batch-input">用户ID | 授权主题（Lentasy / Len） | IPv4 | 授权域名</label><textarea id="eva-ad-batch-input" ref="batchInput" v-model="batchText" rows="3" placeholder="128|Lentasy|192.0.2.80|new-site.example" :aria-invalid="!!batchError" aria-describedby="eva-ad-batch-error"></textarea><p id="eva-ad-batch-error" v-if="batchError" class="eva-ad-error" role="alert">{{ batchError }}</p><footer><button type="button" class="eva-ad-text-button" @click="fillExample">填入示例数据</button><button type="button" class="eva-ad-button is-primary" @click="addBatch">添加到演示列表</button></footer></section>
  <div v-if="message" class="eva-ad-feedback" role="status"><i class="ri-checkbox-circle-line" aria-hidden="true"></i>{{ message }}<button type="button" class="eva-ad-icon" aria-label="关闭提示" @click="message = ''"><i class="ri-close-line" aria-hidden="true"></i></button></div>
  <div class="eva-ad-workspace"><section class="eva-ad-panel eva-ad-records" aria-label="授权记录"><header class="eva-ad-panel-head"><div><h2>授权记录 <span>{{ records.length }}</span></h2><p>查看和管理已录入的站点授权。</p></div><div class="eva-ad-views" role="group" aria-label="展示方式"><button type="button" class="eva-ad-icon" :class="{ 'is-active': view === 'table' }" :aria-pressed="view === 'table'" aria-label="列表视图" @click="view = 'table'"><i class="ri-list-check" aria-hidden="true"></i></button><button type="button" class="eva-ad-icon" :class="{ 'is-active': view === 'cards' }" :aria-pressed="view === 'cards'" aria-label="卡片视图" @click="view = 'cards'"><i class="ri-layout-grid-line" aria-hidden="true"></i></button></div></header>
    <div class="eva-ad-toolbar"><div class="eva-ad-filter-tabs" role="group" aria-label="授权状态筛选"><button v-for="(label, key) in statusNames" :key="key" type="button" :class="{ 'is-active': status === key }" :aria-pressed="status === key" @click="status = key">{{ label }}<span>{{ counts[key] }}</span></button></div><div class="eva-ad-search-row"><label class="eva-ad-search"><i class="ri-search-line" aria-hidden="true"></i><input v-model="search" type="search" placeholder="搜索域名、用户或ID" aria-label="搜索授权"></label><div class="eva-ad-theme-filter"><eva-select v-model="theme" :options="themeOptions" :searchable="false" aria-label="授权主题筛选"></eva-select></div></div></div>
    <div v-if="selected.length" class="eva-ad-selection"><span>已选 {{ selected.length }} 条</span><button type="button" class="eva-ad-text-button" @click="activateSelected">批量启用</button><button type="button" class="eva-ad-text-button" @click="selected = []">取消选择</button></div>
    <div v-if="visible.length && view === 'table'" class="eva-ad-table-scroll"><table class="eva-ad-table"><thead><tr><th class="eva-ad-check-cell"><input type="checkbox" :checked="allSelected" :indeterminate="someSelected" @change="selectPage($event.target.checked)" aria-label="选择本页全部授权"></th><th>授权站点</th><th>用户</th><th>主题</th><th>状态</th><th>创建时间</th><th class="eva-ad-action-cell">操作</th></tr></thead><tbody><tr v-for="row in visible" :key="row.id" :class="{ 'is-selected': selected.includes(row.id) }"><td><input v-model="selected" type="checkbox" :value="row.id" :aria-label="'选择 ' + row.domain"></td><td><div class="eva-ad-site-cell"><span class="eva-ad-site-icon"><i class="ri-global-line" aria-hidden="true"></i></span><span><strong>{{ row.domain }}</strong><small>{{ row.name }} · #{{ row.id }}</small></span></div></td><td><span>{{ row.user }}</span><small class="eva-ad-cell-sub">ID {{ row.userId }}</small></td><td><span class="eva-ad-theme-badge">{{ row.theme }}</span></td><td><span class="eva-ad-status" :class="'is-' + row.status"><i :class="row.status === 'active' ? 'ri-checkbox-circle-line' : row.status === 'pending' ? 'ri-time-line' : 'ri-error-warning-line'" aria-hidden="true"></i>{{ statusNames[row.status] }}</span></td><td class="eva-ad-date">{{ row.date }}</td><td class="eva-ad-action-cell"><button type="button" class="eva-ad-text-button" :aria-label="'查看 ' + row.domain + ' 详情'" @click="openDetail(row, $event)">详情<i class="ri-arrow-right-s-line" aria-hidden="true"></i></button></td></tr></tbody></table></div>
    <div v-else-if="visible.length" class="eva-ad-record-grid"><article v-for="row in visible" :key="row.id" class="eva-ad-record-card"><div><input v-model="selected" type="checkbox" :value="row.id" :aria-label="'选择 ' + row.domain"><span class="eva-ad-status" :class="'is-' + row.status">{{ statusNames[row.status] }}</span></div><h3>{{ row.domain }}</h3><p>{{ row.name }}</p><dl><div><dt>授权用户</dt><dd>{{ row.user }}</dd></div><div><dt>授权主题</dt><dd>{{ row.theme }}</dd></div></dl><button type="button" class="eva-ad-text-button" :aria-label="'查看 ' + row.domain + ' 详情'" @click="openDetail(row, $event)">查看详情<i class="ri-arrow-right-line" aria-hidden="true"></i></button></article></div>
    <div v-else class="eva-ad-empty"><i class="ri-search-line" aria-hidden="true"></i><strong>没有找到匹配的授权</strong><p>试试其他关键词，或清除当前筛选条件。</p><button type="button" class="eva-ad-button" @click="clearFilters">清除筛选</button></div>
    <footer class="eva-ad-pagination"><span>共 {{ filtered.length }} 条记录<span v-if="filtered.length"> · 显示 {{ (page - 1) * 6 + 1 }}–{{ Math.min(page * 6, filtered.length) }} 条</span></span><div><button type="button" class="eva-ad-icon" :disabled="page === 1" aria-label="上一页" @click="page--"><i class="ri-arrow-left-s-line" aria-hidden="true"></i></button><span>{{ page }} / {{ pages }}</span><button type="button" class="eva-ad-icon" :disabled="page >= pages" aria-label="下一页" @click="page++"><i class="ri-arrow-right-s-line" aria-hidden="true"></i></button></div></footer>
  </section>
  <aside class="eva-ad-panel eva-ad-service"><div class="eva-ad-service-mark"><i class="ri-scan-2-line" aria-hidden="true"></i></div><h2>站点截图巡检</h2><p>将站点状态和网页预览放在一起，让授权管理更直观。</p><span class="eva-ad-demo-label">演示预览</span><dl><div><dt>预览站点</dt><dd>{{ sites.length }} 个</dd></div><div><dt>真实截图请求</dt><dd>未接入</dd></div><div><dt>数据保存</dt><dd>当前页面</dd></div></dl><div class="eva-ad-service-note"><i class="ri-lightbulb-line" aria-hidden="true"></i><span>此处展示页面结构。正式接入后，可复用现有截图服务和授权数据库。</span></div></aside></div>
  <section class="eva-ad-site-section" aria-label="站点预览"><header class="eva-ad-panel-head"><div><h2>站点预览</h2><p>用卡片快速浏览授权站点，缩略图为示意排版。</p></div><span class="eva-ad-muted">最近添加 · {{ sites.length }} 个站点</span></header><div class="eva-ad-site-grid"><article v-for="(row, i) in sites" :key="row.id" class="eva-ad-site-preview"><div class="eva-ad-mock" :class="'is-layout-' + i" aria-hidden="true"><div class="eva-ad-mock-bar"><span></span><span></span><span></span><small>{{ row.domain }}</small></div><div class="eva-ad-mock-page"><div class="eva-ad-mock-nav"><b>{{ row.name }}</b><span>首页</span><span>归档</span><span>关于</span></div><div class="eva-ad-mock-hero"><i class="ri-landscape-line"></i><span>记录生活中的每一份美好</span></div><div class="eva-ad-mock-lines"><span></span><span></span><span></span></div></div><span class="eva-ad-mock-label">示意预览</span></div><div class="eva-ad-preview-meta"><div><h3>{{ row.name }}</h3><p>{{ row.domain }}</p></div><span class="eva-ad-status" :class="'is-' + row.status">{{ statusNames[row.status] }}</span><button type="button" class="eva-ad-icon" :aria-label="'查看 ' + row.domain + ' 详情'" @click="openDetail(row, $event)"><i class="ri-arrow-right-up-line" aria-hidden="true"></i></button></div></article></div></section>
  <div v-if="detail" class="eva-ad-overlay" @click.self="closeDetail" @keydown="trapFocus"><section ref="dialog" role="dialog" aria-modal="true" aria-label="授权详情" class="eva-ad-dialog"><header class="eva-ad-panel-head"><div><h2>授权详情</h2><p>演示记录 #{{ detail.id }}</p></div><button ref="detailClose" type="button" class="eva-ad-icon" aria-label="关闭授权详情" @click="closeDetail"><i class="ri-close-line" aria-hidden="true"></i></button></header><div class="eva-ad-detail-title"><span class="eva-ad-site-icon"><i class="ri-global-line" aria-hidden="true"></i></span><div><h3>{{ detail.name }}</h3><p>{{ detail.domain }}</p></div><span class="eva-ad-status" :class="'is-' + detail.status">{{ statusNames[detail.status] }}</span></div><dl class="eva-ad-detail-list"><div><dt>授权主题</dt><dd>{{ detail.theme }}</dd></div><div><dt>授权用户</dt><dd>{{ detail.user }} / {{ detail.userId }}</dd></div><div><dt>授权 IP</dt><dd>{{ detail.ip }}</dd></div><div><dt>创建时间</dt><dd>{{ detail.date }}</dd></div><div><dt>示例授权码</dt><dd><code>{{ detail.code }}</code></dd></div></dl><footer><span>状态修改仅用于当前演示</span><button type="button" class="eva-ad-button is-primary" @click="toggleDetail">{{ detail.status === 'active' ? '设为待激活' : '启用授权' }}</button></footer></section></div>
</div>`
  };
})();
