(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[77272,39040],{496829:(e,t,r)=>{"use strict";r.d(t,{Z:()=>d});var n=r(675263),o=r.n(n),i=r(124852),c=r.n(i),l=r(480681);function a(e){return a="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},a(e)}function u(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,y(n.key),n)}}function p(e,t){return p=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(e,t){return e.__proto__=t,e},p(e,t)}function s(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function f(e){return f=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(e){return e.__proto__||Object.getPrototypeOf(e)},f(e)}function b(e,t,r){return(t=y(t))in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function y(e){var t=function(e,t){if("object"!=a(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=a(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==a(t)?t:String(t)}var m=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&p(e,t)}(y,e);var t,r,n,o,i=(n=y,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=f(n);if(o){var r=f(this).constructor;e=Reflect.construct(t,arguments,r)}else e=t.apply(this,arguments);return function(e,t){if(t&&("object"===a(t)||"function"==typeof t))return t;if(void 0!==t)throw new TypeError("Derived constructors may only return object or undefined");return s(e)}(this,e)});function y(){var e;!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,y);for(var t=arguments.length,r=new Array(t),n=0;n<t;n++)r[n]=arguments[n];return b(s(e=i.call.apply(i,[this].concat(r))),"onChange",(function(){e.props.onChange(!e.refs.input.props.checked)})),b(s(e),"isEnabled",(function(){return e.props.isEnabled?e.props.isEnabled(e.props.layouts):0===e.props.layouts.length||e.props.layouts.some((function(t){return t.name.match(e.props.enableRegex)}))})),e}return t=y,(r=[{key:"render",value:function(){return c().createElement(l.Checkbox,{disabled:!this.isEnabled(),ref:"input",checked:this.props.checked,onChange:this.onChange},this.props.label)}}])&&u(t.prototype,r),Object.defineProperty(t,"prototype",{writable:!1}),y}(c().Component);b(m,"propTypes",{layouts:o().array,enableRegex:o().oneOfType([o().object,o().string]),label:o().string,onChange:o().func,checked:o().bool,isEnabled:o().func}),b(m,"defaultProps",{layouts:[],enableRegex:/^.*$/,label:"Option",onChange:function(){},checked:!1});const d=m},832395:(e,t,r)=>{"use strict";r.d(t,{W:()=>y});var n=r(124852),o=r.n(n),i=r(675263),c=r.n(i),l=r(322843),a=r(86638),u=r(496829),p=r(227361),s=r.n(p);function f(e){return f="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},f(e)}function b(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}var y=function(e,t){var r=e.spec,i=e.property,c=e.label,p=e.onChangeParameter,y=e.enabled,m=void 0===y||y,d=e.actions,v=e.path,g=void 0===v?"params.":v,O=e.additionalProperty,h=void 0===O||O,j=g+i;return(0,n.useEffect)((function(){var e;h&&(null==d||d.addParameter(i,null!==(e=s()(r,j))&&void 0!==e&&e))}),[]),(0,l.CU)({},function(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?b(Object(r),!0).forEach((function(t){var n,o,i,c;n=e,o=t,i=r[t],c=function(e,t){if("object"!=f(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=f(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(o),(o="symbol"==f(c)?c:String(c))in n?Object.defineProperty(n,o,{value:i,enumerable:!0,configurable:!0,writable:!0}):n[o]=i})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):b(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}({},e),"{"+m+"}")?o().createElement(u.Z,{checked:!!s()(r,j),label:(0,a.S$)(t.messages,c),onChange:function(e){return p(j,e)}}):null};y.contextTypes={messages:c().object}},1842:(e,t,r)=>{"use strict";r.r(t),r.d(t,{defaultFormat:()=>g,Scale:()=>h,default:()=>j});var n=r(124852),o=r.n(n),i=r(832395),c=r(322843),l=r(171703),a=r(986069),u=r(805346),p=r(134049),s=r(720289),f=r(145959),b=["map","scale","locale","label","optionLabel","actions","onAddParameter"];function y(e){return y="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},y(e)}function m(){return m=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var r=arguments[t];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(e[n]=r[n])}return e},m.apply(this,arguments)}function d(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function v(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?d(Object(r),!0).forEach((function(t){var n,o,i,c;n=e,o=t,i=r[t],c=function(e,t){if("object"!=y(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=y(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(o),(o="symbol"==y(c)?c:String(c))in n?Object.defineProperty(n,o,{value:i,enumerable:!0,configurable:!0,writable:!0}):n[o]=i})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):d(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function g(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"en-US",r=new Intl.NumberFormat(t,{maximumFractionDigits:0}).format(e);return"1:".concat(r)}var O=function(e){var t,r,n,o,i,c;return{spec:null!==(t=null==e||null===(r=e.print)||void 0===r?void 0:r.spec)&&void 0!==t?t:{},scale:null==e||null===(n=e.print)||void 0===n||null===(o=n.map)||void 0===o?void 0:o.scale,locale:null!==(i=null==e||null===(c=e.locale)||void 0===c?void 0:c.current)&&void 0!==i?i:"en-US"}},h=function(e){var t,r=e.map,c=e.scale,l=e.locale,a=e.label,s=void 0===a?"print.scale":a,f=e.optionLabel,y=void 0===f?"print.includeScale":f,d=(e.actions,e.onAddParameter),h=function(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}(e,b),j=e.format||g;return(0,n.useEffect)((function(){var e;(0,p.addTransformer)("scale",(e=j,function(t,r){var n,o,i=null==r||null===(n=r.pages)||void 0===n||null===(o=n[0])||void 0===o?void 0:o.scale,c=O(t).locale;return Promise.resolve(v(v({},r),{},{mapScale:null!=r&&r.includeScale?"".concat(e(i,c,!0)):""}))}),4)}),[]),o().createElement("div",{id:"print-scale"},o().createElement("div",{style:{float:"left",marginRight:5}},o().createElement(u.Z,{msgId:s})," ",j(null!==(t=null==r?void 0:r.scale)&&void 0!==t?t:c,l)),o().createElement(i.W,m({},h,{actions:{addParameter:d},property:"includeScale",label:y})))};const j=(0,c.rx)("PrintScale",{component:(0,l.connect)(O,{onChangeParameter:a.d$,onAddParameter:a.eT})(h),reducers:{locale:s.Z,print:f.Z},containers:{Print:{priority:1,target:"left-panel",position:3}}})},145959:(e,t,r)=>{"use strict";r.d(t,{Z:()=>g});var n=r(986069),o=r(782904),i=r(513218),c=r.n(i),l=r(227361),a=r.n(l),u=r(737295),p=r.n(u),s=r(436968),f=r.n(s);function b(e){return b="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},b(e)}function y(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function m(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?y(Object(r),!0).forEach((function(t){var n,o,i,c;n=e,o=t,i=r[t],c=function(e,t){if("object"!=b(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=b(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(o),(o="symbol"==b(c)?c:String(c))in n?Object.defineProperty(n,o,{value:i,enumerable:!0,configurable:!0,writable:!0}):n[o]=i})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):y(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}var d={antiAliasing:!0,iconSize:24,legendDpi:96,fontFamily:"Verdana",fontSize:8,bold:!1,italic:!1,resolution:96,name:"",description:"",outputFormat:"pdf"},v=function(){return(arguments.length>0&&void 0!==arguments[0]?arguments[0]:"").split("_")[0]};const g=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{spec:d,capabilities:null,map:null,isLoading:!1,pdfUrl:null},t=arguments.length>1?arguments[1]:void 0;switch(t.type){case o.kM:return"print"===t.control?p()({},e,{pdfUrl:null,isLoading:!1,error:null}):e;case n.qp:var r=a()(t,"capabilities.layouts",[{name:"A4"}]),i=r.filter((function(t){return v(t.name)===e.spec.sheet})).length?e.spec.sheet:v(r[0].name);return p()({},e,{capabilities:t.capabilities,spec:p()({},e.spec||{},{sheet:i,resolution:t.capabilities&&t.capabilities.dpis&&t.capabilities.dpis.length&&t.capabilities.dpis[0].value})});case n.U6:return m(m({},e),{},{spec:f()(m({},e.spec),t.name,t.value)});case n.rd:return a()(e.spec,t.name)?e:m(m({},e),{},{spec:f()(m({},e.spec),t.name,t.value)});case n.PB:var l,u,s=t.layers.map((function(e){return e.title?p()({},e,{title:c()(e.title)&&t.currentLocale&&e.title[t.currentLocale]||c()(e.title)&&e.title.default||e.title}):e}));return p()({},e,{map:{center:t.center,zoom:t.zoom,scaleZoom:t.scaleZoom,scale:t.scale,layers:s,size:null!==(l=t.size)&&void 0!==l?l:null===(u=e.map)||void 0===u?void 0:u.size,projection:t.projection},error:null});case n.HA:var b=t.zoom-e.map.scaleZoom;return p()({},e,{map:p()({},e.map,{scaleZoom:t.zoom,zoom:e.map.zoom+b,scale:t.scale})});case n.Yk:return p()({},e,{map:p()({},e.map,{size:t.size})});case n.Fp:return p()({},e,{isLoading:!0,pdfUrl:null,error:null});case n.EZ:return p()({},e,{isLoading:!1,pdfUrl:t.url,error:null});case n.WB:case n.aN:return p()({},e,{isLoading:!1,pdfUrl:null,error:t.error});case n.qH:return p()({},e,{isLoading:!1,pdfUrl:null,error:null});default:return e}}},650148:(e,t,r)=>{"use strict";r.d(t,{DX:()=>i,p6:()=>c,LI:()=>l});var n=r(737295),o=r.n(n),i=function(e){return e.print&&e.print.spec&&o()({},e.print.spec,e.print.map||{})},c=function(e){return e.print&&e.print.capabilities&&e.print.capabilities.layouts.filter((function(t){return 0===t.name.indexOf(e.print.spec.sheet)}))||[]},l=function(e){return e.print&&e.print.spec&&e.print.spec.includeLegend}},580760:(e,t,r)=>{var n=r(989881);e.exports=function(e,t){var r=[];return n(e,(function(e,n,o){t(e,n,o)&&r.push(e)})),r}},763105:(e,t,r)=>{var n=r(234963),o=r(580760),i=r(267206),c=r(701469);e.exports=function(e,t){return(c(e)?n:o)(e,i(t,3))}},531351:e=>{var t=Array.prototype.reverse;e.exports=function(e){return null==e?e:t.call(e)}}}]);