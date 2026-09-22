/**
 * Eva 字段：map（对应 CSF 的 map）。
 *
 * 用途：
 * - 在地图上选一个位置：可搜索地址、点击地图或拖动图钉，也可以直接改经纬度。
 * - 返回值与 CSF 一致：{ address, latitude, longitude, zoom }（全部是字符串）。
 *
 * 字段配置：
 * - `height`：地图高度，默认 '400px'。
 * - `settings`：{ center: [纬度, 经度], zoom: 2, scrollWheelZoom: false }，与 CSF 同名。
 * - `placeholder`：搜索框占位文字；`latitude_text` / `longitude_text`：经纬度输入框标题。
 * - `tiles`：瓦片地址模板，默认 OpenStreetMap；`attribution`：地图右下角的版权文字。
 * - `search`：false 时不显示地址搜索（搜索走 OpenStreetMap 的 Nominatim 接口，国内网络可能较慢）。
 * - `disabled`：只读。
 *
 * 依赖：Leaflet（首次用到时才从 jsDelivr 加载，页面上没有 map 字段就不会请求）。
 */
(function () {
  'use strict';
  window.EvaFields = window.EvaFields || {};

  var LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
  var LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
  var DEFAULT_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var DEFAULT_ATTRIBUTION = '&copy; OpenStreetMap contributors';
  var leafletPromise = null;

  // 功能：加载 Leaflet 的样式与脚本；多个 map 字段共用同一次加载。
  function Load_Leaflet() {
    if (window.L && window.L.map) { return Promise.resolve(window.L); }
    if (leafletPromise) { return leafletPromise; }
    leafletPromise = new Promise(function (resolve, reject) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
      var script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      script.onload = function () { resolve(window.L); };
      script.onerror = function () { leafletPromise = null; reject(new Error('Leaflet load failed')); };
      document.head.appendChild(script);
    });
    return leafletPromise;
  }

  // 功能：把任意输入规整成限定范围内的数字；非法时返回 null。
  function To_Number(value, min, max) {
    if (value === '' || value === null || value === undefined) { return null; }
    var number = Number(value);
    if (!isFinite(number)) { return null; }
    return Math.max(min, Math.min(max, number));
  }

  window.EvaFields.map = {
    props: ['field', 'modelValue'],
    emits: ['update:modelValue'],
    // 功能：初始化组件响应式状态与对外数据。
    data: function () {
      return { ready: false, failed: false, query: '', results: [], searching: false, open: false };
    },
    computed: {
      // 功能：当前值（始终按对象处理）。
      value: function () {
        var value = this.modelValue && typeof this.modelValue === 'object' && !Array.isArray(this.modelValue) ? this.modelValue : {};
        return {
          address: value.address == null ? '' : String(value.address),
          latitude: value.latitude == null ? '' : String(value.latitude),
          longitude: value.longitude == null ? '' : String(value.longitude),
          zoom: value.zoom == null ? '' : String(value.zoom)
        };
      },
      settings: function () {
        return this.field.settings && typeof this.field.settings === 'object' ? this.field.settings : {};
      },
      mapHeight: function () {
        var height = this.field.height || '400px';
        return /^\d+$/.test(String(height)) ? height + 'px' : String(height);
      },
      searchable: function () {
        return this.field.search !== false && !this.field.disabled;
      }
    },
    watch: {
      // 功能：外部改了值（恢复默认、放弃更改）时，把图钉和视野同步过去。
      modelValue: function () { this.syncFromValue(); }
    },
    // 功能：组件挂载后加载 Leaflet 并初始化地图。
    mounted: function () {
      var self = this;
      this.query = this.value.address;
      Load_Leaflet().then(function (L) { self.initMap(L); }).catch(function () { self.failed = true; });
      document.addEventListener('mousedown', this.onDocumentDown, true);
    },
    // 功能：组件销毁前清理地图、监听与计时器。
    beforeUnmount: function () {
      document.removeEventListener('mousedown', this.onDocumentDown, true);
      clearTimeout(this.searchTimer);
      if (this.resizeObserver) { this.resizeObserver.disconnect(); }
      if (this.map) { this.map.remove(); this.map = null; }
    },
    methods: {
      // 功能：处理 tv 相关逻辑。
      tv: function (value) { return window.EvaI18n.tv(value); },
      // 功能：创建地图、瓦片层和可拖动的图钉。
      initMap: function (L) {
        if (!this.$refs.canvas || this.map) { return; }
        var self = this;
        var center = Array.isArray(this.settings.center) && this.settings.center.length === 2 ? this.settings.center : [20, 0];
        var lat = To_Number(this.value.latitude, -90, 90);
        var lng = To_Number(this.value.longitude, -180, 180);
        var hasPoint = lat !== null && lng !== null;
        var zoom = To_Number(this.value.zoom, 0, 22);
        if (zoom === null) { zoom = To_Number(this.settings.zoom, 0, 22); }
        if (zoom === null) { zoom = hasPoint ? 13 : 2; }

        this.map = L.map(this.$refs.canvas, {
          center: hasPoint ? [lat, lng] : center,
          zoom: zoom,
          scrollWheelZoom: this.settings.scrollWheelZoom === true,
          dragging: !this.field.disabled,
          zoomControl: true
        });
        L.tileLayer(this.field.tiles || DEFAULT_TILES, { attribution: this.field.attribution || DEFAULT_ATTRIBUTION, maxZoom: 19 }).addTo(this.map);

        // 不用 Leaflet 默认的图片图钉（它按脚本路径找图片，走 CDN 时容易 404），用一个纯 CSS 的圆点。
        var icon = L.divIcon({ className: 'eva-map-pin', iconSize: [22, 22], iconAnchor: [11, 11] });
        this.marker = L.marker(hasPoint ? [lat, lng] : center, { draggable: !this.field.disabled, icon: icon, opacity: hasPoint ? 1 : 0.55 }).addTo(this.map);

        if (!this.field.disabled) {
          this.marker.on('dragend', function () { var p = self.marker.getLatLng(); self.commit({ latitude: p.lat, longitude: p.lng }); });
          this.map.on('click', function (event) { self.commit({ latitude: event.latlng.lat, longitude: event.latlng.lng }); });
          this.map.on('zoomend', function () {
            // 只有已经选过位置时才记缩放级别：单纯缩放地图浏览不该让表单变成「有未保存更改」。
            if (self.value.latitude !== '' && String(self.map.getZoom()) !== self.value.zoom) { self.commit({ zoom: self.map.getZoom() }); }
          });
        }

        // 地图放在标签页 / 折叠面板里时，初始化那一刻容器宽高是 0；变为可见后要让 Leaflet 重新量尺寸。
        if (window.ResizeObserver) {
          this.resizeObserver = new ResizeObserver(function () { if (self.map) { self.map.invalidateSize(); } });
          this.resizeObserver.observe(this.$refs.canvas);
        }
        this.ready = true;
      },
      // 功能：合并一部分新值并回传；经纬度统一保留 6 位小数（约 0.1 米）。
      commit: function (patch) {
        var next = Object.assign({}, this.value);
        if (patch.latitude !== undefined) { var lat = To_Number(patch.latitude, -90, 90); next.latitude = lat === null ? '' : String(Number(lat.toFixed(6))); }
        if (patch.longitude !== undefined) { var lng = To_Number(patch.longitude, -180, 180); next.longitude = lng === null ? '' : String(Number(lng.toFixed(6))); }
        if (patch.address !== undefined) { next.address = String(patch.address); }
        if (patch.zoom !== undefined) { next.zoom = String(patch.zoom); }
        else if (this.map && next.zoom === '' && next.latitude !== '') { next.zoom = String(this.map.getZoom()); }
        this.$emit('update:modelValue', next);
      },
      // 功能：按当前值移动图钉和视野。
      syncFromValue: function () {
        if (!this.map || !this.marker) { return; }
        var lat = To_Number(this.value.latitude, -90, 90);
        var lng = To_Number(this.value.longitude, -180, 180);
        if (lat === null || lng === null) { this.marker.setOpacity(0.55); return; }
        this.marker.setOpacity(1);
        var at = this.marker.getLatLng();
        if (Math.abs(at.lat - lat) > 1e-7 || Math.abs(at.lng - lng) > 1e-7) {
          this.marker.setLatLng([lat, lng]);
          this.map.panTo([lat, lng]);
        }
        if (this.query !== this.value.address && document.activeElement !== this.$refs.search) { this.query = this.value.address; }
      },
      // 功能：输入地址后稍等片刻再搜索，避免每敲一个字发一次请求。
      onQueryInput: function () {
        var self = this;
        clearTimeout(this.searchTimer);
        this.commit({ address: this.query });
        if (this.query.trim().length < 3) { this.results = []; this.open = false; return; }
        this.searchTimer = setTimeout(function () { self.search(); }, 500);
      },
      // 功能：调用 Nominatim 搜索地址。
      search: function () {
        var self = this;
        var keyword = this.query.trim();
        this.searching = true;
        fetch('https://nominatim.openstreetmap.org/search?format=json&limit=6&q=' + encodeURIComponent(keyword), { headers: { Accept: 'application/json' } })
          .then(function (response) { return response.ok ? response.json() : []; })
          .then(function (items) {
            if (keyword !== self.query.trim()) { return; }
            self.results = (Array.isArray(items) ? items : []).map(function (item) { return { label: item.display_name, lat: item.lat, lng: item.lon }; });
            self.open = true;
          })
          .catch(function () { self.results = []; self.open = true; })
          .then(function () { self.searching = false; });
      },
      // 功能：选中一条搜索结果。
      pick: function (item) {
        this.query = item.label;
        this.open = false;
        this.commit({ address: item.label, latitude: item.lat, longitude: item.lng });
        if (this.map) { this.map.setView([Number(item.lat), Number(item.lng)], Math.max(this.map.getZoom(), 13)); }
      },
      // 功能：点在字段外面时收起搜索结果。
      onDocumentDown: function (event) {
        if (this.open && this.$el && !this.$el.contains(event.target)) { this.open = false; }
      },
      // 功能：清空已选位置。
      clear: function () {
        this.query = '';
        this.results = [];
        this.$emit('update:modelValue', { address: '', latitude: '', longitude: '', zoom: '' });
      }
    },
    template: [
      '<div class="eva-map" :class="{ \'is-disabled\': field.disabled }">',
      '  <div v-if="searchable" class="eva-map-search">',
      '    <i class="ri-search-line" aria-hidden="true"></i>',
      '    <input ref="search" type="text" v-model="query" :placeholder="tv(field.placeholder) || \'搜索地址…\'" autocomplete="off" @input="onQueryInput" @focus="open = results.length > 0" @keydown.esc="open = false">',
      '    <i v-if="searching" class="eva-map-spin ri-loader-4-line" aria-hidden="true"></i>',
      '    <ul v-if="open" class="eva-map-results">',
      '      <li v-for="(item, index) in results" :key="index" @mousedown.prevent="pick(item)">{{ item.label }}</li>',
      '      <li v-if="!results.length" class="is-empty">没有找到匹配的地址</li>',
      '    </ul>',
      '  </div>',
      '  <div class="eva-map-canvas" :style="{ height: mapHeight }">',
      '    <div ref="canvas" class="eva-map-leaflet"></div>',
      '    <div v-if="!ready" class="eva-map-state"><i :class="failed ? \'ri-error-warning-line\' : \'ri-loader-4-line eva-map-spin\'"></i><span>{{ failed ? \'地图组件加载失败，仍可直接填写经纬度\' : \'地图加载中…\' }}</span></div>',
      '  </div>',
      '  <div class="eva-map-coords">',
      '    <label><span>{{ tv(field.latitude_text) || \'纬度\' }}</span><input type="number" step="any" min="-90" max="90" :value="value.latitude" :disabled="field.disabled" @change="commit({ latitude: $event.target.value })"></label>',
      '    <label><span>{{ tv(field.longitude_text) || \'经度\' }}</span><input type="number" step="any" min="-180" max="180" :value="value.longitude" :disabled="field.disabled" @change="commit({ longitude: $event.target.value })"></label>',
      '    <button v-if="!field.disabled && (value.latitude !== \'\' || value.address !== \'\')" type="button" class="eva-map-clear" @click="clear"><i class="ri-close-line"></i>清除位置</button>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
})();
