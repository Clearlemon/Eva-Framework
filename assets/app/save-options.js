/** 设置分组保存、菜单保存参与者、字段错误及快照同步。 */
(function (app) {
  'use strict';
  app.saveOptions = function (cfg, optionId, model, savedSnapshot, manualSaves, fieldErrors, Clear_Field_Errors, Focus_First_Field_Error) {

    var saving = Vue.ref(false);
    var saveMsg = Vue.ref('');
    function saveGroups() {
      return cfg.saveGroups && cfg.saveGroups.length > 1 ? cfg.saveGroups : [{ optionId: optionId, fieldIds: Object.keys(model) }];
    }
    // 保存设置页字段：通过 REST 调用共享数据层，后端按 schema 清洗未知字段。
    function saveOptions() {
      if (saving.value) { return; }
      var submitted = JSON.parse(JSON.stringify(model));
      var baseline = JSON.parse(savedSnapshot.value);
      var groups = saveGroups().filter(function (group) {
        return group.fieldIds.some(function (id) { return JSON.stringify(submitted[id]) !== JSON.stringify(baseline[id]); });
      });
      var participants = Array.from(manualSaves.values()).filter(function (participant) { return participant.isDirty(); });
      if (!groups.length && !participants.length) { return; }
      saving.value = true;
      saveMsg.value = '保存中…';
      Clear_Field_Errors();
      var url = cfg.restActions;
      // 同一外壳可展示多个容器，仅提交有修改的容器；每次请求仍独立校验和清洗。
      return Promise.all(groups.map(function (group) {
        var values = {};
        group.fieldIds.forEach(function (id) { values[id] = submitted[id]; });
        var body = 'action=eva_fw_save_options&nonce=' + encodeURIComponent(cfg.nonce || '') +
          '&option_id=' + encodeURIComponent(group.optionId) +
          '&values=' + encodeURIComponent(JSON.stringify(values));
        return window.EvaApi.action(body).then(function (res) {
          return { group: group, response: res };
        }).catch(function () { return { group: group, response: null }; });
      }).concat(participants.map(function (participant) {
        return Promise.resolve().then(function () { return participant.save(); }).then(function () { return { manual: true }; }).catch(function (error) { return { manual: true, error: error }; });
      }))).then(function (results) {
        saving.value = false;
        var invalid = {};
        var failed = [];
        var snapshot = JSON.parse(savedSnapshot.value);
        results.forEach(function (result) {
          if (result.manual) { if (result.error) { failed.push(result.error.message || '菜单保存失败'); } return; }
          var res = result.response;
          if (!res || !res.success) {
            failed.push(res && res.data && res.data.msg ? res.data.msg : '请求失败');
            return;
          }
          var values = res.data && res.data.values ? res.data.values : {};
          result.group.fieldIds.forEach(function (id) {
            var value = Object.prototype.hasOwnProperty.call(values, id) ? values[id] : submitted[id];
            snapshot[id] = value;
            // 请求期间继续编辑的字段保留新输入，并继续显示未保存状态。
            if (JSON.stringify(model[id]) === JSON.stringify(submitted[id])) { model[id] = value; }
          });
          Object.assign(invalid, res.data && res.data.errors ? res.data.errors : {});
        });
        savedSnapshot.value = JSON.stringify(snapshot);
        var invalidCount = Object.keys(invalid).length;
        if (invalidCount) {
          Object.assign(fieldErrors, invalid);
          Focus_First_Field_Error(invalid);
        }
        saveMsg.value = failed.length ? '部分配置保存失败: ' + failed.join('、') :
          (invalidCount ? '已保存（' + invalidCount + ' 项有误，已还原）' : '已保存');
        setTimeout(function () { saveMsg.value = ''; }, invalidCount || failed.length ? 4500 : 2500);
      }).catch(function () {
        saving.value = false;
        saveMsg.value = '保存失败';
        setTimeout(function () { saveMsg.value = ''; }, 2500);
      });
    }


    return { saving: saving, saveMsg: saveMsg, saveOptions: saveOptions };
  };
})(window.EvaApp = window.EvaApp || {});
