(function(){
  window.EvaFields=window.EvaFields||{};
  window.EvaFields.slider={props:['field','modelValue'],emits:['update:modelValue'],template:'<eva-slider :model-value="modelValue" :min="field.min==null?0:Number(field.min)" :max="field.max==null?100:Number(field.max)" :step="field.step==null?1:Number(field.step)" :marks="field.marks" :show-value="field.show_value!==false" :show-limits="field.show_limits!==false" :output="field.output||\'value\'" :unit="field.unit||field.units||\'\'" :color="field.color||\'\'" :disabled="field.disabled" @update:model-value="$emit(\'update:modelValue\',$event)"></eva-slider>'};
})();
