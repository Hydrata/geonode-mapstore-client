(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[95121,47310],{921914:(e,t,r)=>{"use strict";r.d(t,{XL:()=>o,km:()=>i,Ih:()=>a,Xw:()=>u,Pn:()=>c,DZ:()=>s,e8:()=>l,E0:()=>f,F9:()=>d,X_:()=>p,pb:()=>m,qb:()=>y,Re:()=>E,ih:()=>v,xy:()=>O,jL:()=>b,oz:()=>g,ph:()=>h,lF:()=>S,gG:()=>T,cb:()=>_,GI:()=>I,B1:()=>P,fv:()=>R,gc:()=>D,zX:()=>w,ZF:()=>N,Zb:()=>A,DW:()=>j,Xp:()=>C,Fm:()=>M,sV:()=>U,Mn:()=>G,LU:()=>F,XP:()=>L,WU:()=>Z,JB:()=>x,g:()=>k,ws:()=>H,HP:()=>Y,aN:()=>q,Pg:()=>W,u0:()=>V,TM:()=>X,PM:()=>$,lK:()=>Q,sv:()=>z,MO:()=>K,oO:()=>J,Mc:()=>ee,Zw:()=>te,RA:()=>re,am:()=>ne,ZM:()=>oe,wm:()=>ie,Y$:()=>ae,Qu:()=>ue,kT:()=>ce});var n=r(647310),o="LOAD_FEATURE_INFO",i="ERROR_FEATURE_INFO",a="EXCEPTIONS_FEATURE_INFO",u="CHANGE_MAPINFO_STATE",c="NEW_MAPINFO_REQUEST",s="PURGE_MAPINFO_RESULTS",l="CHANGE_MAPINFO_FORMAT",f="SHOW_MAPINFO_MARKER",d="HIDE_MAPINFO_MARKER",p="SHOW_REVERSE_GEOCODE",m="HIDE_REVERSE_GEOCODE",y="GET_VECTOR_INFO",E="NO_QUERYABLE_LAYERS",v="CLEAR_WARNING",O="FEATURE_INFO_CLICK",b="IDENTIFY:UPDATE_FEATURE_INFO_CLICK_POINT",g="IDENTIFY:TOGGLE_HIGHLIGHT_FEATURE",h="TOGGLE_MAPINFO_STATE",S="UPDATE_CENTER_TO_MARKER",T="IDENTIFY:CHANGE_PAGE",_="IDENTIFY:CLOSE_IDENTIFY",I="IDENTIFY:CHANGE_FORMAT",P="IDENTIFY:TOGGLE_SHOW_COORD_EDITOR",R="IDENTIFY:EDIT_LAYER_FEATURES",D="IDENTIFY:CURRENT_EDIT_FEATURE_QUERY",w="IDENTIFY:SET_MAP_TRIGGER",N="IDENTIFY:TOGGLE_EMPTY_MESSAGE_GFI",A="IDENTIFY:SET_SHOW_IN_MAP_POPUP",j="IDENTIFY:IDENTIFY_IS_MOUNTED",C="IDENTIFY:INIT_PLUGIN";function M(e,t,r,n,i){return{type:o,data:t,reqId:e,requestParams:r,layerMetadata:n,layer:i}}function U(e,t,r,n){return{type:i,error:t,reqId:e,requestParams:r,layerMetadata:n}}function G(e,t,r,n){return{type:a,reqId:e,exceptions:t,requestParams:r,layerMetadata:n}}function F(){return{type:E}}function L(){return{type:v}}function Z(e,t){return{type:c,reqId:e,request:t}}function x(e,t,r,n){return{type:y,layer:e,request:t,metadata:r,queryableLayers:n}}function k(){return{type:s}}function H(e){return{type:l,infoFormat:e}}function Y(){return{type:f}}function q(){return{type:d}}function B(e){return{type:p,reverseGeocodeData:e.data}}function W(e){return function(t){n.Z.reverseGeocode(e).then((function(e){t(B(e))})).catch((function(e){t(B(e))}))}}function V(){return{type:m}}function X(){return{type:h}}function $(e){return{type:S,status:e}}function Q(e,t){return{type:O,point:e,layer:t,filterNameList:arguments.length>2&&void 0!==arguments[2]?arguments[2]:[],overrideParams:arguments.length>3&&void 0!==arguments[3]?arguments[3]:{},itemId:arguments.length>4&&void 0!==arguments[4]?arguments[4]:null}}function z(e){return{type:b,point:e}}function K(e){return{type:g,enabled:e}}function J(e){return{type:T,index:e}}var ee=function(){return{type:_}},te=function(e){return{type:I,format:e}},re=function(e){return{type:P,showCoordinateEditor:e}},ne=function(e){return{type:R,layer:e}},oe=function(e){return{type:D,query:e}},ie=function(e){return{type:w,trigger:e}},ae=function(e){return{type:A,value:e}},ue=function(e){return{type:j,isMounted:e}},ce=function(e){return{type:C,cfg:e}}},647310:(e,t,r)=>{"use strict";r.d(t,{Z:()=>l});var n=r(375875),o=r.n(n),i=r(531940),a=r.n(i),u=r(737295),c=r.n(u),s={format:"json",bounded:0,polygon_geojson:1,priority:5};const l={geocode:function(e,t){var r=c()({q:e},s,t||{}),n=a().format({protocol:"https",host:"nominatim.openstreetmap.org",query:r});return o().get(n)},reverseGeocode:function(e,t){var r=c()({lat:e.lat,lon:e.lng},t||{},s),n=a().format({protocol:"https",host:"nominatim.openstreetmap.org/reverse",query:r});return o().get(n)}}},925108:(e,t,r)=>{"use strict";r.d(t,{Z:()=>f});var n=r(782904),o=r(737295),i=r.n(o),a=r(921914);function u(e){return u="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},u(e)}function c(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function s(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?c(Object(r),!0).forEach((function(t){l(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):c(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function l(e,t,r){var n;return n=function(e,t){if("object"!=u(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=u(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(t),(t="symbol"==u(n)?n:String(n))in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}const f=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=arguments.length>1?arguments[1]:void 0;switch(t.type){case n.kM:var r=t.property||"enabled";return i()({},e,l({},t.control,i()({},e[t.control],l({},r,!(e[t.control]||{})[r]))));case n.At:return!0===t.toggle&&e[t.control]&&e[t.control][t.property]===t.value?i()({},e,l({},t.control,i()({},e[t.control],l({},t.property,void 0)))):i()({},e,l({},t.control,i()({},e[t.control],l({},t.property,t.value))));case n.dc:return i()({},e,l({},t.control,i()({},e[t.control],t.properties)));case n.l:var o=Object.keys(e).filter((function(e){return-1===(t.skip||[]).indexOf(e)})).reduce((function(t,r){return i()(t,l({},r,i()({},e[r],!0===e[r].enabled?{enabled:!1}:{})))}),{});return i()({},e,o);case a.DW:return s(s({},e),{},{info:s(s({},e.info),{},{available:t.isMounted})});default:return e}}},55237:(e,t,r)=>{"use strict";r.d(t,{tr:()=>h,jb:()=>S,Xu:()=>T,un:()=>_,Qn:()=>I,_q:()=>P,og:()=>R,$4:()=>D,kN:()=>w,oD:()=>N,V$:()=>A,uH:()=>j,pC:()=>C,tz:()=>M,p:()=>U});var n=r(747037),o=r.n(n),i=r(647960),a=r.n(i),u=r(227361),c=r.n(u),s=r(984596),l=r.n(s),f=r(730381),d=r.n(f),p=r(86638);function m(e){return function(e){if(Array.isArray(e))return v(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||E(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function y(e,t){return function(e){if(Array.isArray(e))return e}(e)||function(e,t){var r=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null!=r){var n,o,i,a,u=[],c=!0,s=!1;try{if(i=(r=r.call(e)).next,0===t){if(Object(r)!==r)return;c=!1}else for(;!(c=(n=i.call(r)).done)&&(u.push(n.value),u.length!==t);c=!0);}catch(e){s=!0,o=e}finally{try{if(!c&&null!=r.return&&(a=r.return(),Object(a)!==a))return}finally{if(s)throw o}}return u}}(e,t)||E(e,t)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function E(e,t){if(e){if("string"==typeof e)return v(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?v(e,t):void 0}}function v(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}var O=/PT?[\d\.]+[YMWDHMS]/,b=function(e){return e?o()(e)?new Date(e).getTime():(a()(e)&&e.getTime(),e):null},g=function(e){var t=e.start,r=e.end,n=e.duration,o=d().duration(n).asMilliseconds();return(new Date(r).getTime()-new Date(t).getTime())/o},h=function(e){for(var t=e.start,r=e.end,n=e.duration,o=d().duration(n).asMilliseconds(),i=[],a=new Date(t),u=new Date(r);a<=u;)i.push(new Date(a).toISOString()),a.setTime(a.getTime()+o);return i},S=function(e){var t=e.start,r=e.end,n=e.duration;return h({start:t,end:r,duration:n}).map((function(e){return{start:new Date(e),end:new Date(new Date(e).getTime()+d().duration(n).asMilliseconds())}}))},T=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.start,r=e.end,n=e.duration,o=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},i=o.start,a=o.end;if(!i||!a)return{count:g({start:t,end:r,duration:n}),start:t,end:r};var u=d().duration(n).asMilliseconds(),c=new Date(t).getTime(),s=new Date(r).getTime(),l=new Date(i).getTime(),f=new Date(a).getTime(),p=Math.ceil((l-c)/u),m=Math.floor((f-c)/u),y=Math.floor((s-c)/u);if(p>=0&&m<=y){var E=m-p;return{start:new Date(c+Math.max(0,p)*u),end:new Date(c+Math.min(y,m)*u),count:E}}return{count:g({start:t,end:r,duration:n}),start:t,end:r}},_=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.start,r=e.end,n=arguments.length>1?arguments[1]:void 0,o=new Date(t),i=new Date(r),a=Math.floor(i.getTime()-o.getTime())/n;return{range:{start:t,end:r},resolution:d().duration(a).toISOString().match(O)[0]}},I=function(){var e,t,r=arguments.length>1?arguments[1]:void 0,n=(e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:[],(t=arguments.length>2?arguments[2]:void 0)?e.map((function(e){var r=y(e.split("/"),2);return{start:r[0],end:r[1]}[t]})):e);return n[function(e,t){var r=b(t),n=1/0,o=-1;return e.forEach((function(e,t){var i=b(e),a=Math.abs(i-r);a<n&&(n=a,o=t)})),o}(n,r)]},P=function(e){return e&&e.indexOf&&e.indexOf("--")>0},R=function(e,t){var r=d()(e).diff(t);return{start:r>=0?t:e,end:r>=0?e:t}},D=function(e){return 6e4*e.getTimezoneOffset()},w=function(e){var t=e;!a()(e)&o()(e)&&(t=new Date(e));var r=t.getUTCHours();r=r<10?"0"+r:r;var n=t.getUTCMinutes();n=n<10?"0"+n:n;var i=t.getUTCSeconds();return i=i<10?"0"+i:i,"".concat(r,":").concat(n,":").concat(i)},N=function(e){var t=e;!a()(e)&o()(e)&&(t=new Date(e));var r=t.getUTCMonth()+1,n=t.getUTCDate();return r=r<10?"0"+r:r,n=n<10?"0"+n:n,"".concat(t.getUTCFullYear(),"-").concat(r,"-").concat(n)},A=function(e,t){var r=(0,p.mh)(e),n="HH:mm:SS";switch(t){case"time":return n;case"date":return r;default:return r+" "+n}},j=function(){var e=(arguments.length>0&&void 0!==arguments[0]?arguments[0]:{}).Domains,t=void 0===e?{}:e,r=arguments.length>1?arguments[1]:void 0,n=l()(t.DimensionDomain||[]).concat(),o=t["@version"]||t.version,i=c()(t,"SpaceDomain.BoundingBox");return i&&n.push({Identifier:"space",Domain:i}),n.map((function(e){var t=e.Identifier,n=e.Domain;return{source:{type:"multidim-extension",version:o,url:r},name:t,domain:n}}))},C=function(e,t,r){var n=b(t),o=b(r);return e.reduce((function(e,t){var r=b(t);return b(n)<r&&b(o)>r?[].concat(m(e),[t]):m(e)}),[])},M=function(e){var t=e.reduce((function(e,t){if(-1!==t.indexOf("/")){var r=y(t.split("/"),2),n=r[0],o=r[1];return[].concat(m(e),[n,o])}return[].concat(m(e),[t])}),[]).sort();return[t[0],t[t.length-1]]},U=function(e,t,r){var n=d()(e);return("add"===r?n.add(t,"seconds"):n.subtract(t,"seconds")).toISOString()}},643892:(e,t,r)=>{"use strict";r.d(t,{W:()=>n,Zf:()=>o,Eu:()=>i,Vy:()=>a,YB:()=>u,xm:()=>c,_f:()=>s,ek:()=>l,cd:()=>f,pt:()=>d,ww:()=>p,tR:()=>m,Js:()=>y,p2:()=>E,ZH:()=>v,eQ:()=>O,ql:()=>b,$X:()=>g,nS:()=>h,ih:()=>S,J5:()=>T,uA:()=>_,Pv:()=>I,_Z:()=>P,dh:()=>R,IH:()=>D,e3:()=>w,Oq:()=>N,Q$:()=>A,DF:()=>j,id:()=>C,Br:()=>M,bI:()=>U,U5:()=>G,e5:()=>F,b3:()=>L,mN:()=>Z,QN:()=>x,HV:()=>k,xe:()=>H,vA:()=>Y,gw:()=>q,qs:()=>B,CB:()=>W,vg:()=>V,Z0:()=>X,lf:()=>$,jQ:()=>Q,nk:()=>z,X7:()=>K,nO:()=>J,F4:()=>ee,EU:()=>te,Rk:()=>re,V1:()=>ne});var n="GEONODE:RESOURCE_LOADING",o="GEONODE:SET_RESOURCE",i="GEONODE:RESOURCE_ERROR",a="GEONODE:UPDATE_RESOURCE_PROPERTIES",u="GEONODE:SET_RESOURCE_TYPE",c="GEONODE:SET_NEW_RESOURCE",s="GEONODE:SET_RESOURCE_ID",l="GEONODE:SET_RESOURCE_PERMISSIONS",f="GEONODE:EDIT_TITLE_RESOURCE",d="GEONODE:EDIT_ABSTRACT_RESOURCE",p="GEONODE:EDIT_THUMBNAIL_RESOURCE",m="GEONODE:SET_FAVORITE_RESOURCE",y="GEONODE:SET_MAP_THUMBNAIL",E="GEONODE:SET_SELECTED_DATASET_PERMISSIONS",v="GEONODE:REQUEST_RESOURCE_CONFIG",O="GEONODE:REQUEST_NEW_RESOURCE_CONFIG",b="GEONODE:LOADING_RESOURCE_CONFIG",g="GEONODE:RESET_RESOURCE_STATE",h="GEONODE:RESOURCE_CONFIG_ERROR",S="GEONODE:SET_RESOURCE_COMPACT_PERMISSIONS",T="GEONODE:UPDATE_RESOURCE_COMPACT_PERMISSIONS",_="GEONODE:RESET_GEO_LIMITS",I="GEONODE:PROCESS_RESOURCES",P="GEONODE_SET_RESOURCE_THUMBNAIL",R="GEONODE_ENABLE_MAP_THUMBNAIL_VIEWER",D="GEONODE_DOWNLOAD_RESOURCE",w="GEONODE_DOWNLOAD_COMPLETE",N="GEONODE_UPDATE_SINGLE_RESOURCE";function A(){return{type:n}}function j(e,t){return{type:o,data:e,pending:t}}function C(e){return{type:N,data:e}}function M(e){return{type:f,title:e}}function U(e){return{type:d,abstract:e}}function G(e){return{type:p,thumbnailUrl:e,thumbnailChanged:arguments.length>1&&void 0!==arguments[1]?arguments[1]:"false"}}function F(){return{type:P}}function L(e){return{type:u,resourceType:e}}function Z(e){return{type:i,error:e}}function x(e){return{type:a,properties:e}}function k(){return{type:c}}function H(e){return{type:s,id:e}}function Y(e){return{type:E,permissions:e}}function q(e){return{type:m,favorite:e}}function B(e){return{type:R,enabled:e}}function W(e){return{type:y,bbox:e}}function V(e,t,r){return{type:v,resourceType:e,pk:t,options:r}}function X(e){return{type:O,resourceType:e}}function $(e){return{type:b,loading:e}}function Q(e){return{type:h,message:e}}function z(){return{type:g}}function K(e){return{type:S,compactPermissions:e}}function J(e){return{type:T,compactPermissions:e}}function ee(){return{type:_}}function te(e,t,r){return{type:I,processType:e,resources:t,redirectTo:r}}function re(e){return{type:D,resource:e}}function ne(e){return{type:w,resource:e}}},217549:(e,t,r)=>{"use strict";r.d(t,{Z:()=>l});var n=r(124852),o=r.n(n),i=r(675263),a=r.n(i),u=["href","readOnly","children"];function c(){return c=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var r=arguments[t];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(e[n]=r[n])}return e},c.apply(this,arguments)}function s(e){var t=e.href,r=e.readOnly,n=e.children,i=function(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}(e,u);return r?n:o().createElement("a",c({href:t},i),n)}s.propTypes={href:a().string,readOnly:a().bool.isRequired,children:a().any},s.defaultProps={href:"",readOnly:!1};const l=s},834065:(e,t,r)=>{"use strict";r.d(t,{Z:()=>d});var n=r(124852),o=r.n(n),i=r(675263),a=r.n(i),u=r(877593),c=r(217549),s=["resource","readOnly","formatHref","pathname"];function l(){return l=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var r=arguments[t];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(e[n]=r[n])}return e},l.apply(this,arguments)}function f(e){var t,r,n,i=e.resource,a=e.readOnly,f=e.formatHref,d=e.pathname,p=function(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}(e,s);return p.detailsPanel?o().createElement(c.Z,{readOnly:a,href:f({pathname:d,query:{"filter{owner.username.in}":null===(n=i.owner)||void 0===n?void 0:n.username}})},i.owner&&(0,u.vW)(i.owner)):o().createElement("p",l({className:"card-text gn-card-user"},p),(null===(t=i.owner)||void 0===t?void 0:t.avatar)&&o().createElement("img",{src:i.owner.avatar,alt:(0,u.vW)(i.owner),className:"gn-card-author-image"}),o().createElement(c.Z,{readOnly:a,href:f({pathname:d,query:{"filter{owner.username.in}":null===(r=i.owner)||void 0===r?void 0:r.username}})},i.owner&&(0,u.vW)(i.owner)))}f.propTypes={resource:a().object,readOnly:a().bool,formatHref:a().func,props:a().any},f.defaultProps={resource:{},readOnly:!1,formatHref:function(){return"#"}};const d=f},100824:(e,t,r)=>{"use strict";r.d(t,{Z:()=>i});var n=r(124852),o=r.n(n);const i=(0,n.forwardRef)((function(e,t){var r=e.enabled,n=e.className,i=e.children;return r?o().createElement("div",{ref:t,className:n||"gn-overlay-container",style:{position:"relative",height:"100%"}},i):null}))},71268:(e,t,r)=>{"use strict";r.d(t,{Z:()=>E});var n=r(124852),o=r.n(n),i=r(805346),a=r(675263),u=r.n(a),c=r(507412),s=r(815135),l=r(441609),f=r.n(l),d=r(535721),p=r(303744),m=(0,s.Z)(p.Z),y=function(e){var t,r,n,a=e.resource,u=void 0===a?{}:a,s=(0,d.fu)(u),l=s.isApproved,p=s.isPublished,y=s.isProcessing,E=s.isCopying,v=s.isDeleting,O=s.isDeleted;return f()(u)?null:o().createElement("p",{className:"gn-resource-status-text"},!y&&(!l||!p)&&o().createElement(m,{variant:"default",className:"gn-resource-status gn-status-button",tooltip:(t={isApproved:l,isPublished:p},r=t.isApproved,n=t.isPublished,!r&&n?o().createElement(i.Z,{msgId:"gnhome.pendingApproval"}):r||n?n||r?"":o().createElement(i.Z,{msgId:"gnhome.unpublished"}):o().createElement(i.Z,{msgId:"gnhome.unApprovedunPublished"})),style:{marginRight:(v||O||E)&&"0.4rem"},tooltipPosition:"top"},o().createElement(c.Z,{name:"info-circle",className:"gn-resource-status-pending"})),v&&o().createElement("span",{className:"gn-resource-status gn-resource-status-danger"},o().createElement(i.Z,{msgId:"gnviewer.deleting"})),O&&o().createElement("span",{className:"gn-resource-status gn-resource-status-danger"},o().createElement(i.Z,{msgId:"gnviewer.deleted"})),E&&o().createElement("span",{className:"gn-resource-status gn-resource-status-primary"},o().createElement(i.Z,{msgId:"gnviewer.cloning"})))};y.propTypes={isApproved:u().bool,isPublished:u().bool},y.defaultProps={isApproved:!0,isPublished:!0};const E=y},228261:(e,t,r)=>{"use strict";r.d(t,{Z:()=>l});var n=r(124852),o=r.n(n),i=r(675263),a=r.n(i),u=["id","className","style","children"];function c(){return c=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var r=arguments[t];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(e[n]=r[n])}return e},c.apply(this,arguments)}function s(e){var t=e.id,r=e.className,n=e.style,i=e.children,a=function(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}(e,u),s=r?" "+r:"";return o().createElement(o().Fragment,null,o().createElement("div",c({},a,{id:t,className:"gn-spinner".concat(s),style:n}),o().createElement("div",null)),i)}s.propTypes={id:a().string,className:a().string,style:a().object},s.defaultProps={};const l=s},51605:(e,t,r)=>{"use strict";r.d(t,{Z:()=>n.Z});var n=r(228261)},94228:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>C});var n=r(124852),o=r.n(n),i=r(322843),a=r(171703),u=r(22222),c=r(737275),s=r(843683),l=r(274621),f=r(643892),d=r(452992),p=r(17594),m=r(925108),y=r(782904),E=r(572036),v=r(76907),O=r(303744);var b=r(100824),g=r(625635),h=r(877593),S=r(805346),T=r(675110),_=r(800827),I=r(535721),P=r(770058),R=r(807461);function D(e){return D="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},D(e)}function w(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}var N=(0,a.connect)((0,u.P1)([function(e){var t;return(null==e||null===(t=e.gnresource)||void 0===t?void 0:t.data)||null},function(e){var t;return(null==e||null===(t=e.gnresource)||void 0===t?void 0:t.loading)||!1},function(e){var t,r;return(null==e||null===(t=e.gnresource)||void 0===t||null===(r=t.data)||void 0===r?void 0:r.favorite)||!1},function(e){var t;return(null==e||null===(t=e.gnsave)||void 0===t?void 0:t.savingThumbnailMap)||!1},T.l2,v.km,v.Bs,_.Od,function(e){var t;return(null==e||null===(t=e.gnresource)||void 0===t?void 0:t.showMapThumbnail)||!1},d.WB],(function(e,t,r,n,o,i,a,u,c,s){return{layers:o,resource:e,loading:t,savingThumbnailMap:n,favorite:r,isThumbnailChanged:i,resourceThumbnailUpdating:a,initialBbox:null==u?void 0:u.bbox,enableMapViewer:c,downloading:s,canDownload:(0,I.sH)(e,"download_resourcebase"),resourceId:e.pk}})),{closePanel:y.Xg.bind(null,"rightOverlay","enabled",!1),onFavorite:f.gw,onMapThumbnail:f.CB,onResourceThumbnail:f.e5,onClose:f.qs,onAction:f.Rk})(s.Z),A=(0,a.connect)((0,u.P1)([v.V$,v.fg],(function(e,t){return{hide:e||!t}})),{onClick:y.Xg.bind(null,"rightOverlay","enabled","DetailViewer")})((function(e){var t=e.onClick,r=e.hide,n=e.variant,i=e.size,a=e.showMessage;return r?null:o().createElement(O.Z,{variant:n,size:i,onClick:function(){t()}},a?o().createElement(S.Z,{msgId:"gnviewer.editInfo"}):o().createElement(p.Z,{name:"info-circle"}))})),j=(0,a.connect)((0,u.P1)([function(e){var t,r;return"DetailViewer"===(null==e||null===(t=e.controls)||void 0===t||null===(r=t.rightOverlay)||void 0===r?void 0:r.enabled)},v.il,v.V$,v.fg,l.np,function(e){return(0,i.bh)(e,(0,c.u8)("monitorState"))}],(function(e,t,r,n,o,i){return{enabled:e,canEdit:t,hide:r||!n,user:o,monitoredState:i}})),{onEditResource:f.Br,onEditAbstractResource:f.bI,onEditThumbnail:f.U5,onClose:y.Xg.bind(null,"rightOverlay","enabled",!1)})((0,g.EN)((function(e){var t=e.location,r=e.enabled,i=e.onEditResource,a=e.onEditAbstractResource,u=e.onEditThumbnail,c=e.canEdit,s=e.hide,l=e.user,f=e.onClose,d=e.monitoredState,p=e.queryPathname,m=void 0===p?"/":p,y=e.tabs,E=void 0===y?[]:y,v=(0,P._y)(d,{tabs:E}),O=function(e){var t=e.disabled,r=e.onClickOut,o=(0,n.useRef)();return(0,n.useEffect)((function(){function e(e){var n;!t&&(null==o||null===(n=o.current)||void 0===n?void 0:n.contains)&&!o.current.contains(e.target)&&r()}return window.addEventListener("mousedown",e),function(){window.removeEventListener("mousedown",e)}}),[t,o,r]),o}({disabled:!r,onClickOut:function(){f()}});return s?null:o().createElement(b.Z,{enabled:r,ref:O,className:"gn-overlay-wrapper"},o().createElement(N,{editTitle:function(e){i(e)},editAbstract:function(e){a(e)},editThumbnail:function(e){u(e,!0)},activeEditMode:r&&c,enableFavorite:!!l,formatHref:function(e){return(0,h.nz)(function(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?w(Object(r),!0).forEach((function(t){var n,o,i,a;n=e,o=t,i=r[t],a=function(e,t){if("object"!=D(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=D(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(o),(o="symbol"==D(a)?a:String(a))in n?Object.defineProperty(n,o,{value:i,enumerable:!0,configurable:!0,writable:!0}):n[o]=i})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):w(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}({location:t},e))},tabs:v.tabs,pathname:m}))})));const C=(0,i.rx)("DetailViewer",{component:j,containers:{ActionNavbar:{name:"DetailViewerButton",Component:A}},epics:R.Z,reducers:{gnresource:E.Z,controls:m.Z}})},572036:(e,t,r)=>{"use strict";r.d(t,{Z:()=>O});var n=r(618446),o=r.n(n),i=r(441609),a=r.n(i),u=r(643892),c=r(535721),s=["data"],l=["features"],f=["features"],d=["features"];function p(e){return p="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},p(e)}function m(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}function y(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function E(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?y(Object(r),!0).forEach((function(t){var n,o,i,a;n=e,o=t,i=r[t],a=function(e,t){if("object"!=p(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=p(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(o),(o="symbol"==p(a)?a:String(a))in n?Object.defineProperty(n,o,{value:i,enumerable:!0,configurable:!0,writable:!0}):n[o]=i})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):y(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}var v={selectedLayerPermissions:[],data:{},permissions:[]};const O=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:v,t=arguments.length>1?arguments[1]:void 0;switch(t.type){case u.$X:return v;case u.ql:return E(E({},e),{},{configError:void 0,loadingResourceConfig:t.loading});case u.nS:return E(E({},e),{},{loading:!1,configError:t.message});case u.W:return E(E({},e),{},{loading:!0});case u.Zf:var r,n,i=t.data||{},p=(i.data,E({},m(i,s))),y=null===(r=e.data)||void 0===r?void 0:r.linkedResources;return a()(y)||p.pk!==(null===(n=e.data)||void 0===n?void 0:n.pk)||(p.linkedResources=y),E(E({},e),{},{error:null,initialResource:E({},t.data),data:p,loading:!1,isNew:!1});case u.Eu:return E(E({},e),{},{initialResource:null,data:null,error:t.error,loading:!1});case u.Vy:return E(E({},e),{},{data:E(E({},e.data),t.properties)});case u.YB:return E(E({},e),{},{type:t.resourceType});case u.xm:return E(E({},v),{},{isNew:!0});case u._f:return E(E({},e),{},{id:t.id});case u.ek:return E(E({},e),{},{permissions:t.permissions});case u.cd:return E(E({},e),{},{data:E(E({},null==e?void 0:e.data),{},{title:null==t?void 0:t.title,name:null==t?void 0:t.title})});case u.pt:return E(E({},e),{},{data:E(E({},null==e?void 0:e.data),{},{abstract:null==t?void 0:t.abstract})});case u.ww:return E(E({},e),{},{data:E(E({},null==e?void 0:e.data),{},{thumbnail_url:null==t?void 0:t.thumbnailUrl,thumbnailChanged:null==t?void 0:t.thumbnailChanged})});case u._Z:return E(E({},e),{},{data:E(E({},null==e?void 0:e.data),{},{updatingThumbnail:!0})});case u.dh:return E(E({},e),{},{showMapThumbnail:t.enabled});case u.p2:return E(E({},e),{},{selectedLayerPermissions:t.permissions});case u.ih:return E(E({},e),{},{initialCompactPermissions:t.compactPermissions,compactPermissions:t.compactPermissions,isCompactPermissionsChanged:!1,geoLimits:[]});case u.J5:return E(E({},e),{},{compactPermissions:t.compactPermissions,isCompactPermissionsChanged:!o()((0,c.go)(e.initialCompactPermissions),(0,c.go)(t.compactPermissions)),geoLimits:(0,c.vB)(t.compactPermissions)});case u.uA:if(e.compactPermissions){var O=e.compactPermissions,b=O.users,g=O.organizations,h=O.groups;return E(E({},e),{},{compactPermissions:{users:b.map((function(e){return e.features,m(e,l)})),organizations:g.map((function(e){return e.features,m(e,f)})),groups:h.map((function(e){return e.features,m(e,d)}))},geoLimits:[]})}return e;default:return e}}},770058:(e,t,r)=>{"use strict";r.d(t,{gj:()=>d,QH:()=>p,mk:()=>m,BK:()=>y,bH:()=>E,_y:()=>v});var n=r(227361),o=r.n(n),i=r(414293),a=r.n(i),u=r(322843),c=r(368523);function s(e,t){return function(e){if(Array.isArray(e))return e}(e)||function(e,t){var r=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null!=r){var n,o,i,a,u=[],c=!0,s=!1;try{if(i=(r=r.call(e)).next,0===t){if(Object(r)!==r)return;c=!1}else for(;!(c=(n=i.call(r)).done)&&(u.push(n.value),u.length!==t);c=!0);}catch(e){s=!0,o=e}finally{try{if(!c&&null!=r.return&&(a=r.return(),Object(a)!==a))return}finally{if(s)throw o}}return u}}(e,t)||function(e,t){if(e){if("string"==typeof e)return l(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?l(e,t):void 0}}(e,t)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function l(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}function f(e){return f="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},f(e)}function d(e,t,r){var n=t?t.filter((function(e){return e.type===r})):void 0;return void 0===n||n&&0===n.length||n&&n.some((function(t){return e&&e.includes(null==t?void 0:t.value)}))}function p(e,t){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:"/",n=t.split(r).map((function(t){return function(e,t){return 0===(null==t?void 0:t.indexOf("${"))?o()(e,t.replace(/^\$\{(.*)\}$/,"$1")):t}(e,t)}));return n.join(r)}var m=function(e){return!(""===e||a()(e))},y=function(e){return function t(r){return r&&"object"===f(r)?Array.isArray(r)?r.map(t):Object.fromEntries(Object.entries(r).map((function(e){var r=s(e,2),n=r[0],o=r[1];return[n,t(o)]}))):e(r)}},E=function e(t,r){return t&&t.reduce((function(t,n){var o=n;return Object.entries(n).forEach((function(t){var i=s(t,2),a=i[0],u=i[1];Array.isArray(u)&&(o[a]=e(n[a],r))})),r(o)&&t.push(o),t}),[])},v=function(e,t){var r=(arguments.length>2&&void 0!==arguments[2]?arguments[2]:{}).filterFunc,n=void 0===r?function(e){return!e.disableIf}:r;return s(E([y((function(t){return(0,u.CU)((function(t){return o()(e,t)}),(0,c.z)(),t)}))(t)],n),1)[0]}},887157:(e,t,r)=>{var n=r(640554),o=r(588958);e.exports=function(e,t,r,i){var a=e.length;for((r=n(r))<0&&(r=-r>a?0:a+r),(i=void 0===i||i>a?a:n(i))<0&&(i+=a),i=r>i?0:o(i);r<i;)e[r++]=t;return e}},580760:(e,t,r)=>{var n=r(989881);e.exports=function(e,t){var r=[];return n(e,(function(e,n,o){t(e,n,o)&&r.push(e)})),r}},441761:(e,t,r)=>{var n=r(644239),o=r(637005);e.exports=function(e){return o(e)&&"[object Date]"==n(e)}},389179:(e,t,r)=>{var n=r(555639),o=r(640554),i=r(14841),a=r(479833),u=n.isFinite,c=Math.min;e.exports=function(e){var t=Math[e];return function(e,r){if(e=i(e),(r=null==r?0:c(o(r),292))&&u(e)){var n=(a(e)+"e").split("e"),s=t(n[0]+"e"+(+n[1]+r));return+((n=(a(s)+"e").split("e"))[0]+"e"+(+n[1]-r))}return t(e)}}},819873:(e,t,r)=>{var n=r(887157),o=r(816612);e.exports=function(e,t,r,i){var a=null==e?0:e.length;return a?(r&&"number"!=typeof r&&o(e,t,r)&&(r=0,i=a),n(e,t,r,i)):[]}},763105:(e,t,r)=>{var n=r(234963),o=r(580760),i=r(267206),a=r(701469);e.exports=function(e,t){return(a(e)?n:o)(e,i(t,3))}},647960:(e,t,r)=>{var n=r(441761),o=r(307518),i=r(531167),a=i&&i.isDate,u=a?o(a):n;e.exports=u},313880:(e,t,r)=>{var n=r(479833);e.exports=function(){var e=arguments,t=n(e[0]);return e.length<3?t:t.replace(e[1],e[2])}},59854:(e,t,r)=>{var n=r(389179)("round");e.exports=n},588958:(e,t,r)=>{var n=r(829750),o=r(640554);e.exports=function(e){return e?n(o(e),0,4294967295):0}}}]);