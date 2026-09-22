(function(){
  'use strict';
  window.EvaFields=window.EvaFields||{};
  window.EvaFields.repeater={
    props:['field','modelValue'],emits:['update:modelValue'],data:function(){return{collapsed:{}};},
    computed:{fields:function(){return this.field.fields||this.field.items||[];},rows:function(){return Array.isArray(this.modelValue)?this.modelValue:[];},minRows:function(){return Math.max(0,Number(this.field.min||0));},maxRows:function(){return Math.max(this.minRows,Number(this.field.max||50));}},
    methods:{
      tv:function(v){return window.EvaI18n.tv(v);},
      rowTitle:function(row,index){var key=this.field.title_field||this.field.titleField;return key&&row&&row[key]?String(row[key]):this.tv(this.field.item_title||this.field.itemTitle||'项目')+' '+(index+1);},
      valueFor:function(row,child){return window.EvaAdvanced.value(window.EvaAdvanced.object(row),child);},
      emitRows:function(rows){this.$emit('update:modelValue',rows);},
      add:function(){if(this.field.disabled||this.rows.length>=this.maxRows){return;}this.emitRows(this.rows.concat([window.EvaAdvanced.defaults(this.fields)]));},
      remove:function(index){if(this.field.disabled||this.rows.length<=this.minRows){return;}var next=this.rows.slice();next.splice(index,1);this.emitRows(next);},
      duplicate:function(index){if(this.field.disabled||this.rows.length>=this.maxRows){return;}var next=this.rows.slice();next.splice(index+1,0,window.EvaAdvanced.clone(this.rows[index]));this.emitRows(next);},
      move:function(index,delta){if(this.field.disabled){return;}var target=index+delta;if(target<0||target>=this.rows.length){return;}var next=this.rows.slice(),item=next.splice(index,1)[0];next.splice(target,0,item);this.emitRows(next);},
      updateChild:function(index,child,value){var next=this.rows.map(function(row){return Object.assign({},window.EvaAdvanced.object(row));});next[index][child.id]=value;this.emitRows(next);},
      toggle:function(index){this.collapsed[index]=!this.collapsed[index];},col:window.EvaAdvanced.width
    },
    template:[
      '<div class="eva-repeater" :class="{\'is-disabled\':field.disabled}">',
      '<div v-if="!rows.length" class="eva-repeater-empty"><i class="ri-stack-line"></i><span>{{tv(field.empty_text||\'暂无项目\')}}</span></div>',
      '<section v-for="(row,index) in rows" :key="index" class="eva-repeater-item">',
      '<header class="eva-repeater-head"><button type="button" class="eva-repeater-title" @click="toggle(index)"><i :class="collapsed[index]?\'ri-arrow-right-s-line\':\'ri-arrow-down-s-line\'"></i><strong>{{rowTitle(row,index)}}</strong></button>',
      '<div class="eva-repeater-actions"><button type="button" title="上移" :disabled="index===0" @click="move(index,-1)"><i class="ri-arrow-up-line"></i></button><button type="button" title="下移" :disabled="index===rows.length-1" @click="move(index,1)"><i class="ri-arrow-down-line"></i></button><button type="button" title="复制" :disabled="rows.length>=maxRows" @click="duplicate(index)"><i class="ri-file-copy-line"></i></button><button type="button" class="is-danger" title="删除" :disabled="rows.length<=minRows" @click="remove(index)"><i class="ri-delete-bin-line"></i></button></div></header>',
      '<div v-show="!collapsed[index]" class="eva-repeater-body eva-advanced-grid"><div v-for="child in fields" :key="child.id" class="eva-advanced-child" :class="col(child)"><div v-if="tv(child.title)||tv(child.desc)" class="eva-advanced-meta"><span>{{tv(child.title)}}</span><small v-if="tv(child.desc)">{{tv(child.desc)}}</small></div><eva-field :field="Object.assign({},child,{disabled:field.disabled||child.disabled})" :model-value="valueFor(row,child)" @update:model-value="updateChild(index,child,$event)"></eva-field></div></div>',
      '</section>',
      '<button type="button" class="eva-advanced-add" :disabled="field.disabled||rows.length>=maxRows" @click="add"><i class="ri-add-line"></i>{{tv(field.button_title||field.add_title||\'添加项目\')}}<small>{{rows.length}} / {{maxRows}}</small></button>',
      '</div>'
    ].join('')
  };
})();
