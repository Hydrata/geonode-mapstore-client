(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[1592],{21262:(e,t,n)=>{var r=n(46553);e.exports=function(e,t,n){for(var o=-1,u=e.length;++o<u;){var i=e[o],c=t(i);if(null!=c&&(void 0===l?c==c&&!r(c):n(c,l)))var l=c,a=i}return a}},85812:e=>{e.exports=function(e,t){return e<t}},77820:(e,t,n)=>{var r=n(59130),o=n(71445);e.exports=function(e,t){var n=-1,u=o(e)?Array(e.length):[];return r(e,(function(e,r,o){u[++n]=t(e,r,o)})),u}},84847:(e,t,n)=>{var r=n(54528),o=n(83733),u=n(77820),i=n(65491),c=n(75542),l=n(80961),a=n(70475);e.exports=function(e,t,n){var E=-1;t=r(t.length?t:[a],c(o));var s=u(e,(function(e,n,o){return{criteria:r(t,(function(t){return t(e)})),index:++E,value:e}}));return i(s,(function(e,t){return l(e,t,n)}))}},65491:e=>{e.exports=function(e,t){var n=e.length;for(e.sort(t);n--;)e[n]=e[n].value;return e}},57312:(e,t,n)=>{var r=n(46553);e.exports=function(e,t){if(e!==t){var n=void 0!==e,o=null===e,u=e==e,i=r(e),c=void 0!==t,l=null===t,a=t==t,E=r(t);if(!l&&!E&&!i&&e>t||i&&c&&a&&!l&&!E||o&&c&&a||!n&&a||!u)return 1;if(!o&&!i&&!E&&e<t||E&&n&&u&&!o&&!i||l&&n&&u||!c&&u||!a)return-1}return 0}},80961:(e,t,n)=>{var r=n(57312);e.exports=function(e,t,n){for(var o=-1,u=e.criteria,i=t.criteria,c=u.length,l=n.length;++o<c;){var a=r(u[o],i[o]);if(a)return o>=l?a:a*("desc"==n[o]?-1:1)}return e.index-t.index}},33398:(e,t,n)=>{var r=n(94753),o=n(84847),u=n(98554),i=n(85270),c=u((function(e,t){if(null==e)return[];var n=t.length;return n>1&&i(e,t[0],t[1])?t=[]:n>2&&i(t[0],t[1],t[2])&&(t=[t[0]]),o(e,r(t,1),[])}));e.exports=c},98140:(e,t,n)=>{var r=n(67460),o=n(33716);e.exports=function(e,t,n){var u=!0,i=!0;if("function"!=typeof e)throw new TypeError("Expected a function");return o(n)&&(u="leading"in n?!!n.leading:u,i="trailing"in n?!!n.trailing:i),r(e,t,{leading:u,maxWait:t,trailing:i})}},33528:(e,t,n)=>{"use strict";n.d(t,{gJ:()=>r,Oj:()=>o,jp:()=>u,CM:()=>i,DU:()=>c,aO:()=>l,v6:()=>a,K8:()=>E,IN:()=>s,zh:()=>f,AH:()=>p,Ub:()=>y,_9:()=>R,JB:()=>T,oh:()=>_,AY:()=>d,yi:()=>v,SW:()=>I,Hk:()=>S,iQ:()=>A,dY:()=>O,$:()=>m,_u:()=>b,gG:()=>D,DI:()=>U,dZ:()=>F,qw:()=>g,f$:()=>h,bZ:()=>G,$O:()=>C,sF:()=>N,Gk:()=>L,vO:()=>w,ut:()=>P,MK:()=>Y,VV:()=>x,B8:()=>B,VM:()=>M,a3:()=>V,Xp:()=>H,DA:()=>j,sK:()=>q,yA:()=>k,r:()=>z,iB:()=>Q,EH:()=>W,Yd:()=>Z,Hg:()=>K,Lz:()=>X,ye:()=>J,Jb:()=>$,d:()=>ee,fT:()=>te,Ib:()=>ne,Pl:()=>re,UB:()=>oe,Uh:()=>ue,QT:()=>ie,oL:()=>ce,Ap:()=>le,KD:()=>ae,Z_:()=>Ee,Vw:()=>se,sY:()=>fe,kA:()=>pe,gr:()=>ye,pX:()=>Re,F5:()=>Te,MO:()=>_e,dq:()=>de,DY:()=>ve,oO:()=>Ie,uF:()=>Se,a8:()=>Ae,Pv:()=>Oe,an:()=>me,lg:()=>be,nY:()=>De,nG:()=>Ue,lx:()=>Fe,$S:()=>ge,gc:()=>he,Uz:()=>Ge,fO:()=>Ce,$E:()=>Ne,cE:()=>Le,JK:()=>we,YV:()=>Pe,t9:()=>Ye,YG:()=>xe,HT:()=>Be,MY:()=>Me,ve:()=>Ve,hB:()=>He,Ox:()=>je,zd:()=>qe,aT:()=>ke,VH:()=>ze,Yb:()=>Qe,Jr:()=>We,pP:()=>Ze});var r="FEATUREGRID:SET_UP",o="FEATUREGRID:SELECT_FEATURES",u="FEATUREGRID:DESELECT_FEATURES",i="FEATUREGRID:CLEAR_SELECTION",c="FEATUREGRID:SET_SELECTION_OPTIONS",l="FEATUREGRID:TOGGLE_MODE",a="FEATUREGRID:TOGGLE_FEATURES_SELECTION",E="FEATUREGRID:FEATURES_MODIFIED",s="FEATUREGRID:NEW_FEATURE",f="FEATUREGRID:SAVE_CHANGES",p="FEATUREGRID:SAVING",y="FEATUREGRID:START_EDITING_FEATURE",R="FEATUREGRID:START_DRAWING_FEATURE",T="FEATUREGRID:DELETE_GEOMETRY",_="FEATUREGRID:DELETE_GEOMETRY_FEATURE",d="FEATUREGRID:SAVE_SUCCESS",v="FEATUREGRID:CLEAR_CHANGES",I="FEATUREGRID:SAVE_ERROR",S="FEATUREGRID:DELETE_SELECTED_FEATURES",A="SET_FEATURES",O="FEATUREGRID:SORT_BY",m="FEATUREGRID:SET_LAYER",b="QUERY:UPDATE_FILTER",D="FEATUREGRID:CHANGE_PAGE",U="FEATUREGRID:GEOMETRY_CHANGED",F="DOCK_SIZE_FEATURES",g="FEATUREGRID:TOGGLE_TOOL",h="FEATUREGRID:CUSTOMIZE_ATTRIBUTE",G="ASK_CLOSE_FEATURE_GRID_CONFIRM",C="FEATUREGRID:OPEN_GRID",N="FEATUREGRID:CLOSE_GRID",L="FEATUREGRID:CLEAR_CHANGES_CONFIRMED",w="FEATUREGRID:FEATURE_GRID_CLOSE_CONFIRMED",P="FEATUREGRID:SET_PERMISSION",Y="FEATUREGRID:DISABLE_TOOLBAR",x="FEATUREGRID:ACTIVATE_TEMPORARY_CHANGES",B="FEATUREGRID:DEACTIVATE_GEOMETRY_FILTER",M="FEATUREGRID:ADVANCED_SEARCH",V="FEATUREGRID:ZOOM_ALL",H="FEATUREGRID:INIT_PLUGIN",j="FEATUREGRID:SIZE_CHANGE",q="FEATUREGRID:TOGGLE_SHOW_AGAIN_FLAG",k="FEATUREGRID:HIDE_SYNC_POPOVER",z="FEATUREGRID:UPDATE_EDITORS_OPTIONS",Q="FEATUREGRID:LAUNCH_UPDATE_FILTER_FUNC",W={EDIT:"EDIT",VIEW:"VIEW"},Z="FEATUREGRID:START_SYNC_WMS",K="FEATUREGRID:STOP_SYNC_WMS",X="STORE_ADVANCED_SEARCH_FILTER",J="LOAD_MORE_FEATURES",$="FEATUREGRID:QUERY_RESULT",ee="FEATUREGRID:SET_TIME_SYNC",te="FEATUREGRID:SET_PAGINATION";function ne(){return{type:q}}function re(){return{type:k}}function oe(e,t){return{type:$,features:e,pages:t}}function ue(e){return{type:X,filterObj:e}}function ie(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return{type:H,options:e}}function ce(){return{type:L}}function le(){return{type:w}}function ae(e,t){return{type:o,features:e,append:t}}function Ee(e){return{type:r,options:e}}function se(e){return{type:U,features:e}}function fe(){return{type:y}}function pe(){return{type:R}}function ye(e){return{type:u,features:e}}function Re(){return{type:T}}function Te(e){return{type:_,features:e}}function _e(){return{type:i}}function de(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.multiselect,n=void 0!==t&&t;return{type:c,multiselect:n}}function ve(e,t){return{type:O,sortBy:e,sortOrder:t}}function Ie(e,t){return{type:D,page:e,size:t}}function Se(e){return{type:m,id:e}}function Ae(e){var t=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return{type:b,update:e,append:t}}function Oe(e,t){return{type:g,tool:e,value:t}}function me(e,t,n){return{type:h,name:e,key:t,value:n}}function be(){return{type:l,mode:W.EDIT}}function De(){return{type:l,mode:W.VIEW}}function Ue(e,t){return{type:E,features:e,updated:t}}function Fe(e){return{type:s,features:e}}function ge(){return{type:f}}function he(){return{type:d}}function Ge(){return{type:S}}function Ce(){return{type:p}}function Ne(){return{type:v}}function Le(){return{type:I}}function we(){return{type:G}}function Pe(){return{type:N}}function Ye(){return{type:C}}function xe(e){return{type:Y,disabled:e}}function Be(e){return{type:P,permission:e}}function Me(){return{type:M}}function Ve(){return{type:V}}function He(){return{type:Z}}function je(e,t){return{type:j,size:e,dockProps:t}}var qe=function(e){return{type:J,pages:e}},ke=function(e){return{type:x,activated:e}},ze=function(e){return{type:B,deactivated:e}},Qe=function(e){return{type:ee,value:e}},We=function(e){return{type:te,size:e}},Ze=function(e){return{type:Q,updateFilterAction:e}}},21914:(e,t,n)=>{"use strict";n.d(t,{XL:()=>o,km:()=>u,Ih:()=>i,Xw:()=>c,Pn:()=>l,DZ:()=>a,e8:()=>E,E0:()=>s,F9:()=>f,X_:()=>p,pb:()=>y,qb:()=>R,Re:()=>T,ih:()=>_,xy:()=>d,jL:()=>v,oz:()=>I,ph:()=>S,lF:()=>A,gG:()=>O,cb:()=>m,GI:()=>b,B1:()=>D,fv:()=>U,gc:()=>F,zX:()=>g,ZF:()=>h,Zb:()=>G,Fm:()=>C,sV:()=>N,Mn:()=>L,LU:()=>w,XP:()=>P,WU:()=>Y,JB:()=>x,g:()=>B,ws:()=>M,HP:()=>V,aN:()=>H,Pg:()=>q,u0:()=>k,TM:()=>z,PM:()=>Q,lK:()=>W,sv:()=>Z,MO:()=>K,oO:()=>X,Mc:()=>J,Zw:()=>$,RA:()=>ee,am:()=>te,ZM:()=>ne,wm:()=>re,Y$:()=>oe});var r=n(47310),o="LOAD_FEATURE_INFO",u="ERROR_FEATURE_INFO",i="EXCEPTIONS_FEATURE_INFO",c="CHANGE_MAPINFO_STATE",l="NEW_MAPINFO_REQUEST",a="PURGE_MAPINFO_RESULTS",E="CHANGE_MAPINFO_FORMAT",s="SHOW_MAPINFO_MARKER",f="HIDE_MAPINFO_MARKER",p="SHOW_REVERSE_GEOCODE",y="HIDE_REVERSE_GEOCODE",R="GET_VECTOR_INFO",T="NO_QUERYABLE_LAYERS",_="CLEAR_WARNING",d="FEATURE_INFO_CLICK",v="IDENTIFY:UPDATE_FEATURE_INFO_CLICK_POINT",I="IDENTIFY:TOGGLE_HIGHLIGHT_FEATURE",S="TOGGLE_MAPINFO_STATE",A="UPDATE_CENTER_TO_MARKER",O="IDENTIFY:CHANGE_PAGE",m="IDENTIFY:CLOSE_IDENTIFY",b="IDENTIFY:CHANGE_FORMAT",D="IDENTIFY:TOGGLE_SHOW_COORD_EDITOR",U="IDENTIFY:EDIT_LAYER_FEATURES",F="IDENTIFY:CURRENT_EDIT_FEATURE_QUERY",g="IDENTIFY:SET_MAP_TRIGGER",h="IDENTIFY:TOGGLE_EMPTY_MESSAGE_GFI",G="IDENTIFY:SET_SHOW_IN_MAP_POPUP";function C(e,t,n,r,u){return{type:o,data:t,reqId:e,requestParams:n,layerMetadata:r,layer:u}}function N(e,t,n,r){return{type:u,error:t,reqId:e,requestParams:n,layerMetadata:r}}function L(e,t,n,r){return{type:i,reqId:e,exceptions:t,requestParams:n,layerMetadata:r}}function w(){return{type:T}}function P(){return{type:_}}function Y(e,t){return{type:l,reqId:e,request:t}}function x(e,t,n,r){return{type:R,layer:e,request:t,metadata:n,queryableLayers:r}}function B(){return{type:a}}function M(e){return{type:E,infoFormat:e}}function V(){return{type:s}}function H(){return{type:f}}function j(e){return{type:p,reverseGeocodeData:e.data}}function q(e){return function(t){r.Z.reverseGeocode(e).then((function(e){t(j(e))})).catch((function(e){t(j(e))}))}}function k(){return{type:y}}function z(){return{type:S}}function Q(e){return{type:A,status:e}}function W(e,t){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:[],r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:{},o=arguments.length>4&&void 0!==arguments[4]?arguments[4]:null;return{type:d,point:e,layer:t,filterNameList:n,overrideParams:r,itemId:o}}function Z(e){return{type:v,point:e}}function K(e){return{type:I,enabled:e}}function X(e){return{type:O,index:e}}var J=function(){return{type:m}},$=function(e){return{type:b,format:e}},ee=function(e){return{type:D,showCoordinateEditor:e}},te=function(e){return{type:U,layer:e}},ne=function(e){return{type:F,query:e}},re=function(e){return{type:g,trigger:e}},oe=function(e){return{type:G,value:e}}},95797:(e,t,n)=>{"use strict";n.d(t,{DR:()=>r,S0:()=>o,u7:()=>u,lj:()=>i,yz:()=>c,lN:()=>l,zW:()=>a,Yx:()=>E,VN:()=>s,Hu:()=>f,VT:()=>p,RD:()=>y,Qq:()=>R,R1:()=>T,_T:()=>_,vO:()=>d,XO:()=>v,jG:()=>I,Xc:()=>S,gT:()=>A,rG:()=>O,t3:()=>m,Fs:()=>b,w_:()=>D,Lm:()=>U,rh:()=>F,rP:()=>g,IO:()=>h,zc:()=>G}),n(75875);var r="LAYER_SELECTED_FOR_SEARCH",o="FEATURE_TYPE_SELECTED",u="FEATURE_TYPE_LOADED",i="FEATURE_LOADED",c="FEATURE_LOADING",l="FEATURE_TYPE_ERROR",a="FEATURE_ERROR",E="QUERY_CREATE",s="QUERY:UPDATE_QUERY",f="QUERY_RESULT",p="QUERY_ERROR",y="RESET_QUERY",R="QUERY",T="INIT_QUERY_PANEL",_="QUERY:TOGGLE_SYNC_WMS",d="QUERY:TOGGLE_LAYER_FILTER";function v(){return{type:_}}function I(){return{type:d}}function S(){return{type:T}}function A(e,t){return{type:o,url:e,typeName:t}}function O(e,t){return{type:u,typeName:e,featureType:t}}function m(e,t){return{type:l,typeName:e,error:t}}function b(e){return{type:c,isLoading:e}}function D(e,t,n,r,o){return{type:f,searchUrl:t,filterObj:n,result:e,queryOptions:r,reason:o}}function U(e){return{type:p,error:e}}function F(e,t){return{type:s,updates:e,reason:t}}function g(e,t){return{type:E,searchUrl:e,filterObj:t}}function h(e,t,n,r){return{type:R,searchUrl:e,filterObj:t,queryOptions:n,reason:r}}function G(){return{type:y}}},47310:(e,t,n)=>{"use strict";n.d(t,{Z:()=>E});var r=n(75875),o=n.n(r),u=n(72500),i=n.n(u),c=n(27418),l=n.n(c),a={format:"json",bounded:0,polygon_geojson:1,priority:5};const E={geocode:function(e,t){var n=l()({q:e},a,t||{}),r=i().format({protocol:"https",host:"nominatim.openstreetmap.org",query:n});return o().get(r)},reverseGeocode:function(e,t){var n=l()({lat:e.lat,lon:e.lng},t||{},a),r=i().format({protocol:"https",host:"nominatim.openstreetmap.org/reverse",query:n});return o().get(r)}}},83589:(e,t,n)=>{"use strict";n.r(t),n.d(t,{default:()=>P});var r=n(22843),o=n(85634);function u(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?u(Object(n),!0).forEach((function(t){c(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):u(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function c(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}var l=n(24852),a=n.n(l),E=n(71703),s=n(23885);function f(e){return(f="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function p(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}function y(e,t){return(y=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function R(e,t){return!t||"object"!==f(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function T(e){return(T=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function _(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}n(70613);var d=n(45697),v=n(48465),I=(v.Cell,v.BarChart,v.Bar,v.PieChart,v.Pie,v.ResponsiveContainer,v.XAxis,v.YAxis,v.Legend,v.Tooltip,function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&y(e,t)}(i,e);var t,n,r,o,u=(r=i,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=T(r);if(o){var n=T(this).constructor;e=Reflect.construct(t,arguments,n)}else e=t.apply(this,arguments);return R(this,e)});function i(e){var t;return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,i),(t=u.call(this,e)).state={},t}return t=i,(n=[{key:"render",value:function(){var e,t,n=this;return a().createElement(s.Modal,{show:!0,dialogClassName:"biocollect-modal",style:{top:"60px",width:"100%",minHeight:"500px"}},a().createElement(s.Modal.Header,null,a().createElement(s.Modal.Title,{style:{textAlign:"center"}},a().createElement("h4",{style:{padding:"0",margin:"0"},id:"test"},"Survey Sites"))),a().createElement(s.Modal.Body,null,a().createElement(s.Grid,null,a().createElement(s.Col,{sm:2},a().createElement(s.Row,{className:"well",style:{paddingTop:"0"}},a().createElement("h4",{style:{paddingTop:"5px",paddingBottom:"10px",margin:"0",textAlign:"center",fontSize:"14px"}},"Survey Sites"),a().createElement(s.ButtonGroup,null,null===(e=this.props.swampsSurveyData)||void 0===e?void 0:e.map((function(e){return a().createElement(s.Button,{bsStyle:"info",bsSize:"xsmall",block:!0,style:{width:"200px",marginTop:"4px",fontSize:"x-small"}},e.properties.name)})))),a().createElement(s.Row,{className:"well",style:{paddingTop:"20px"}},a().createElement("h4",{style:{paddingTop:"5px",paddingBottom:"10px",margin:"0",textAlign:"center",fontSize:"14px"}},"Sort Data By:"),a().createElement("div",{className:"row-no-gutters"},a().createElement(s.Button,{bsStyle:"success",bsSize:"xsmall",block:!0},"Button 1")),a().createElement("div",{className:"row-no-gutters"},a().createElement(s.Button,{bsStyle:"success",bsSize:"xsmall",block:!0},"Button 2")),a().createElement("div",{className:"row-no-gutters"},a().createElement(s.Button,{bsStyle:"success",bsSize:"xsmall",block:!0},"Button 3")))),a().createElement(s.Col,{sm:9},null===(t=this.props.swampsSurveyData)||void 0===t?void 0:t.map((function(e){var t,n;return a().createElement("div",null,a().createElement("h4",null,null==e||null===(t=e.properties)||void 0===t?void 0:t.name),JSON.parse(null==e||null===(n=e.properties)||void 0===n?void 0:n.activities).map((function(e){var t,n,r,o;return a().createElement(a().Fragment,null,a().createElement("pre",null,null==e||null===(t=e.outputs)||void 0===t||null===(n=t[0])||void 0===n||null===(r=n.data)||void 0===r||null===(o=r.dataList)||void 0===o?void 0:o.map((function(e){return a().createElement("p",null,e.key,": ",JSON.stringify(e.value))}))))})))}))))),a().createElement(s.Modal.Footer,null,a().createElement(s.Button,{bsStyle:"danger",bsSize:"small",style:{opacity:"0.7"},onClick:function(){return n.props.setVisibleBiocollectChart(!1)}},"Close")))}}])&&p(t.prototype,n),i}(a().Component));_(I,"propTypes",{setVisibleBiocollectChart:d.func,visibleBiocollectChart:d.bool,currentBiocollectSurveySiteId:d.string,swampsSurveyData:d.array}),_(I,"defaultProps",{});const S=(0,E.connect)((function(e){var t,n,r;return{currentBiocollectSurveySiteId:null==e||null===(t=e.biocollect)||void 0===t?void 0:t.currentBiocollectSurveySiteId,visibleBiocollectChart:null==e||null===(n=e.biocollect)||void 0===n?void 0:n.visibleBiocollectChart,swampsSurveyData:null==e||null===(r=e.biocollect)||void 0===r?void 0:r.swampsSurveyData}}),(function(e){return{setVisibleBiocollectChart:function(t){return e((0,o.setVisibleBiocollectChart)(t))}}}))(I);function A(e){return(A="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function O(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}function m(e,t){return(m=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function b(e,t){return!t||"object"!==A(t)&&"function"!=typeof t?function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e):t}function D(e){return(D=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function U(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}var F=n(45697),g=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&m(e,t)}(i,e);var t,n,r,o,u=(r=i,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=D(r);if(o){var n=D(this).constructor;e=Reflect.construct(t,arguments,n)}else e=t.apply(this,arguments);return b(this,e)});function i(e){return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,i),u.call(this,e)}return t=i,(n=[{key:"render",value:function(){return a().createElement("div",{id:"biocollect-container"},this.props.visibleBiocollectChart?a().createElement(S,null):null)}}])&&O(t.prototype,n),i}(a().Component);U(g,"propTypes",{visibleBiocollectChart:F.bool}),U(g,"defaultProps",{});const h=(0,E.connect)((function(e){var t;return console.log("state for Biocollect:",e),{visibleBiocollectChart:null==e||null===(t=e.biocollect)||void 0===t?void 0:t.visibleBiocollectChart}}),(function(e){return{}}))(g);var G=n(49977),C=n.n(G),N=n(21914),L=n(33528),w=n(95797);const P=(0,r.rx)("Biocollect",{component:h,reducers:{biocollect:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=arguments.length>1?arguments[1]:void 0;switch(console.log(t),t.type){case o.SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID:return i(i({},e),{},{currentBiocollectSurveySiteId:t.currentBiocollectSurveySiteId});case o.SAVE_SWAMPS_SURVEY_QUERY_TO_STORE:return i(i({},e),{},{swampsSurveyData:t.swampsSurveyData});case o.SET_VISIBLE_BIOCOLLECT_CHART:return i(i({},e),{},{visibleBiocollectChart:t.visible});default:return e}}},epics:{queryLayerAttributesToStoreStep1:function(e,t){return e.ofType(N.XL).filter((function(e){var t,n;return null!=e&&null!==(t=e.layer)&&void 0!==t&&null!==(n=t.id)&&void 0!==n&&n.includes("swamps_surveysite")?e:null})).mergeMap((function(e){var t,n,r,u;return C().Observable.merge(C().Observable.of((0,o.setVisibleBiocollectChart)(!0)),C().Observable.of((0,o.setCurrentBiocollectSurveySiteId)(null==e||null===(t=e.data)||void 0===t||null===(n=t.features)||void 0===n||null===(r=n[0])||void 0===r||null===(u=r.properties)||void 0===u?void 0:u.site_id)),C().Observable.of((0,N.Mc)()),C().Observable.of((0,L.uF)("swamps_surveysite__20")),C().Observable.of((0,w.gT)("http://localhost:8080/geoserver/wfs","geonode:swamps_surveysite")))}))},queryLayerAttributesToStoreStep2:function(e,t){return e.ofType(w.u7).filter((function(e){var t;return null!=e&&null!==(t=e.typeName)&&void 0!==t&&t.includes("swamps_surveysite")?e:null})).mergeMap((function(){return C().Observable.of((0,w.IO)("http://localhost:8000/gs/ows",{featureTypeName:"geonode:swamps_surveysite",filterType:"OGC",ogcVersion:"1.1.0",pagination:{startIndex:0,maxFeatures:2e3}},{},"swamps: get swamps_surveysite data"))}))},queryLayerAttributesToStoreStep3:function(e,t){return e.ofType(w.Hu).filter((function(e){return"swamps: get swamps_surveysite data"===(null==e?void 0:e.reason)})).mergeMap((function(e){return C().Observable.of((0,o.saveSwampsQueryToStore)(e.result.features))}))}}})},85634:e=>{var t="SET_VISIBLE_BIOCOLLECT_CHART",n="SAVE_SWAMPS_SURVEY_QUERY_TO_STORE",r="SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID";e.exports={SET_VISIBLE_BIOCOLLECT_CHART:t,setVisibleBiocollectChart:function(e){return{type:t,visible:e}},SET_CURRENT_BIOCOLLECT_SURVEY_SITE_ID:r,setCurrentBiocollectSurveySiteId:function(e){return{type:r,currentBiocollectSurveySiteId:e}},SAVE_SWAMPS_SURVEY_QUERY_TO_STORE:n,saveSwampsQueryToStore:function(e){return{type:n,swampsSurveyData:e}}}},34088:e=>{e.exports=function(){for(var e=arguments.length,t=[],n=0;n<e;n++)t[n]=arguments[n];if(0!==(t=t.filter((function(e){return null!=e}))).length)return 1===t.length?t[0]:t.reduce((function(e,t){return function(){e.apply(this,arguments),t.apply(this,arguments)}}))}},96515:(e,t,n)=>{(e.exports=n(9252)()).push([e.id,".msgapi .biocollect-modal {\n    position: absolute;\n    z-index: 1021;\n    top: 11px;\n    width: 100%;\n    height: 500px;\n    background-color: rgba(0, 60, 136, 0.6);\n    border-color: rgba(255, 255, 255, 0.7);\n    border-width: 2px;\n    padding: 3px 5px;\n    font-size: 12px;\n    line-height: 1.3;\n    border-radius: 4px;\n    color: red;\n    text-align: center;\n}\n\n.msgapi #test {\n    color: red;\n}",""])},45177:(e,t,n)=>{"use strict";var r=n(29059);t.__esModule=!0,t.default=void 0;var o,u=r(n(50139)),i="clearTimeout",c=function(e){var t=(new Date).getTime(),n=Math.max(0,16-(t-a)),r=setTimeout(e,n);return a=t,r},l=function(e,t){return e+(e?t[0].toUpperCase()+t.substr(1):t)+"AnimationFrame"};u.default&&["","webkit","moz","o","ms"].some((function(e){var t=l(e,"request");if(t in window)return i=l(e,"cancel"),c=function(e){return window[t](e)}}));var a=(new Date).getTime();(o=function(e){return c(e)}).cancel=function(e){window[i]&&"function"==typeof window[i]&&window[i](e)};var E=o;t.default=E,e.exports=t.default},73759:e=>{"use strict";e.exports=function(e,t,n,r,o,u,i,c){if(!e){var l;if(void 0===t)l=new Error("Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings.");else{var a=[n,r,o,u,i,c],E=0;(l=new Error(t.replace(/%s/g,(function(){return a[E++]})))).name="Invariant Violation"}throw l.framesToPop=1,l}}},70613:(e,t,n)=>{var r=n(96515);"string"==typeof r&&(r=[[e.id,r,""]]),n(14246)(r,{}),r.locals&&(e.exports=r.locals)}}]);