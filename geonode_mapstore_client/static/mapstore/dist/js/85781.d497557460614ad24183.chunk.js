(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[85781],{881808:(e,t,r)=>{"use strict";r.d(t,{eD:()=>n,AM:()=>o,ok:()=>i,Gg:()=>u,nT:()=>a,TL:()=>c,KS:()=>p,EB:()=>f,DZ:()=>l,Aw:()=>y,V_:()=>s,H0:()=>b,jW:()=>d,JZ:()=>O,fQ:()=>m,HK:()=>v,YO:()=>E,I6:()=>g});var n="MAP:LOAD_NEW_MAP",o="MAP_LOAD_MAP_CONFIG",i="MAP_CONFIG_LOADED",u="MAP_CONFIG_LOAD_ERROR",a="MAP_LOAD_INFO",c="MAP_INFO_LOAD_START",p="MAP_INFO_LOADED",f="MAP_INFO_LOAD_ERROR",l="MAP:MAP_SAVE_ERROR",y="MAP:MAP_SAVED",s="MAP:RESET_MAP_SAVE_ERROR";function b(e,t,r){return{type:i,config:e,legacy:!!t,mapId:t,zoomToExtent:r}}function d(e,t){return{type:u,error:e,mapId:t}}function O(e,t,r,n,i){return{type:o,configName:e,mapId:t,config:r,mapInfo:n,overrideConfig:i}}function m(e,t){return{type:p,mapId:t,info:e}}function v(e,t){return{type:f,mapId:e,error:t}}function E(e){return{type:c,mapId:e}}function g(e){return{type:a,mapId:e}}},580416:(e,t,r)=>{"use strict";r.d(t,{yS:()=>n,Zz:()=>o,ms:()=>i,ih:()=>u,OX:()=>c,sb:()=>p,K$:()=>f,k7:()=>l,cX:()=>y,x9:()=>s,vs:()=>b,oE:()=>d,Po:()=>O,qv:()=>m,cI:()=>v,g6:()=>E,I4:()=>g,l$:()=>A,Xv:()=>S,k3:()=>P,CQ:()=>R,R8:()=>_,HN:()=>h,sH:()=>L,c7:()=>D,_7:()=>w,eF:()=>T,O6:()=>j,ED:()=>I,RP:()=>M,sF:()=>k,VP:()=>N,He:()=>C,vO:()=>Y,WO:()=>F,bh:()=>H,pV:()=>G,MK:()=>U,ZF:()=>V,tV:()=>B,Dv:()=>W,Yz:()=>Z,kI:()=>z,XG:()=>X,A4:()=>$,Rp:()=>x,$o:()=>J,ct:()=>K,oZ:()=>q,oh:()=>Q,$h:()=>ee,ud:()=>te,Qr:()=>re,LR:()=>ne,nN:()=>oe,UG:()=>ie,F5:()=>ue,c9:()=>ae,Jh:()=>ce,Xy:()=>pe});var n="CHANGE_LAYER_PROPERTIES",o="LAYERS:CHANGE_LAYER_PARAMS",i="CHANGE_GROUP_PROPERTIES",u="TOGGLE_NODE",a="CONTEXT_NODE",c="SORT_NODE",p="REMOVE_NODE",f="UPDATE_NODE",l="MOVE_NODE",y="LAYER_LOADING",s="LAYER_LOAD",b="LAYER_ERROR",d="ADD_LAYER",O="ADD_GROUP",m="REMOVE_LAYER",v="SHOW_SETTINGS",E="HIDE_SETTINGS",g="UPDATE_SETTINGS",A="REFRESH_LAYERS",S="LAYERS:UPDATE_LAYERS_DIMENSION",P="LAYERS_REFRESHED",R="LAYERS_REFRESH_ERROR",_="LAYERS:BROWSE_DATA",h="LAYERS:DOWNLOAD",L="LAYERS:CLEAR_LAYERS",D="LAYERS:SELECT_NODE",w="LAYERS:FILTER_LAYERS",T="LAYERS:SHOW_LAYER_METADATA",j="LAYERS:HIDE_LAYER_METADATA",I="LAYERS:UPDATE_SETTINGS_PARAMS";function M(e,t,r){return{type:v,node:e,nodeType:t,options:r}}function k(){return{type:E}}function N(e){return{type:g,options:e}}function C(e,t){return{type:n,newProperties:t,layer:e}}function Y(e,t){return{type:o,layer:e,params:t}}function F(e,t){return{type:i,newProperties:t,group:e}}function H(e,t,r){return{type:u,node:e,nodeType:t,status:!r}}function G(e){return{type:a,node:e}}function U(e,t){return{type:c,node:e,order:t,sortLayers:arguments.length>2&&void 0!==arguments[2]?arguments[2]:null}}function V(e,t){return{type:p,node:e,nodeType:t,removeEmpty:arguments.length>2&&void 0!==arguments[2]&&arguments[2]}}function B(e,t,r){return{type:f,node:e,nodeType:t,options:r}}function W(e,t,r){return{type:l,node:e,groupId:t,index:r}}function Z(e){return{type:y,layerId:e}}function z(e,t){return{type:s,layerId:e,error:t}}function X(e,t,r){return{type:b,layerId:e,tilesCount:t,tilesErrorCount:r}}function $(e){return{type:d,layer:e,foreground:!(arguments.length>1&&void 0!==arguments[1])||arguments[1]}}function x(e,t,r){return{type:O,group:e,parent:t,options:r}}function J(e){return{type:m,layerId:e}}function K(e,t){return{type:n,layer:e,newProperties:{_v_:t||(new Date).getTime()}}}function q(e,t){return{type:A,layers:e,options:t}}function Q(e){return{type:P,layers:e}}function ee(e,t){return{type:R,layers:e,error:t}}function te(e,t,r,n){return{type:S,dimension:e,value:t,options:r,layers:n}}function re(e){return{type:_,layer:e}}function ne(e){return{type:h,layer:e}}function oe(){return{type:L}}function ie(e,t,r){return{type:D,id:e,nodeType:t,ctrlKey:r}}function ue(e){return{type:w,text:e}}function ae(e,t){return{type:T,metadataRecord:e,maskLoading:t}}function ce(){return{type:j}}function pe(e,t){return{type:I,newParams:e,update:t}}},879504:(e,t,r)=>{"use strict";r.d(t,{Z:()=>A});var n=r(49977),o=r.n(n),i=r(91175),u=r.n(i),a=r(53001),c=r(782904),p=r(881808),f=r(931273),l=r(580416),y=r(675110),s=r(31935),b=r(680833),d=r(624262);function O(e){return O="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},O(e)}function m(e){return function(e){if(Array.isArray(e))return v(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||function(e,t){if(e){if("string"==typeof e)return v(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?v(e,t):void 0}}(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function v(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}function E(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function g(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?E(Object(r),!0).forEach((function(t){var n,o,i,u;n=e,o=t,i=r[t],u=function(e,t){if("object"!=O(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=O(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(o),(o="symbol"==O(u)?u:u+"")in n?Object.defineProperty(n,o,{value:i,enumerable:!0,configurable:!0,writable:!0}):n[o]=i})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):E(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}const A={accessMetadataExplorer:function(e){return e.ofType(a.xT).switchMap((function(){return o().Observable.of((0,c.Xg)("metadataexplorer","enabled",!0),(0,a.vw)(!1),(0,f.Dw)("default_map_backgrounds"))}))},addBackgroundPropertiesEpic:function(e){return e.ofType(a.oQ).switchMap((function(e){var t=e.modalParams,r=o().Observable.of((0,a.$c)(g(g({},t),{},{loading:!1})));return t.layer&&"wms"===t.layer.type?o().Observable.of((0,a.$c)(g(g({},t),{},{loading:!0}))).concat((0,b.kB)(t.layer).switchMap((function(e){return o().Observable.of((0,a.$c)(g(g({},t),{},{loading:!1,capabilities:(0,d.IA)(e)})))})).catch((function(){return r}))):r}))},backgroundsListInit:function(e){return e.ofType(p.ok).switchMap((function(e){var t,r=e.config,n=r.map&&r.map.backgrounds||[],i=(r.map&&r.map.layers||[]).filter((function(e){return"background"===e.group})),c=n.filter((function(e){return!!e.thumbnail})).map((function(e){return(0,l.He)(e.id,{thumbURL:function(e){for(var t=atob(e.split(",")[1]),r=e.split(",")[0].split(":")[1].split(";")[0],n=new ArrayBuffer(t.length),o=new Uint8Array(n),i=0;i<t.length;++i)o[i]=t.charCodeAt(i);return URL.createObjectURL(new Blob([n],{type:r}))}(e.thumbnail)})})),p=u()(i.filter((function(e){return e.visibility})));return(t=o().Observable).of.apply(t,m(c.concat((0,a.M3)(n))).concat(m(p?[(0,a.ke)(p.id)]:[])))}))},setCurrentBackgroundLayerEpic:function(e,t){return e.ofType(a.Wv).switchMap((function(e){var r,n=e.layerId,i=t.getState(),u=(0,y.CA)(i,n);return(r=o().Observable).of.apply(r,m(u&&"background"===u.group?[(0,c.Xg)("backgroundSelector","tempLayer",u),(0,c.Xg)("backgroundSelector","currentLayer",u)]:[]))}))},backgroundAddedEpic:function(e,t){return e.ofType(a.gC).mergeMap((function(e){var r=e.layerId,n=t.getState(),i=(0,y.CA)(n,r);return i?o().Observable.of((0,l.He)(i.id,{visibility:!0}),(0,a.ke)(i.id),(0,a.V3)()):o().Observable.empty()}))},backgroundEditedEpic:function(e,t){return e.ofType(a.dG).mergeMap((function(e){var r=e.layerId,n=t.getState();return(0,y.CA)(n,r)?o().Observable.of((0,a.V3)()):o().Observable.empty()}))},backgroundRemovedEpic:function(e,t){return e.ofType(a.H_).mergeMap((function(e){var r=e.backgroundId,n=t.getState(),i=(0,y.CA)(n,r),c=(0,s.TP)(n)||[],p=(0,y.DP)(n)||{},f=r===p.id?u()(c.filter((function(e){return e.id!==r&&!e.invalid}))):p;return i?o().Observable.of((0,l.ZF)(r,"layers"),(0,l.He)(f.id,{visibility:!0}),(0,a.ke)(f.id)):o().Observable.empty()}))},syncSelectedBackgroundEpic:function(e){return e.ofType(a.K2).take(1).switchMap((function(t){var r=t.id;return e.ofType(l.oE).filter((function(e){return e.layer.id===r})).switchMap((function(){return o().Observable.of((0,a.pW)(r))})).takeUntil(e.ofType(a.gC))}))}}},680833:(e,t,r)=>{"use strict";r.d(t,{kB:()=>O,HI:()=>m});var n=r(472500),o=r.n(n),i=(r(91175),r(490173)),u=r(49977),a=r(501157),c=r(375875),p=r.n(c),f=(r(986267),r(624262)),l=r(510284),y=r(233044);function s(e){return s="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},s(e)}function b(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function d(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?b(Object(r),!0).forEach((function(t){var n,o,i,u;n=e,o=t,i=r[t],u=function(e,t){if("object"!=s(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=s(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(o),(o="symbol"==s(u)?u:u+"")in n?Object.defineProperty(n,o,{value:i,enumerable:!0,configurable:!0,writable:!0}):n[o]=i})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):b(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}i.default;var O=function(e){return u.Observable.defer((function(){return a.ZP.getCapabilities((0,f.Fh)(e))})).let(l.oB).map((function(t){return a.ZP.parseLayerCapabilities(t,e)}))},m=function(e){return function(e){return u.Observable.defer((function(){return p().get(function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.name,r=e.search,n=void 0===r?{}:r,i=e.url,u=o().parse(n.url||i,!0);return o().format(d(d({},u),{},{search:void 0,query:d(d({},u.query),{},{service:"WMS",version:"1.1.1",layers:t,outputFormat:"application/json",request:"DescribeLayer"})}))}(e))})).let(l.oB)}(e).map((function(e){var t=e.data,r=void 0===t?{}:t;return r&&r.layerDescriptions[0]})).map((function(){var t=(arguments.length>0&&void 0!==arguments[0]?arguments[0]:{}).owsURL;return d(d({},e),{},{params:{},search:t?{type:"wfs",url:(0,y.cleanAuthParamsFromURL)(t)}:void 0})}))}},55105:(e,t,r)=>{"use strict";r.d(t,{Ss:()=>b,Nr:()=>d,ic:()=>m,Jz:()=>v,VM:()=>E,CF:()=>g,Ju:()=>A});var n=r(91175),o=r.n(n),i=r(288306),u=r.n(i),a=r(800827),c=r(552259),p=r(737275);function f(e){return f="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},f(e)}function l(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function y(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?l(Object(r),!0).forEach((function(t){s(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):l(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function s(e,t,r){var n;return n=function(e,t){if("object"!=f(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=f(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(t),(t="symbol"==f(n)?n:n+"")in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var b=function(e){return e.maplayout&&e.maplayout.layout||{}},d=function(e){return e.maplayout&&e.maplayout.boundingMapRect||{}},O=function(e){return e.maplayout&&e.maplayout.boundingSidebarRect||{}},m=u()((function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},r=arguments.length>2&&void 0!==arguments[2]&&arguments[2],n=b(e),o=O(e);return n&&Object.keys(n).filter((function(e){return t[e]})).reduce((function(e,t){var i;return y(y({},e),{},s({},t,r&&null!==(i=o[t])&&void 0!==i?i:n[t]))}),{})||{}}),(function(e,t,r){return JSON.stringify(b(e))+JSON.stringify(O(e))+JSON.stringify(t)+(r?"_isDock":"")})),v=function(e){var t;return!(null===(t=b(e))||void 0===t||!t.rightPanel)},E=function(e){var t,r=p.ZP.getConfigProp("mapLayout")||c.DEFAULT_MAP_LAYOUT;return function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:[],r=b(e);return!!o()(t.filter((function(e){return r[e.key]})).map((function(e){return"not"===e.type?r[e.key]!==e.value&&r[e.key]:r[e.key]===e.value})))}(e,[{key:"bottom",value:null!==(t=null==r?void 0:r.bottom.sm)&&void 0!==t?t:0,type:"not"}])},g=function(e){var t=(0,a.Od)(e),r=d(e);return r&&t&&t.size&&{left:(0,c.parseLayoutValue)(r.left,t.size.width),bottom:(0,c.parseLayoutValue)(r.bottom,t.size.height),right:(0,c.parseLayoutValue)(r.right,t.size.width),top:(0,c.parseLayoutValue)(r.top,t.size.height)}},A=function(e){var t,r;return null!==(t=null==e||null===(r=e.maplayout)||void 0===r?void 0:r.dockPanels)&&void 0!==t?t:{left:[],right:[]}}}}]);