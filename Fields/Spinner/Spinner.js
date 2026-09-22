(function(){
  window.EvaFields=window.EvaFields||{};
  window.EvaFields.spinner={
    props:['field','modelValue'],emits:['update:modelValue'],
    computed:{num:function(){var n=Number(this.modelValue);return isFinite(n)?n:Number(this.field.default||0);},step:function(){return Number(this.field.step||1);}},
    methods:{set:function(v){var min=this.field.min==null?-Infinity:Number(this.field.min),max=this.field.max==null?Infinity:Number(this.field.max);if(this.field.wrap&&isFinite(min)&&isFinite(max)){if(v>max)v=min;else if(v<min)v=max;}v=Math.min(max,Math.max(min,v));this.$emit('update:modelValue',Number(v.toFixed(8)));},input:function(e){if(e.target.value==='')this.$emit('update:modelValue','');else this.set(Number(e.target.value));}},
    template:'<div class="eva-spinner" :class="{\'is-vertical\':field.vertical,\'is-compact\':field.compact,\'is-disabled\':field.disabled}"><button type="button" class="eva-spin-minus" :disabled="field.disabled" @click="set(num-step)"><i class="ri-subtract-line"></i></button><div class="eva-spin-value"><input type="number" :value="modelValue" :min="field.min" :max="field.max" :step="step" :placeholder="field.placeholder||\'\'" :disabled="field.disabled" @input="input"><span v-if="field.unit||field.units">{{field.unit||field.units}}</span></div><button type="button" class="eva-spin-plus" :disabled="field.disabled" @click="set(num+step)"><i class="ri-add-line"></i></button></div>'
  };
})();
