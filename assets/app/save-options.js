/** 设置分组保存、菜单保存参与者、字段错误及快照同步。 */
(function (app) {
  'use strict';
  app.saveOptions = function (cfg, optionId, model, savedSnapshot, manualSaves, fieldErrors, Clear_Field_Errors, Focus_First_Field_Error) {

    var saving = Vue.ref(false);
    var saveMsg = Vue.ref('');
    var messageTimer = null;
    var disposed = false;

    /** 读取本次页面所包含的设置容器。 */
    function get_save_groups() {
      return cfg.saveGroups && cfg.saveGroups.length > 1 ? cfg.saveGroups : [{ optionId: optionId, fieldIds: Object.keys(model) }];
    }

    /** 只提交有修改的容器，避免无关设置被重复保存。 */
    function get_changed_groups(submitted, baseline) {
      return get_save_groups().filter(function (group) {
        return group.fieldIds.some(function (id) { return JSON.stringify(submitted[id]) !== JSON.stringify(baseline[id]); });
      });
    }

    /** 收集菜单等自行管理保存过程的模块。 */
    function get_dirty_participants() {
      return Array.from(manualSaves.values()).filter(function (participant) { return participant.isDirty(); });
    }

    /** 从提交快照中取出单个容器的字段。 */
    function get_group_values(group, submitted) {
      var values = {};
      group.fieldIds.forEach(function (id) { values[id] = submitted[id]; });
      return values;
    }

    /** 保存一个设置容器；失败结果交由统一汇总方法处理。 */
    async function save_group(group, submitted) {
      var values = get_group_values(group, submitted);
      var body = 'action=eva_fw_save_options&nonce=' + encodeURIComponent(cfg.nonce || '') +
        '&option_id=' + encodeURIComponent(group.optionId) +
        '&values=' + encodeURIComponent(JSON.stringify(values));
      try {
        var response = await window.EvaApi.action(body);
        return { group: group, response: response };
      } catch (error) {
        return { group: group, response: null };
      }
    }

    /** 保存一个手动参与者，保留其业务错误消息。 */
    async function save_participant(participant) {
      try {
        await participant.save();
        return { manual: true };
      } catch (error) {
        return { manual: true, error: error };
      }
    }

    /** 并行发送独立保存任务，不在 Promise 回调里实现完整业务。 */
    function send_save_requests(groups, participants, submitted) {
      var requests = groups.map(function (group) { return save_group(group, submitted); });
      return Promise.all(requests.concat(participants.map(save_participant)));
    }

    /** 更新已保存快照，保留请求期间用户继续输入的新值。 */
    function sync_saved_fields(group, response, submitted, snapshot) {
      var values = response.data && response.data.values ? response.data.values : {};
      group.fieldIds.forEach(function (id) {
        var value = Object.prototype.hasOwnProperty.call(values, id) ? values[id] : submitted[id];
        snapshot[id] = value;
        if (JSON.stringify(model[id]) === JSON.stringify(submitted[id])) { model[id] = value; }
      });
    }

    /** 合并单个任务的结果，区分请求失败、字段错误和成功保存。 */
    function apply_save_result(result, submitted, state) {
      if (result.manual) {
        if (result.error) { state.failed.push(result.error.message || '菜单保存失败'); }
        return;
      }
      var response = result.response;
      if (!response || !response.success) {
        state.failed.push(response && response.data && response.data.msg ? response.data.msg : '请求失败');
        return;
      }
      sync_saved_fields(result.group, response, submitted, state.snapshot);
      Object.assign(state.invalid, response.data && response.data.errors ? response.data.errors : {});
    }

    /** 把服务器返回的字段错误同步到表单，并定位首个错误。 */
    function apply_field_errors(errors) {
      if (!Object.keys(errors).length) { return; }
      Object.assign(fieldErrors, errors);
      Focus_First_Field_Error(errors);
    }

    function clear_save_message() {
      saveMsg.value = '';
    }

    /** 同一实例只保留一个消息计时器，卸载后不再创建。 */
    function show_save_message(message, duration) {
      if (disposed) { return; }
      window.clearTimeout(messageTimer);
      saveMsg.value = message;
      if (duration) { messageTimer = window.setTimeout(clear_save_message, duration); }
    }

    /** 汇总所有结果并更新表单快照和提示。 */
    function apply_save_results(results, submitted) {
      var state = { snapshot: JSON.parse(savedSnapshot.value), invalid: {}, failed: [] };
      results.forEach(function (result) { apply_save_result(result, submitted, state); });
      savedSnapshot.value = JSON.stringify(state.snapshot);
      apply_field_errors(state.invalid);
      var invalidCount = Object.keys(state.invalid).length;
      var message = state.failed.length ? '部分配置保存失败: ' + state.failed.join('、') :
        (invalidCount ? '已保存（' + invalidCount + ' 项有误，已还原）' : '已保存');
      show_save_message(message, invalidCount || state.failed.length ? 4500 : 2500);
    }

    /** 保存入口只组织流程：收集修改、发送请求、应用结果。 */
    function saveOptions() {
      if (saving.value) { return; }
      var submitted = JSON.parse(JSON.stringify(model));
      var groups = get_changed_groups(submitted, JSON.parse(savedSnapshot.value));
      var participants = get_dirty_participants();
      if (!groups.length && !participants.length) { return; }
      saving.value = true;
      show_save_message('保存中…');
      Clear_Field_Errors();
      return send_save_requests(groups, participants, submitted)
        .then(function (results) { apply_save_results(results, submitted); })
        .catch(function () { show_save_message('保存失败', 2500); })
        .finally(function () { saving.value = false; });
    }

    function destroy_save() {
      disposed = true;
      window.clearTimeout(messageTimer);
    }

    Vue.onBeforeUnmount(destroy_save);

    return { saving: saving, saveMsg: saveMsg, saveOptions: saveOptions };
  };
})(window.EvaApp = window.EvaApp || {});
