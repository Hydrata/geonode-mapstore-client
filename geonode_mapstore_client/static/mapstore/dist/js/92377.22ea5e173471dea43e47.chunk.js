(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[92377],{95797:(r,e,t)=>{"use strict";t.d(e,{DR:()=>n,S0:()=>u,u7:()=>o,lj:()=>i,yz:()=>f,lN:()=>c,zW:()=>a,Yx:()=>l,VN:()=>y,Hu:()=>s,VT:()=>p,RD:()=>b,Qq:()=>m,R1:()=>g,_T:()=>d,vO:()=>O,XO:()=>v,jG:()=>j,Xc:()=>E,gT:()=>P,rG:()=>S,t3:()=>h,Fs:()=>w,w_:()=>q,Lm:()=>R,rh:()=>_,rP:()=>L,IO:()=>T}),t(375875);var n="LAYER_SELECTED_FOR_SEARCH",u="FEATURE_TYPE_SELECTED",o="FEATURE_TYPE_LOADED",i="FEATURE_LOADED",f="FEATURE_LOADING",c="FEATURE_TYPE_ERROR",a="FEATURE_ERROR",l="QUERY_CREATE",y="QUERY:UPDATE_QUERY",s="QUERY_RESULT",p="QUERY_ERROR",b="RESET_QUERY",m="QUERY",g="INIT_QUERY_PANEL",d="QUERY:TOGGLE_SYNC_WMS",O="QUERY:TOGGLE_LAYER_FILTER";function v(){return{type:d}}function j(){return{type:O}}function E(){return{type:g}}function P(r,e){return{type:u,url:r,typeName:e}}function S(r,e){return{type:o,typeName:r,featureType:e}}function h(r,e){return{type:c,typeName:r,error:e}}function w(r){return{type:f,isLoading:r}}function q(r,e,t,n,u){return{type:s,searchUrl:e,filterObj:t,result:r,queryOptions:n,reason:u}}function R(r){return{type:p,error:r}}function _(){var r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=r.updates,t=r.reason,n=r.useLayerFilter;return{type:y,updates:e,reason:t,useLayerFilter:n}}function L(r,e){return{type:l,searchUrl:r,filterObj:e}}function T(r,e,t,n){return{type:m,searchUrl:r,filterObj:e,queryOptions:t,reason:n}}},352595:(r,e,t)=>{"use strict";t.d(e,{Z:()=>n});const n=(0,t(461365).Z)(t(757588).Overlay)},399534:(r,e,t)=>{"use strict";t.d(e,{Z:()=>o});var n=t(461365),u=t(569334);const o=(0,n.Z)(u.h_)},731255:(r,e,t)=>{"use strict";t.d(e,{u$:()=>S,Xh:()=>h,_w:()=>w,eO:()=>q,kG:()=>R,P3:()=>_,bq:()=>F,LB:()=>D,b4:()=>U,M0:()=>A,Li:()=>k,Rd:()=>Y,g5:()=>G,Sj:()=>x,o:()=>N,eK:()=>z,jY:()=>C,ND:()=>I,OK:()=>Q,tU:()=>M,ou:()=>V,DK:()=>K,Gl:()=>W,uz:()=>Z,Ci:()=>H,Ae:()=>X,gz:()=>B,He:()=>$,P4:()=>J,kd:()=>rr,TC:()=>er,nq:()=>tr,Vf:()=>nr,lg:()=>ur});var n=t(91175),u=t.n(n),o=t(227361),i=t.n(o),f=t(513218),c=t.n(f),a=t(675110),l=t(378889),y=t(308316),s=t(552259),p=t(196958),b=t(285148),m=t(274621),g=t(93152),d=t(824260);function O(r){return O="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(r){return typeof r}:function(r){return r&&"function"==typeof Symbol&&r.constructor===Symbol&&r!==Symbol.prototype?"symbol":typeof r},O(r)}function v(r,e){var t=Object.keys(r);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(r);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(r,e).enumerable}))),t.push.apply(t,n)}return t}function j(r){for(var e=1;e<arguments.length;e++){var t=null!=arguments[e]?arguments[e]:{};e%2?v(Object(t),!0).forEach((function(e){E(r,e,t[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(r,Object.getOwnPropertyDescriptors(t)):v(Object(t)).forEach((function(e){Object.defineProperty(r,e,Object.getOwnPropertyDescriptor(t,e))}))}return r}function E(r,e,t){return(e=function(r){var e=function(r,e){if("object"!==O(r)||null===r)return r;var t=r[Symbol.toPrimitive];if(void 0!==t){var n=t.call(r,"string");if("object"!==O(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(r)}(r);return"symbol"===O(e)?e:String(e)}(e))in r?Object.defineProperty(r,e,{value:t,enumerable:!0,configurable:!0,writable:!0}):r[e]=t,r}var P=a.CA,S=function(r){return i()(r,"featuregrid.selectedLayer")},h=function(r){return i()(r,"featuregrid.attributes")},w=function(r){return r&&r.featuregrid&&r.featuregrid.select},q=function(r){return r&&r.featuregrid&&r.featuregrid.changes},R=function(r){return r&&r.featuregrid&&r.featuregrid.newFeatures},_=function(r){return u()(w(r))},L=function(r){var e=(0,d.Qs)(r);if(e){var t=(0,l.findGeometryProperty)(e);return t&&t.localType}return null},T=["Geometry","GeometryCollection"],F=function(r){return!u()(T.filter((function(e){return L(r)===e})))},D=function(r){return q(r)&&q(r).length>0},U=function(r){return R(r)&&R(r).length>0},A=function(r){return r&&r.featuregrid&&r.featuregrid.filters},k=function(r){return P(r,S(r))},Y=function(r){return r&&r.featuregrid&&r.featuregrid.open},G=function(r,e){return i()(A(r),e)},x=function(r){var e=function(){var r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return r.title||r.name}(P(r,S(r)));return c()(e)?e[(0,y.Pz)(r)]||e.default||"":e},N=function(r){return((0,d.L)(r)||[]).map((function(e){var t=function(r,e){return i()(r,"featuregrid.attributes[".concat(e.name||e.attribute,"]"))}(r,e);return t?j(j({},e),t):e}))},z=function(r){return r&&r.featuregrid&&r.featuregrid.mode},C=function(r){return(w(r)||[]).length},I=function(r){return(0,p.rK)(q(r))},Q=function(r){return function(r){var e=_(r);if(e){var t=(0,p.rK)(q(r));return!((!t[e.id]||null===t[e.id].geometry)&&(t[e.id]&&null===t[e.id].geometry||e._new&&u()(R(r))&&null===u()(R(r)).geometry||(!e._new||!u()(R(r))||null===u()(R(r)).geometry)&&null===e.geometry))}return!1}(r)},M=function(r){return i()(r,"featuregrid.showAgain",!1)},V=function(r){if(i()(r,"featuregrid.showTimeSync",!1)){var e=S(r);return(0,b.jo)({id:e},"time")(r)}return null},K=function(r){return i()(r,"featuregrid.timeSync",!1)},W=function(r){return i()(r,"featuregrid.showPopoverSync",!0)},Z=function(r){return r&&r.featuregrid&&r.featuregrid.saving},H=function(r){return r&&r.featuregrid&&r.featuregrid.saved},X=function(r){return r&&r.featuregrid&&r.featuregrid.drawing},B=function(r){return i()(r,"featuregrid.multiselect",!1)},$=function(r){return(0,s.isSimpleGeomType)(L(r))},J=function(r){return r.featuregrid&&r.featuregrid.dockSize},rr=function(r){var e=P(r,S(r));return e&&e.name||""},er=function(r){var e=function(r){return i()(P(r,S(r)),"params")}(r);return{viewParams:e&&(e.VIEWPARAMS||e.viewParams||e.viewparams),cqlFilter:e&&(e.CQL_FILTER||e.cqlFilter||e.cql_filter)}},tr=function(r){var e=(0,m.L3)(r),t=function(r){return i()(r,"featuregrid.editingAllowedRoles",["ADMIN"])}(r)||["ADMIN"],n=function(r){return r&&r.featuregrid&&r.featuregrid.canEdit}(r);return(-1!==t.indexOf(e)||n)&&!(0,g.c0)(r)},nr=function(r){return i()(r,"featuregrid.pagination")},ur=function(r){return i()(r,"featuregrid.useLayerFilter",!0)}},55105:(r,e,t)=>{"use strict";t.d(e,{Ss:()=>y,Nr:()=>s,ic:()=>p,Jz:()=>m,VM:()=>g,CF:()=>d});var n=t(91175),u=t.n(n),o=t(800827),i=t(552259);function f(r){return f="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(r){return typeof r}:function(r){return r&&"function"==typeof Symbol&&r.constructor===Symbol&&r!==Symbol.prototype?"symbol":typeof r},f(r)}function c(r,e){var t=Object.keys(r);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(r);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(r,e).enumerable}))),t.push.apply(t,n)}return t}function a(r){for(var e=1;e<arguments.length;e++){var t=null!=arguments[e]?arguments[e]:{};e%2?c(Object(t),!0).forEach((function(e){l(r,e,t[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(r,Object.getOwnPropertyDescriptors(t)):c(Object(t)).forEach((function(e){Object.defineProperty(r,e,Object.getOwnPropertyDescriptor(t,e))}))}return r}function l(r,e,t){return(e=function(r){var e=function(r,e){if("object"!==f(r)||null===r)return r;var t=r[Symbol.toPrimitive];if(void 0!==t){var n=t.call(r,"string");if("object"!==f(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(r)}(r);return"symbol"===f(e)?e:String(e)}(e))in r?Object.defineProperty(r,e,{value:t,enumerable:!0,configurable:!0,writable:!0}):r[e]=t,r}var y=function(r){return r.maplayout&&r.maplayout.layout||{}},s=function(r){return r.maplayout&&r.maplayout.boundingMapRect||{}},p=function(r){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},t=y(r);return t&&Object.keys(t).filter((function(r){return e[r]})).reduce((function(r,e){return a(a({},r),{},l({},e,t[e]))}),{})||{}},b=function(r){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:[],t=y(r),n=!!u()(e.filter((function(r){return t[r.key]})).map((function(r){return"not"===r.type?t[r.key]!==r.value&&t[r.key]:t[r.key]===r.value})));return n},m=function(r){return b(r,[{key:"right",value:658}])},g=function(r){return b(r,[{key:"bottom",value:30,type:"not"}])},d=function(r){var e=(0,o.Od)(r),t=s(r);return t&&e&&e.size&&{left:(0,i.parseLayoutValue)(t.left,e.size.width),bottom:(0,i.parseLayoutValue)(t.bottom,e.size.height),right:(0,i.parseLayoutValue)(t.right,e.size.width),top:(0,i.parseLayoutValue)(t.top,e.size.height)}}},824260:(r,e,t)=>{"use strict";t.d(e,{qj:()=>v,Bu:()=>j,UM:()=>E,X1:()=>P,L:()=>S,HY:()=>h,Mz:()=>w,F0:()=>q,dc:()=>R,b0:()=>_,hk:()=>L,Qs:()=>T,gy:()=>F,M7:()=>D,VD:()=>U});var n=t(414293),u=t.n(n),o=t(227361),i=t.n(o),f=t(91175),c=t.n(f),a=t(701469),l=t.n(a),y=t(630998),s=t.n(y);function p(r){return p="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(r){return typeof r}:function(r){return r&&"function"==typeof Symbol&&r.constructor===Symbol&&r!==Symbol.prototype?"symbol":typeof r},p(r)}function b(r,e){var t=Object.keys(r);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(r);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(r,e).enumerable}))),t.push.apply(t,n)}return t}function m(r){for(var e=1;e<arguments.length;e++){var t=null!=arguments[e]?arguments[e]:{};e%2?b(Object(t),!0).forEach((function(e){g(r,e,t[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(r,Object.getOwnPropertyDescriptors(t)):b(Object(t)).forEach((function(e){Object.defineProperty(r,e,Object.getOwnPropertyDescriptor(t,e))}))}return r}function g(r,e,t){return(e=function(r){var e=function(r,e){if("object"!==p(r)||null===r)return r;var t=r[Symbol.toPrimitive];if(void 0!==t){var n=t.call(r,"string");if("object"!==p(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(r)}(r);return"symbol"===p(e)?e:String(e)}(e))in r?Object.defineProperty(r,e,{value:t,enumerable:!0,configurable:!0,writable:!0}):r[e]=t,r}var d=function(r){return i()(r,"query.filterObj.featureTypeName")},O=function(r){return function(e){return i()(e,'query.featureTypes["'.concat(r,'"]'))}},v=function(r,e){return i()(O(e)(r),"original")},j=function(r){return r&&r.query&&r.query.searchUrl},E=function(r){return r&&r.query&&r.query.url},P=function(r){return r&&r.query&&r.query.filterObj},S=function(r){return i()(O(d(r))(r),"attributes")},h=function(r){return i()(r,"query.typeName")},w=function(r){return i()(r,"query.result.features")},q=function(r){var e=i()(r,"query.result");return m(m({},e),{},{features:(e&&e.features||[]).filter((function(r){return!u()(r.geometry)}))})},R=function(r,e){var t=r&&r.query&&r.query.result&&r.query.result.features;return c()(t.filter((function(r){return r.id===e})))},_={startIndex:function(r){return i()(r,"query.filterObj.pagination.startIndex")},maxFeatures:function(r){return i()(r,"query.filterObj.pagination.maxFeatures")},resultSize:function(r){return i()(r,"query.result.features.length")},totalFeatures:function(r){return i()(r,"query.result.totalFeatures")}},L=function(r,e){var t=O(e)(r);return!!(t&&t.attributes&&t.geometry&&t.original)},T=function(r){return v(r,d(r))},F=function(r){return i()(r,"query.featureLoading")},D=function(r){return i()(r,"query.syncWmsFilter",!1)},U=function(r){var e=i()(r,"query.filterObj.crossLayerFilter"),t=i()(r,"query.filterObj.spatialField"),n=i()(r,"query.filterObj.filterFields");return!!(n&&c()(n)||t&&(t.method&&t.operation&&t.geometry||l()(t)&&s()(t,(function(r){return r.method&&r.operation&&r.geometry}))>-1)||e&&e.collectGeometries&&e.operation)}},469842:(r,e,t)=>{"use strict";t.d(e,{qh:()=>b,GK:()=>m,Nl:()=>g,vE:()=>d,gC:()=>O,hI:()=>v,Vc:()=>j,BU:()=>E,Vx:()=>P,a8:()=>S,IM:()=>h,G$:()=>w});var n=t(227361),u=t.n(n),o=t(22222),i=t(675110),f=t(308316),c=t(86638);function a(r){return a="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(r){return typeof r}:function(r){return r&&"function"==typeof Symbol&&r.constructor===Symbol&&r!==Symbol.prototype?"symbol":typeof r},a(r)}var l=["title"];function y(r,e){var t=Object.keys(r);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(r);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(r,e).enumerable}))),t.push.apply(t,n)}return t}function s(r){for(var e=1;e<arguments.length;e++){var t=null!=arguments[e]?arguments[e]:{};e%2?y(Object(t),!0).forEach((function(e){p(r,e,t[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(r,Object.getOwnPropertyDescriptors(t)):y(Object(t)).forEach((function(e){Object.defineProperty(r,e,Object.getOwnPropertyDescriptor(t,e))}))}return r}function p(r,e,t){return(e=function(r){var e=function(r,e){if("object"!==a(r)||null===r)return r;var t=r[Symbol.toPrimitive];if(void 0!==t){var n=t.call(r,"string");if("object"!==a(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(r)}(r);return"symbol"===a(e)?e:String(e)}(e))in r?Object.defineProperty(r,e,{value:t,enumerable:!0,configurable:!0,writable:!0}):r[e]=t,r}var b=function(r){return u()(r,"queryform.crossLayerFilter")},m=function(r){return((0,i.l2)(r)||[]).filter((function(){var r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=r.type,t=r.group;return"wms"===e&&"background"!==t})).map((function(e){var t=e.title;return s(s({},function(r,e){if(null==r)return{};var t,n,u=function(r,e){if(null==r)return{};var t,n,u={},o=Object.keys(r);for(n=0;n<o.length;n++)t=o[n],e.indexOf(t)>=0||(u[t]=r[t]);return u}(r,e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(r);for(n=0;n<o.length;n++)t=o[n],e.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(r,t)&&(u[t]=r[t])}return u}(e,l)),{},{title:(0,c.MZ)((0,f.Pz)(r),t)})}))},g=function(r){return u()(r,"queryform.spatialField.geometry")},d=function(r){return u()(r,"queryform.spatialField")},O=(0,o.P1)((function(r){return u()(r,"queryform.attributePanelExpanded")}),(function(r){return u()(r,"queryform.spatialPanelExpanded")}),(function(r){return u()(r,"queryform.crossLayerExpanded")}),(function(r,e,t){return{attributePanelExpanded:r,spatialPanelExpanded:e,crossLayerExpanded:t}})),v=function(r){return u()(r,"layerFilter.persisted")},j=function(r){return u()(r,"layerFilter.applied")},E=function(r){return u()(r,"queryform.spatialField.method")},P=function(r){return u()(r,"queryform.maxFeaturesWPS")},S=function(r){return g(r)&&g(r).type||"Polygon"},h=function(r){return g(r)&&g(r).projection||"EPSG =4326"},w=function(r){return g(r)&&g(r).coordinates||[]}}}]);