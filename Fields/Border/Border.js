(function(){
  'use strict';
  window.EvaFields=window.EvaFields||{};
  window.EvaFields.border={
    props:['field','modelValue'],emits:['update:modelValue'],
    computed:{value:function(){return window.EvaAdvanced.object(this.modelValue);},width:function(){return window.EvaAdvanced.object(this.value.width);},radius:function(){return window.EvaAdvanced.object(this.value.radius);},colorField:function(){return{type:'color',alpha:true,presets:this.field.presets||[]};}},
    methods:{visible:function(name){var snake='show_'+name,camel='show'+name.split('_').map(function(part){return part.charAt(0).toUpperCase()+part.slice(1);}).join('');return this.field[snake]!==false&&this.field[camel]!==false;},get:function(key,fallback){return this.value[key]!==undefined?this.value[key]:fallback;},set:function(key,value){var next=Object.assign({},this.value);next[key]=value;this.$emit('update:modelValue',next);},setPart:function(group,key,value){var next=Object.assign({},this.value),current=Object.assign({},window.EvaAdvanced.object(next[group])),linkKey=group==='width'?'linked_width':'linked_radius';current[key]=value;if(next[linkKey]){Object.keys(current).forEach(function(k){current[k]=value;});}next[group]=current;this.$emit('update:modelValue',next);}},
    template:[
      '<div class="eva-advanced-card eva-border-field"><div class="eva-advanced-grid">',
      '<label v-if="visible(\'style\')" class="eva-advanced-control eva-advanced-col-3"><span>边框样式</span><eva-select :options="{none:\'无\',solid:\'实线\',dashed:\'虚线\',dotted:\'点线\',double:\'双线\'}" :model-value="get(\'style\',\'solid\')" @update:model-value="set(\'style\',$event)"></eva-select></label>',
      '<div v-if="visible(\'color\')" class="eva-advanced-control eva-advanced-col-3"><span>边框颜色</span><eva-field :field="colorField" :model-value="get(\'color\',\'\')" @update:model-value="set(\'color\',$event)"></eva-field></div>',
      '<label v-if="visible(\'unit\')" class="eva-advanced-control eva-advanced-col-3"><span>单位</span><eva-select :options="{px:\'px\',rem:\'rem\',em:\'em\'}" :model-value="get(\'unit\',\'px\')" @update:model-value="set(\'unit\',$event)"></eva-select></label>',
      '<div v-if="visible(\'width_link\')" class="eva-advanced-control eva-advanced-col-3 eva-inline-switch"><span>宽度联动</span><button type="button" :class="{\'is-active\':get(\'linked_width\',true)}" @click="set(\'linked_width\',!get(\'linked_width\',true))"><i class="ri-link"></i></button></div>',
      '<label v-if="visible(\'width\')" v-for="item in [{k:\'top\',l:\'上边框\'},{k:\'right\',l:\'右边框\'},{k:\'bottom\',l:\'下边框\'},{k:\'left\',l:\'左边框\'}]" :key="item.k" class="eva-advanced-control eva-advanced-col-3"><span>{{item.l}}</span><input type="number" min="0" step="0.1" :value="width[item.k]||\'\'" @input="setPart(\'width\',item.k,$event.target.value)"></label>',
      '<div v-if="visible(\'radius_link\')" class="eva-advanced-control eva-advanced-col-3 eva-inline-switch"><span>圆角联动</span><button type="button" :class="{\'is-active\':get(\'linked_radius\',true)}" @click="set(\'linked_radius\',!get(\'linked_radius\',true))"><i class="ri-link"></i></button></div>',
      '<label v-if="visible(\'radius\')" v-for="item in [{k:\'top_left\',l:\'左上圆角\'},{k:\'top_right\',l:\'右上圆角\'},{k:\'bottom_right\',l:\'右下圆角\'},{k:\'bottom_left\',l:\'左下圆角\'}]" :key="item.k" class="eva-advanced-control eva-advanced-col-3"><span>{{item.l}}</span><input type="number" min="0" step="0.1" :value="radius[item.k]||\'\'" @input="setPart(\'radius\',item.k,$event.target.value)"></label>',
      '</div></div>'
    ].join('')
  };
})();
