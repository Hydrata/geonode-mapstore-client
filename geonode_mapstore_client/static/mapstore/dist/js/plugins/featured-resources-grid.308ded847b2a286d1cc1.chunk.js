(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[65512,80628],{615402:(e,t,r)=>{"use strict";r.d(t,{Z:()=>m});var n=r(45697),o=r.n(n),i=r(124852),a=r.n(i);function c(e){return(c="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function u(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function l(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function s(e,t){return(s=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(e,t){return e.__proto__=t,e})(e,t)}function f(e,t){if(t&&("object"===c(t)||"function"==typeof t))return t;if(void 0!==t)throw new TypeError("Derived constructors may only return object or undefined");return function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e)}function d(e){return(d=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function p(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var y=r(868195).FormattedHTMLMessage,b=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&s(e,t)}(c,e);var t,r,n,o,i=(n=c,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=d(n);if(o){var r=d(this).constructor;e=Reflect.construct(t,arguments,r)}else e=t.apply(this,arguments);return f(this,e)});function c(){return u(this,c),i.apply(this,arguments)}return t=c,(r=[{key:"render",value:function(){return this.context.intl?a().createElement(y,{id:this.props.msgId,values:this.props.msgParams}):a().createElement("span",null,this.props.msgId||"")}}])&&l(t.prototype,r),Object.defineProperty(t,"prototype",{writable:!1}),c}(a().Component);p(b,"propTypes",{msgId:o().string.isRequired,msgParams:o().object}),p(b,"contextTypes",{intl:o().object});const m=b},999052:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>M});var n=r(124852),o=r.n(n),i=r(171703),a=r(180307),c=r(322843),u=r(472500),l=r.n(u),s=r(22222),f=r(770058),d=r(93993),p=r(303744),y=r(51605),b=r(615402),m=r(507412),v=r(580628),g=r(182021),h=r(535721);const O=(0,v.Z)((function(e){var t=e.resources,r=e.formatHref,i=e.isCardActive,a=e.buildHrefByTemplate,c=e.containerWidth,u=e.width,l=e.options,s=e.onResize,f=e.downloading,d=e.getDetailHref,p=u||c,y=Math.floor(p/344),b=y>4?4:y,m=p>=368?Math.floor((p-24*b)/b):"100%";(0,n.useEffect)((function(){s(b)}),[b]);var v=Math.floor(12),O=0===b||1===b,P=function(e){return O?{width:p-24,margin:v}:{width:m,marginRight:(e+1)%b==0?0:24,marginTop:8}},w=O?{paddingBottom:0}:{paddingLeft:v,paddingBottom:0};return u?o().createElement("ul",{style:w},t.map((function(e,t){var n=(0,h.fu)(e).isProcessing;return o().createElement("li",{key:null==e?void 0:e.pk,style:P(t)},o().createElement(g.Z,{active:i(e),data:e,formatHref:r,options:l,buildHrefByTemplate:a,layoutCardsStyle:"grid",loading:n,readOnly:n,featured:!0,downloading:!(null==f||!f.find((function(t){return t.pk===e.pk}))),getDetailHref:d}))}))):o().createElement("div",null)}));function P(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function w(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?P(Object(r),!0).forEach((function(t){j(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):P(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function j(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function E(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}var S=(0,v.Z)((function(e){var t,r,i=e.resources,a=e.loading,c=e.isNextPageAvailable,u=e.formatHref,l=e.isCardActive,s=e.containerStyle,f=e.header,d=e.buildHrefByTemplate,v=e.isPreviousPageAvailable,g=e.loadFeaturedResources,h=e.onLoad,P=e.width,j=e.downloading,S=e.getDetailHref,_=(t=(0,n.useState)(),r=2,function(e){if(Array.isArray(e))return e}(t)||function(e,t){var r=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null!=r){var n,o,i=[],a=!0,c=!1;try{for(r=r.call(e);!(a=(n=r.next()).done)&&(i.push(n.value),!t||i.length!==t);a=!0);}catch(e){c=!0,o=e}finally{try{a||null==r.return||r.return()}finally{if(c)throw o}}return i}}(t,r)||function(e,t){if(e){if("string"==typeof e)return E(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?E(e,t):void 0}}(t,r)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()),H=_[0],R=_[1],k=w({fontSize:"1rem"},!c||a?{color:"grey",cursor:"not-allowed"}:{cursor:"pointer"}),A=w({fontSize:"1rem"},!v||a?{color:"grey",cursor:"not-allowed"}:{cursor:"pointer"});return o().createElement("div",{className:"gn-card-grid",style:0===i.length?{display:"none"}:{}},f,o().createElement("div",{style:{display:"flex",width:"100%"}},o().createElement("div",{style:{flex:1,width:"100%"}},o().createElement("div",{className:"gn-card-grid-container",style:s},o().createElement("h3",null,o().createElement(b.Z,{msgId:"gnhome.featuredList"})),o().createElement(O,{featured:!0,resources:i,formatHref:u,isCardActive:l,buildHrefByTemplate:d,containerWidth:P,onResize:function(e){!isNaN(e)&&h(void 0,e),R(e)},downloading:j,getDetailHref:S}),o().createElement("div",{className:"gn-card-grid-pagination featured-list"},o().createElement(p.Z,{size:"sm",onClick:function(){return g("previous",H)},disabled:!v||a,"aria-hidden":"true"},o().createElement(m.Z,{style:A,name:"caret-left"})),o().createElement("div",null,a&&o().createElement(y.Z,{size:"sm",animation:"border",role:"status"},o().createElement("span",{className:"sr-only"},"Loading..."))),o().createElement(p.Z,{size:"sm",onClick:function(){return g("next",H)},disabled:!c||a,"aria-hidden":"true"},o().createElement(m.Z,{style:k,name:"caret-right"})))))))}));S.defaultProps={page:1,resources:[],isNextPageAvailable:!1,loading:!1,formatHref:function(){return"#"},isCardActive:function(){return!1},isPreviousPageAvailable:!1,onLoad:function(){}};const _=S;var H=r(877593),R=r(653488),k=r(452992),A=r(805207),Z=r(572036),x=r(555168),C=r(864818),T=r(18576),D=r(331869);function N(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function B(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?N(Object(r),!0).forEach((function(t){z(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):N(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function z(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var F=(0,i.connect)((0,s.P1)([R.n,function(e){var t,r;return(null==e||null===(t=e.gnsearch)||void 0===t||null===(r=t.featuredResources)||void 0===r?void 0:r.page)||1},function(e){var t,r;return(null==e||null===(t=e.gnsearch)||void 0===t||null===(r=t.featuredResources)||void 0===r?void 0:r.isNextPageAvailable)||!1},function(e){var t,r;return(null==e||null===(t=e.gnsearch)||void 0===t||null===(r=t.featuredResources)||void 0===r?void 0:r.isPreviousPageAvailable)||!1},function(e){var t,r;return(null==e||null===(t=e.gnsearch)||void 0===t||null===(r=t.featuredResources)||void 0===r?void 0:r.loading)||!1},k.aZ],(function(e,t,r,n,o,i){return{resources:e,page:t,isNextPageAvailable:r,isPreviousPageAvailable:n,loading:o,downloading:i}})),{loadFeaturedResources:d.Jl})(_);function I(e){var t=e.targetSelector,r=void 0===t?"":t,n=e.children,i=r?document.querySelector(r):null;return i?(0,a.createPortal)(n,i):o().createElement(o().Fragment,null,n)}var L=(0,i.connect)((0,s.P1)([function(e){var t;return null==e||null===(t=e.router)||void 0===t?void 0:t.location},function(e){var t;return(null==e||null===(t=e.gnresource)||void 0===t?void 0:t.data)||null}],(function(e,t){return{location:e,resource:t}})),{fetchFeaturedResources:d.Jl})((function(e){var t=e.location,r=e.pagePath,n=void 0===r?"":r,i=e.fetchFeaturedResources,a=e.targetSelector,c=e.resource;function u(e){return n+(0,H.nz)(B({location:t},e))}var s=l().parse(t.search,!0).query;return o().createElement(I,{targetSelector:a},o().createElement("div",{className:"gn-row gn-home-section"},o().createElement("div",{className:"gn-grid-container"},o().createElement(F,{query:s,getDetailHref:function(e){return u({query:{d:"".concat(e.pk,";").concat(e.resource_type)},replaceQuery:!0,excludeQueryKeys:[]})},formatHref:u,cardOptions:[],isCardActive:function(e){return e.pk===(null==c?void 0:c.pk)},buildHrefByTemplate:f.QH,onLoad:i,containerStyle:{minHeight:"auto"}}))))}));const M=(0,c.rx)("FeaturedResourcesGrid",{component:L,containers:{},epics:B(B(B({},C.ZP),T.ZP),D.ZP),reducers:{gnsearch:A.Z,gnresource:Z.Z,resourceservice:x.Z}})},580628:(e,t,r)=>{"use strict";r.d(t,{Z:()=>y});var n=r(124852),o=r.n(n),i=r(285331);function a(e){return(a="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function c(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function u(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function l(e,t,r){return t&&u(e.prototype,t),r&&u(e,r),e}function s(e,t){return!t||"object"!==a(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function f(e){return(f=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function d(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&p(e,t)}function p(e,t){return(p=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}const y=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{handleWidth:!0,handleHeight:!0};return function(r){function n(){return c(this,n),s(this,f(n).apply(this,arguments))}return d(n,r),l(n,[{key:"render",value:function(){return o().createElement(i.Z,t,o().createElement(e,this.props))}}]),n}(n.Component)}}}]);