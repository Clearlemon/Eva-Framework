(function(){
  'use strict';
  window.EvaFields=window.EvaFields||{};
  window.EvaAdvanced={
    clone:function(value){if(value===undefined){return undefined;}try{return JSON.parse(JSON.stringify(value));}catch(e){return value;}},
    object:function(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};},
    width:function(field){var map={full:'eva-advanced-col-12','1/1':'eva-advanced-col-12','3/4':'eva-advanced-col-9','2/3':'eva-advanced-col-8','1/2':'eva-advanced-col-6','1/3':'eva-advanced-col-4','1/4':'eva-advanced-col-3'};return map[field.width||'full']||'eva-advanced-col-12';},
    value:function(source,field){return Object.prototype.hasOwnProperty.call(source,field.id)?source[field.id]:(field.default!==undefined?this.clone(field.default):'');},
    defaults:function(fields){var self=this,row={};(fields||[]).forEach(function(field){if(field&&field.id&&field.save!==false){row[field.id]=field.default!==undefined?self.clone(field.default):'';}});return row;},
    options:function(options,fallback){var source=options&&typeof options==='object'?options:fallback,out=[];if(Array.isArray(source)){source.forEach(function(item){if(item&&typeof item==='object'){var value=item.value!==undefined?item.value:(item.id!==undefined?item.id:item.label);out.push({value:String(value==null?'':value),label:item.label||item.title||String(value||'')});}else{out.push({value:String(item==null?'':item),label:String(item==null?'':item)});}});}else{Object.keys(source||{}).forEach(function(key){var item=source[key];out.push({value:String(key),label:item&&typeof item==='object'?(item.label||item.title||key):String(item)});});}return out;}
  };
})();
