(function(){
  window.EvaFields=window.EvaFields||{};
  function tv(v){ return window.EvaI18n&&window.EvaI18n.tv?window.EvaI18n.tv(v):String(v==null?'':v); }
  window.EvaFields.checkbox={
    props:['field','modelValue'], emits:['update:modelValue'],
    computed:{
      items:function(){ var o=this.field.options||{}; return Object.keys(o).map(function(k){ var x=o[k], d=(x&&typeof x==='object')?x:{}; return {value:Array.isArray(o)?(d.value!=null?d.value:x):(d.value!=null?d.value:k),label:tv(d.label!=null?d.label:x),desc:tv(d.desc||''),icon:d.icon||'',disabled:!!d.disabled}; }); },
      selected:function(){ return Array.isArray(this.modelValue)?this.modelValue.map(String):(this.modelValue==null||this.modelValue===''?[]:[String(this.modelValue)]); },
      limit:function(){ return Number(this.field.max||this.field.max_select||0); },
      disabled:function(){ return !!this.field.disabled; }
    },
    methods:{
      checked:function(v){ return this.selected.indexOf(String(v))>-1; },
      toggle:function(item){ if(this.disabled||item.disabled)return; var key=String(item.value), next=this.selected.slice(), i=next.indexOf(key); if(i>-1)next.splice(i,1); else if(!this.limit||next.length<this.limit)next.push(key); this.$emit('update:modelValue',next); }
    },
    template:'<div class="eva-choice-group eva-checkbox-group" :class="{\'is-inline\':field.inline,\'is-card\':field.card,\'is-disabled\':disabled}"><button v-for="item in items" :key="item.value" type="button" class="eva-choice-item" :class="{\'is-checked\':checked(item.value),\'is-disabled\':item.disabled}" :disabled="disabled||item.disabled" @click="toggle(item)"><span class="eva-choice-control eva-check-control"><i class="ri-check-line"></i></span><span v-if="item.icon" class="eva-choice-icon"><i :class="item.icon"></i></span><span class="eva-choice-copy"><strong>{{item.label}}</strong><small v-if="item.desc">{{item.desc}}</small></span></button></div>'
  };
})();
