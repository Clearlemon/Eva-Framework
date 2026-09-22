(function(){
  window.EvaFields=window.EvaFields||{};
  function tv(v){ return window.EvaI18n&&window.EvaI18n.tv?window.EvaI18n.tv(v):String(v==null?'':v); }
  window.EvaFields.radio={
    props:['field','modelValue'], emits:['update:modelValue'],
    computed:{items:function(){var o=this.field.options||{};return Object.keys(o).map(function(k){var x=o[k],d=(x&&typeof x==='object')?x:{};return{value:Array.isArray(o)?(d.value!=null?d.value:x):(d.value!=null?d.value:k),label:tv(d.label!=null?d.label:x),desc:tv(d.desc||''),icon:d.icon||'',disabled:!!d.disabled};});},disabled:function(){return !!this.field.disabled;},readonly:function(){return !!this.field.readonly;},clearable:function(){return this.field.clearable===true||this.field.clearable==='true';},cardStyle:function(){var columns=Math.max(0,Number(this.field.columns||0));return columns?{'--eva-choice-columns':columns}:{};}},
    methods:{choose:function(item){if(this.disabled||this.readonly||item.disabled)return;var value=String(item.value);this.$emit('update:modelValue',this.clearable&&String(this.modelValue)===value?'':value);}},
    template:'<div class="eva-choice-group eva-radio-group" :class="{\'is-inline\':field.inline,\'is-card\':field.card,\'is-disabled\':disabled||readonly}" :style="cardStyle"><button v-for="item in items" :key="item.value" type="button" class="eva-choice-item" :class="{\'is-checked\':String(modelValue)===String(item.value),\'is-disabled\':item.disabled}" :disabled="disabled||item.disabled" @click="choose(item)"><span class="eva-choice-control eva-radio-control"><i></i></span><span v-if="item.icon" class="eva-choice-icon"><i :class="item.icon"></i></span><span class="eva-choice-copy"><strong>{{item.label}}</strong><small v-if="item.desc">{{item.desc}}</small></span></button></div>'
  };
})();
