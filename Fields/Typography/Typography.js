(function(){
  'use strict';
  window.EvaFields=window.EvaFields||{};
  window.EvaFields.typography={
    props:['field','modelValue'],emits:['update:modelValue'],
    computed:{
      value:function(){return window.EvaAdvanced.object(this.modelValue);},
      fonts:function(){return window.EvaAdvanced.options(this.field.fonts||this.field.options,{
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif':'系统默认',
        'Arial, sans-serif':'Arial','"Helvetica Neue", Helvetica, sans-serif':'Helvetica Neue','Georgia, serif':'Georgia','"Times New Roman", serif':'Times New Roman','ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace':'Monospace'
      });},
      colorField:function(){return{type:'color',alpha:this.field.alpha!==false,presets:this.field.presets||[],placeholder:'#111827'};},
      fontOptions:function(){var self=this;return this.fonts.map(function(item){return{value:item.value,label:self.tv(item.label)};});}
    },
    methods:{tv:function(v){return window.EvaI18n.tv(v);},visible:function(name){var snake='show_'+name,camel='show'+name.split('_').map(function(part){return part.charAt(0).toUpperCase()+part.slice(1);}).join('');return this.field[snake]!==false&&this.field[camel]!==false;},get:function(key,fallback){return this.value[key]!==undefined?this.value[key]:fallback;},set:function(key,value){var next=Object.assign({},this.value);next[key]=value;this.$emit('update:modelValue',next);}},
    template:[
      '<div class="eva-advanced-card eva-typography"><div class="eva-advanced-grid">',
      '<label v-if="visible(\'family\')" class="eva-advanced-control eva-advanced-col-6"><span>字体</span><eva-select :options="fontOptions" :model-value="get(\'family\',\'\')" :disabled="field.disabled" @update:model-value="set(\'family\',$event)"></eva-select></label>',
      '<label v-if="visible(\'size\')" class="eva-advanced-control eva-advanced-col-3"><span>字号</span><div class="eva-advanced-number"><input type="number" min="0" step="0.1" :value="get(\'size\',\'\')" :disabled="field.disabled" @input="set(\'size\',$event.target.value)"><eva-select :options="{px:\'px\',rem:\'rem\',em:\'em\',\'%\':\'%\',vw:\'vw\'}" :model-value="get(\'size_unit\',\'px\')" :disabled="field.disabled" @update:model-value="set(\'size_unit\',$event)"></eva-select></div></label>',
      '<label v-if="visible(\'weight\')" class="eva-advanced-control eva-advanced-col-3"><span>字重</span><eva-select :options="{normal:\'Normal\',100:\'100\',200:\'200\',300:\'300\',400:\'400\',500:\'500\',600:\'600\',700:\'700\',800:\'800\',900:\'900\',bold:\'Bold\'}" :model-value="get(\'weight\',\'400\')" :disabled="field.disabled" @update:model-value="set(\'weight\',$event)"></eva-select></label>',
      '<label v-if="visible(\'line_height\')" class="eva-advanced-control eva-advanced-col-3"><span>行高</span><div class="eva-advanced-number"><input type="number" min="0" step="0.1" :value="get(\'line_height\',\'\')" :disabled="field.disabled" @input="set(\'line_height\',$event.target.value)"><eva-select :options="{\'\':\'倍数\',px:\'px\',rem:\'rem\',em:\'em\',\'%\':\'%\'}" :model-value="get(\'line_height_unit\',\'\')" :disabled="field.disabled" @update:model-value="set(\'line_height_unit\',$event)"></eva-select></div></label>',
      '<label v-if="visible(\'letter_spacing\')" class="eva-advanced-control eva-advanced-col-3"><span>字间距</span><div class="eva-advanced-number"><input type="number" step="0.1" :value="get(\'letter_spacing\',\'\')" :disabled="field.disabled" @input="set(\'letter_spacing\',$event.target.value)"><eva-select :options="{px:\'px\',rem:\'rem\',em:\'em\'}" :model-value="get(\'letter_spacing_unit\',\'px\')" :disabled="field.disabled" @update:model-value="set(\'letter_spacing_unit\',$event)"></eva-select></div></label>',
      '<label v-if="visible(\'style\')" class="eva-advanced-control eva-advanced-col-3"><span>样式</span><eva-select :options="{normal:\'正常\',italic:\'斜体\',oblique:\'倾斜\'}" :model-value="get(\'style\',\'normal\')" :disabled="field.disabled" @update:model-value="set(\'style\',$event)"></eva-select></label>',
      '<label v-if="visible(\'transform\')" class="eva-advanced-control eva-advanced-col-3"><span>转换</span><eva-select :options="{none:\'无\',uppercase:\'大写\',lowercase:\'小写\',capitalize:\'首字母大写\'}" :model-value="get(\'transform\',\'none\')" :disabled="field.disabled" @update:model-value="set(\'transform\',$event)"></eva-select></label>',
      '<label v-if="visible(\'align\')" class="eva-advanced-control eva-advanced-col-3"><span>对齐</span><eva-select :options="{inherit:\'继承\',left:\'左\',center:\'中\',right:\'右\',justify:\'两端\'}" :model-value="get(\'align\',\'inherit\')" :disabled="field.disabled" @update:model-value="set(\'align\',$event)"></eva-select></label>',
      '<div v-if="visible(\'color\')" class="eva-advanced-control eva-advanced-col-3"><span>文字颜色</span><eva-field :field="colorField" :model-value="get(\'color\',\'\')" @update:model-value="set(\'color\',$event)"></eva-field></div>',
      '</div><div v-if="field.preview!==false" class="eva-typography-preview" :style="{fontFamily:get(\'family\',\'inherit\'),fontSize:get(\'size\',\'\')?get(\'size\',\'\')+get(\'size_unit\',\'px\'):\'inherit\',fontWeight:get(\'weight\',\'400\'),fontStyle:get(\'style\',\'normal\'),lineHeight:get(\'line_height\',\'\')?get(\'line_height\',\'\')+get(\'line_height_unit\',\'\'):\'normal\',letterSpacing:get(\'letter_spacing\',\'\')?get(\'letter_spacing\',\'\')+get(\'letter_spacing_unit\',\'px\'):\'normal\',textTransform:get(\'transform\',\'none\'),textAlign:get(\'align\',\'inherit\'),color:get(\'color\',\'inherit\')}">{{tv(field.preview_text||\'Eva Framework 字体预览 Typography Preview\')}}</div></div>'
    ].join('')
  };
})();
