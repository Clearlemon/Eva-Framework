(function(){
  window.EvaUI=window.EvaUI||{};
  function num(v,f){v=Number(v);return isFinite(v)?v:f;}
  window.EvaUI.Slider={
    props:{modelValue:{default:0},min:{type:Number,default:0},max:{type:Number,default:100},step:{type:Number,default:1},marks:{default:null},showValue:{type:Boolean,default:true},showLimits:{type:Boolean,default:true},output:{type:String,default:'value'},unit:{type:String,default:''},color:{type:String,default:''},disabled:{type:Boolean,default:false}},
    emits:['update:modelValue'],
    computed:{
      value:function(){return Math.min(this.max,Math.max(this.min,num(this.modelValue,this.min)));},
      percent:function(){return this.max===this.min?0:((this.value-this.min)/(this.max-this.min))*100;},
      trackStyle:function(){return{'--eva-slider-progress':this.percent+'%'};},
      themeStyle:function(){return this.color?{'--eva-primary':this.color}:{};},
      outputValue:function(){return this.output==='percent'?Math.round(this.percent)+'%':String(this.value)+(this.unit||'');},
      markItems:function(){var m=this.marks;if(!m)return[];if(Array.isArray(m))return m.map(function(v){return{value:num(v,0),label:String(v)};});return Object.keys(m).map(function(k){return{value:num(k,0),label:String(m[k])};});}
    },
    methods:{input:function(e){this.$emit('update:modelValue',Number(e.target.value));},markStyle:function(v){return{left:Math.max(0,Math.min(100,((v-this.min)/(this.max-this.min))*100))+'%'};},choose:function(v){if(!this.disabled)this.$emit('update:modelValue',v);}},
    template:['<div class="eva-ui-slider" :class="{\'is-disabled\':disabled,\'has-marks\':markItems.length}" :style="themeStyle">','<div class="eva-ui-slider-head" v-if="showValue"><output>{{outputValue}}</output></div>','<div class="eva-ui-slider-track-wrap">','<input type="range" :min="min" :max="max" :step="step" :value="value" :disabled="disabled" :style="trackStyle" @input="input">','</div>','<div v-if="markItems.length" class="eva-ui-slider-marks"><button v-for="m in markItems" :key="m.value" type="button" :style="markStyle(m.value)" :disabled="disabled" @click="choose(m.value)"><i></i><span>{{m.label}}</span></button></div>','<div v-if="showLimits" class="eva-ui-slider-limits"><span>{{min}}{{unit}}</span><span>{{max}}{{unit}}</span></div>','</div>'].join('')
  };
})();
