(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[1618],{4206:(e,t,r)=>{"use strict";r.d(t,{hZ:()=>n,pb:()=>i,kD:()=>o,DI:()=>l,IC:()=>a,Vw:()=>c,KD:()=>p,uj:()=>d,lo:()=>f,Yf:()=>y,fo:()=>E,PY:()=>F,bp:()=>m});var n="CHANGE_DRAWING_STATUS",i="DRAW:END_DRAWING",o="DRAW:SET_CURRENT_STYLE",l="DRAW:GEOMETRY_CHANGED",a="DRAW:DRAW_SUPPORT_STOPPED",u="DRAW:FEATURES_SELECTED",s="DRAW:DRAWING_FEATURES";function c(e,t,r,n,i){return{type:l,features:e,owner:t,enableEdit:r,textChanged:n,circleChanged:i}}function p(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:[];return{type:u,features:e}}function d(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:[];return{type:s,features:e}}function f(){return{type:a}}function y(e,t,r,i,o,l){return{type:n,status:e,method:t,owner:r,features:i,options:o,style:l}}function E(e,t){return{type:i,geometry:e,owner:t}}function F(e){return{type:o,currentStyle:e}}var m=function(e){return y("clean","",e,[],{})}},40512:(e,t,r)=>{"use strict";r.d(t,{y6:()=>n,g$:()=>i,Xk:()=>o,H1:()=>l,MY:()=>a,Xs:()=>u,no:()=>s,Nd:()=>c,Zq:()=>p,Xr:()=>d,Rb:()=>f,HH:()=>y});var n="LAYER_FILTER:INIT_LAYER_FILTER",i="LAYER_FILTER:APPLIED_FILTER",o="LAYER_FILTER:STORE_CURRENT_APPLIED_FILTER",l="LAYER_FILTER:DISCARD_CURRENT_FILTER",a="LAYER_FILTER:APPLY_FILTER",u="LAYER_FILTER:OPEN_QUERY_BUILDER";function s(){return{type:o}}function c(){return{type:l}}function p(){return{type:u}}function d(e){return{type:i,filter:e}}function f(){return{type:a}}function y(e){return{type:n,filter:e}}},7878:(e,t,r)=>{"use strict";r.d(t,{E6:()=>l,vo:()=>a,l1:()=>u,J9:()=>s,U:()=>c,z8:()=>p,ql:()=>d,O_:()=>f,M$:()=>y,Ug:()=>E,p5:()=>F,Fz:()=>m,WZ:()=>_,bP:()=>R,On:()=>b,d_:()=>T,xM:()=>O,bl:()=>g,Wi:()=>I,PN:()=>L,_M:()=>v,Wm:()=>A,Eg:()=>S,V1:()=>D,cY:()=>P,RD:()=>h,Hl:()=>N,co:()=>w,uY:()=>U,H8:()=>C,je:()=>j,go:()=>Y,_8:()=>M,xd:()=>x,o7:()=>G,Nr:()=>H,Gf:()=>W,nh:()=>Q,Rf:()=>V,D6:()=>k,Sm:()=>z,Ef:()=>Z,jW:()=>q,kQ:()=>B,JG:()=>X,js:()=>$,q$:()=>J,OZ:()=>K,Nc:()=>ee,NV:()=>te,I5:()=>re,QL:()=>ne,I:()=>ie,ku:()=>oe,EU:()=>le,IV:()=>ae,HT:()=>ue,lg:()=>se,ds:()=>ce,VF:()=>pe,DD:()=>de,uo:()=>fe,Ry:()=>ye,ZH:()=>Ee,AQ:()=>Fe,yC:()=>me,F:()=>_e,mc:()=>Re,uM:()=>Te,eJ:()=>Oe,uP:()=>ge,N5:()=>Ie,bn:()=>Le,Bm:()=>ve,F2:()=>Ae,jR:()=>Se,$J:()=>De});var n=r(75875),i=r.n(n);function o(e){return(o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}var l="ADD_FILTER_FIELD",a="REMOVE_FILTER_FIELD",u="UPDATE_FILTER_FIELD",s="UPDATE_EXCEPTION_FIELD",c="ADD_GROUP_FIELD",p="UPDATE_LOGIC_COMBO",d="REMOVE_GROUP_FIELD",f="CHANGE_CASCADING_VALUE",y="EXPAND_ATTRIBUTE_PANEL",E="EXPAND_SPATIAL_PANEL",F="QUERYFORM:EXPAND_CROSS_LAYER",m="QUERYFORM:SET_CROSS_LAYER_PARAMETER",_="QUERYFORM:RESET_CROSS_LAYER_FILTER",R="SELECT_SPATIAL_METHOD",b="SELECT_VIEWPORT_SPATIAL_METHOD",T="UPDATE_GEOMETRY",O="SELECT_SPATIAL_OPERATION",g="CHANGE_SPATIAL_ATTRIBUTE",I="CHANGE_SPATIAL_FILTER_VALUE",L="REMOVE_SPATIAL_SELECT",v="SHOW_SPATIAL_DETAILS",A="QUERY_FORM_SEARCH",S="QUERY_FORM_RESET",D="SHOW_GENERATED_FILTER",P="CHANGE_DWITHIN_VALUE",h="ZONE_SEARCH",N="ZONE_SEARCH_ERROR",w="ZONE_FILTER",U="ZONE_CHANGE",C="ZONES_RESET",j="SIMPLE_FILTER_FIELD_UPDATE",Y="ADD_SIMPLE_FILTER_FIELD",M="REMOVE_SIMPLE_FILTER_FIELD",x="REMOVE_ALL_SIMPLE_FILTER_FIELDS",G="UPDATE_FILTER_FIELD_OPTIONS",H="LOADING_FILTER_FIELD_OPTIONS",W="QUERYFORM:ADD_CROSS_LAYER_FILTER_FIELD",Q="QUERYFORM:UPDATE_CROSS_LAYER_FILTER_FIELD",V="QUERYFORM:REMOVE_CROSS_LAYER_FILTER_FIELD",k="SET_AUTOCOMPLETE_MODE",z="TOGGLE_AUTOCOMPLETE_MENU",Z="QUERYFORM:LOAD_FILTER";function q(e){return{type:l,groupId:e}}function B(e,t){return{type:c,groupId:e,index:t}}function X(e){return{type:a,rowId:e}}function $(e,t){return{type:z,rowId:e,status:t}}function J(e,t,r,n){var i=arguments.length>4&&void 0!==arguments[4]?arguments[4]:{};return{type:u,rowId:e,fieldName:t,fieldValue:r,fieldType:n,fieldOptions:i}}function K(e,t){return{type:s,rowId:e,exceptionMessage:t}}function ee(e,t){return{type:p,groupId:e,logic:t}}function te(e){return{type:k,status:e}}function re(e){return{type:d,groupId:e}}function ne(e){return{type:f,attributes:e}}function ie(e){return{type:y,expand:e}}function oe(e){return{type:E,expand:e}}function le(e){return{type:F,expand:e}}function ae(e,t){return{type:m,key:e,value:t}}function ue(e,t){return{type:R,fieldName:t,method:e}}function se(){return{type:b}}function ce(e){return{type:T,geometry:e}}function pe(e,t){return{type:O,fieldName:t,operation:e}}function de(e){return{type:g,attribute:e}}function fe(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.feature,r=e.srsName,n=e.collectGeometries,i=e.style,o=e.options,l=e.value;return{type:I,value:l,collectGeometries:n,options:o,geometry:t&&t.geometry,feature:t,srsName:r,style:i}}function ye(){return{type:L}}function Ee(e){return{type:v,show:e}}function Fe(e){return{type:P,distance:e}}function me(e,t){return{type:A,searchUrl:e,filterObj:t}}function _e(e){return{type:Z,filter:e}}function Re(e){return{type:S,skip:e}}function be(e,t){return{type:N,error:e,id:t}}function Te(e,t){return{type:h,active:e,id:t}}function Oe(e,t,r){return function(n){return i().post(e,t,{timeout:1e4,headers:{Accept:"application/json","Content-Type":"text/plain"}}).then((function(i){var l=i.data;if("object"!==o(l))try{l=JSON.parse(l)}catch(i){n(be("Search result broken ("+e+":   "+t+"): "+i.message,r))}n(function(e,t){return{type:w,data:e,id:t}}(l,r)),n(Te(!1,r))})).catch((function(e){n(be(e,r))}))}}function ge(e,t){return{type:U,id:e,value:t}}function Ie(e){return{type:W,rowId:(new Date).getTime(),groupId:e}}function Le(e,t,r,n){var i=arguments.length>4&&void 0!==arguments[4]?arguments[4]:{};return{type:Q,rowId:e,fieldName:t,fieldValue:r,fieldType:n,fieldOptions:i}}function ve(e){return{type:V,rowId:e}}function Ae(){return{type:_}}function Se(e,t){return{type:H,status:e,filterField:t}}function De(e,t,r){return{type:G,filterField:e,options:t,valuesCount:r}}},95797:(e,t,r)=>{"use strict";r.d(t,{DR:()=>n,S0:()=>i,u7:()=>o,lj:()=>l,yz:()=>a,lN:()=>u,zW:()=>s,Yx:()=>c,VN:()=>p,Hu:()=>d,VT:()=>f,RD:()=>y,Qq:()=>E,R1:()=>F,_T:()=>m,vO:()=>_,XO:()=>R,jG:()=>b,Xc:()=>T,gT:()=>O,rG:()=>g,t3:()=>I,Fs:()=>L,w_:()=>v,Lm:()=>A,rh:()=>S,rP:()=>D,IO:()=>P}),r(75875);var n="LAYER_SELECTED_FOR_SEARCH",i="FEATURE_TYPE_SELECTED",o="FEATURE_TYPE_LOADED",l="FEATURE_LOADED",a="FEATURE_LOADING",u="FEATURE_TYPE_ERROR",s="FEATURE_ERROR",c="QUERY_CREATE",p="QUERY:UPDATE_QUERY",d="QUERY_RESULT",f="QUERY_ERROR",y="RESET_QUERY",E="QUERY",F="INIT_QUERY_PANEL",m="QUERY:TOGGLE_SYNC_WMS",_="QUERY:TOGGLE_LAYER_FILTER";function R(){return{type:m}}function b(){return{type:_}}function T(){return{type:F}}function O(e,t){return{type:i,url:e,typeName:t}}function g(e,t){return{type:o,typeName:e,featureType:t}}function I(e,t){return{type:u,typeName:e,error:t}}function L(e){return{type:a,isLoading:e}}function v(e,t,r,n,i){return{type:d,searchUrl:t,filterObj:r,result:e,queryOptions:n,reason:i}}function A(e){return{type:f,error:e}}function S(e,t){return{type:p,updates:e,reason:t}}function D(e,t){return{type:c,searchUrl:e,filterObj:t}}function P(e,t,r,n){return{type:E,searchUrl:e,filterObj:t,queryOptions:r,reason:n}}},43614:(e,t,r)=>{"use strict";r.d(t,{Z:()=>y});var n=r(27418),i=r.n(n),o=r(30294),l=r(61365);function a(e){return(a="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function u(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function s(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function c(e,t){return(c=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function p(e,t){return!t||"object"!==a(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function d(e){return(d=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}var f=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&c(e,t)}(l,e);var t,r,n,i,o=(n=l,i=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=d(n);if(i){var r=d(this).constructor;e=Reflect.construct(t,arguments,r)}else e=t.apply(this,arguments);return p(this,e)});function l(){return u(this,l),o.apply(this,arguments)}return t=l,(r=[{key:"handleDialogClick",value:function(e){e.target===e.currentTarget&&this.props.onHide(e)}}])&&s(t.prototype,r),l}(o.Modal);const y=i()((0,l.Z)(f),{Body:o.Modal.Body,Dialog:o.Modal.Dialog,Footer:o.Modal.Footer,Header:o.Modal.Header,Title:o.Modal.Title})},97301:(e,t,r)=>{"use strict";r.d(t,{Z:()=>d});var n=r(95797),i=r(7878),o=r(82904),l=r(27418),a=r.n(l);function u(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function s(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}var c=function(e){return["STATE_NAME","STATE_ABBR","SUB_REGION","STATE_FIPS"].map((function(t){return{attribute:t,values:e.features.reduce((function(e,r){return-1===e.indexOf(r.properties[t])?[].concat((n=e,function(e){if(Array.isArray(e))return s(e)}(n)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(n)||function(e,t){if(e){if("string"==typeof e)return s(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?s(e,t):void 0}}(n)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()),[r.properties[t]]).sort():e;var n}),[])}})).reduce((function(e,t){return a()(e,u({},t.attribute,t.values.map((function(e){return{id:e,name:e}}))))}),{})},p={featureTypes:{},data:{},result:null,resultError:null,syncWmsFilter:!1,isLayerFilter:!1};const d=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:p,t=arguments.length>1?arguments[1]:void 0;switch(t.type){case n.S0:return a()({},e,{typeName:t.typeName,url:t.url});case n.u7:return a()({},e,{featureTypes:a()({},e.featureTypes,u({},t.typeName,t.featureType))});case n.lN:return a()({},e,{featureTypes:a()({},e.featureTypes,u({},t.typeName,{error:t.error}))});case n.yz:return a()({},e,{featureLoading:t.isLoading});case n.lj:return a()({},e,{featureLoading:!1,data:a()({},e.data,u({},t.typeName,c(t.feature)))});case n.zW:return a()({},e,{featureLoading:!1,featureTypes:a()({},e.data,u({},t.typeName,{error:t.error}))});case n.Yx:return a()({},e,{isNew:!0,searchUrl:t.searchUrl,filterObj:t.filterObj});case n.VN:return a()({},e,{filterObj:a()({},e.filterObj,t.updates)});case n.Hu:return a()({},e,{isNew:!1,result:t.result,searchUrl:t.searchUrl,filterObj:t.filterObj,resultError:null});case n.VT:return a()({},e,{isNew:!1,result:null,resultError:t.error});case o.l:case i.Eg:return t.skip&&t.skip.indexOf("query")>=0?e:a()({},e,{isNew:!1,result:null,filterObj:null,searchUrl:null});case n.RD:return a()({},e,{result:null,resultError:null});case n._T:return a()({},e,{syncWmsFilter:!e.syncWmsFilter});case n.vO:return a()({},e,{isLayerFilter:!e.isLayerFilter});default:return e}}},46905:(e,t,r)=>{"use strict";r.d(t,{Z:()=>I});var n=r(7878),i=r(4206),o=r(27418),l=r.n(o),a=r(19412),u=r.n(a),s=r(94707),c=r.n(s),p=r(27361),d=r.n(p),f=r(61868),y=["attribute"];function E(e,t){if(null==e)return{};var r,n,i=function(e,t){if(null==e)return{};var r,n,i={},o=Object.keys(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||(i[r]=e[r]);return i}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(i[r]=e[r])}return i}function F(e){return(F="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function m(e){return function(e){if(Array.isArray(e))return _(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||function(e,t){if(e){if("string"==typeof e)return _(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?_(e,t):void 0}}(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function _(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}function R(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function b(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?R(Object(r),!0).forEach((function(t){T(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):R(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function T(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var O={searchUrl:null,featureTypeConfigUrl:null,showGeneratedFilter:!1,attributePanelExpanded:!0,spatialPanelExpanded:!0,crossLayerExpanded:!0,showDetailsPanel:!1,groupLevels:5,useMapProjection:!1,toolbarEnabled:!0,groupFields:[{id:1,logic:"OR",index:0}],maxFeaturesWPS:5,filterFields:[],spatialField:{method:null,attribute:"the_geom",operation:"INTERSECTS",geometry:null},simpleFilterFields:[]},g=function(){var e,t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},n=l()({},t,(T(e={},r.fieldName,r.fieldValue),T(e,"type",r.fieldType),e),{fieldOptions:l()({},b({},t.fieldOptions),{currentPage:void 0===r.fieldOptions.currentPage?1:r.fieldOptions.currentPage})});return"attribute"===r.fieldName&&(n.value="string"===r.fieldType?"":null,n.operator="="),"operator"===r.fieldName&&(n.value=null),n};const I=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:O,t=arguments.length>1?arguments[1]:void 0;switch(t.type){case n.E6:var r={rowId:(new Date).getTime(),groupId:t.groupId,attribute:null,operator:"=",value:null,type:null,fieldOptions:{valuesCount:0,currentPage:1},exception:null};return l()({},e,{filterFields:e.filterFields?[].concat(m(e.filterFields),[r]):[r]});case n.vo:return l()({},e,{filterFields:e.filterFields.filter((function(e){return e.rowId!==t.rowId}))});case n.l1:return l()({},e,{filterFields:e.filterFields.map((function(e){return e.rowId===t.rowId?g(e,t):e}))});case n.o7:return l()({},e,{filterFields:e.filterFields.map((function(e){return e.rowId===t.filterField.rowId?l()({},e,{options:l()({},b({},e.options),T({},e.attribute,t.options))},{fieldOptions:l()({},b({},e.fieldOptions),{valuesCount:t.valuesCount})}):e}))});case n.Sm:return l()({},e,{filterFields:e.filterFields.map((function(e){return e.rowId===t.rowId?l()({},e,{openAutocompleteMenu:t.status}):e}))});case n.D6:return l()({},e,{autocompleteEnabled:t.status});case n.Nr:return l()({},e,{filterFields:e.filterFields.map((function(e){return e.rowId===t.filterField.rowId?l()({},e,{loading:t.status}):e}))});case n.J9:return l()({},e,{filterFields:e.filterFields.map((function(e){return e.rowId===t.rowId?l()({},e,{exception:t.exceptionMessage}):e}))});case n.U:var o={id:(new Date).getTime(),logic:"OR",groupId:t.groupId,index:t.index+1};return l()({},e,{groupFields:e.groupFields?[].concat(m(e.groupFields),[o]):[o]});case n.z8:return l()({},e,{groupFields:e.groupFields.map((function(e){return e.id===t.groupId?l()({},e,{logic:t.logic}):e}))});case n.ql:return l()({},e,{filterFields:e.filterFields.filter((function(e){return e.groupId!==t.groupId})),groupFields:e.groupFields.filter((function(e){return e.id!==t.groupId}))});case n.O_:return l()({},e,{filterFields:e.filterFields.map((function(e){for(var r=0;r<t.attributes.length;r++)if(e.attribute===t.attributes[r].id)return l()({},e,{value:null});return e}))});case n.M$:return l()({},e,{attributePanelExpanded:t.expand});case n.Ug:return l()({},e,{spatialPanelExpanded:t.expand});case n.p5:return l()({},e,{crossLayerExpanded:t.expand});case n.Fz:return l()({},e,{crossLayerFilter:(0,f.t8)(t.key,t.value,e.crossLayerFilter)});case n.Gf:return(0,f.vy)("crossLayerFilter.collectGeometries.queryCollection.filterFields",{rowId:t.rowId,groupId:t.groupId,attribute:null,operator:"=",value:null,type:null,fieldOptions:{valuesCount:0,currentPage:1},exception:null},{rowId:t.rowId},e);case n.nh:return(0,f.t8)("crossLayerFilter.collectGeometries.queryCollection.filterFields",(d()(e,"crossLayerFilter.collectGeometries.queryCollection.filterFields")||[]).map((function(e){return e.rowId===t.rowId?g(e,t):e})),e);case n.Rf:return(0,f.z6)("crossLayerFilter.collectGeometries.queryCollection.filterFields",{rowId:t.rowId},e);case n.WZ:return l()({},e,{crossLayerFilter:{attribute:e.crossLayerFilter&&e.crossLayerFilter.attribute}});case n.bP:var a;return l()({},e,{spatialField:l()({},e.spatialField,(a={},T(a,t.fieldName,t.method),T(a,"geometry",null),a))});case n.d_:return l()({},e,{spatialField:l()({},e.spatialField,{geometry:t.geometry})},{toolbarEnabled:!0});case n.xM:return l()({},e,{spatialField:l()({},e.spatialField,T({},t.fieldName,t.operation))});case n.bl:return l()({},e,{spatialField:l()({},e.spatialField,{attribute:t.attribute}),crossLayerFilter:l()({},e.crossLayerFilter,{attribute:t.attribute})});case i.hZ:return"queryform"===t.owner&&"start"===t.status?l()({},e,{toolbarEnabled:!1}):e;case n.Wi:return l()({},e,{toolbarEnabled:!0,spatialField:l()({},e.spatialField,{value:t.value,collectGeometries:t.collectGeometries,geometry:t.srsName?b(b({},t.geometry),{},{projection:t.srsName}):t.geometry})});case i.pb:return"queryform"===t.owner?l()({},e,{toolbarEnabled:!0,spatialField:l()({},e.spatialField,{collectGeometries:t.collectGeometries,geometry:t.geometry})}):e;case n.PN:var s=l()({},O.spatialField,{attribute:e.spatialField.attribute,value:void 0});return l()({},e,{spatialField:l()({},e.spatialField,s)});case n._M:return l()({},e,{showDetailsPanel:t.show});case n.Eg:var p=l()({},O.spatialField,{attribute:e.spatialField.attribute,value:void 0}),_={attribute:e.crossLayerFilter&&e.crossLayerFilter.attribute};return l()({},e,O,{spatialField:p,crossLayerFilter:_});case n.V1:return l()({},e,{showGeneratedFilter:t.data});case n.cY:return l()({},e,{spatialField:l()({},e.spatialField,{geometry:l()({},e.spatialField.geometry,{distance:t.distance})})});case n.co:return l()({},e,{spatialField:l()({},e.spatialField,{zoneFields:e.spatialField.zoneFields.map((function(e){return e.id===t.id&&t.data.features&&t.data.features.length>0?l()({},e,{values:t.data.features,open:!0,error:null}):e}))})});case n.RD:return l()({},e,{spatialField:l()({},e.spatialField,{zoneFields:e.spatialField.zoneFields.map((function(e){return e.id===t.id?l()({},e,{busy:t.active}):e}))})});case n.uY:var R,I,L=e.spatialField.zoneFields.map((function(e){if(e.id===t.id){if(R=e.multivalue?t.value.value:t.value.value[0],t.value.feature[0]){var r=t.value.feature[0],n=r.geometry_name;if(e.multivalue&&t.value.feature.length>1){for(var i=1;i<t.value.feature.length;i++){var o=t.value.feature[i];o&&(r=u()(r,o))}I={coordinates:r.geometry.coordinates,geometryName:n,geometryType:r.geometry.type}}else I={coordinates:r.geometry.coordinates,geometryName:n,geometryType:r.geometry.type}}return l()({},e,{value:R,open:!1,geometryName:I?I.geometryName:null})}return e.dependson&&t.id===e.dependson.id?l()({},e,{disabled:!1,values:null,value:null,open:!1,dependson:l()({},e.dependson,{value:R})}):e})),v=c()({type:"FeatureCollection",features:t.value.feature});return l()({},e,{spatialField:l()({},e.spatialField,{zoneFields:L,geometry:v&&I?{extent:v,type:I.geometryType,coordinates:I.coordinates}:null})});case n.H8:return l()({},e,{spatialField:l()({},e.spatialField,{zoneFields:e.spatialField.zoneFields.map((function(e){var t=l()({},e,{values:null,value:null,open:!1,error:null});return e.dependson?l()({},t,{disabled:!0,open:!1,value:null,dependson:l()({},e.dependson,{value:null})}):t})),geometry:null})});case n.Hl:var A;return l()({},e,{spatialField:l()({},e.spatialField,{zoneFields:e.spatialField.zoneFields.map((function(e){return e.id===t.id?(A="object"!==F(t.error)?t.error.status&&t.error.statusText&&t.error.data?{status:t.error.status,statusText:t.error.statusText,data:t.error.data}:{message:t.error.message||"unknown error"}:t.error,l()({},e,{error:A,busy:!1})):e}))})});case n.je:var S=e.simpleFilterFields.reduce((function(e,r){return r.fieldId===t.id?e.push(b(b({},r),t.properties)):e.push(r),e}),[]);return b(b({},e),{},{simpleFilterFields:S});case n.go:var D=t.properties.fieldId?t.properties:b(b({},t.properties),{},{fieldId:(new Date).getTime()}),P=e.simpleFilterFields?[].concat(m(e.simpleFilterFields),[D]):[D];return b(b({},e),{},{simpleFilterFields:P});case n._8:return b(b({},e),{},{simpleFilterFields:e.simpleFilterFields.filter((function(e){return e.fieldId!==t.id}))});case n.xd:return b(b({},e),{},{simpleFilterFields:[]});case n.Ef:var h=O.spatialField,N=(h.attribute,E(h,y)),w=l()({},O,{spatialField:b({},N)}),U=t.filter||w,C=U.spatialField,j=U.filterFields,Y=U.groupFields,M=U.crossLayerFilter,x=U.attributePanelExpanded,G=U.spatialPanelExpanded,H=U.crossLayerExpanded;return b(b({},e),{attributePanelExpanded:x,spatialPanelExpanded:G,crossLayerExpanded:H,spatialField:b(b({},C),{},{attribute:C&&C.attribute||e.spatialField&&e.spatialField.attribute}),filterFields:j,groupFields:Y,crossLayerFilter:b(b({},M),{},{attribute:M&&M.attribute||e.crossLayerFilter&&e.crossLayerFilter.attribute})});default:return e}}}}]);