(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[4189],{21262:(e,t,n)=>{var r=n(46553);e.exports=function(e,t,n){for(var o=-1,u=e.length;++o<u;){var i=e[o],a=t(i);if(null!=a&&(void 0===l?a==a&&!r(a):n(a,l)))var l=a,s=i}return s}},85812:e=>{e.exports=function(e,t){return e<t}},77820:(e,t,n)=>{var r=n(59130),o=n(71445);e.exports=function(e,t){var n=-1,u=o(e)?Array(e.length):[];return r(e,(function(e,r,o){u[++n]=t(e,r,o)})),u}},84847:(e,t,n)=>{var r=n(54528),o=n(83733),u=n(77820),i=n(65491),a=n(75542),l=n(80961),s=n(70475);e.exports=function(e,t,n){var c=-1;t=r(t.length?t:[s],a(o));var p=u(e,(function(e,n,o){return{criteria:r(t,(function(t){return t(e)})),index:++c,value:e}}));return i(p,(function(e,t){return l(e,t,n)}))}},65491:e=>{e.exports=function(e,t){var n=e.length;for(e.sort(t);n--;)e[n]=e[n].value;return e}},57312:(e,t,n)=>{var r=n(46553);e.exports=function(e,t){if(e!==t){var n=void 0!==e,o=null===e,u=e==e,i=r(e),a=void 0!==t,l=null===t,s=t==t,c=r(t);if(!l&&!c&&!i&&e>t||i&&a&&s&&!l&&!c||o&&a&&s||!n&&s||!u)return 1;if(!o&&!i&&!c&&e<t||c&&n&&u&&!o&&!i||l&&n&&u||!a&&u||!s)return-1}return 0}},80961:(e,t,n)=>{var r=n(57312);e.exports=function(e,t,n){for(var o=-1,u=e.criteria,i=t.criteria,a=u.length,l=n.length;++o<a;){var s=r(u[o],i[o]);if(s)return o>=l?s:s*("desc"==n[o]?-1:1)}return e.index-t.index}},33398:(e,t,n)=>{var r=n(94753),o=n(84847),u=n(98554),i=n(85270),a=u((function(e,t){if(null==e)return[];var n=t.length;return n>1&&i(e,t[0],t[1])?t=[]:n>2&&i(t[0],t[1],t[2])&&(t=[t[0]]),o(e,r(t,1),[])}));e.exports=a},33528:(e,t,n)=>{"use strict";n.d(t,{gJ:()=>r,Oj:()=>o,jp:()=>u,CM:()=>i,DU:()=>a,aO:()=>l,v6:()=>s,K8:()=>c,IN:()=>p,zh:()=>f,AH:()=>E,Ub:()=>y,_9:()=>d,JB:()=>v,oh:()=>S,AY:()=>R,yi:()=>_,SW:()=>T,Hk:()=>m,iQ:()=>I,dY:()=>b,$:()=>A,_u:()=>O,gG:()=>w,DI:()=>D,dZ:()=>h,qw:()=>g,f$:()=>F,bZ:()=>U,$O:()=>G,sF:()=>C,Gk:()=>P,vO:()=>N,ut:()=>Y,MK:()=>L,VV:()=>M,B8:()=>x,VM:()=>j,a3:()=>K,Xp:()=>V,DA:()=>H,sK:()=>W,yA:()=>X,r:()=>k,iB:()=>q,EH:()=>B,Yd:()=>Q,Hg:()=>z,Lz:()=>Z,ye:()=>J,Jb:()=>$,d:()=>ee,fT:()=>te,Ib:()=>ne,Pl:()=>re,UB:()=>oe,Uh:()=>ue,QT:()=>ie,oL:()=>ae,Ap:()=>le,KD:()=>se,Z_:()=>ce,Vw:()=>pe,sY:()=>fe,kA:()=>Ee,gr:()=>ye,pX:()=>de,F5:()=>ve,MO:()=>Se,dq:()=>Re,DY:()=>_e,oO:()=>Te,uF:()=>me,a8:()=>Ie,Pv:()=>be,an:()=>Ae,lg:()=>Oe,nY:()=>we,nG:()=>De,lx:()=>he,$S:()=>ge,gc:()=>Fe,Uz:()=>Ue,fO:()=>Ge,$E:()=>Ce,cE:()=>Pe,JK:()=>Ne,YV:()=>Ye,t9:()=>Le,YG:()=>Me,HT:()=>xe,MY:()=>je,ve:()=>Ke,hB:()=>Ve,Ox:()=>He,zd:()=>We,aT:()=>Xe,VH:()=>ke,Yb:()=>qe,Jr:()=>Be,pP:()=>Qe});var r="FEATUREGRID:SET_UP",o="FEATUREGRID:SELECT_FEATURES",u="FEATUREGRID:DESELECT_FEATURES",i="FEATUREGRID:CLEAR_SELECTION",a="FEATUREGRID:SET_SELECTION_OPTIONS",l="FEATUREGRID:TOGGLE_MODE",s="FEATUREGRID:TOGGLE_FEATURES_SELECTION",c="FEATUREGRID:FEATURES_MODIFIED",p="FEATUREGRID:NEW_FEATURE",f="FEATUREGRID:SAVE_CHANGES",E="FEATUREGRID:SAVING",y="FEATUREGRID:START_EDITING_FEATURE",d="FEATUREGRID:START_DRAWING_FEATURE",v="FEATUREGRID:DELETE_GEOMETRY",S="FEATUREGRID:DELETE_GEOMETRY_FEATURE",R="FEATUREGRID:SAVE_SUCCESS",_="FEATUREGRID:CLEAR_CHANGES",T="FEATUREGRID:SAVE_ERROR",m="FEATUREGRID:DELETE_SELECTED_FEATURES",I="SET_FEATURES",b="FEATUREGRID:SORT_BY",A="FEATUREGRID:SET_LAYER",O="QUERY:UPDATE_FILTER",w="FEATUREGRID:CHANGE_PAGE",D="FEATUREGRID:GEOMETRY_CHANGED",h="DOCK_SIZE_FEATURES",g="FEATUREGRID:TOGGLE_TOOL",F="FEATUREGRID:CUSTOMIZE_ATTRIBUTE",U="ASK_CLOSE_FEATURE_GRID_CONFIRM",G="FEATUREGRID:OPEN_GRID",C="FEATUREGRID:CLOSE_GRID",P="FEATUREGRID:CLEAR_CHANGES_CONFIRMED",N="FEATUREGRID:FEATURE_GRID_CLOSE_CONFIRMED",Y="FEATUREGRID:SET_PERMISSION",L="FEATUREGRID:DISABLE_TOOLBAR",M="FEATUREGRID:ACTIVATE_TEMPORARY_CHANGES",x="FEATUREGRID:DEACTIVATE_GEOMETRY_FILTER",j="FEATUREGRID:ADVANCED_SEARCH",K="FEATUREGRID:ZOOM_ALL",V="FEATUREGRID:INIT_PLUGIN",H="FEATUREGRID:SIZE_CHANGE",W="FEATUREGRID:TOGGLE_SHOW_AGAIN_FLAG",X="FEATUREGRID:HIDE_SYNC_POPOVER",k="FEATUREGRID:UPDATE_EDITORS_OPTIONS",q="FEATUREGRID:LAUNCH_UPDATE_FILTER_FUNC",B={EDIT:"EDIT",VIEW:"VIEW"},Q="FEATUREGRID:START_SYNC_WMS",z="FEATUREGRID:STOP_SYNC_WMS",Z="STORE_ADVANCED_SEARCH_FILTER",J="LOAD_MORE_FEATURES",$="FEATUREGRID:QUERY_RESULT",ee="FEATUREGRID:SET_TIME_SYNC",te="FEATUREGRID:SET_PAGINATION";function ne(){return{type:W}}function re(){return{type:X}}function oe(e,t){return{type:$,features:e,pages:t}}function ue(e){return{type:Z,filterObj:e}}function ie(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return{type:V,options:e}}function ae(){return{type:P}}function le(){return{type:N}}function se(e,t){return{type:o,features:e,append:t}}function ce(e){return{type:r,options:e}}function pe(e){return{type:D,features:e}}function fe(){return{type:y}}function Ee(){return{type:d}}function ye(e){return{type:u,features:e}}function de(){return{type:v}}function ve(e){return{type:S,features:e}}function Se(){return{type:i}}function Re(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.multiselect,n=void 0!==t&&t;return{type:a,multiselect:n}}function _e(e,t){return{type:b,sortBy:e,sortOrder:t}}function Te(e,t){return{type:w,page:e,size:t}}function me(e){return{type:A,id:e}}function Ie(e){var t=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return{type:O,update:e,append:t}}function be(e,t){return{type:g,tool:e,value:t}}function Ae(e,t,n){return{type:F,name:e,key:t,value:n}}function Oe(){return{type:l,mode:B.EDIT}}function we(){return{type:l,mode:B.VIEW}}function De(e,t){return{type:c,features:e,updated:t}}function he(e){return{type:p,features:e}}function ge(){return{type:f}}function Fe(){return{type:R}}function Ue(){return{type:m}}function Ge(){return{type:E}}function Ce(){return{type:_}}function Pe(){return{type:T}}function Ne(){return{type:U}}function Ye(){return{type:C}}function Le(){return{type:G}}function Me(e){return{type:L,disabled:e}}function xe(e){return{type:Y,permission:e}}function je(){return{type:j}}function Ke(){return{type:K}}function Ve(){return{type:Q}}function He(e,t){return{type:H,size:e,dockProps:t}}var We=function(e){return{type:J,pages:e}},Xe=function(e){return{type:M,activated:e}},ke=function(e){return{type:x,deactivated:e}},qe=function(e){return{type:ee,value:e}},Be=function(e){return{type:te,size:e}},Qe=function(e){return{type:q,updateFilterAction:e}}},21914:(e,t,n)=>{"use strict";n.d(t,{XL:()=>o,km:()=>u,Ih:()=>i,Xw:()=>a,Pn:()=>l,DZ:()=>s,e8:()=>c,E0:()=>p,F9:()=>f,X_:()=>E,pb:()=>y,qb:()=>d,Re:()=>v,ih:()=>S,xy:()=>R,jL:()=>_,oz:()=>T,ph:()=>m,lF:()=>I,gG:()=>b,cb:()=>A,GI:()=>O,B1:()=>w,fv:()=>D,gc:()=>h,zX:()=>g,ZF:()=>F,Zb:()=>U,Fm:()=>G,sV:()=>C,Mn:()=>P,LU:()=>N,XP:()=>Y,WU:()=>L,JB:()=>M,g:()=>x,ws:()=>j,HP:()=>K,aN:()=>V,Pg:()=>W,u0:()=>X,TM:()=>k,PM:()=>q,lK:()=>B,sv:()=>Q,MO:()=>z,oO:()=>Z,Mc:()=>J,Zw:()=>$,RA:()=>ee,am:()=>te,ZM:()=>ne,wm:()=>re,Y$:()=>oe});var r=n(47310),o="LOAD_FEATURE_INFO",u="ERROR_FEATURE_INFO",i="EXCEPTIONS_FEATURE_INFO",a="CHANGE_MAPINFO_STATE",l="NEW_MAPINFO_REQUEST",s="PURGE_MAPINFO_RESULTS",c="CHANGE_MAPINFO_FORMAT",p="SHOW_MAPINFO_MARKER",f="HIDE_MAPINFO_MARKER",E="SHOW_REVERSE_GEOCODE",y="HIDE_REVERSE_GEOCODE",d="GET_VECTOR_INFO",v="NO_QUERYABLE_LAYERS",S="CLEAR_WARNING",R="FEATURE_INFO_CLICK",_="IDENTIFY:UPDATE_FEATURE_INFO_CLICK_POINT",T="IDENTIFY:TOGGLE_HIGHLIGHT_FEATURE",m="TOGGLE_MAPINFO_STATE",I="UPDATE_CENTER_TO_MARKER",b="IDENTIFY:CHANGE_PAGE",A="IDENTIFY:CLOSE_IDENTIFY",O="IDENTIFY:CHANGE_FORMAT",w="IDENTIFY:TOGGLE_SHOW_COORD_EDITOR",D="IDENTIFY:EDIT_LAYER_FEATURES",h="IDENTIFY:CURRENT_EDIT_FEATURE_QUERY",g="IDENTIFY:SET_MAP_TRIGGER",F="IDENTIFY:TOGGLE_EMPTY_MESSAGE_GFI",U="IDENTIFY:SET_SHOW_IN_MAP_POPUP";function G(e,t,n,r,u){return{type:o,data:t,reqId:e,requestParams:n,layerMetadata:r,layer:u}}function C(e,t,n,r){return{type:u,error:t,reqId:e,requestParams:n,layerMetadata:r}}function P(e,t,n,r){return{type:i,reqId:e,exceptions:t,requestParams:n,layerMetadata:r}}function N(){return{type:v}}function Y(){return{type:S}}function L(e,t){return{type:l,reqId:e,request:t}}function M(e,t,n,r){return{type:d,layer:e,request:t,metadata:n,queryableLayers:r}}function x(){return{type:s}}function j(e){return{type:c,infoFormat:e}}function K(){return{type:p}}function V(){return{type:f}}function H(e){return{type:E,reverseGeocodeData:e.data}}function W(e){return function(t){r.Z.reverseGeocode(e).then((function(e){t(H(e))})).catch((function(e){t(H(e))}))}}function X(){return{type:y}}function k(){return{type:m}}function q(e){return{type:I,status:e}}function B(e,t){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:[],r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:{},o=arguments.length>4&&void 0!==arguments[4]?arguments[4]:null;return{type:R,point:e,layer:t,filterNameList:n,overrideParams:r,itemId:o}}function Q(e){return{type:_,point:e}}function z(e){return{type:T,enabled:e}}function Z(e){return{type:b,index:e}}var J=function(){return{type:A}},$=function(e){return{type:O,format:e}},ee=function(e){return{type:w,showCoordinateEditor:e}},te=function(e){return{type:D,layer:e}},ne=function(e){return{type:h,query:e}},re=function(e){return{type:g,trigger:e}},oe=function(e){return{type:U,value:e}}},95797:(e,t,n)=>{"use strict";n.d(t,{DR:()=>r,S0:()=>o,u7:()=>u,lj:()=>i,yz:()=>a,lN:()=>l,zW:()=>s,Yx:()=>c,VN:()=>p,Hu:()=>f,VT:()=>E,RD:()=>y,Qq:()=>d,R1:()=>v,_T:()=>S,vO:()=>R,XO:()=>_,jG:()=>T,Xc:()=>m,gT:()=>I,rG:()=>b,t3:()=>A,Fs:()=>O,w_:()=>w,Lm:()=>D,rh:()=>h,rP:()=>g,IO:()=>F,zc:()=>U}),n(75875);var r="LAYER_SELECTED_FOR_SEARCH",o="FEATURE_TYPE_SELECTED",u="FEATURE_TYPE_LOADED",i="FEATURE_LOADED",a="FEATURE_LOADING",l="FEATURE_TYPE_ERROR",s="FEATURE_ERROR",c="QUERY_CREATE",p="QUERY:UPDATE_QUERY",f="QUERY_RESULT",E="QUERY_ERROR",y="RESET_QUERY",d="QUERY",v="INIT_QUERY_PANEL",S="QUERY:TOGGLE_SYNC_WMS",R="QUERY:TOGGLE_LAYER_FILTER";function _(){return{type:S}}function T(){return{type:R}}function m(){return{type:v}}function I(e,t){return{type:o,url:e,typeName:t}}function b(e,t){return{type:u,typeName:e,featureType:t}}function A(e,t){return{type:l,typeName:e,error:t}}function O(e){return{type:a,isLoading:e}}function w(e,t,n,r,o){return{type:f,searchUrl:t,filterObj:n,result:e,queryOptions:r,reason:o}}function D(e){return{type:E,error:e}}function h(e,t){return{type:p,updates:e,reason:t}}function g(e,t){return{type:c,searchUrl:e,filterObj:t}}function F(e,t,n,r){return{type:d,searchUrl:e,filterObj:t,queryOptions:n,reason:r}}function U(){return{type:y}}},47310:(e,t,n)=>{"use strict";n.d(t,{Z:()=>c});var r=n(75875),o=n.n(r),u=n(72500),i=n.n(u),a=n(27418),l=n.n(a),s={format:"json",bounded:0,polygon_geojson:1,priority:5};const c={geocode:function(e,t){var n=l()({q:e},s,t||{}),r=i().format({protocol:"https",host:"nominatim.openstreetmap.org",query:n});return o().get(r)},reverseGeocode:function(e,t){var n=l()({lat:e.lat,lon:e.lng},t||{},s),r=i().format({protocol:"https",host:"nominatim.openstreetmap.org/reverse",query:n});return o().get(r)}}},95917:(e,t,n)=>{"use strict";n.r(t),n.d(t,{default:()=>B});var r=n(22843),o=n(96828);function u(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?u(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):u(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}var l=function(e){var t={};return e.map((function(e){var n,r,o,u=null==e||null===(n=e.properties)||void 0===n?void 0:n.site_id;t[u]={data:[]};var i=[];null===(r=JSON.parse(null==e||null===(o=e.properties)||void 0===o?void 0:o.activities))||void 0===r||r.map((function(e){var n,r,o,a,l=null==e||null===(n=e.outputs)||void 0===n||null===(r=n[0])||void 0===r||null===(o=r.data)||void 0===o?void 0:o.dataList,s=l.map((function(e){return e.key}));s.indexOf("eventDate")>-1?a="eventDate":s.indexOf("surveyDate")>-1?a="surveyDate":s.indexOf("observationDate")>-1&&(a="observationDate");var c=l.filter((function(e){return e.key===a}))[0].value,p=Date.parse(c),f=t[u].data.filter((function(e){return e.time===p}))[0]||{};f.time=p,s.map((function(e){var t=l.filter((function(t){return t.key===e}))[0].value;parseFloat(t)&&(f[e]=parseFloat(t),-1===i.indexOf(e)&&i.push(e))})),t[u].data.push(f)})),t[u].availableXKeys=["time"],t[u].availableYKeys=i})),t},s=n(24852),c=n.n(s),p=n(71703),f=n(23885);function E(e){return(E="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function y(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}function d(e,t){return(d=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function v(e,t){return!t||"object"!==E(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function S(e){return(S=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function R(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}n(30381),n(87649);var _=n(45697),T=n(48465),m=(T.ScatterChart,T.Scatter,T.LineChart,T.Line,T.CartesianGrid,T.Label,T.Pie,T.ResponsiveContainer,T.XAxis,T.YAxis,T.Legend,T.Tooltip,function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&d(e,t)}(i,e);var t,n,r,o,u=(r=i,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=S(r);if(o){var n=S(this).constructor;e=Reflect.construct(t,arguments,n)}else e=t.apply(this,arguments);return v(this,e)});function i(e){var t;return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,i),(t=u.call(this,e)).state={},t}return t=i,(n=[{key:"render",value:function(){return c().createElement("div",{id:"swamps-chart"},c().createElement("div",{className:"chart-header"},"Header"),c().createElement("div",{className:"chart-mainbody"},c().createElement("p",null,"Body")),c().createElement("div",{className:"chart-footer"},"Footer"))}}])&&y(t.prototype,n),i}(c().Component));R(m,"propTypes",{setVisibleSwampsChart:_.func,setCurrentSwampsSurveySiteId:_.func,visibleSwampsChart:_.bool,currentSwampsSurveySiteId:_.string,currentSwampsSurveySite:_.object,swampsSurveyData:_.array,lineChartData:_.array,setSelectedXKey:_.func,setSelectedYKey:_.func,availableXKeys:_.array,availableYKeys:_.array,selectedXKey:_.string,selectedYKey:_.string}),R(m,"defaultProps",{});const I=(0,p.connect)((function(e){var t,n,r,o,u,i,a,l,s,c,p,f,E,y,d,v,S,R,_;return{currentSwampsSurveySiteId:null==e||null===(t=e.swamps)||void 0===t?void 0:t.currentSwampsSurveySiteId,currentSwampsSurveySite:null==e||null===(n=e.swamps)||void 0===n||null===(r=n.swampsSurveyData)||void 0===r?void 0:r.filter((function(t){var n;return t.properties.site_id===(null==e||null===(n=e.swamps)||void 0===n?void 0:n.currentSwampsSurveySiteId)}))[0],visibleSwampsChart:null==e||null===(o=e.swamps)||void 0===o?void 0:o.visibleSwampsChart,swampsSurveyData:null==e||null===(u=e.swamps)||void 0===u?void 0:u.swampsSurveyData,selectedXKey:(null==e||null===(i=e.swamps)||void 0===i?void 0:i.selectedXKey)||"time",selectedYKey:(null==e||null===(a=e.swamps)||void 0===a?void 0:a.selectedYKey)||"",availableXKeys:(null==e||null===(l=e.swamps)||void 0===l||null===(s=l.processedSwampsSurveyData)||void 0===s||null===(c=s[null==e||null===(p=e.swamps)||void 0===p?void 0:p.currentSwampsSurveySiteId])||void 0===c?void 0:c.availableXKeys)||["time"],availableYKeys:(null==e||null===(f=e.swamps)||void 0===f||null===(E=f.processedSwampsSurveyData)||void 0===E||null===(y=E[null==e||null===(d=e.swamps)||void 0===d?void 0:d.currentSwampsSurveySiteId])||void 0===y?void 0:y.availableYKeys)||[],lineChartData:(null==e||null===(v=e.swamps)||void 0===v||null===(S=v.processedSwampsSurveyData)||void 0===S||null===(R=S[null==e||null===(_=e.swamps)||void 0===_?void 0:_.currentSwampsSurveySiteId])||void 0===R?void 0:R.data)||[]}}),(function(e){return{setVisibleSwampsChart:function(t){return e((0,o.setVisibleSwampsChart)(t))},setCurrentSwampsSurveySiteId:function(t){return e((0,o.setCurrentSwampsSurveySiteId)(t))},setSelectedXKey:function(t){return e((0,o.setSelectedXKey)(t))},setSelectedYKey:function(t){return e((0,o.setSelectedYKey)(t))}}}))(m);function b(e){return(b="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function A(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}function O(e,t){return(O=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function w(e,t){return!t||"object"!==b(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function D(e){return(D=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function h(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}var g=n(45697),F=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&O(e,t)}(i,e);var t,n,r,o,u=(r=i,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=D(r);if(o){var n=D(this).constructor;e=Reflect.construct(t,arguments,n)}else e=t.apply(this,arguments);return w(this,e)});function i(e){var t;return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,i),(t=u.call(this,e)).state={},t}return t=i,(n=[{key:"render",value:function(){var e=this;return c().createElement(c().Fragment,null,c().createElement("div",{id:"swamps-controls",className:"simple-view-panel",style:{top:70*this.props.swampGroupLength,width:"480px"}},c().createElement("div",{className:"menu-rows-container"},c().createElement("div",{className:"row menu-row pull-left",style:{width:"480px",textAlign:"left"}},c().createElement(f.Button,{bsStyle:"success",bsSize:"xsmall",style:{margin:"2px",borderRadius:"2px"},onClick:function(){e.props.initSwamps()}},"Refresh Monitoring Data")))))}}])&&A(t.prototype,n),i}(c().Component);h(F,"propTypes",{initSwamps:g.func,swampGroupLength:g.number}),h(F,"defaultProps",{});const U=(0,p.connect)((function(e){var t,n,r,o;return{swampGroupLength:null==e||null===(t=e.layers)||void 0===t||null===(n=t.groups)||void 0===n||null===(r=n.filter((function(e){return"Swamps"===e.title}))[0])||void 0===r||null===(o=r.nodes)||void 0===o?void 0:o.length}}),(function(e){return{initSwamps:function(){return e((0,o.initSwamps)())}}}))(F);function G(e){return(G="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function C(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}function P(e,t){return(P=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function N(e,t){return!t||"object"!==G(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function Y(e){return(Y=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function L(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}var M=n(45697),x=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&P(e,t)}(i,e);var t,n,r,o,u=(r=i,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=Y(r);if(o){var n=Y(this).constructor;e=Reflect.construct(t,arguments,n)}else e=t.apply(this,arguments);return N(this,e)});function i(e){return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,i),u.call(this,e)}return t=i,(n=[{key:"componentDidMount",value:function(){}},{key:"render",value:function(){return c().createElement("div",{id:"swamps-container"},this.props.visibleSwampsChart?c().createElement(I,null):null,this.props.viewSwampsGroupId===this.props.openMenuGroupId?c().createElement("div",null,c().createElement(U,null)):null)}}])&&C(t.prototype,n),i}(c().Component);L(x,"propTypes",{visibleSwampsChart:M.bool,initSwamps:M.func,viewSwampsGroupId:M.string,openMenuGroupId:M.string}),L(x,"defaultProps",{});const j=(0,p.connect)((function(e){var t,n,r,o,u;return{visibleSwampsChart:null==e||null===(t=e.swamps)||void 0===t?void 0:t.visibleSwampsChart,viewSwampsGroupId:null==e||null===(n=e.mapConfigRawData)||void 0===n||null===(r=n.map)||void 0===r||null===(o=r.groups.filter((function(e){return"Swamps"===e.title}))[0])||void 0===o?void 0:o.id,openMenuGroupId:null==e||null===(u=e.simpleView)||void 0===u?void 0:u.openMenuGroupId}}),(function(e){return{initSwamps:function(){return e((0,o.initSwamps)())}}}))(x);var K=n(49977),V=n.n(K),H=n(21914),W=n(33528),X=n(95797),k=n(75875),q=n.n(k);const B=(0,r.rx)("Swamps",{component:j,reducers:{swamps:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=arguments.length>1?arguments[1]:void 0;switch(t.type){case o.SET_CURRENT_SWAMPS_SURVEY_SITE_ID:return i(i({},e),{},{currentSwampsSurveySiteId:t.currentSwampsSurveySiteId});case o.SAVE_SWAMPS_SURVEY_QUERY_TO_STORE:return i(i({},e),{},{swampsSurveyData:t.swampsSurveyData,processedSwampsSurveyData:l(t.swampsSurveyData)});case o.SET_VISIBLE_SWAMPS_CHART:return i(i({},e),{},{visibleSwampsChart:t.visible});case o.SET_SELECTED_X_KEY:return i(i({},e),{},{selectedXKey:t.selectedXKey});case o.SET_SELECTED_Y_KEY:return i(i({},e),{},{selectedYKey:t.selectedYKey});case o.REFRESH_PAGE:window.location.reload(!1);default:return e}}},epics:{initSwampsEpic:function(e){return e.ofType(o.INIT_SWAMPS).mergeMap((function(){return V().Observable.from(q().get("/swamps/api/update-from-airtables"))})).mergeMap((function(e){return console.log("initSwmap Exhaust",e),e?V().Observable.of((0,o.refreshPage)()):null}))},queryLayerAttributesToStoreStep1:function(e,t){return e.ofType(H.XL).filter((function(e){var t,n,r,o;return null!=e&&null!==(t=e.data)&&void 0!==t&&null!==(n=t.features)&&void 0!==n&&null!==(r=n[0])&&void 0!==r&&null!==(o=r.id)&&void 0!==o&&o.includes("bluemountains_thpss")?e:null})).mergeMap((function(e){var n,r,u,i,a,l;return V().Observable.merge(V().Observable.of((0,o.setVisibleSwampsChart)(!0)),V().Observable.of((0,o.setCurrentSwampsSurveySiteId)(null==e||null===(n=e.data)||void 0===n||null===(r=n.features)||void 0===r||null===(u=r[0])||void 0===u||null===(i=u.properties)||void 0===i?void 0:i.site_id)),V().Observable.of((0,H.Mc)()),V().Observable.of((0,W.uF)(null==e?void 0:e.layer.id)),V().Observable.of((0,X.gT)((null===(a=t.getState())||void 0===a||null===(l=a.gnsettings)||void 0===l?void 0:l.geoserverUrl)+"/wfs","geonode:swamps_surveysite")))}))},queryLayerAttributesToStoreStep2:function(e,t){return e.ofType(X.u7).filter((function(e){var t;return null!=e&&null!==(t=e.typeName)&&void 0!==t&&t.includes("bluemountains_thpss")?e:null})).mergeMap((function(e){var n,r;return V().Observable.of((0,X.IO)((null===(n=t.getState())||void 0===n||null===(r=n.gnsettings)||void 0===r?void 0:r.geoserverUrl)+"/ows",{featureTypeName:e.typeName,filterType:"OGC",ogcVersion:"1.1.0",pagination:{startIndex:0,maxFeatures:2e3}},{},"swamps: get swamps_surveysite data"))}))},queryLayerAttributesToStoreStep3:function(e,t){return e.ofType(X.Hu).filter((function(e){return"swamps: get bluemountains_thpss data"===(null==e?void 0:e.reason)})).mergeMap((function(e){return V().Observable.of((0,o.saveSwampsQueryToStore)(e.result.features))}))}}})},96828:e=>{var t="INIT_SWAMPS",n="SET_VISIBLE_SWAMPS_CHART",r="SAVE_SWAMPS_SURVEY_QUERY_TO_STORE",o="SET_CURRENT_SWAMPS_SURVEY_SITE_ID",u="SET_SELECTED_X_KEY",i="SET_SELECTED_Y_KEY",a="REFRESH_PAGE";e.exports={INIT_SWAMPS:t,initSwamps:function(){return{type:t}},REFRESH_PAGE:a,refreshPage:function(){return{type:a}},SET_VISIBLE_SWAMPS_CHART:n,setVisibleSwampsChart:function(e){return{type:n,visible:e}},SET_CURRENT_SWAMPS_SURVEY_SITE_ID:o,setCurrentSwampsSurveySiteId:function(e){return{type:o,currentSwampsSurveySiteId:e}},SAVE_SWAMPS_SURVEY_QUERY_TO_STORE:r,saveSwampsQueryToStore:function(e){return{type:r,swampsSurveyData:e}},SET_SELECTED_X_KEY:u,setSelectedXKey:function(e){return{type:u,selectedXKey:e}},SET_SELECTED_Y_KEY:i,setSelectedYKey:function(e){return{type:i,selectedYKey:e}}}},34088:e=>{e.exports=function(){for(var e=arguments.length,t=[],n=0;n<e;n++)t[n]=arguments[n];if(0!==(t=t.filter((function(e){return null!=e}))).length)return 1===t.length?t[0]:t.reduce((function(e,t){return function(){e.apply(this,arguments),t.apply(this,arguments)}}))}},55181:(e,t,n)=>{(e.exports=n(9252)()).push([e.id,".msgapi #swamps-container {\r\n    width:100%;\r\n    height:100%;\r\n    display: flex;\r\n    justify-content: center;\r\n    margin: 10px;\r\n    border: 1px solid #fff;\r\n    background-color: #ffffff;\r\n}\r\n\r\n.msgapi #swamps-chart {\r\n    z-index: 3000;\r\n    width: 98%;\r\n    height: 90%;\r\n    margin: 70px 20px 20px 0;\r\n    background-color: #ffffff;\r\n    font-size: 12px;\r\n    border-radius: 4px;\r\n    text-align: center;\r\n}\r\n\r\n.msgapi .chart-mainbody {\r\n    margin-top: 0;\r\n    height: 85%;\r\n    overflow: auto;\r\n}\r\n\r\n.msgapi .chart-header {\r\n    height: 80px;\r\n    top: 80px;\r\n    border-bottom: 1px solid #DDD;\r\n    background-color: #ffffff;\r\n    border-top-left-radius: 5px;\r\n    border-top-right-radius: 5px;\r\n}\r\n\r\n.msgapi .chart-footer {\r\n    bottom: 0;\r\n    height: 80px;\r\n    background-color: #ffffff;\r\n    border-top: 1px solid #DDD;\r\n    border-bottom-left-radius: 5px;\r\n    border-bottom-right-radius: 5px;\r\n}\r\n",""])},45177:(e,t,n)=>{"use strict";var r=n(29059);t.__esModule=!0,t.default=void 0;var o,u=r(n(50139)),i="clearTimeout",a=function(e){var t=(new Date).getTime(),n=Math.max(0,16-(t-s)),r=setTimeout(e,n);return s=t,r},l=function(e,t){return e+(e?t[0].toUpperCase()+t.substr(1):t)+"AnimationFrame"};u.default&&["","webkit","moz","o","ms"].some((function(e){var t=l(e,"request");if(t in window)return i=l(e,"cancel"),a=function(e){return window[t](e)}}));var s=(new Date).getTime();(o=function(e){return a(e)}).cancel=function(e){window[i]&&"function"==typeof window[i]&&window[i](e)};var c=o;t.default=c,e.exports=t.default},73759:e=>{"use strict";e.exports=function(e,t,n,r,o,u,i,a){if(!e){var l;if(void 0===t)l=new Error("Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings.");else{var s=[n,r,o,u,i,a],c=0;(l=new Error(t.replace(/%s/g,(function(){return s[c++]})))).name="Invariant Violation"}throw l.framesToPop=1,l}}},87649:(e,t,n)=>{var r=n(55181);"string"==typeof r&&(r=[[e.id,r,""]]),n(14246)(r,{}),r.locals&&(e.exports=r.locals)}}]);