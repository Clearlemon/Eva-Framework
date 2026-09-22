/**
 * Eva 字段：textarea。
 *
 * 支持 rows / attributes / readonly / disabled / maxlength，适合短备注到大段内容等不同场景。
 */
(function () {
  'use strict';
  function tv(v) { return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(v) : String(v || ''); }
  function list(v) { return Array.isArray(v) ? v : (v === null || typeof v === 'undefined' || v === '' ? [] : [v]); }
  function lines(v) { v = String(v == null ? '' : v).replace(/\r\n?/g, '\n'); return v === '' ? 0 : v.split('\n').length; }
  function words(v) { var m = String(v == null ? '' : v).match(/[\u3400-\u9fff]|[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g); return m ? m.length : 0; }
  function normalize(v, mode) {
    v = String(v == null ? '' : v).replace(/\r\n?/g, '\n'); mode = String(mode || '').toLowerCase();
    if (mode === 'trim') return v.trim();
    if (mode === 'trim_lines') return v.split('\n').map(function (line) { return line.trim(); }).join('\n').trim();
    if (mode === 'compact_lines') return v.split('\n').map(function (line) { return line.trim(); }).filter(Boolean).join('\n');
    if (mode === 'uppercase') return v.toUpperCase();
    if (mode === 'lowercase') return v.toLowerCase();
    return v;
  }
  function actionIcon(a) { return {clear:'ri-delete-bin-line',copy:'ri-file-copy-line',trim:'ri-align-vertically',compact_lines:'ri-contract-up-down-line'}[a] || 'ri-more-line'; }

  window.EvaFields = window.EvaFields || {};
  window.EvaFields.textarea = {
    props: ['field', 'modelValue'], emits: ['update:modelValue'],
    data: function () { return {error:'',success:'',notice:'',noticeTimer:null}; },
    computed: {
      value: function () { return String(this.modelValue == null ? '' : this.modelValue); },
      inputId: function () { return 'eva-textarea-' + String(this.field.id || 'field').replace(/[^a-zA-Z0-9_-]/g, '-'); },
      textareaAttributes: function () {
        var a=Object.assign({},this.field.attributes||{});a.rows=this.field.auto_grow?(this.field.min_rows||this.field.rows||3):(this.field.rows||a.rows||4);
        if(this.field.readonly)a.readonly=true;if(this.field.disabled)a.disabled=true;if(this.field.required)a.required=true;
        if(this.field.maxlength!=null&&this.field.maxlength!=='')a.maxlength=this.field.maxlength;if(this.field.minlength!=null&&this.field.minlength!=='')a.minlength=this.field.minlength;
        if(this.field.spellcheck!=null)a.spellcheck=!!this.field.spellcheck;if(this.field.wrap)a.wrap=this.field.wrap;return a;
      },
      characterCount:function(){return this.value.length;},wordCount:function(){return words(this.value);},lineCount:function(){return lines(this.value);},
      counterMode:function(){return String(this.field.counter_mode||'characters').toLowerCase();},
      counterText:function(){var p=[];if(this.counterMode==='characters'||this.counterMode==='all')p.push(this.characterCount+(this.field.maxlength?' / '+this.field.maxlength:'')+' \u5b57\u7b26');if(this.counterMode==='words'||this.counterMode==='all')p.push(this.wordCount+(this.field.max_words?' / '+this.field.max_words:'')+' \u8bcd');if(this.counterMode==='lines'||this.counterMode==='all')p.push(this.lineCount+(this.field.max_lines?' / '+this.field.max_lines:'')+' \u884c');return p.join(' / ');},
      nearLimit:function(){if(this.counterMode==='characters'&&this.field.maxlength)return this.characterCount>=Number(this.field.maxlength)*.8;if(this.counterMode==='words'&&this.field.max_words)return this.wordCount>=Number(this.field.max_words)*.8;if(this.counterMode==='lines'&&this.field.max_lines)return this.lineCount>=Number(this.field.max_lines)*.8;return false;},
      actions:function(){var items=list(this.field.actions).map(function(v){return typeof v==='string'?{action:v}:Object.assign({},v);});if(this.field.clearable)items.push({action:'clear',title:'\u6e05\u7a7a'});if(this.field.copyable)items.push({action:'copy',title:'\u590d\u5236'});var seen={};return items.filter(function(v){if(!v.action||seen[v.action])return false;seen[v.action]=true;return true;});},
      resizeStyle:function(){return{resize:this.field.auto_grow?'none':(this.field.resize||'vertical')};},showMeta:function(){return!!(this.field.show_counter||this.error||this.success||this.notice);}
    },
    mounted:function(){this.resize();if(this.field.realtime_validate)this.validate(this.value);},beforeUnmount:function(){clearTimeout(this.noticeTimer);},
    methods:{
      tv:tv,actionIcon:actionIcon,emitValue:function(v){this.$emit('update:modelValue',v);},
      resize:function(){var el=this.$refs.textarea;if(!el||!this.field.auto_grow)return;var s=window.getComputedStyle(el),lh=parseFloat(s.lineHeight)||22,p=(parseFloat(s.paddingTop)||0)+(parseFloat(s.paddingBottom)||0),b=(parseFloat(s.borderTopWidth)||0)+(parseFloat(s.borderBottomWidth)||0);var min=Math.max(1,parseInt(this.field.min_rows||this.field.rows||3,10)||3),max=Math.max(min,parseInt(this.field.max_rows||12,10)||12);el.style.height='auto';var minH=min*lh+p+b,maxH=max*lh+p+b;el.style.height=Math.max(minH,Math.min(el.scrollHeight,maxH))+'px';el.style.overflowY=el.scrollHeight>maxH?'auto':'hidden';},
      setNotice:function(v){var self=this;this.notice=v;clearTimeout(this.noticeTimer);this.noticeTimer=setTimeout(function(){self.notice='';},1400);},
      onInput:function(e){var v=e.target.value.replace(/\r\n?/g,'\n');if(this.field.transform&&this.field.transform_on==='input'){v=normalize(v,this.field.transform);e.target.value=v;}this.emitValue(v);this.resize();if(this.field.realtime_validate||this.field.validate_on==='input')this.validate(v);},
      onBlur:function(e){var v=e.target.value;if(this.field.transform&&this.field.transform_on!=='input'){v=normalize(v,this.field.transform);e.target.value=v;this.emitValue(v);this.resize();}if(this.field.validate||this.field.required||this.field.minlength||this.field.maxlength||this.field.min_words||this.field.max_words||this.field.min_lines||this.field.max_lines)this.validate(v);},
      validate:function(v){v=String(v==null?'':v);var err='';if(this.field.required&&!v.trim())err='\u6b64\u9879\u4e0d\u80fd\u4e3a\u7a7a';if(!err&&v&&this.field.minlength&&v.length<Number(this.field.minlength))err='\u81f3\u5c11\u8f93\u5165 '+this.field.minlength+' \u4e2a\u5b57\u7b26';if(!err&&this.field.maxlength&&v.length>Number(this.field.maxlength))err='\u6700\u591a\u8f93\u5165 '+this.field.maxlength+' \u4e2a\u5b57\u7b26';if(!err&&v&&this.field.min_words&&words(v)<Number(this.field.min_words))err='\u81f3\u5c11\u8f93\u5165 '+this.field.min_words+' \u4e2a\u8bcd';if(!err&&this.field.max_words&&words(v)>Number(this.field.max_words))err='\u6700\u591a\u8f93\u5165 '+this.field.max_words+' \u4e2a\u8bcd';if(!err&&v&&this.field.min_lines&&lines(v)<Number(this.field.min_lines))err='\u81f3\u5c11\u8f93\u5165 '+this.field.min_lines+' \u884c';if(!err&&this.field.max_lines&&lines(v)>Number(this.field.max_lines))err='\u6700\u591a\u8f93\u5165 '+this.field.max_lines+' \u884c';this.error=err?tv(this.field.error_text||err):'';this.success=!err&&v?tv(this.field.success_text||'\u5185\u5bb9\u6709\u6548'):'';return!err;},
      copy:function(){var self=this,done=function(){self.setNotice('\u5df2\u590d\u5236');};if(window.navigator&&navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(this.value).then(done).catch(done);return;}var el=document.createElement('textarea');el.value=this.value;document.body.appendChild(el);el.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(el);done();},
      runAction:function(item){var a=item.action;if(a==='clear'){this.emitValue('');this.error='';this.success='';this.setNotice('\u5df2\u6e05\u7a7a');}else if(a==='copy')this.copy();else if(a==='trim'||a==='compact_lines'){var v=normalize(this.value,a);this.emitValue(v);this.validate(v);this.setNotice(a==='trim'?'\u5df2\u6574\u7406\u9996\u5c3e\u7a7a\u767d':'\u5df2\u79fb\u9664\u7a7a\u884c');}this.$nextTick(this.resize);}
    },
    template:[
      '<div class="eva-textarea-field" :class="{\'has-error\':error,\'has-success\':success&&!error,\'is-monospace\':field.monospace,\'is-auto-grow\':field.auto_grow}">',
      '<div v-if="actions.length" class="eva-textarea-toolbar"><span>{{tv(field.toolbar_label||\'\u6587\u672c\u64cd\u4f5c\')}}</span><div><button v-for="item in actions" :key="item.action" type="button" :title="tv(item.title||item.action)" :disabled="field.disabled||(!value&&(item.action===\'copy\'||item.action===\'trim\'||item.action===\'compact_lines\'))" @click="runAction(item)"><i :class="item.icon||actionIcon(item.action)"></i></button></div></div>',
      '<textarea ref="textarea" class="eva-f-input eva-f-textarea" v-bind="textareaAttributes" :id="inputId" :style="resizeStyle" :value="value" :placeholder="tv(field.placeholder||\'\')" @input="onInput" @blur="onBlur"></textarea>',
      '<div v-if="showMeta" class="eva-textarea-meta"><span v-if="error" class="eva-textarea-message is-error"><i class="ri-error-warning-line"></i>{{error}}</span><span v-else-if="success" class="eva-textarea-message is-success"><i class="ri-checkbox-circle-line"></i>{{success}}</span><span v-else-if="notice" class="eva-textarea-message is-info"><i class="ri-information-line"></i>{{notice}}</span><span v-if="field.show_counter" class="eva-textarea-counter" :class="{\'is-near\':nearLimit}">{{counterText}}</span></div></div>'
    ].join('')
  };
})();
