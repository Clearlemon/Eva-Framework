(function(){
  'use strict';
  window.EvaFields=window.EvaFields||{};
  window.EvaFields.group={
    props:['field','modelValue'],emits:['update:modelValue'],data:function(){return{collapsed:false};},
    computed:{fields:function(){return this.field.fields||this.field.items||[];},value:function(){return window.EvaAdvanced.object(this.modelValue);},collapsible:function(){return this.field.collapsible===true||this.field.collapsible==='true';},showChildMeta:function(){return this.field.show_child_meta!==false&&this.field.showChildMeta!==false;},rootClass:function(){return{'is-disabled':this.field.disabled,'is-collapsed':this.collapsible&&this.collapsed,'is-compact':this.field.compact===true||this.field.compact==='true'};}},
    methods:{tv:function(v){return window.EvaI18n.tv(v);},valueFor:function(child){return window.EvaAdvanced.value(this.value,child);},updateChild:function(child,value){var next=Object.assign({},this.value);next[child.id]=value;this.$emit('update:modelValue',next);},toggle:function(){if(this.collapsible){this.collapsed=!this.collapsed;}},col:window.EvaAdvanced.width},
    template:[
      '<div class="eva-advanced-card eva-group-field" :class="rootClass">',
      '<button v-if="collapsible" type="button" class="eva-group-head-button" @click="toggle"><span class="eva-advanced-card-head"><strong>{{tv(field.heading||field.title)}}</strong><small>{{tv(field.description||field.desc)}}</small></span><i :class="collapsed?\'ri-arrow-right-s-line\':\'ri-arrow-down-s-line\'"></i></button>',
      '<div v-else-if="field.heading || field.description" class="eva-advanced-card-head"><strong>{{tv(field.heading)}}</strong><small>{{tv(field.description)}}</small></div>',
      '<div v-show="!collapsible || !collapsed" class="eva-group-body"><div class="eva-advanced-grid"><div v-for="child in fields" :key="child.id" class="eva-advanced-child" :class="col(child)">',
      '<div v-if="showChildMeta && (tv(child.title) || tv(child.desc))" class="eva-advanced-meta"><span>{{tv(child.title)}}</span><small v-if="tv(child.desc)">{{tv(child.desc)}}</small></div>',
      '<eva-field :field="Object.assign({},child,{disabled:field.disabled||child.disabled})" :model-value="valueFor(child)" @update:model-value="updateChild(child,$event)"></eva-field>',
      '</div></div></div></div>'
    ].join('')
  };
})();
