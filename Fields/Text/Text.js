/**
 * Eva 字段：text。
 *
 * 支持普通文本以及 URL、邮箱、密码等原生 input 类型；字段 schema 可通过
 * input_type / attributes / readonly / disabled / maxlength / autocomplete 调整行为。
 */
(function () {
  'use strict';
  function tv(v) { return window.EvaI18n && window.EvaI18n.tv ? window.EvaI18n.tv(v) : String(v || ''); }
  function list(v) { return Array.isArray(v) ? v : (v === null || typeof v === 'undefined' || v === '' ? [] : [v]); }
  function slug(v) { return String(v || '').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\u3400-\u9fff-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
  function transform(v, mode) {
    v = String(v == null ? '' : v); mode = String(mode || '').toLowerCase();
    if (mode === 'slug') return slug(v); if (mode === 'uppercase') return v.toUpperCase(); if (mode === 'lowercase') return v.toLowerCase();
    if (mode === 'trim') return v.trim(); if (mode === 'numeric') return v.replace(/[^0-9+.-]/g, ''); if (mode === 'alphanumeric') return v.replace(/[^a-z0-9]/gi, ''); return v;
  }
  function mask(v, pattern) {
    var raw = String(v || '').replace(/[^a-z0-9]/gi, ''), out = '', at = 0; pattern = String(pattern || '');
    for (var i = 0; i < pattern.length && at < raw.length; i += 1) {
      var token = pattern[i];
      if (token === '0' || token === 'A' || token === '*') {
        while (at < raw.length && ((token === '0' && !/[0-9]/.test(raw[at])) || (token === 'A' && !/[a-z]/i.test(raw[at])))) at += 1;
        if (at < raw.length) { out += raw[at]; at += 1; }
      } else { out += token; }
    }
    return out;
  }
  function random(length, chars) {
    var size = Math.max(1, parseInt(length, 10) || 24), out = '', values = new Uint32Array(size);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(values); else for (var x = 0; x < size; x += 1) values[x] = Math.random() * 1000000;
    for (var i = 0; i < size; i += 1) out += chars[values[i] % chars.length]; return out;
  }
  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function actionIcon(a) { return { clear:'ri-close-line', copy:'ri-file-copy-line', generate:'ri-refresh-line', open:'ri-external-link-line', reveal:'ri-eye-line', hide:'ri-eye-off-line' }[a] || 'ri-more-line'; }

  window.EvaFields = window.EvaFields || {};
  window.EvaFields.text = {
    props: ['field', 'modelValue'], emits: ['update:modelValue'],
    data: function () { return { revealed:false, error:'', success:'', notice:'', timer:null }; },
    computed: {
      value: function () { return String(this.modelValue == null ? '' : this.modelValue); },
      inputType: function () { return this.field.input_type === 'password' && this.revealed ? 'text' : (this.field.input_type || 'text'); },
      inputId: function () { return 'eva-text-' + String(this.field.id || 'field').replace(/[^a-zA-Z0-9_-]/g, '-'); },
      suggestions: function () { return list(this.field.suggestions).map(function (v) { return typeof v === 'object' ? {value:String(v.value || ''),label:tv(v.label || v.value)} : {value:String(v),label:String(v)}; }).filter(function (v) { return v.value; }); },
      inputAttributes: function () {
        var a = Object.assign({}, this.field.attributes || {}), self = this;
        ['minlength','maxlength','pattern','inputmode','autocomplete','name'].forEach(function (k) { if (self.field[k] !== null && typeof self.field[k] !== 'undefined' && self.field[k] !== '') a[k] = self.field[k]; });
        if (this.field.readonly) a.readonly = true; if (this.field.disabled) a.disabled = true; if (this.field.required) a.required = true; if (this.suggestions.length) a.list = this.inputId + '-suggestions'; return a;
      },
      actions: function () {
        var items = list(this.field.actions).map(function (v) { return typeof v === 'string' ? {action:v} : Object.assign({}, v); });
        if (this.field.clearable) items.push({action:'clear',title:'清空'}); if (this.field.copyable) items.push({action:'copy',title:'复制'}); if (this.field.generate) items.push({action:'generate',title:'生成'});
        if (this.field.openable || this.field.preview === 'url') items.push({action:'open',title:'打开链接'}); if (this.field.input_type === 'password' && this.field.toggle_password !== false) items.push({action:this.revealed?'hide':'reveal',title:this.revealed?'隐藏密码':'显示密码'});
        var seen = {}; return items.filter(function (v) { if (!v.action || seen[v.action]) return false; seen[v.action] = true; return true; });
      },
      counter: function () { return this.value.length + (this.field.maxlength ? ' / ' + this.field.maxlength : ''); },
      nearLimit: function () { return this.field.maxlength && this.value.length >= Number(this.field.maxlength) * .8; },
      passwordScore: function () { var v=this.value,s=0;if(v.length>=8)s++;if(v.length>=12)s++;if(/[a-z]/.test(v)&&/[A-Z]/.test(v))s++;if(/\d/.test(v))s++;if(/[^a-z0-9]/i.test(v))s++;return Math.min(4,s); },
      passwordLabel: function () { return ['很弱','较弱','一般','较强','强'][this.passwordScore]; },
      colorPreview: function () { return this.field.preview === 'color' && /^(#|rgb|hsl|transparent)/i.test(this.value) ? this.value : 'transparent'; }
    },
    beforeUnmount: function () { clearTimeout(this.timer); },
    methods: {
      tv:tv, actionIcon:actionIcon, emitValue:function(v){this.$emit('update:modelValue',v);},
      setNotice:function(v){var self=this;this.notice=v;clearTimeout(this.timer);this.timer=setTimeout(function(){self.notice='';},1400);},
      onInput:function(e){var v=e.target.value;if(this.field.mask){v=mask(v,this.field.mask);e.target.value=v;}if(this.field.transform&&this.field.transform_on==='input'){v=transform(v,this.field.transform);e.target.value=v;}this.emitValue(v);if(this.field.realtime_validate||this.field.validate_on==='input')this.validate(v);},
      onBlur:function(e){var v=e.target.value;if(this.field.transform&&this.field.transform_on!=='input'){v=transform(v,this.field.transform);e.target.value=v;this.emitValue(v);}if(this.field.validate||this.field.required||this.field.pattern||this.field.minlength||this.field.input_type==='email'||this.field.input_type==='url')this.validate(v);},
      validate:function(v){
        v=String(v==null?'':v);var rules=list(this.field.validate),err='';if(this.field.required)rules.unshift('required');if(this.field.input_type==='email')rules.push('email');if(this.field.input_type==='url')rules.push('url');
        if(rules.indexOf('required')!==-1&&!v.trim())err='此项不能为空';if(!err&&v&&rules.indexOf('email')!==-1&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))err='请输入有效邮箱';if(!err&&v&&rules.indexOf('url')!==-1){try{new URL(v);}catch(e){err='请输入完整 URL';}}
        if(!err&&v&&(rules.indexOf('numeric')!==-1||rules.indexOf('number')!==-1)&&!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(v))err='请输入有效数字';if(!err&&v&&rules.indexOf('phone')!==-1&&v.replace(/\D/g,'').length<7)err='请输入有效电话号码';
        if(!err&&v&&rules.indexOf('slug')!==-1&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v))err='只能使用小写字母、数字和连字符';if(!err&&v&&rules.indexOf('uuid')!==-1&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v))err='请输入有效 UUID';
        if(!err&&this.field.minlength&&v.length<Number(this.field.minlength))err='至少输入 '+this.field.minlength+' 个字符';if(!err&&this.field.pattern&&v){try{if(!(new RegExp(this.field.pattern)).test(v))err=tv(this.field.pattern_message||'输入格式不正确');}catch(e){}}this.error=err?tv(this.field.error_text||err):'';this.success=!err&&v?tv(this.field.success_text||'格式正确'):'';return !err;
      },
      copy:function(){var self=this,done=function(){self.setNotice('已复制');};if(window.navigator&&navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(this.value).then(done).catch(done);return;}var el=document.createElement('textarea');el.value=this.value;document.body.appendChild(el);el.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(el);done();},
      generatedValue:function(){var c=this.field.generate,t=String(typeof c==='object'?c.type:c||'uuid').toLowerCase(),len=typeof c==='object'?c.length:this.field.generate_length;if(t==='uuid')return uuid();if(t==='timestamp')return String(Date.now());if(t==='slug')return slug(this.value||tv(this.field.generate_source||this.field.title||'eva-item'));if(t==='password')return random(len||18,'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?');return random(len||32,'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');},
      runAction:function(item){var a=item.action;if(a==='clear'){this.emitValue('');this.error='';this.success='';this.setNotice('已清空');}else if(a==='copy')this.copy();else if(a==='generate'){var v=this.generatedValue();this.emitValue(v);this.validate(v);this.setNotice('已生成');}else if(a==='open'&&this.value)window.open(this.value,'_blank','noopener,noreferrer');else if(a==='reveal'||a==='hide')this.revealed=!this.revealed;}
    },
    template:[
      '<div class="eva-text-field" :class="{\'has-error\':error,\'has-success\':success&&!error}"><div class="eva-text-input-wrap">',
      '<span v-if="field.prefix||field.prefix_icon" class="eva-text-affix is-prefix"><i v-if="field.prefix_icon" :class="field.prefix_icon"></i><span v-if="field.prefix">{{tv(field.prefix)}}</span></span>',
      '<input class="eva-f-input eva-text-input" v-bind="inputAttributes" :id="inputId" :type="inputType" :value="value" :placeholder="tv(field.placeholder||\'\')" @input="onInput" @blur="onBlur">',
      '<span v-if="field.preview===\'color\'" class="eva-text-color-preview" :style="{backgroundColor:colorPreview}"></span><span v-if="field.suffix||field.suffix_icon" class="eva-text-affix is-suffix"><span v-if="field.suffix">{{tv(field.suffix)}}</span><i v-if="field.suffix_icon" :class="field.suffix_icon"></i></span>',
      '<span v-if="actions.length" class="eva-text-actions"><button v-for="item in actions" :key="item.action" type="button" :title="tv(item.title||item.action)" :disabled="field.disabled||((item.action===\'copy\'||item.action===\'open\')&&!value)" @click="runAction(item)"><i :class="item.icon||actionIcon(item.action)"></i></button></span></div>',
      '<datalist v-if="suggestions.length" :id="inputId+\'-suggestions\'"><option v-for="item in suggestions" :key="item.value" :value="item.value">{{item.label}}</option></datalist>',
      '<div v-if="field.show_counter||error||success||notice||(field.password_strength&&value)" class="eva-text-meta"><span v-if="error" class="eva-text-message is-error"><i class="ri-error-warning-line"></i>{{error}}</span><span v-else-if="success" class="eva-text-message is-success"><i class="ri-checkbox-circle-line"></i>{{success}}</span><span v-else-if="notice" class="eva-text-message is-info"><i class="ri-information-line"></i>{{notice}}</span><span v-if="field.password_strength&&value" class="eva-password-strength"><span><i v-for="n in 4" :key="n" :class="{\'is-on\':n<=passwordScore}"></i></span><em>{{passwordLabel}}</em></span><span v-if="field.show_counter" class="eva-text-counter" :class="{\'is-near\':nearLimit}">{{counter}}</span></div>',
      '<div v-if="field.preview===\'image\'&&value" class="eva-text-image-preview"><img :src="value" alt="" loading="lazy"><span>{{value}}</span></div><a v-if="field.preview===\'email\'&&value" class="eva-text-link-preview" :href="\'mailto:\'+value"><i class="ri-mail-send-line"></i>发送邮件</a></div>'
    ].join('')
  };
})();
