(function(){
  window.EvaFields=window.EvaFields||{};
  window.EvaFields.datetime={props:['field','modelValue'],emits:['update:modelValue'],template:'<eva-datepicker mode="datetime" :model-value="modelValue" :range="field.range" :format="field.return_format||field.format||(field.show_seconds?\'Y-m-d H:i:s\':\'Y-m-d H:i\')" :display-format="field.display_format||field.format" :min="field.min_date" :max="field.max_date" :show-seconds="field.show_seconds" :minute-step="Number(field.minute_step||1)" :second-step="Number(field.second_step||1)" :disabled-weekdays="field.disabled_weekdays" :disabled-dates="field.disabled_dates" :placeholder="field.placeholder||\'\'" :disabled="field.disabled" @update:model-value="$emit(\'update:modelValue\',$event)"></eva-datepicker>'};
})();
