(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[88265],{604206:(e,t,r)=>{"use strict";r.d(t,{hZ:()=>n,pb:()=>o,kD:()=>i,DI:()=>u,IC:()=>l,iU:()=>a,W7:()=>s,uB:()=>c,Rh:()=>p,G_:()=>f,vU:()=>d,Vw:()=>E,KD:()=>y,uj:()=>R,lo:()=>F,Yf:()=>m,fo:()=>T,PY:()=>b,bp:()=>_,oJ:()=>O,k4:()=>A,sc:()=>I,Li:()=>g});var n="CHANGE_DRAWING_STATUS",o="DRAW:END_DRAWING",i="DRAW:SET_CURRENT_STYLE",u="DRAW:GEOMETRY_CHANGED",l="DRAW:DRAW_SUPPORT_STOPPED",a="DRAW:FEATURES_SELECTED",s="DRAW:DRAWING_FEATURES",c="DRAW:SET_SNAPPING_LAYER",p="DRAW:SNAPPING_IS_LOADING",f="DRAW:TOGGLE_SNAPPING",d="DRAW:SET_SNAPPING_CONFIG";function E(e,t,r,n,o){return{type:u,features:e,owner:t,enableEdit:r,textChanged:n,circleChanged:o}}function y(){return{type:a,features:arguments.length>0&&void 0!==arguments[0]?arguments[0]:[]}}function R(){return{type:s,features:arguments.length>0&&void 0!==arguments[0]?arguments[0]:[]}}function F(){return{type:l}}function m(e,t,r,o,i,u){return{type:n,status:e,method:t,owner:r,features:o,options:i,style:u}}function T(e,t){return{type:o,geometry:e,owner:t}}function b(e){return{type:i,currentStyle:e}}var _=function(e){return m("clean","",e,[],{})};function O(){return{type:f}}function A(e){return{type:c,snappingLayer:e}}function I(){return{type:p}}function g(e,t,r){return{type:d,value:e,prop:t,pluginCfg:r}}},433528:(e,t,r)=>{"use strict";r.d(t,{gJ:()=>n,Oj:()=>o,jp:()=>i,CM:()=>u,DU:()=>l,aO:()=>a,v6:()=>s,K8:()=>c,IN:()=>p,zh:()=>f,AH:()=>d,Ub:()=>E,_9:()=>y,JB:()=>R,oh:()=>F,AY:()=>m,yi:()=>T,SW:()=>b,Hk:()=>_,iQ:()=>O,dY:()=>A,$:()=>I,_u:()=>g,gG:()=>v,DI:()=>S,dZ:()=>D,qw:()=>L,f$:()=>h,bZ:()=>U,$O:()=>N,sF:()=>P,Gk:()=>G,vO:()=>C,ut:()=>w,MK:()=>j,VV:()=>M,B8:()=>Y,VM:()=>x,a3:()=>k,Xp:()=>W,DA:()=>H,sK:()=>V,yA:()=>z,r:()=>Q,iB:()=>B,WB:()=>Z,EH:()=>q,Yd:()=>J,Hg:()=>$,Lz:()=>X,ye:()=>K,Jb:()=>ee,d:()=>te,fT:()=>re,Ib:()=>ne,Pl:()=>oe,UB:()=>ie,Uh:()=>ue,QT:()=>le,oL:()=>ae,Ap:()=>se,KD:()=>ce,Z_:()=>pe,Vw:()=>fe,sY:()=>de,kA:()=>Ee,gr:()=>ye,pX:()=>Re,F5:()=>Fe,MO:()=>me,dq:()=>Te,DY:()=>be,oO:()=>_e,uF:()=>Oe,a8:()=>Ae,Pv:()=>Ie,an:()=>ge,lg:()=>ve,nY:()=>Se,nG:()=>De,lx:()=>Le,$S:()=>he,gc:()=>Ue,Uz:()=>Ne,fO:()=>Pe,$E:()=>Ge,cE:()=>Ce,JK:()=>we,YV:()=>je,t9:()=>Me,YG:()=>Ye,HT:()=>xe,MY:()=>ke,ve:()=>We,hB:()=>He,Ox:()=>Ve,zd:()=>ze,aT:()=>Qe,VH:()=>Be,Yb:()=>Ze,Jr:()=>qe,pP:()=>Je,gL:()=>$e});var n="FEATUREGRID:SET_UP",o="FEATUREGRID:SELECT_FEATURES",i="FEATUREGRID:DESELECT_FEATURES",u="FEATUREGRID:CLEAR_SELECTION",l="FEATUREGRID:SET_SELECTION_OPTIONS",a="FEATUREGRID:TOGGLE_MODE",s="FEATUREGRID:TOGGLE_FEATURES_SELECTION",c="FEATUREGRID:FEATURES_MODIFIED",p="FEATUREGRID:NEW_FEATURE",f="FEATUREGRID:SAVE_CHANGES",d="FEATUREGRID:SAVING",E="FEATUREGRID:START_EDITING_FEATURE",y="FEATUREGRID:START_DRAWING_FEATURE",R="FEATUREGRID:DELETE_GEOMETRY",F="FEATUREGRID:DELETE_GEOMETRY_FEATURE",m="FEATUREGRID:SAVE_SUCCESS",T="FEATUREGRID:CLEAR_CHANGES",b="FEATUREGRID:SAVE_ERROR",_="FEATUREGRID:DELETE_SELECTED_FEATURES",O="SET_FEATURES",A="FEATUREGRID:SORT_BY",I="FEATUREGRID:SET_LAYER",g="QUERY:UPDATE_FILTER",v="FEATUREGRID:CHANGE_PAGE",S="FEATUREGRID:GEOMETRY_CHANGED",D="DOCK_SIZE_FEATURES",L="FEATUREGRID:TOGGLE_TOOL",h="FEATUREGRID:CUSTOMIZE_ATTRIBUTE",U="ASK_CLOSE_FEATURE_GRID_CONFIRM",N="FEATUREGRID:OPEN_GRID",P="FEATUREGRID:CLOSE_GRID",G="FEATUREGRID:CLEAR_CHANGES_CONFIRMED",C="FEATUREGRID:FEATURE_GRID_CLOSE_CONFIRMED",w="FEATUREGRID:SET_PERMISSION",j="FEATUREGRID:DISABLE_TOOLBAR",M="FEATUREGRID:ACTIVATE_TEMPORARY_CHANGES",Y="FEATUREGRID:DEACTIVATE_GEOMETRY_FILTER",x="FEATUREGRID:ADVANCED_SEARCH",k="FEATUREGRID:ZOOM_ALL",W="FEATUREGRID:INIT_PLUGIN",H="FEATUREGRID:SIZE_CHANGE",V="FEATUREGRID:TOGGLE_SHOW_AGAIN_FLAG",z="FEATUREGRID:HIDE_SYNC_POPOVER",Q="FEATUREGRID:UPDATE_EDITORS_OPTIONS",B="FEATUREGRID:LAUNCH_UPDATE_FILTER_FUNC",Z="FEATUREGRID:SET_SYNC_TOOL",q={EDIT:"EDIT",VIEW:"VIEW"},J="FEATUREGRID:START_SYNC_WMS",$="FEATUREGRID:STOP_SYNC_WMS",X="STORE_ADVANCED_SEARCH_FILTER",K="LOAD_MORE_FEATURES",ee="FEATUREGRID:QUERY_RESULT",te="FEATUREGRID:SET_TIME_SYNC",re="FEATUREGRID:SET_PAGINATION";function ne(){return{type:V}}function oe(){return{type:z}}function ie(e,t){return{type:ee,features:e,pages:t}}function ue(e){return{type:X,filterObj:e}}function le(){return{type:W,options:arguments.length>0&&void 0!==arguments[0]?arguments[0]:{}}}function ae(){return{type:G}}function se(){return{type:C}}function ce(e,t){return{type:o,features:e,append:t}}function pe(e){return{type:n,options:e}}function fe(e){return{type:S,features:e}}function de(){return{type:E}}function Ee(){return{type:y}}function ye(e){return{type:i,features:e}}function Re(){return{type:R}}function Fe(e){return{type:F,features:e}}function me(){return{type:u}}function Te(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.multiselect,r=e.showCheckbox;return{type:l,multiselect:t,showCheckbox:r}}function be(e,t){return{type:A,sortBy:e,sortOrder:t}}function _e(e,t){return{type:v,page:e,size:t}}function Oe(e){return{type:I,id:e}}function Ae(e){return{type:g,update:e,append:arguments.length>1&&void 0!==arguments[1]&&arguments[1]}}function Ie(e,t){return{type:L,tool:e,value:t}}function ge(e,t,r){return{type:h,name:e,key:t,value:r}}function ve(){return{type:a,mode:q.EDIT}}function Se(){return{type:a,mode:q.VIEW}}function De(e,t){return{type:c,features:e,updated:t}}function Le(e){return{type:p,features:e}}function he(){return{type:f}}function Ue(){return{type:m}}function Ne(){return{type:_}}function Pe(){return{type:d}}function Ge(){return{type:T}}function Ce(){return{type:b}}function we(){return{type:U}}function je(){return{type:P}}function Me(){return{type:N}}function Ye(e){return{type:j,disabled:e}}function xe(e){return{type:w,permission:e}}function ke(){return{type:x}}function We(){return{type:k}}function He(){return{type:J}}function Ve(e,t){return{type:H,size:e,dockProps:t}}var ze=function(e){return{type:K,pages:e}},Qe=function(e){return{type:M,activated:e}},Be=function(e){return{type:Y,deactivated:e}},Ze=function(e){return{type:te,value:e}},qe=function(e){return{type:re,size:e}},Je=function(e){return{type:B,updateFilterAction:e}},$e=function(e){return{type:Z,syncWmsFilter:e}}},807878:(e,t,r)=>{"use strict";r.d(t,{E6:()=>u,vo:()=>l,l1:()=>a,J9:()=>s,U:()=>c,z8:()=>p,ql:()=>f,O_:()=>d,M$:()=>E,Ug:()=>y,p5:()=>R,Fz:()=>F,WZ:()=>m,bP:()=>T,On:()=>b,d_:()=>_,xM:()=>O,bl:()=>A,Wi:()=>I,PN:()=>g,_M:()=>v,Wm:()=>S,Eg:()=>D,V1:()=>L,cY:()=>h,RD:()=>U,Hl:()=>N,co:()=>P,uY:()=>G,H8:()=>C,je:()=>w,go:()=>j,_8:()=>M,xd:()=>Y,o7:()=>x,Nr:()=>k,Gf:()=>W,nh:()=>H,Rf:()=>V,Xp:()=>z,D6:()=>Q,Sm:()=>B,Ef:()=>Z,jW:()=>q,kQ:()=>J,JG:()=>$,js:()=>X,q$:()=>K,OZ:()=>ee,Nc:()=>te,NV:()=>re,I5:()=>ne,QL:()=>oe,I:()=>ie,ku:()=>ue,EU:()=>le,IV:()=>ae,HT:()=>se,lg:()=>ce,ds:()=>pe,VF:()=>fe,DD:()=>de,uo:()=>Ee,Ry:()=>ye,ZH:()=>Re,AQ:()=>Fe,yC:()=>me,F:()=>Te,mc:()=>be,uM:()=>Oe,eJ:()=>Ae,uP:()=>Ie,N5:()=>ge,bn:()=>ve,Bm:()=>Se,F2:()=>De,jR:()=>Le,$J:()=>he,ln:()=>Ue});var n=r(375875),o=r.n(n);function i(e){return i="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},i(e)}var u="ADD_FILTER_FIELD",l="REMOVE_FILTER_FIELD",a="UPDATE_FILTER_FIELD",s="UPDATE_EXCEPTION_FIELD",c="ADD_GROUP_FIELD",p="UPDATE_LOGIC_COMBO",f="REMOVE_GROUP_FIELD",d="CHANGE_CASCADING_VALUE",E="EXPAND_ATTRIBUTE_PANEL",y="EXPAND_SPATIAL_PANEL",R="QUERYFORM:EXPAND_CROSS_LAYER",F="QUERYFORM:SET_CROSS_LAYER_PARAMETER",m="QUERYFORM:RESET_CROSS_LAYER_FILTER",T="SELECT_SPATIAL_METHOD",b="SELECT_VIEWPORT_SPATIAL_METHOD",_="UPDATE_GEOMETRY",O="SELECT_SPATIAL_OPERATION",A="CHANGE_SPATIAL_ATTRIBUTE",I="CHANGE_SPATIAL_FILTER_VALUE",g="REMOVE_SPATIAL_SELECT",v="SHOW_SPATIAL_DETAILS",S="QUERY_FORM_SEARCH",D="QUERY_FORM_RESET",L="SHOW_GENERATED_FILTER",h="CHANGE_DWITHIN_VALUE",U="ZONE_SEARCH",N="ZONE_SEARCH_ERROR",P="ZONE_FILTER",G="ZONE_CHANGE",C="ZONES_RESET",w="SIMPLE_FILTER_FIELD_UPDATE",j="ADD_SIMPLE_FILTER_FIELD",M="REMOVE_SIMPLE_FILTER_FIELD",Y="REMOVE_ALL_SIMPLE_FILTER_FIELDS",x="UPDATE_FILTER_FIELD_OPTIONS",k="LOADING_FILTER_FIELD_OPTIONS",W="QUERYFORM:ADD_CROSS_LAYER_FILTER_FIELD",H="QUERYFORM:UPDATE_CROSS_LAYER_FILTER_FIELD",V="QUERYFORM:REMOVE_CROSS_LAYER_FILTER_FIELD",z="QUERYFORM:UPDATE_CROSS_LAYER_FILTER_FIELD_OPTIONS",Q="SET_AUTOCOMPLETE_MODE",B="TOGGLE_AUTOCOMPLETE_MENU",Z="QUERYFORM:LOAD_FILTER";function q(e){return{type:u,groupId:e}}function J(e,t){return{type:c,groupId:e,index:t}}function $(e){return{type:l,rowId:e}}function X(e,t){return{type:B,rowId:e,status:t,layerFilterType:arguments.length>2&&void 0!==arguments[2]?arguments[2]:"filterField"}}function K(e,t,r,n){return{type:a,rowId:e,fieldName:t,fieldValue:r,fieldType:n,fieldOptions:arguments.length>4&&void 0!==arguments[4]?arguments[4]:{}}}function ee(e,t){return{type:s,rowId:e,exceptionMessage:t}}function te(e,t){return{type:p,groupId:e,logic:t}}function re(e){return{type:Q,status:e}}function ne(e){return{type:f,groupId:e}}function oe(e){return{type:d,attributes:e}}function ie(e){return{type:E,expand:e}}function ue(e){return{type:y,expand:e}}function le(e){return{type:R,expand:e}}function ae(e,t){return{type:F,key:e,value:t}}function se(e,t){return{type:T,fieldName:t,method:e}}function ce(){return{type:b}}function pe(e){return{type:_,geometry:e}}function fe(e,t){return{type:O,fieldName:t,operation:e}}function de(e){return{type:A,attribute:e}}function Ee(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.feature,r=e.srsName,n=e.collectGeometries,o=e.style,i=e.options,u=e.value;return{type:I,value:u,collectGeometries:n,options:i,geometry:t&&t.geometry,feature:t,srsName:r,style:o}}function ye(){return{type:g}}function Re(e){return{type:v,show:e}}function Fe(e){return{type:h,distance:e}}function me(e,t){return{type:S,searchUrl:e,filterObj:t}}function Te(e){return{type:Z,filter:e}}function be(e){return{type:D,skip:e}}function _e(e,t){return{type:N,error:e,id:t}}function Oe(e,t){return{type:U,active:e,id:t}}function Ae(e,t,r){return function(n){return o().post(e,t,{timeout:1e4,headers:{Accept:"application/json","Content-Type":"text/plain"}}).then((function(o){var u=o.data;if("object"!==i(u))try{u=JSON.parse(u)}catch(o){n(_e("Search result broken ("+e+":   "+t+"): "+o.message,r))}n(function(e,t){return{type:P,data:e,id:t}}(u,r)),n(Oe(!1,r))})).catch((function(e){n(_e(e,r))}))}}function Ie(e,t){return{type:G,id:e,value:t}}function ge(e){return{type:W,rowId:(new Date).getTime(),groupId:e}}function ve(e,t,r,n){return{type:H,rowId:e,fieldName:t,fieldValue:r,fieldType:n,fieldOptions:arguments.length>4&&void 0!==arguments[4]?arguments[4]:{}}}function Se(e){return{type:V,rowId:e}}function De(){return{type:m}}function Le(e,t){return{type:k,status:e,filterField:t,layerFilterType:arguments.length>2&&void 0!==arguments[2]?arguments[2]:"filterField"}}function he(e,t,r){return{type:x,filterField:e,options:t,valuesCount:r}}function Ue(e,t,r){return{type:z,filterField:e,options:t,valuesCount:r}}},95797:(e,t,r)=>{"use strict";r.d(t,{DR:()=>n,S0:()=>o,u7:()=>i,lj:()=>u,yz:()=>l,lN:()=>a,zW:()=>s,Yx:()=>c,VN:()=>p,Hu:()=>f,VT:()=>d,RD:()=>E,Qq:()=>y,R1:()=>R,_T:()=>F,vO:()=>m,XO:()=>T,jG:()=>b,Xc:()=>_,gT:()=>O,rG:()=>A,t3:()=>I,Fs:()=>g,w_:()=>v,Lm:()=>S,rh:()=>D,rP:()=>L,IO:()=>h,zc:()=>U}),r(375875);var n="LAYER_SELECTED_FOR_SEARCH",o="FEATURE_TYPE_SELECTED",i="FEATURE_TYPE_LOADED",u="FEATURE_LOADED",l="FEATURE_LOADING",a="FEATURE_TYPE_ERROR",s="FEATURE_ERROR",c="QUERY_CREATE",p="QUERY:UPDATE_QUERY",f="QUERY_RESULT",d="QUERY_ERROR",E="RESET_QUERY",y="QUERY",R="INIT_QUERY_PANEL",F="QUERY:TOGGLE_SYNC_WMS",m="QUERY:TOGGLE_LAYER_FILTER";function T(){return{type:F}}function b(){return{type:m}}function _(){return{type:R}}function O(e,t){return{type:o,url:e,typeName:t}}function A(e,t){return{type:i,typeName:e,featureType:t}}function I(e,t){return{type:a,typeName:e,error:t}}function g(e){return{type:l,isLoading:e}}function v(e,t,r,n,o){return{type:f,searchUrl:t,filterObj:r,result:e,queryOptions:n,reason:o}}function S(e){return{type:d,error:e}}function D(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.updates,r=e.reason,n=e.useLayerFilter;return{type:p,updates:t,reason:r,useLayerFilter:n}}function L(e,t){return{type:c,searchUrl:e,filterObj:t}}function h(e,t,r,n){return{type:y,searchUrl:e,filterObj:t,queryOptions:r,reason:n}}function U(){return{type:E}}},807472:(e,t,r)=>{"use strict";r.d(t,{Z:()=>I});var n=r(737295),o=r.n(n),i=r(675263),u=r.n(i),l=r(124852),a=r.n(l),s=r(485294),c=r.n(s),p=r(472986),f=r.n(p),d=r(805346);function E(e){return E="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},E(e)}function y(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function R(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?y(Object(r),!0).forEach((function(t){_(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):y(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function F(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,O(n.key),n)}}function m(e,t){return m=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(e,t){return e.__proto__=t,e},m(e,t)}function T(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function b(e){return b=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(e){return e.__proto__||Object.getPrototypeOf(e)},b(e)}function _(e,t,r){return(t=O(t))in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function O(e){var t=function(e,t){if("object"!=E(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=E(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==E(t)?t:String(t)}var A=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&m(e,t)}(l,e);var t,r,n,i,u=(n=l,i=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=b(n);if(i){var r=b(this).constructor;e=Reflect.construct(t,arguments,r)}else e=t.apply(this,arguments);return function(e,t){if(t&&("object"===E(t)||"function"==typeof t))return t;if(void 0!==t)throw new TypeError("Derived constructors may only return object or undefined");return T(e)}(this,e)});function l(){var e;!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,l);for(var t=arguments.length,r=new Array(t),n=0;n<t;n++)r[n]=arguments[n];return _(T(e=u.call.apply(u,[this].concat(r))),"renderLoading",(function(){return e.props.maskLoading?a().createElement("div",{style:{width:"100%",height:"100%",position:"absolute",overflow:"visible",margin:"auto",verticalAlign:"center",left:"0",background:"rgba(255, 255, 255, 0.5)",zIndex:2}},a().createElement("div",{style:{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%, -40%)"}},a().createElement(d.Z,{msgId:"loading"}),a().createElement(f(),{spinnerName:"circle",noFadeIn:!0,overrideSpinnerClassName:"spinner"}))):null})),_(T(e),"renderRole",(function(t){return a().Children.toArray(e.props.children).filter((function(e){return e.props.role===t}))})),_(T(e),"hasRole",(function(t){return a().Children.toArray(e.props.children).filter((function(e){return e.props.role===t})).length>0})),_(T(e),"onClickOut",(function(t){e.props.onClickOut&&e.mask===t.target&&e.props.onClickOut(t)})),e}return t=l,(r=[{key:"render",value:function(){var e=this,t=a().createElement("div",{id:this.props.id,style:R({},this.props.style),className:"".concat(this.props.draggable?"modal-dialog-draggable":""," ").concat(this.props.className," modal-dialog-container")},a().createElement("div",{className:this.props.headerClassName+" draggable-header"},this.renderRole("header")),a().createElement("div",{className:this.props.bodyClassName},this.renderLoading(),this.renderRole("body")),this.hasRole("footer")?a().createElement("div",{className:this.props.footerClassName},this.renderRole("footer")):a().createElement("span",null)),r=this.props.draggable?a().createElement(c(),{defaultPosition:this.props.start,bounds:this.props.bounds,handle:".draggable-header, .draggable-header *"},t):t,n=o()({},this.props.style.display?{display:this.props.style.display}:{},this.props.backgroundStyle);return this.props.modal?a().createElement("div",{ref:function(t){e.mask=t},onClick:this.onClickOut,style:n,className:"fade in modal "+this.props.containerClassName,role:"dialog"},r):r}}])&&F(t.prototype,r),Object.defineProperty(t,"prototype",{writable:!1}),l}(a().Component);_(A,"propTypes",{id:u().string.isRequired,style:u().object,backgroundStyle:u().object,className:u().string,maskLoading:u().bool,containerClassName:u().string,headerClassName:u().string,bodyClassName:u().string,footerClassName:u().string,onClickOut:u().func,modal:u().bool,start:u().object,draggable:u().bool,bounds:u().oneOfType([u().string,u().object])}),_(A,"defaultProps",{style:{},backgroundStyle:{background:"rgba(0,0,0,.5)"},start:{x:0,y:150},className:"modal-dialog modal-content",maskLoading:!1,containerClassName:"",headerClassName:"modal-header",bodyClassName:"modal-body",footerClassName:"modal-footer",modal:!1,draggable:!0,bounds:"parent"});const I=A},843614:(e,t,r)=>{"use strict";r.d(t,{Z:()=>d});var n=r(737295),o=r.n(n),i=r(480681),u=r(461365);function l(e){return l="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},l(e)}function a(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,s(n.key),n)}}function s(e){var t=function(e,t){if("object"!=l(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=l(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==l(t)?t:String(t)}function c(e,t){return c=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(e,t){return e.__proto__=t,e},c(e,t)}function p(e){return p=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(e){return e.__proto__||Object.getPrototypeOf(e)},p(e)}var f=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&c(e,t)}(u,e);var t,r,n,o,i=(n=u,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=p(n);if(o){var r=p(this).constructor;e=Reflect.construct(t,arguments,r)}else e=t.apply(this,arguments);return function(e,t){if(t&&("object"===l(t)||"function"==typeof t))return t;if(void 0!==t)throw new TypeError("Derived constructors may only return object or undefined");return function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e)}(this,e)});function u(){return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,u),i.apply(this,arguments)}return t=u,(r=[{key:"handleDialogClick",value:function(e){e.target===e.currentTarget&&this.props.onHide(e)}}])&&a(t.prototype,r),Object.defineProperty(t,"prototype",{writable:!1}),u}(i.Modal);const d=o()((0,u.Z)(f),{Body:i.Modal.Body,Dialog:i.Modal.Dialog,Footer:i.Modal.Footer,Header:i.Modal.Header,Title:i.Modal.Title})},399534:(e,t,r)=>{"use strict";r.d(t,{Z:()=>i});var n=r(461365),o=r(356936);const i=(0,n.Z)(o.h_)},797301:(e,t,r)=>{"use strict";r.d(t,{Z:()=>d});var n=r(95797),o=r(433528),i=r(807878),u=r(782904),l=r(737295),a=r.n(l);function s(e){return s="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},s(e)}function c(e,t,r){var n;return n=function(e,t){if("object"!=s(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=s(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(t),(t="symbol"==s(n)?n:String(n))in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function p(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}var f={featureTypes:{},data:{},result:null,resultError:null,syncWmsFilter:!1,isLayerFilter:!1};const d=function(){var e,t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:f,r=arguments.length>1?arguments[1]:void 0;switch(r.type){case n.S0:return a()({},t,{typeName:r.typeName,url:r.url});case n.u7:return a()({},t,{featureTypes:a()({},t.featureTypes,c({},r.typeName,r.featureType))});case n.lN:return a()({},t,{featureTypes:a()({},t.featureTypes,c({},r.typeName,{error:r.error}))});case n.yz:return a()({},t,{featureLoading:r.isLoading});case n.lj:return a()({},t,{featureLoading:!1,data:a()({},t.data,c({},r.typeName,(e=r.feature,["STATE_NAME","STATE_ABBR","SUB_REGION","STATE_FIPS"].map((function(t){return{attribute:t,values:e.features.reduce((function(e,r){return-1===e.indexOf(r.properties[t])?[].concat((n=e,function(e){if(Array.isArray(e))return p(e)}(n)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(n)||function(e,t){if(e){if("string"==typeof e)return p(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?p(e,t):void 0}}(n)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()),[r.properties[t]]).sort():e;var n}),[])}})).reduce((function(e,t){return a()(e,c({},t.attribute,t.values.map((function(e){return{id:e,name:e}}))))}),{}))))});case n.zW:return a()({},t,{featureLoading:!1,featureTypes:a()({},t.data,c({},r.typeName,{error:r.error}))});case n.Yx:return a()({},t,{isNew:!0,searchUrl:r.searchUrl,filterObj:r.filterObj});case n.VN:return a()({},t,{filterObj:a()({},t.filterObj,r.updates)});case n.Hu:return a()({},t,{isNew:!1,result:r.result,searchUrl:r.searchUrl,filterObj:r.filterObj,resultError:null});case n.VT:return a()({},t,{isNew:!1,result:null,resultError:r.error});case u.l:case i.Eg:return r.skip&&r.skip.indexOf("query")>=0?t:a()({},t,{isNew:!1,result:null,filterObj:null,searchUrl:null});case n.RD:return a()({},t,{result:null,resultError:null});case n._T:return a()({},t,{syncWmsFilter:!t.syncWmsFilter});case o.WB:return a()({},t,{syncWmsFilter:r.syncWmsFilter});case n.vO:return a()({},t,{isLayerFilter:!t.isLayerFilter});default:return t}}},146905:(e,t,r)=>{"use strict";r.d(t,{Z:()=>A});var n=r(807878),o=r(604206),i=r(737295),u=r.n(i),l=r(819412),a=r.n(l),s=r(294707),c=r.n(s),p=r(227361),f=r.n(p),d=r(761868),E=["attribute"];function y(e){return y="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},y(e)}function R(e){return function(e){if(Array.isArray(e))return F(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||function(e,t){if(e){if("string"==typeof e)return F(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?F(e,t):void 0}}(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function F(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}function m(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function T(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?m(Object(r),!0).forEach((function(t){b(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):m(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function b(e,t,r){var n;return n=function(e,t){if("object"!=y(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=y(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(t),(t="symbol"==y(n)?n:String(n))in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var _={searchUrl:null,featureTypeConfigUrl:null,showGeneratedFilter:!1,attributePanelExpanded:!0,spatialPanelExpanded:!0,crossLayerExpanded:!0,showDetailsPanel:!1,groupLevels:5,useMapProjection:!1,toolbarEnabled:!0,groupFields:[{id:1,logic:"OR",index:0}],maxFeaturesWPS:5,filterFields:[],spatialField:{method:null,attribute:"the_geom",operation:"INTERSECTS",geometry:null},simpleFilterFields:[]},O=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},r=u()({},e,b(b({},t.fieldName,t.fieldValue),"type",t.fieldType),{fieldOptions:u()({},T({},e.fieldOptions),{currentPage:void 0===t.fieldOptions.currentPage?1:t.fieldOptions.currentPage})});return"attribute"===t.fieldName&&(r.value="string"===t.fieldType?"":null,r.operator="="),"operator"===t.fieldName&&(r.value=null),r};const A=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:_,t=arguments.length>1?arguments[1]:void 0;switch(t.type){case n.E6:var r={rowId:(new Date).getTime(),groupId:t.groupId,attribute:null,operator:"=",value:null,type:null,fieldOptions:{valuesCount:0,currentPage:1},exception:null};return u()({},e,{filterFields:e.filterFields?[].concat(R(e.filterFields),[r]):[r]});case n.vo:return u()({},e,{filterFields:e.filterFields.filter((function(e){return e.rowId!==t.rowId}))});case n.l1:return u()({},e,{filterFields:e.filterFields.map((function(e){return e.rowId===t.rowId?O(e,t):e}))});case n.o7:return u()({},e,{filterFields:e.filterFields.map((function(e){return e.rowId===t.filterField.rowId?u()({},e,{options:u()({},T({},e.options),b({},e.attribute,t.options))},{fieldOptions:u()({},T({},e.fieldOptions),{valuesCount:t.valuesCount})}):e}))});case n.Sm:return"filterField"===t.layerFilterType?u()({},e,{filterFields:e.filterFields.map((function(e){return e.rowId===t.rowId?u()({},e,{openAutocompleteMenu:t.status}):e}))}):(0,d.t8)("crossLayerFilter.collectGeometries.queryCollection.filterFields",(f()(e,"crossLayerFilter.collectGeometries.queryCollection.filterFields")||[]).map((function(e){return e.rowId===t.rowId?T(T({},e),{},{openAutocompleteMenu:t.status}):e})),e);case n.D6:return u()({},e,{autocompleteEnabled:t.status});case n.Nr:return"filterField"===t.layerFilterType?u()({},e,{filterFields:e.filterFields.map((function(e){return e.rowId===t.filterField.rowId?u()({},e,{loading:t.status}):e}))}):(0,d.t8)("crossLayerFilter.collectGeometries.queryCollection.filterFields",(f()(e,"crossLayerFilter.collectGeometries.queryCollection.filterFields")||[]).map((function(e){return e.rowId===t.filterField.rowId?T(T({},e),{},{loading:t.status}):e})),e);case n.J9:return u()({},e,{filterFields:e.filterFields.map((function(e){return e.rowId===t.rowId?u()({},e,{exception:t.exceptionMessage}):e}))});case n.U:var i={id:(new Date).getTime(),logic:"OR",groupId:t.groupId,index:t.index+1};return u()({},e,{groupFields:e.groupFields?[].concat(R(e.groupFields),[i]):[i]});case n.z8:return u()({},e,{groupFields:e.groupFields.map((function(e){return e.id===t.groupId?u()({},e,{logic:t.logic}):e}))});case n.ql:return u()({},e,{filterFields:e.filterFields.filter((function(e){return e.groupId!==t.groupId})),groupFields:e.groupFields.filter((function(e){return e.id!==t.groupId}))});case n.O_:return u()({},e,{filterFields:e.filterFields.map((function(e){for(var r=0;r<t.attributes.length;r++)if(e.attribute===t.attributes[r].id)return u()({},e,{value:null});return e}))});case n.M$:return u()({},e,{attributePanelExpanded:t.expand});case n.Ug:return u()({},e,{spatialPanelExpanded:t.expand});case n.p5:return u()({},e,{crossLayerExpanded:t.expand});case n.Fz:return u()({},e,{crossLayerFilter:(0,d.t8)(t.key,t.value,e.crossLayerFilter)});case n.Gf:return(0,d.vy)("crossLayerFilter.collectGeometries.queryCollection.filterFields",{rowId:t.rowId,groupId:t.groupId,attribute:null,operator:"=",value:null,type:null,fieldOptions:{valuesCount:0,currentPage:1},exception:null},{rowId:t.rowId},e);case n.nh:return(0,d.t8)("crossLayerFilter.collectGeometries.queryCollection.filterFields",(f()(e,"crossLayerFilter.collectGeometries.queryCollection.filterFields")||[]).map((function(e){return e.rowId===t.rowId?O(e,t):e})),e);case n.Rf:return(0,d.z6)("crossLayerFilter.collectGeometries.queryCollection.filterFields",{rowId:t.rowId},e);case n.WZ:return u()({},e,{crossLayerFilter:{attribute:e.crossLayerFilter&&e.crossLayerFilter.attribute}});case n.Xp:return(0,d.t8)("crossLayerFilter.collectGeometries.queryCollection.filterFields",(f()(e,"crossLayerFilter.collectGeometries.queryCollection.filterFields")||[]).map((function(e){return e.rowId===t.filterField.rowId?T(T({},e),{},{options:T(T({},e.options),{},b({},e.attribute,t.options)),fieldOptions:T(T({},e.fieldOptions),{},{valuesCount:t.valuesCount})}):e})),e);case n.bP:return u()({},e,{spatialField:u()({},e.spatialField,b(b({},t.fieldName,t.method),"geometry",null))});case n.d_:return u()({},e,{spatialField:u()({},e.spatialField,{geometry:t.geometry})},{toolbarEnabled:!0});case n.xM:return u()({},e,{spatialField:u()({},e.spatialField,b({},t.fieldName,t.operation))});case n.bl:return u()({},e,{spatialField:u()({},e.spatialField,{attribute:t.attribute}),crossLayerFilter:u()({},e.crossLayerFilter,{attribute:t.attribute})});case o.hZ:return"queryform"===t.owner&&"start"===t.status?u()({},e,{toolbarEnabled:!1}):e;case n.Wi:return u()({},e,{toolbarEnabled:!0,spatialField:u()({},e.spatialField,{value:t.value,collectGeometries:t.collectGeometries,geometry:t.srsName?T(T({},t.geometry),{},{projection:t.srsName}):t.geometry})});case o.pb:return"queryform"===t.owner?u()({},e,{toolbarEnabled:!0,spatialField:u()({},e.spatialField,{collectGeometries:t.collectGeometries,geometry:t.geometry})}):e;case n.PN:var l=u()({},_.spatialField,{attribute:e.spatialField.attribute,value:void 0});return u()({},e,{spatialField:u()({},e.spatialField,l)});case n._M:return u()({},e,{showDetailsPanel:t.show});case n.Eg:var s=u()({},_.spatialField,{attribute:e.spatialField.attribute,value:void 0}),p={attribute:e.crossLayerFilter&&e.crossLayerFilter.attribute};return u()({},e,_,{spatialField:s,crossLayerFilter:p});case n.V1:return u()({},e,{showGeneratedFilter:t.data});case n.cY:return u()({},e,{spatialField:u()({},e.spatialField,{geometry:u()({},e.spatialField.geometry,{distance:t.distance})})});case n.co:return u()({},e,{spatialField:u()({},e.spatialField,{zoneFields:e.spatialField.zoneFields.map((function(e){return e.id===t.id&&t.data.features&&t.data.features.length>0?u()({},e,{values:t.data.features,open:!0,error:null}):e}))})});case n.RD:return u()({},e,{spatialField:u()({},e.spatialField,{zoneFields:e.spatialField.zoneFields.map((function(e){return e.id===t.id?u()({},e,{busy:t.active}):e}))})});case n.uY:var F,m,A=e.spatialField.zoneFields.map((function(e){if(e.id===t.id){if(F=e.multivalue?t.value.value:t.value.value[0],t.value.feature[0]){var r=t.value.feature[0],n=r.geometry_name;if(e.multivalue&&t.value.feature.length>1){for(var o=1;o<t.value.feature.length;o++){var i=t.value.feature[o];i&&(r=a()(r,i))}m={coordinates:r.geometry.coordinates,geometryName:n,geometryType:r.geometry.type}}else m={coordinates:r.geometry.coordinates,geometryName:n,geometryType:r.geometry.type}}return u()({},e,{value:F,open:!1,geometryName:m?m.geometryName:null})}return e.dependson&&t.id===e.dependson.id?u()({},e,{disabled:!1,values:null,value:null,open:!1,dependson:u()({},e.dependson,{value:F})}):e})),I=c()({type:"FeatureCollection",features:t.value.feature});return u()({},e,{spatialField:u()({},e.spatialField,{zoneFields:A,geometry:I&&m?{extent:I,type:m.geometryType,coordinates:m.coordinates}:null})});case n.H8:return u()({},e,{spatialField:u()({},e.spatialField,{zoneFields:e.spatialField.zoneFields.map((function(e){var t=u()({},e,{values:null,value:null,open:!1,error:null});return e.dependson?u()({},t,{disabled:!0,open:!1,value:null,dependson:u()({},e.dependson,{value:null})}):t})),geometry:null})});case n.Hl:var g;return u()({},e,{spatialField:u()({},e.spatialField,{zoneFields:e.spatialField.zoneFields.map((function(e){return e.id===t.id?(g="object"!==y(t.error)?t.error.status&&t.error.statusText&&t.error.data?{status:t.error.status,statusText:t.error.statusText,data:t.error.data}:{message:t.error.message||"unknown error"}:t.error,u()({},e,{error:g,busy:!1})):e}))})});case n.je:var v=e.simpleFilterFields.reduce((function(e,r){return r.fieldId===t.id?e.push(T(T({},r),t.properties)):e.push(r),e}),[]);return T(T({},e),{},{simpleFilterFields:v});case n.go:var S=t.properties.fieldId?t.properties:T(T({},t.properties),{},{fieldId:(new Date).getTime()}),D=e.simpleFilterFields?[].concat(R(e.simpleFilterFields),[S]):[S];return T(T({},e),{},{simpleFilterFields:D});case n._8:return T(T({},e),{},{simpleFilterFields:e.simpleFilterFields.filter((function(e){return e.fieldId!==t.id}))});case n.xd:return T(T({},e),{},{simpleFilterFields:[]});case n.Ef:var L=_.spatialField,h=(L.attribute,function(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}(L,E)),U=u()({},_,{spatialField:T({},h)}),N=t.filter||U,P=N.spatialField,G=N.filterFields,C=N.groupFields,w=N.crossLayerFilter,j=N.attributePanelExpanded,M=N.spatialPanelExpanded,Y=N.crossLayerExpanded;return T(T({},e),{attributePanelExpanded:j,spatialPanelExpanded:M,crossLayerExpanded:Y,spatialField:T(T({},P),{},{attribute:P&&P.attribute||e.spatialField&&e.spatialField.attribute}),filterFields:G,groupFields:C,crossLayerFilter:T(T({},w),{},{attribute:w&&w.attribute||e.crossLayerFilter&&e.crossLayerFilter.attribute})});default:return e}}}}]);