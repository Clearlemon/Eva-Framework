(function(){
  window.EvaFields=window.EvaFields||{};
  function tv(v){ return window.EvaI18n&&window.EvaI18n.tv?window.EvaI18n.tv(v):String(v==null?'':v); }
  window.EvaFields.button_set={
    props:['field','modelValue'],emits:['update:modelValue'],
    computed:{items:function(){var o=this.field.options||{};return Object.keys(o).map(function(k){var x=o[k],d=(x&&typeof x==='object')?x:{};return{value:Array.isArray(o)?(d.value!=null?d.value:x):(d.value!=null?d.value:k),label:tv(d.label!=null?d.label:x),icon:d.icon||'',disabled:!!d.disabled};});},size:function(){return this.field.size||'md';},multiple:function(){return this.field.multiple===true||this.field.multiple==='true';},values:function(){return this.multiple?(Array.isArray(this.modelValue)?this.modelValue.map(String):[]):[String(this.modelValue==null?'':this.modelValue)];},maxSelect:function(){return Math.max(0,Number(this.field.max_select||this.field.maxSelect||0));}},
    methods:{active:function(i){return this.values.indexOf(String(i.value))!==-1;},choose:function(i){if(this.field.disabled||i.disabled)return;var value=String(i.value);if(this.multiple){var next=this.values.slice(),index=next.indexOf(value);if(index<0){if(this.maxSelect&&next.length>=this.maxSelect)return;next.push(value);}else next.splice(index,1);this.$emit('update:modelValue',next);return;}this.$emit('update:modelValue',this.field.clearable&&this.active(i)?'':value);}},
    template:'<div class="eva-button-set" :class="[\'is-\'+size,{\'is-full\':field.full_width,\'is-disabled\':field.disabled,\'is-multiple\':multiple,\'is-vertical\':field.vertical}]"><button v-for="item in items" :key="item.value" type="button" :class="{\'is-active\':active(item)}" :disabled="field.disabled||item.disabled||multiple&&!active(item)&&maxSelect&&values.length>=maxSelect" @click="choose(item)"><i v-if="item.icon" :class="item.icon"></i><span>{{item.label}}</span></button></div>'
  };
})();
