/* Shared Axios + REST transport. Existing field models retain their internal result shape. */
(function () {
  'use strict';
  var client = window.axios.create({ timeout: 20000 });
  function cfg() { return window.EvaFW && window.EvaFW.config || {}; }
  function restUrl(path) {
    var url = new URL(cfg().restUrl || '/wp-json/', location.href);
    if (url.searchParams.has('rest_route')) url.searchParams.set('rest_route', url.searchParams.get('rest_route').replace(/\/$/, '') + '/' + path);
    else url.pathname = url.pathname.replace(/\/$/, '') + '/' + path;
    return url.href;
  }
  function request(options) {
    options = Object.assign({}, options);
    var url = new URL(options.url, location.href);
    // Nonces are only attached to this site's REST requests, never external assets/services.
    if (url.origin === location.origin && options.rest !== false) {
      options.headers = Object.assign({ 'X-WP-Nonce': cfg().restNonce || '' }, options.headers || {});
    }
    delete options.rest;
    return client.request(options).catch(function (error) {
      if (window.axios.isCancel(error)) { error.name = 'AbortError'; }
      else if (error.response && error.response.data && error.response.data.message) error.message = error.response.data.message;
      throw error;
    });
  }
  function action(fields, options) {
    var data = {};
    if (typeof fields === 'string') fields = new URLSearchParams(fields);
    if (fields && typeof fields.forEach === 'function') fields.forEach(function (value, key) { data[key] = value; });
    else data = Object.assign({}, fields || {});
    var name = data.action, route = (cfg().restActions || {})[name];
    if (!route) return Promise.reject(new Error('Unknown REST action: ' + name));
    delete data.action; delete data.nonce;
    if (name === 'eva_fw_search_posts') data.resource = 'posts';
    ['values', 'value', 'structure_values', 'queries', 'items', 'removed_ids', 'assigned_locations', 'urls'].forEach(function (key) {
      if (typeof data[key] === 'string') {
        try { data[key] = JSON.parse(data[key]); } catch (_) { /* Server schema reports malformed data. */ }
      }
    });
    if (data.include_resources !== undefined) data.include_resources = data.include_resources === true || data.include_resources === '1';
    var config = Object.assign({}, options || {}, { url: route.url, method: route.method });
    config[route.method === 'GET' ? 'params' : 'data'] = data;
    return request(config).then(function (response) { return { success: true, data: response.data }; });
  }
  window.EvaApi = { action: action, request: request, rest: function (path, options) { return request(Object.assign({}, options || {}, { url: restUrl(path) })); } };
})();
