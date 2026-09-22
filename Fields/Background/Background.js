(function(){
  'use strict';
  window.EvaFields=window.EvaFields||{};
  window.EvaFields.background={
    props:['field','modelValue'],emits:['update:modelValue'],
    computed:{value:function(){return window.EvaAdvanced.object(this.modelValue);},colorField:function(){return{type:'color',alpha:true,presets:this.field.presets||[]};},imageField:function(){return{type:'upload',library:'image',return_type:this.field.return_type||'url',button_title:'选择背景图',placeholder:'选择或上传背景图片'};}},
    methods:{
      // allow_unset：每个下拉多一个「不设置」（空值），没存过的属性也停在它上面而不是某个具体取值。
      // CSF 的 background 允许各属性留空（留空就不输出对应的 CSS）；兼容层给 CSF 写法的字段打开这个开关。
      choices:function(options){if(this.field.allow_unset!==true){return options;}var out=[{value:'',label:'不设置'}];Object.keys(options).forEach(function(key){out.push({value:key,label:options[key]});});return out;},
      fallback:function(value){return this.field.allow_unset===true?'':value;},
      visible:function(name){var snake='show_'+name,camel='show'+name.split('_').map(function(part){return part.charAt(0).toUpperCase()+part.slice(1);}).join('');return this.field[snake]!==false&&this.field[camel]!==false;},get:function(key,fallback){return this.value[key]!==undefined?this.value[key]:fallback;},set:function(key,value){var next=Object.assign({},this.value);next[key]=value;this.$emit('update:modelValue',next);}},
    template:[
      '<div class="eva-advanced-card eva-background-field"><div class="eva-advanced-grid">',
      '<div v-if="visible(\'color\')" class="eva-advanced-control eva-advanced-col-4"><span>背景颜色</span><eva-field :field="colorField" :model-value="get(\'color\',\'\')" @update:model-value="set(\'color\',$event)"></eva-field></div>',
      '<label v-if="visible(\'repeat\')" class="eva-advanced-control eva-advanced-col-4"><span>重复方式</span><eva-select :options="choices({\'no-repeat\':\'不重复\',repeat:\'重复\',\'repeat-x\':\'水平重复\',\'repeat-y\':\'垂直重复\'})" :model-value="get(\'repeat\',fallback(\'no-repeat\'))" @update:model-value="set(\'repeat\',$event)"></eva-select></label>',
      '<label v-if="visible(\'size\')" class="eva-advanced-control eva-advanced-col-4"><span>尺寸</span><eva-select :options="choices({auto:\'自动\',cover:\'覆盖\',contain:\'完整显示\'})" :model-value="get(\'size\',fallback(\'cover\'))" @update:model-value="set(\'size\',$event)"></eva-select></label>',
      '<label v-if="visible(\'position\')" class="eva-advanced-control eva-advanced-col-4"><span>位置</span><eva-select :options="choices({\'left top\':\'左上\',\'center top\':\'中上\',\'right top\':\'右上\',\'left center\':\'左中\',\'center center\':\'居中\',\'right center\':\'右中\',\'left bottom\':\'左下\',\'center bottom\':\'中下\',\'right bottom\':\'右下\'})" :model-value="get(\'position\',fallback(\'center center\'))" @update:model-value="set(\'position\',$event)"></eva-select></label>',
      '<label v-if="visible(\'attachment\')" class="eva-advanced-control eva-advanced-col-4"><span>滚动方式</span><eva-select :options="choices({scroll:\'随页面滚动\',fixed:\'固定\',local:\'随元素滚动\'})" :model-value="get(\'attachment\',fallback(\'scroll\'))" @update:model-value="set(\'attachment\',$event)"></eva-select></label>',
      '<label v-if="visible(\'blend_mode\')" class="eva-advanced-control eva-advanced-col-4"><span>混合模式</span><eva-select :options="choices({normal:\'正常\',multiply:\'正片叠底\',screen:\'滤色\',overlay:\'叠加\',darken:\'变暗\',lighten:\'变亮\'})" :model-value="get(\'blend_mode\',fallback(\'normal\'))" @update:model-value="set(\'blend_mode\',$event)"></eva-select></label>',
      '<div v-if="visible(\'image\')" class="eva-advanced-control eva-advanced-col-12"><span>背景图片</span><eva-field :field="imageField" :model-value="get(\'image\',\'\')" @update:model-value="set(\'image\',$event)"></eva-field></div>',
      '</div></div>'
    ].join('')
  };
})();
