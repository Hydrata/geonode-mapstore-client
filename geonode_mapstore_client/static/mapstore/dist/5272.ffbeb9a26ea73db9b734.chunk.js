(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[5272],{80416:(e,t,r)=>{"use strict";r.d(t,{yS:()=>n,Zz:()=>o,ms:()=>i,ih:()=>a,OX:()=>u,sb:()=>l,K$:()=>c,k7:()=>p,cX:()=>s,x9:()=>f,vs:()=>y,oE:()=>d,Po:()=>b,qv:()=>h,cI:()=>g,g6:()=>m,I4:()=>v,l$:()=>O,Xv:()=>E,k3:()=>_,CQ:()=>R,R8:()=>P,HN:()=>S,sH:()=>j,c7:()=>w,_7:()=>x,eF:()=>L,O6:()=>A,ED:()=>T,RP:()=>C,sF:()=>M,VP:()=>G,He:()=>D,vO:()=>I,WO:()=>N,bh:()=>k,pV:()=>Y,MK:()=>H,ZF:()=>F,tV:()=>U,Dv:()=>B,Yz:()=>W,kI:()=>V,XG:()=>z,A4:()=>J,Rp:()=>Z,ct:()=>X,oh:()=>$,$h:()=>q,ud:()=>K,Qr:()=>Q,LR:()=>ee,nN:()=>te,UG:()=>re,F5:()=>ne,c9:()=>oe,Jh:()=>ie,Xy:()=>ae});var n="CHANGE_LAYER_PROPERTIES",o="LAYERS:CHANGE_LAYER_PARAMS",i="CHANGE_GROUP_PROPERTIES",a="TOGGLE_NODE",u="SORT_NODE",l="REMOVE_NODE",c="UPDATE_NODE",p="MOVE_NODE",s="LAYER_LOADING",f="LAYER_LOAD",y="LAYER_ERROR",d="ADD_LAYER",b="ADD_GROUP",h="REMOVE_LAYER",g="SHOW_SETTINGS",m="HIDE_SETTINGS",v="UPDATE_SETTINGS",O="REFRESH_LAYERS",E="LAYERS:UPDATE_LAYERS_DIMENSION",_="LAYERS_REFRESHED",R="LAYERS_REFRESH_ERROR",P="LAYERS:BROWSE_DATA",S="LAYERS:DOWNLOAD",j="LAYERS:CLEAR_LAYERS",w="LAYERS:SELECT_NODE",x="LAYERS:FILTER_LAYERS",L="LAYERS:SHOW_LAYER_METADATA",A="LAYERS:HIDE_LAYER_METADATA",T="LAYERS:UPDATE_SETTINGS_PARAMS";function C(e,t,r){return{type:g,node:e,nodeType:t,options:r}}function M(){return{type:m}}function G(e){return{type:v,options:e}}function D(e,t){return{type:n,newProperties:t,layer:e}}function I(e,t){return{type:o,layer:e,params:t}}function N(e,t){return{type:i,newProperties:t,group:e}}function k(e,t,r){return{type:a,node:e,nodeType:t,status:!r}}function Y(e){return{type:"CONTEXT_NODE",node:e}}function H(e,t){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:null;return{type:u,node:e,order:t,sortLayers:r}}function F(e,t){var r=arguments.length>2&&void 0!==arguments[2]&&arguments[2];return{type:l,node:e,nodeType:t,removeEmpty:r}}function U(e,t,r){return{type:c,node:e,nodeType:t,options:r}}function B(e,t,r){return{type:p,node:e,groupId:t,index:r}}function W(e){return{type:s,layerId:e}}function V(e,t){return{type:f,layerId:e,error:t}}function z(e,t,r){return{type:y,layerId:e,tilesCount:t,tilesErrorCount:r}}function J(e){var t=!(arguments.length>1&&void 0!==arguments[1])||arguments[1];return{type:d,layer:e,foreground:t}}function Z(e,t,r){return{type:b,group:e,parent:t,options:r}}function X(e,t){return{type:n,layer:e,newProperties:{_v_:t||(new Date).getTime()}}}function $(e){return{type:_,layers:e}}function q(e,t){return{type:R,layers:e,error:t}}function K(e,t,r,n){return{type:E,dimension:e,value:t,options:r,layers:n}}function Q(e){return{type:P,layer:e}}function ee(e){return{type:S,layer:e}}function te(){return{type:j}}function re(e,t,r){return{type:w,id:e,nodeType:t,ctrlKey:r}}function ne(e){return{type:x,text:e}}function oe(e,t){return{type:L,metadataRecord:e,maskLoading:t}}function ie(){return{type:A}}function ae(e,t){return{type:T,newParams:e,update:t}}},90079:(e,t,r)=>{"use strict";r.d(t,{Z:()=>P});var n=r(72500),o=r.n(n),i=r(80643),a=r.n(i),u=r(27418),l=r.n(u),c=r(45697),p=r.n(c),s=r(24852),f=r.n(s),y=r(33044),d=r(5346);function b(e){return(b="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function h(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function g(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function m(e,t){return(m=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function v(e,t){return!t||"object"!==b(t)&&"function"!=typeof t?O(e):t}function O(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function E(e){return(E=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function _(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var R=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&m(e,t)}(c,e);var t,r,n,i,u=(n=c,i=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=E(n);if(i){var r=E(this).constructor;e=Reflect.construct(t,arguments,r)}else e=t.apply(this,arguments);return v(this,e)});function c(){var e;h(this,c);for(var t=arguments.length,r=new Array(t),n=0;n<t;n++)r[n]=arguments[n];return _(O(e=u.call.apply(u,[this].concat(r))),"state",{error:!1}),_(O(e),"onImgError",(function(){e.setState((function(){return{error:!0}}))})),_(O(e),"getUrl",(function(e,t){if(e.layer&&"wms"===e.layer.type&&e.layer.url){var r=e.layer,n=t||a()(r.url)&&Math.floor(Math.random()*r.url.length),i=a()(r.url)?r.url[n]:r.url.replace(/[?].*$/g,""),u=o().parse(i),c=(0,y.clearNilValuesForParams)(r.params),p=l()({},{service:"WMS",request:"GetLegendGraphic",format:"image/png",height:e.legendHeight,width:e.legendWidth,layer:r.name,style:r.style||null,version:r.version||"1.3.0",SLD_VERSION:"1.1.0",LEGEND_OPTIONS:e.legendOptions},r.legendParams||{},e.language&&r.localizedLayerStyles?{LANGUAGE:e.language}:{},(0,y.addAuthenticationToSLD)(c||{},e.layer),c&&c.SLD_BODY?{SLD_BODY:c.SLD_BODY}:{},e.scales&&e.currentZoomLvl&&e.scaleDependent?{SCALE:Math.round(e.scales[e.currentZoomLvl])}:{});return(0,y.addAuthenticationParameter)(i,p),o().format({host:u.host,protocol:u.protocol,pathname:u.pathname,query:p})}return""})),_(O(e),"validateImg",(function(t){t.height<=1&&t.width<=2&&e.onImgError()})),e}return t=c,(r=[{key:"UNSAFE_componentWillReceiveProps",value:function(e){this.state.error&&this.getUrl(e,0)!==this.getUrl(this.props,0)&&this.setState((function(){return{error:!1}}))}},{key:"render",value:function(){var e=this;return!this.state.error&&this.props.layer&&"wms"===this.props.layer.type&&this.props.layer.url?f().createElement("img",{onError:this.onImgError,onLoad:function(t){return e.validateImg(t.target)},src:this.getUrl(this.props),style:this.props.style}):f().createElement(d.Z,{msgId:"layerProperties.legenderror"})}}])&&g(t.prototype,r),c}(f().Component);_(R,"propTypes",{layer:p().object,legendHeight:p().number,legendWidth:p().number,legendOptions:p().string,style:p().object,currentZoomLvl:p().number,scales:p().array,scaleDependent:p().bool,language:p().string}),_(R,"defaultProps",{legendHeight:12,legendWidth:12,legendOptions:"forceLabels:on",style:{maxWidth:"100%"},scaleDependent:!0});const P=R},61070:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>be});var n=r(22843),o=r(68038);function i(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function a(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?i(Object(r),!0).forEach((function(t){u(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):i(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function u(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var l=r(24852),c=r.n(l),p=r(71703),s=r(80416);function f(e){return(f="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function y(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function d(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?y(Object(r),!0).forEach((function(t){v(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):y(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function b(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function h(e,t){return(h=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function g(e,t){return!t||"object"!==f(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function m(e){return(m=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function v(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}r(7169);var O=r(45697),E=r(85552),_={borderBottom:"1px solid #ffffffad",paddingLeft:"5px",margin:0},R={display:"inline-block",verticalAlign:"middle"},P={background:"#ffffff",borderRadius:"3px",margin:"5px",marginRight:"20px",color:"limegreen",fontSize:"10px"},S={whiteSpace:"nowrap",paddingLeft:"3px"},j=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&h(e,t)}(a,e);var t,r,n,o,i=(n=a,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=m(n);if(o){var r=m(this).constructor;e=Reflect.construct(t,arguments,r)}else e=t.apply(this,arguments);return g(this,e)});function a(e){var t;return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,a),(t=i.call(this,e)).state={isVisible:!0},t}return t=a,(r=[{key:"render",value:function(){var e,t,r,n=this;return this.props.thisLayer?c().createElement("div",{className:"row",style:d({},_)},c().createElement("div",{className:"btn-group inline pull-left",style:d({},R)},c().createElement("div",{className:"btn glyphicon "+(null!==(e=this.props.thisLayer)&&void 0!==e&&e.visibility?"glyphicon-ok":"glyphicon-remove"),style:d(d({},P),{},{color:null!==(t=this.props.thisLayer)&&void 0!==t&&t.visibility?"limegreen":"red"}),onClick:function(){var e,t;n.props.toggleLayer(null===(e=n.props.thisLayer)||void 0===e?void 0:e.id,null===(t=n.props.thisLayer)||void 0===t?void 0:t.visibility)}}),c().createElement("div",{className:"h5",style:S},this.props.thisLayer.title)),0===this.props.thisLayer.opacity||this.props.thisLayer.opacity?c().createElement("div",{className:"mapstore-slider dataset-transparency with-tooltip",onClick:function(e){e.stopPropagation()}},c().createElement(E,{step:1,start:100*(null===(r=this.props.thisLayer)||void 0===r?void 0:r.opacity),range:{min:0,max:100},onChange:function(e){var t;n.props.setOpacity(null===(t=n.props.thisLayer)||void 0===t?void 0:t.id,e)}})):null):c().createElement("div",{className:"row",style:d({},_)},c().createElement("div",{className:"btn-group inline pull-left",style:d({},R)},c().createElement("div",{className:"h5",style:S},"No datasets here yet...")))}}])&&b(t.prototype,r),a}(c().Component);v(j,"propTypes",{thisLayer:O.array,dataset:O.object,toggleLayer:O.func,setOpacity:O.func,layer:O.object});var w=(0,p.connect)((function(e,t){var r;return{thisLayer:t.layer?t.layer:null==e||null===(r=e.layers)||void 0===r?void 0:r.flat.filter((function(e){var r;return(null==e?void 0:e.id)===(null===(r=t.dataset)||void 0===r?void 0:r.layer)}))[0]}}),(function(e){return{toggleLayer:function(t,r){return e((0,s.He)(t,{visibility:!r}))},setOpacity:function(t,r){return e((0,s.He)(t,{opacity:.01*parseFloat(r)}))}}}))(j);function x(e){return(x="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function L(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function A(e,t){return(A=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function T(e,t){return!t||"object"!==x(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function C(e){return(C=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}var M,G,D,I=r(45697),N={borderTop:"1px solid #ffffffad"},k=function(e){var t;return null==e||null===(t=e.projectManager)||void 0===t?void 0:t.openMenuGroup},Y=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&A(e,t)}(a,e);var t,r,n,o,i=(n=a,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=C(n);if(o){var r=C(this).constructor;e=Reflect.construct(t,arguments,r)}else e=t.apply(this,arguments);return T(this,e)});function a(e){return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,a),i.call(this,e)}return t=a,(r=[{key:"render",value:function(){var e,t;return"basemaps"===this.props.openMenuGroup.id_label?c().createElement("div",{style:N},this.props.baseMaps.map((function(e){return c().createElement(w,{layer:e})}))):0===(null===(e=this.props.menuDatasets)||void 0===e?void 0:e.length)?c().createElement("div",{style:N},c().createElement(w,{dataset:null})):c().createElement("div",{style:N},null===(t=this.props.menuDatasets)||void 0===t?void 0:t.map((function(e){return c().createElement(w,{dataset:e})})))}}])&&L(t.prototype,r),a}(c().Component);M=Y,G="propTypes",D={menuDatasets:I.array,openMenuGroup:I.string,baseMaps:I.array},G in M?Object.defineProperty(M,G,{value:D,enumerable:!0,configurable:!0,writable:!0}):M[G]=D;var H=(0,p.connect)((function(e){var t,r,n;return{openMenuGroup:k(e),menuDatasets:null==e||null===(t=e.projectManager)||void 0===t||null===(r=t.data)||void 0===r?void 0:r.dataset_set.filter((function(t){var r,n;return(null==t||null===(r=t.mapstore_menu_group)||void 0===r?void 0:r.id_label)===(null===(n=k(e))||void 0===n?void 0:n.id_label)})),baseMaps:null==e||null===(n=e.layers)||void 0===n?void 0:n.flat.filter((function(e){return"background"===e.group}))}}),(function(e){return{setMenuGroup:function(t){return e((0,o.setMenuGroup)(t))}}}))(Y),F=r(90079);function U(e){return(U="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function B(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function W(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?B(Object(r),!0).forEach((function(t){V(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):B(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function V(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function z(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function J(e,t){return(J=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function Z(e,t){return!t||"object"!==U(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function X(e){return(X=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}var $={position:"absolute",zIndex:1021,top:"10px",right:"60px",minWidth:"400px",backgroundColor:"rgba(0,60,136,0.6)",borderColor:"rgb(255 255 255 / 70%)",borderWidth:"2px",paddingBottom:"10px",fontSize:"12px",lineHeight:"1.5",borderRadius:"4px",color:"white",textAlign:"right",overflowY:"auto",overflowX:"hidden",maxHeight:"92%"},q={position:"absolute",zIndex:1021,top:"10px",right:"60px",minWidth:"135px",backgroundColor:"rgba(0,60,136,0.5)",borderColor:"rgb(255 255 255 / 70%)",borderWidth:"2px",padding:"5px 10px",fontSize:"12px",lineHeight:"1.5",borderRadius:"4px",color:"white",textAlign:"center"},K=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&J(e,t)}(a,e);var t,r,n,o,i=(n=a,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=X(n);if(o){var r=X(this).constructor;e=Reflect.construct(t,arguments,r)}else e=t.apply(this,arguments);return Z(this,e)});function a(e){var t;return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,a),(t=i.call(this,e)).state={showLegend:!1},t}return t=a,(r=[{key:"render",value:function(){var e=this;return this.state.showLegend?c().createElement("div",{style:$},c().createElement("div",{className:"row"},c().createElement("h4",{style:{textAlign:"center"}},"Legend")),c().createElement("span",{className:"btn glyphicon glyphicon-remove",style:{position:"absolute",right:"0px",color:"red"},onClick:function(){return e.setState({showLegend:!e.state.showLegend})}}),this.props.visibleLayers.map((function(e){return"wms"===e.type?c().createElement("div",{key:e.id,className:"row",style:{padding:"10px",margin:"-1px 10px -1px 10px",border:"2px solid #ffffffad",borderRadius:"3px"}},c().createElement("div",{className:"col-sm-6",style:{backgroundColor:"white",padding:"3px",borderRadius:"3px"}},c().createElement(F.Z,{layer:e,legendHeight:12,legendWidth:12,legendOptions:"dpi:150",style:{display:"block",marginLeft:"auto",marginRight:"auto",maxWidth:"80%",maxHeight:"auto"}})),c().createElement("div",{className:"col-sm-6"},c().createElement("span",{className:"h4 pull-left",style:{textAlign:"left"}},e.title))):null}))):c().createElement("div",null,c().createElement("button",{style:W({},q),onClick:function(){return e.setState({showLegend:!e.state.showLegend})}},"Show Legend"))}}])&&z(t.prototype,r),a}(c().Component);const Q=(0,p.connect)((function(e){var t,r;return{visibleLayers:null==e||null===(t=e.layers)||void 0===t?void 0:t.flat.filter((function(e){return!0===e.visibility})),openLegendPanel:null==e||null===(r=e.projectManager)||void 0===r?void 0:r.openLegendPanel}}),null)(K);function ee(e){return(ee="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function te(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function re(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?te(Object(r),!0).forEach((function(t){ue(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):te(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function ne(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function oe(e,t){return(oe=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function ie(e,t){return!t||"object"!==ee(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function ae(e){return(ae=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function ue(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var le=r(45697),ce=r(827).mapIdSelector,pe=function(e){var t,r;return(null==e||null===(t=e.projectManager)||void 0===t||null===(r=t.data)||void 0===r?void 0:r.map_store_menu_groups)||[]},se={position:"absolute",zIndex:1021,top:"85px",left:"20px",minWidth:"400px",backgroundColor:"rgba(0,60,136,0.6)",borderColor:"rgb(255 255 255 / 70%)",borderWidth:"2px",padding:"5px 10px",fontSize:"12px",lineHeight:"1.5",borderRadius:"4px",color:"white",textAlign:"center"},fe={position:"absolute",zIndex:1021,top:11,width:"85px",height:"60px",backgroundColor:"rgba(0,60,136,0.5)",borderColor:"rgb(255 255 255 / 70%)",borderWidth:"2px",padding:"3px 5px",fontSize:"12px",lineHeight:"1.3",borderRadius:"4px",color:"white",textAlign:"center"},ye=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&oe(e,t)}(a,e);var t,r,n,o,i=(n=a,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=ae(n);if(o){var r=ae(this).constructor;e=Reflect.construct(t,arguments,r)}else e=t.apply(this,arguments);return ie(this,e)});function a(e){return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,a),i.call(this,e)}return t=a,(r=[{key:"componentDidUpdate",value:function(){this.props.mapId||this.fetching||(this.fetching=!1),!this.props.mapId||this.props.hasPmData||this.fetching||(this.props.fetchProjectManagerConfig(this.props.mapId),this.fetching=!0),this.props.mapId&&this.props.hasPmData&&(this.fetching=!1)}},{key:"render",value:function(){var e=this;return c().createElement("div",{id:"project-manager-container"},c().createElement("div",null,c().createElement("ul",{className:"menu-groups"},c().createElement("button",{key:"basemaps",style:re(re({},fe),{},{left:20}),onClick:function(){e.props.setMenuGroup(e.props.baseMapMenuGroup)}},"BaseMaps"),this.props.menuGroups&&this.props.menuGroups.length&&this.props.menuGroups.map((function(t,r){return c().createElement("button",{key:t.title,style:re(re({},fe),{},{left:100*(r+1)+20}),onClick:function(){e.props.setMenuGroup(t)}},t.title)})))),function(){var t;switch(null===(t=e.props)||void 0===t?void 0:t.openMenuGroup){case null:case void 0:return null;case"app_scenario":return c().createElement("div",{id:"app-scenario-empty-div"});default:return c().createElement("div",{style:re({},se)},c().createElement(H,null))}}(),c().createElement(Q,null))}}])&&ne(t.prototype,r),a}(c().Component);ue(ye,"propTypes",{fetchProjectManagerConfig:le.func,menuGroups:le.array,baseMapMenuGroup:le.object,mapId:le.number,layers:le.array,projectTitle:le.string,isFetching:le.bool,hasPmData:le.object,openMenuGroup:le.string,setMenuGroup:le.func,menu:le.object}),ue(ye,"defaultProps",{fetchProjectManagerConfig:function(){}});const de=(0,p.connect)((function(e){var t,r,n,o,i,a,u;return{mapId:ce(e),layers:null==e||null===(t=e.layers)||void 0===t?void 0:t.flat.map((function(e){return e.name})),menuGroups:pe(e),baseMapMenuGroup:{id:0,id_label:"basemaps",title:"Base Maps"},projectTitle:null==e||null===(r=e.projectManager)||void 0===r||null===(n=r.data)||void 0===n?void 0:n.title,isFetching:null==e||null===(o=e.projectManager)||void 0===o?void 0:o.fetching,hasPmData:null==e||null===(i=e.projectManager)||void 0===i?void 0:i.data,openMenuGroup:null==e||null===(a=e.projectManager)||void 0===a||null===(u=a.openMenuGroup)||void 0===u?void 0:u.id_label}}),(function(e){return{fetchProjectManagerConfig:(0,o.fetchProjectManagerConfig)(e),setMenuGroup:function(t){return e((0,o.setMenuGroup)(t))}}}))(ye),be=(0,n.rx)("ProjectManager",{component:de,reducers:{projectManager:function(){var e,t,r,n,i=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},u=arguments.length>1?arguments[1]:void 0;switch(u.type){case o.FETCH_PROJECT_MANAGER_CONFIG:return a(a({},i),{},{fetching:u.mapId});case o.FETCH_PROJECT_MANAGER_CONFIG_SUCCESS:return a(a({},i),{},{fetching:null,data:u.payload});case o.SET_MENU_GROUP:return(null===(e=i.openMenuGroup)||void 0===e?void 0:e.id_label)===(null===(t=u.payload)||void 0===t?void 0:t.id_label)?a(a({},i),{},{openMenuGroup:null}):a(a({},i),{},{openMenuGroup:u.payload});case o.SET_ORG_VISIBILITY:return a(a({},i),{},{data:a(a({},i.data),{},{organisations:null==i||null===(r=i.data)||void 0===r||null===(n=r.organisations)||void 0===n?void 0:n.map((function(e){return e.id===u.org.id?a(a({},e),{},{visibility:u.isVisible}):e}))})});default:return i}}}})},68038:(e,t,r)=>{var n=r(75875),o="FETCH_PROJECT_MANAGER_CONFIG_ERROR",i="FETCH_PROJECT_MANAGER_CONFIG_SUCCESS",a="SET_MENU_GROUP",u=function(e){return{type:i,payload:e}};function l(e){return console.log("*** error:",e),{type:o,error:e}}e.exports={FETCH_PROJECT_MANAGER_CONFIG:"FETCH_PROJECT_MANAGER_CONFIG",fetchProjectManagerConfig:function(e){return function(t){return n.get("/projects/api/maps/".concat(t,"/")).then((function(t){e(u(t.data.project))})).catch((function(t){e(l(t))}))}},FETCH_PROJECT_MANAGER_CONFIG_ERROR:o,fetchProjectManagerConfigError:l,FETCH_PROJECT_MANAGER_CONFIG_SUCCESS:i,fetchProjectManagerConfigSuccess:u,SET_MENU_GROUP:a,setMenuGroup:function(e){return{type:a,payload:e}},SET_ORG_VISIBILITY:"SET_ORG_VISIBILITY",setOrgVisibility:function(e,t){return console.log("setOrgVisibility:",e,t),function(r){r({type:"SET_ORG_VISIBILITY",org:e,isVisible:t})}}}},83918:(e,t,r)=>{(e.exports=r(9252)()).push([e.id,".msgapi .project-manager-panel {\r\n    position: absolute;\r\n    z-index: 1021;\r\n    top: 50px;\r\n    left: 20px;\r\n    min-width: 400px;\r\n    background-color: rgba(0, 60, 136, 0.6);\r\n    border-color: rgba(255, 255, 255, 0.7);\r\n    border-width: 2px;\r\n    padding: 5px 10px;\r\n    font-size: 12px;\r\n    line-height: 1.5;\r\n    border-radius: 4px;\r\n    color: white;\r\n    text-align: center\r\n}\r\n\r\n.msgapi .dataset-transparency {\r\n    margin-left: 280px;\r\n    margin-top: 15px;\r\n}\r\n\r\n.msgapi .mapstore-slider.with-tooltip.dataset-transparency .noUi-target.noUi-horizontal .noUi-base .noUi-origin .noUi-handle {\r\n    width: 20px;\r\n    left: -10px;\r\n    border: 2px solid #dddddd;\r\n    border-radius: 10px;\r\n    cursor: default;\r\n}\r\n\r\n.msgapi .mapstore-slider.with-tooltip.dataset-transparency .noUi-target {\r\n    box-shadow: none;\r\n    border: 1px solid rgba(255, 255, 255, 0.68);\r\n    background-color: #335781;\r\n}\r\n",""])},7169:(e,t,r)=>{var n=r(83918);"string"==typeof n&&(n=[[e.id,n,""]]),r(14246)(n,{}),n.locals&&(e.exports=n.locals)}}]);