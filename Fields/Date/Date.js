(function(){
  window.EvaFields=window.EvaFields||{};
  window.EvaFields.date={props:['field','modelValue'],emits:['update:modelValue'],template:'<eva-datepicker mode="date" :model-value="modelValue" :range="field.range || (field.type_options&&field.type_options.mode===\'range\')" :format="field.return_format||field.format||\'Y-m-d\'" :display-format="field.display_format||\'Y-m-d\'" :min="field.min_date" :max="field.max_date" :disabled-weekdays="field.disabled_weekdays" :disabled-dates="field.disabled_dates" :placeholder="field.placeholder||\'\'" :presets="field.preset||field.presets" :disabled="field.disabled" @update:model-value="$emit(\'update:modelValue\',$event)"></eva-datepicker>'};
})();
