(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[88380],{433528:(e,n,t)=>{"use strict";t.d(n,{gJ:()=>r,Oj:()=>o,jp:()=>i,CM:()=>a,DU:()=>p,aO:()=>l,v6:()=>u,K8:()=>s,IN:()=>c,zh:()=>E,AH:()=>d,Ub:()=>f,_9:()=>y,JB:()=>T,oh:()=>m,AY:()=>R,yi:()=>g,SW:()=>_,Hk:()=>A,iQ:()=>S,dY:()=>b,$:()=>h,_u:()=>v,gG:()=>I,DI:()=>w,dZ:()=>U,qw:()=>D,f$:()=>O,bZ:()=>x,$O:()=>L,sF:()=>F,Gk:()=>G,vO:()=>N,ut:()=>C,MK:()=>P,VV:()=>V,B8:()=>k,VM:()=>Y,a3:()=>M,Xp:()=>B,DA:()=>H,sK:()=>j,yA:()=>z,r:()=>W,iB:()=>Q,WB:()=>Z,EH:()=>K,Yd:()=>X,Hg:()=>$,Lz:()=>q,ye:()=>J,Jb:()=>ee,d:()=>ne,fT:()=>te,Ib:()=>re,Pl:()=>oe,UB:()=>ie,Uh:()=>ae,QT:()=>pe,oL:()=>le,Ap:()=>ue,KD:()=>se,Z_:()=>ce,Vw:()=>Ee,sY:()=>de,kA:()=>fe,gr:()=>ye,pX:()=>Te,F5:()=>me,MO:()=>Re,dq:()=>ge,DY:()=>_e,oO:()=>Ae,uF:()=>Se,a8:()=>be,Pv:()=>he,an:()=>ve,lg:()=>Ie,nY:()=>we,nG:()=>Ue,lx:()=>De,$S:()=>Oe,gc:()=>xe,Uz:()=>Le,fO:()=>Fe,$E:()=>Ge,cE:()=>Ne,JK:()=>Ce,YV:()=>Pe,t9:()=>Ve,YG:()=>ke,HT:()=>Ye,MY:()=>Me,ve:()=>Be,hB:()=>He,Ox:()=>je,zd:()=>ze,aT:()=>We,VH:()=>Qe,Yb:()=>Ze,Jr:()=>Ke,pP:()=>Xe,gL:()=>$e});var r="FEATUREGRID:SET_UP",o="FEATUREGRID:SELECT_FEATURES",i="FEATUREGRID:DESELECT_FEATURES",a="FEATUREGRID:CLEAR_SELECTION",p="FEATUREGRID:SET_SELECTION_OPTIONS",l="FEATUREGRID:TOGGLE_MODE",u="FEATUREGRID:TOGGLE_FEATURES_SELECTION",s="FEATUREGRID:FEATURES_MODIFIED",c="FEATUREGRID:NEW_FEATURE",E="FEATUREGRID:SAVE_CHANGES",d="FEATUREGRID:SAVING",f="FEATUREGRID:START_EDITING_FEATURE",y="FEATUREGRID:START_DRAWING_FEATURE",T="FEATUREGRID:DELETE_GEOMETRY",m="FEATUREGRID:DELETE_GEOMETRY_FEATURE",R="FEATUREGRID:SAVE_SUCCESS",g="FEATUREGRID:CLEAR_CHANGES",_="FEATUREGRID:SAVE_ERROR",A="FEATUREGRID:DELETE_SELECTED_FEATURES",S="SET_FEATURES",b="FEATUREGRID:SORT_BY",h="FEATUREGRID:SET_LAYER",v="QUERY:UPDATE_FILTER",I="FEATUREGRID:CHANGE_PAGE",w="FEATUREGRID:GEOMETRY_CHANGED",U="DOCK_SIZE_FEATURES",D="FEATUREGRID:TOGGLE_TOOL",O="FEATUREGRID:CUSTOMIZE_ATTRIBUTE",x="ASK_CLOSE_FEATURE_GRID_CONFIRM",L="FEATUREGRID:OPEN_GRID",F="FEATUREGRID:CLOSE_GRID",G="FEATUREGRID:CLEAR_CHANGES_CONFIRMED",N="FEATUREGRID:FEATURE_GRID_CLOSE_CONFIRMED",C="FEATUREGRID:SET_PERMISSION",P="FEATUREGRID:DISABLE_TOOLBAR",V="FEATUREGRID:ACTIVATE_TEMPORARY_CHANGES",k="FEATUREGRID:DEACTIVATE_GEOMETRY_FILTER",Y="FEATUREGRID:ADVANCED_SEARCH",M="FEATUREGRID:ZOOM_ALL",B="FEATUREGRID:INIT_PLUGIN",H="FEATUREGRID:SIZE_CHANGE",j="FEATUREGRID:TOGGLE_SHOW_AGAIN_FLAG",z="FEATUREGRID:HIDE_SYNC_POPOVER",W="FEATUREGRID:UPDATE_EDITORS_OPTIONS",Q="FEATUREGRID:LAUNCH_UPDATE_FILTER_FUNC",Z="FEATUREGRID:SET_SYNC_TOOL",K={EDIT:"EDIT",VIEW:"VIEW"},X="FEATUREGRID:START_SYNC_WMS",$="FEATUREGRID:STOP_SYNC_WMS",q="STORE_ADVANCED_SEARCH_FILTER",J="LOAD_MORE_FEATURES",ee="FEATUREGRID:QUERY_RESULT",ne="FEATUREGRID:SET_TIME_SYNC",te="FEATUREGRID:SET_PAGINATION";function re(){return{type:j}}function oe(){return{type:z}}function ie(e,n){return{type:ee,features:e,pages:n}}function ae(e){return{type:q,filterObj:e}}function pe(){return{type:B,options:arguments.length>0&&void 0!==arguments[0]?arguments[0]:{}}}function le(){return{type:G}}function ue(){return{type:N}}function se(e,n){return{type:o,features:e,append:n}}function ce(e){return{type:r,options:e}}function Ee(e){return{type:w,features:e}}function de(){return{type:f}}function fe(){return{type:y}}function ye(e){return{type:i,features:e}}function Te(){return{type:T}}function me(e){return{type:m,features:e}}function Re(){return{type:a}}function ge(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=e.multiselect,t=e.showCheckbox;return{type:p,multiselect:n,showCheckbox:t}}function _e(e,n){return{type:b,sortBy:e,sortOrder:n}}function Ae(e,n){return{type:I,page:e,size:n}}function Se(e){return{type:h,id:e}}function be(e){return{type:v,update:e,append:arguments.length>1&&void 0!==arguments[1]&&arguments[1]}}function he(e,n){return{type:D,tool:e,value:n}}function ve(e,n,t){return{type:O,name:e,key:n,value:t}}function Ie(){return{type:l,mode:K.EDIT}}function we(){return{type:l,mode:K.VIEW}}function Ue(e,n){return{type:s,features:e,updated:n}}function De(e){return{type:c,features:e}}function Oe(){return{type:E}}function xe(){return{type:R}}function Le(){return{type:A}}function Fe(){return{type:d}}function Ge(){return{type:g}}function Ne(){return{type:_}}function Ce(){return{type:x}}function Pe(){return{type:F}}function Ve(){return{type:L}}function ke(e){return{type:P,disabled:e}}function Ye(e){return{type:C,permission:e}}function Me(){return{type:Y}}function Be(){return{type:M}}function He(){return{type:X}}function je(e,n){return{type:H,size:e,dockProps:n}}var ze=function(e){return{type:J,pages:e}},We=function(e){return{type:V,activated:e}},Qe=function(e){return{type:k,deactivated:e}},Ze=function(e){return{type:ne,value:e}},Ke=function(e){return{type:te,size:e}},Xe=function(e){return{type:Q,updateFilterAction:e}},$e=function(e){return{type:Z,syncWmsFilter:e}}},580416:(e,n,t)=>{"use strict";t.d(n,{yS:()=>r,Zz:()=>o,ms:()=>i,ih:()=>a,OX:()=>l,sb:()=>u,K$:()=>s,k7:()=>c,cX:()=>E,x9:()=>d,vs:()=>f,oE:()=>y,Po:()=>T,qv:()=>m,cI:()=>R,g6:()=>g,I4:()=>_,l$:()=>A,Xv:()=>S,k3:()=>b,CQ:()=>h,R8:()=>v,HN:()=>I,sH:()=>w,c7:()=>U,_7:()=>D,eF:()=>O,O6:()=>x,ED:()=>L,RP:()=>F,sF:()=>G,VP:()=>N,He:()=>C,vO:()=>P,WO:()=>V,bh:()=>k,pV:()=>Y,MK:()=>M,ZF:()=>B,tV:()=>H,Dv:()=>j,Yz:()=>z,kI:()=>W,XG:()=>Q,A4:()=>Z,Rp:()=>K,$o:()=>X,ct:()=>$,oZ:()=>q,oh:()=>J,$h:()=>ee,ud:()=>ne,Qr:()=>te,LR:()=>re,nN:()=>oe,UG:()=>ie,F5:()=>ae,c9:()=>pe,Jh:()=>le,Xy:()=>ue});var r="CHANGE_LAYER_PROPERTIES",o="LAYERS:CHANGE_LAYER_PARAMS",i="CHANGE_GROUP_PROPERTIES",a="TOGGLE_NODE",p="CONTEXT_NODE",l="SORT_NODE",u="REMOVE_NODE",s="UPDATE_NODE",c="MOVE_NODE",E="LAYER_LOADING",d="LAYER_LOAD",f="LAYER_ERROR",y="ADD_LAYER",T="ADD_GROUP",m="REMOVE_LAYER",R="SHOW_SETTINGS",g="HIDE_SETTINGS",_="UPDATE_SETTINGS",A="REFRESH_LAYERS",S="LAYERS:UPDATE_LAYERS_DIMENSION",b="LAYERS_REFRESHED",h="LAYERS_REFRESH_ERROR",v="LAYERS:BROWSE_DATA",I="LAYERS:DOWNLOAD",w="LAYERS:CLEAR_LAYERS",U="LAYERS:SELECT_NODE",D="LAYERS:FILTER_LAYERS",O="LAYERS:SHOW_LAYER_METADATA",x="LAYERS:HIDE_LAYER_METADATA",L="LAYERS:UPDATE_SETTINGS_PARAMS";function F(e,n,t){return{type:R,node:e,nodeType:n,options:t}}function G(){return{type:g}}function N(e){return{type:_,options:e}}function C(e,n){return{type:r,newProperties:n,layer:e}}function P(e,n){return{type:o,layer:e,params:n}}function V(e,n){return{type:i,newProperties:n,group:e}}function k(e,n,t){return{type:a,node:e,nodeType:n,status:!t}}function Y(e){return{type:p,node:e}}function M(e,n){return{type:l,node:e,order:n,sortLayers:arguments.length>2&&void 0!==arguments[2]?arguments[2]:null}}function B(e,n){return{type:u,node:e,nodeType:n,removeEmpty:arguments.length>2&&void 0!==arguments[2]&&arguments[2]}}function H(e,n,t){return{type:s,node:e,nodeType:n,options:t}}function j(e,n,t){return{type:c,node:e,groupId:n,index:t}}function z(e){return{type:E,layerId:e}}function W(e,n){return{type:d,layerId:e,error:n}}function Q(e,n,t){return{type:f,layerId:e,tilesCount:n,tilesErrorCount:t}}function Z(e){return{type:y,layer:e,foreground:!(arguments.length>1&&void 0!==arguments[1])||arguments[1]}}function K(e,n,t){return{type:T,group:e,parent:n,options:t}}function X(e){return{type:m,layerId:e}}function $(e,n){return{type:r,layer:e,newProperties:{_v_:n||(new Date).getTime()}}}function q(e,n){return{type:A,layers:e,options:n}}function J(e){return{type:b,layers:e}}function ee(e,n){return{type:h,layers:e,error:n}}function ne(e,n,t,r){return{type:S,dimension:e,value:n,options:t,layers:r}}function te(e){return{type:v,layer:e}}function re(e){return{type:I,layer:e}}function oe(){return{type:w}}function ie(e,n,t){return{type:U,id:e,nodeType:n,ctrlKey:t}}function ae(e){return{type:D,text:e}}function pe(e,n){return{type:O,metadataRecord:e,maskLoading:n}}function le(){return{type:x}}function ue(e,n){return{type:L,newParams:e,update:n}}},95797:(e,n,t)=>{"use strict";t.d(n,{DR:()=>r,S0:()=>o,u7:()=>i,lj:()=>a,yz:()=>p,lN:()=>l,zW:()=>u,Yx:()=>s,VN:()=>c,Hu:()=>E,VT:()=>d,RD:()=>f,Qq:()=>y,R1:()=>T,_T:()=>m,vO:()=>R,XO:()=>g,jG:()=>_,Xc:()=>A,gT:()=>S,rG:()=>b,t3:()=>h,Fs:()=>v,w_:()=>I,Lm:()=>w,rh:()=>U,rP:()=>D,IO:()=>O,zc:()=>x}),t(375875);var r="LAYER_SELECTED_FOR_SEARCH",o="FEATURE_TYPE_SELECTED",i="FEATURE_TYPE_LOADED",a="FEATURE_LOADED",p="FEATURE_LOADING",l="FEATURE_TYPE_ERROR",u="FEATURE_ERROR",s="QUERY_CREATE",c="QUERY:UPDATE_QUERY",E="QUERY_RESULT",d="QUERY_ERROR",f="RESET_QUERY",y="QUERY",T="INIT_QUERY_PANEL",m="QUERY:TOGGLE_SYNC_WMS",R="QUERY:TOGGLE_LAYER_FILTER";function g(){return{type:m}}function _(){return{type:R}}function A(){return{type:T}}function S(e,n){return{type:o,url:e,typeName:n}}function b(e,n){return{type:i,typeName:e,featureType:n}}function h(e,n){return{type:l,typeName:e,error:n}}function v(e){return{type:p,isLoading:e}}function I(e,n,t,r,o){return{type:E,searchUrl:n,filterObj:t,result:e,queryOptions:r,reason:o}}function w(e){return{type:d,error:e}}function U(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=e.updates,t=e.reason,r=e.useLayerFilter;return{type:c,updates:n,reason:t,useLayerFilter:r}}function D(e,n){return{type:s,searchUrl:e,filterObj:n}}function O(e,n,t,r){return{type:y,searchUrl:e,filterObj:n,queryOptions:t,reason:r}}function x(){return{type:f}}},351288:e=>{var n="SET_OPEN_MENU_GROUP_ID",t="SET_VISIBLE_LEGEND_PANEL",r="SET_VISIBLE_INTRODUCTION",o="SET_VISIBLE_UPLOADER_PANEL",i="SET_VISIBLE_SV_ATTRIBUTE_FORM",a="UPDATE_UPLOAD_STATUS",p="SV_SELECT_LAYER",l="SV_DOWNLOAD_LAYER",u="UPDATE_DATASET_TITLE",s="UPDATE_DATASET_TITLE_SUCCESS",c="SET_SV_CONFIG",E="UPDATE_SV_ATTRIBUTE_FORM",d="CREATE_SV_ATTRIBUTE_FORM",f="SUBMIT_SV_ATTRIBUTE_FORM",y="SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS",T="SET_VISIBLE_SV_ATTRIBUTE_RESULT",m="SET_SV_ATTRIBUTE_RESULT",R="SET_PROCESSING_SV_ATTRIBUTE_FORM";e.exports={SET_OPEN_MENU_GROUP_ID:n,setOpenMenuGroupId:function(e){return{type:n,openMenuGroupId:e}},SET_VISIBLE_LEGEND_PANEL:t,setVisibleLegendPanel:function(e){return{type:t,visible:e}},SET_VISIBLE_INTRODUCTION:r,setVisibleIntroduction:function(e){return{type:r,visible:e}},SET_VISIBLE_UPLOADER_PANEL:o,setVisibleUploaderPanel:function(e,n,t){return{type:o,visible:e,importerConfigKey:n,importerTargetObjectId:t}},SET_VISIBLE_SV_ATTRIBUTE_FORM:i,setVisibleSimpleViewAttributeForm:function(e){return{type:i,visible:e}},UPDATE_UPLOAD_STATUS:a,updateUploadStatus:function(e){return{type:a,status:e}},UPDATE_DATASET_TITLE:u,updateDatasetTitle:function(e,n){return{type:u,datasetName:e,newTitle:n}},UPDATE_DATASET_TITLE_SUCCESS:s,updateDatasetTitleSuccess:function(){return{type:s}},SV_SELECT_LAYER:p,svSelectLayer:function(e){return{type:p,layer:e}},SV_DOWNLOAD_LAYER:l,svDownloadLayer:function(e){return{type:l,layer:e}},SET_SV_CONFIG:c,setSvConfig:function(e){return{type:c,config:e}},UPDATE_SV_ATTRIBUTE_FORM:E,updateSimpleViewAttributeForm:function(e){return{type:E,kv:e}},CREATE_SV_ATTRIBUTE_FORM:d,createSimpleViewAttributeForm:function(e){return{type:d,form:null==e?void 0:e.form,simpleViewImporterSessionId:null==e?void 0:e.importer_session_id,submitUrl:null==e?void 0:e.submitUrl}},SUBMIT_SV_ATTRIBUTE_FORM:f,submitSimpleViewAttributeForm:function(e,n,t){return console.log("actions submitSimpleViewAttributeForm: ",e,n,t),{type:f,form:e,projectId:n,simpleViewImporterSessionId:t}},SUBMIT_SV_ATTRIBUTE_FORM_SUCCESS:y,submitSimpleViewAttributeFormSuccess:function(e){return{type:y,data:e}},SET_PROCESSING_SV_ATTRIBUTE_FORM:R,setProcessingSimpleViewAttributeForm:function(e){return{type:R,processing:e}},SET_VISIBLE_SV_ATTRIBUTE_RESULT:T,setVisibleSimpleViewAttributeResult:function(e){return{type:T,visible:e}},SET_SV_ATTRIBUTE_RESULT:m,setSimpleViewAttributeResult:function(e){return{type:m,data:e}}}},388380:(e,n,t)=>{"use strict";t.d(n,{j:()=>S});var r=t(124852),o=t.n(r),i=t(171703),a=t(580416),p=(t(472619),t(351288)),l=t(95797),u=t(433528),s=t(357218);function c(e){return c="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},c(e)}function E(e,n){for(var t=0;t<n.length;t++){var r=n[t];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,R(r.key),r)}}function d(e,n,t){return n=y(n),function(e,n){if(n&&("object"===c(n)||"function"==typeof n))return n;if(void 0!==n)throw new TypeError("Derived constructors may only return object or undefined");return function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e)}(e,f()?Reflect.construct(n,t||[],y(e).constructor):n.apply(e,t))}function f(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(f=function(){return!!e})()}function y(e){return y=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(e){return e.__proto__||Object.getPrototypeOf(e)},y(e)}function T(e,n){return T=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(e,n){return e.__proto__=n,e},T(e,n)}function m(e,n,t){return(n=R(n))in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function R(e){var n=function(e,n){if("object"!=c(e)||!e)return e;var t=e[Symbol.toPrimitive];if(void 0!==t){var r=t.call(e,"string");if("object"!=c(r))return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==c(n)?n:n+""}var g=t(675263),_=t(185552),A=function(e){function n(e){var t,r;return function(e,n){if(!(e instanceof n))throw new TypeError("Cannot call a class as a function")}(this,n),m(r=d(this,n,[e]),"canEditLayer",(function(e){var n,t;return(null==e||null===(n=e.perms)||void 0===n?void 0:n.indexOf("change_dataset_data"))>-1&&(null==e||null===(t=e.perms)||void 0===t?void 0:t.indexOf("change_resourcebase"))>-1})),m(r,"canDeleteLayer",(function(e){var n;return(null==e||null===(n=e.perms)||void 0===n?void 0:n.indexOf("delete_resourcebase"))>-1})),m(r,"canExportLayer",(function(e){var n;return(null==e||null===(n=e.perms)||void 0===n?void 0:n.indexOf("download_resourcebase"))>-1})),r.state={newTitle:null===(t=e.layer)||void 0===t?void 0:t.title},r}return function(e,n){if("function"!=typeof n&&null!==n)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(n&&n.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),n&&T(e,n)}(n,e),t=n,(r=[{key:"render",value:function(){var e,n,t,r,i,a,p,l=this;return this.props.layer?o().createElement("div",{className:"row menu-row"},o().createElement("span",{className:"pull-left menu-row-button"},o().createElement("span",{className:"btn glyphicon menu-row-glyph "+(null!==(e=this.props.layer)&&void 0!==e&&e.visibility?"glyphicon-ok":"glyphicon-remove"),style:{color:null!==(n=this.props.layer)&&void 0!==n&&n.visibility?"limegreen":"red"},onClick:function(){var e,n,t,r;l.props.toggleLayer(null===(e=l.props.layer)||void 0===e?void 0:e.id,null===(n=l.props.layer)||void 0===n?void 0:n.visibility),console.log("tracking simpleview-menu-row-turn-".concat(null!==(t=l.props.layer)&&void 0!==t&&t.visibility?"off":"on","-").concat(l.props.layer.title)),s.Aw.trackEvent("button","click","simpleview-menu-row-turn-".concat(null!==(r=l.props.layer)&&void 0!==r&&r.visibility?"off":"on","-").concat(l.props.layer.title))}}),this.props.canEditMap&&this.canExportLayer(this.props.layer)?o().createElement(o().Fragment,null,o().createElement("span",{className:"btn glyphicon menu-row-glyph glyphicon-download",style:{color:"limegreen"},onClick:function(){l.props.svDownloadLayer(l.props.layer),console.log("tracking simpleview-menu-row-download-".concat(l.props.layer.title)),s.Aw.trackEvent("button","click","simpleview-menu-row-download-".concat(l.props.layer.title))}}),o().createElement("span",{className:"btn glyphicon menu-row-glyph glyphicon-upload",style:{color:"limegreen"},onClick:function(){var e;l.props.setVisibleUploaderPanel(!0,"erosion",null===(e=l.props.layer)||void 0===e?void 0:e.importerTargetObjectId),console.log("tracking simpleview-menu-row-upload-".concat(l.props.layer.title)),s.Aw.trackEvent("button","click","simpleview-menu-row-upload-".concat(l.props.layer.title))}})):null,this.props.canEditMap&&this.canEditLayer(this.props.layer)?o().createElement(o().Fragment,null,o().createElement("span",{className:"btn glyphicon menu-row-glyph glyphicon-pencil",style:{color:"grey"},onClick:function(){l.props.closeFeatureGrid(),l.props.selectFeatures([]),l.props.setOpenMenuGroupId(null),l.props.setPermission({canEdit:!0}),l.props.svSelectLayer(l.props.layer),l.props.browseData(l.props.layer),console.log("tracking simpleview-menu-row-edit-".concat(l.props.layer.title)),s.Aw.trackEvent("button","click","simpleview-menu-row-edit-".concat(l.props.layer.title))}}),o().createElement("input",{id:"input-".concat(this.props.layer.name),key:"input-key-".concat(this.props.layer.name),className:"data-title-input",style:{width:"160px",float:"none"},type:"text",value:this.state.newTitle,onChange:function(e){return l.setState({newTitle:e.target.value})}}),(null===(t=this.props.layer)||void 0===t?void 0:t.title)===this.state.newTitle?null:o().createElement("span",{className:"btn glyphicon menu-row-glyph glyphicon-floppy-disk",style:{color:"limegreen",float:"right",marginLeft:"8px"},onClick:function(){l.props.updateDatasetTitle(l.props.layer.name,l.state.newTitle),l.props.updateLayerTitle(l.props.layer.id,l.state.newTitle),console.log("tracking simpleview-menu-row-update-title-".concat(l.props.layer.name," -> ").concat(l.state.newTitle)),s.Aw.trackEvent("button","click","tracking simpleview-menu-row-update-title-".concat(l.props.layer.name," -> ").concat(l.state.newTitle))}})):o().createElement("span",{className:"menu-row-text",style:"Error"===(null===(r=this.props.layer)||void 0===r?void 0:r.loadingError)?{textDecoration:"lineThrough"}:null},null===(i=this.props.layer)||void 0===i?void 0:i.title)),o().createElement("span",{className:"pull-right menu-row-button"},this.props.canEditMap&&this.canDeleteLayer(this.props.layer)?o().createElement("span",{className:"btn glyphicon menu-row-glyph glyphicon-trash",style:{color:"darkred",float:"right"},onClick:function(){l.props.removeNode(l.props.layer.id,"layers"),l.props.removeLayer(l.props.layer.id),l.props.refreshlayerVersion(l.props.layer.id),console.log("tracking simpleview-menu-row-delete-".concat(l.props.layer.title)),s.Aw.trackEvent("button","click","simpleview-menu-row-delete-".concat(l.props.layer.title))}}):null,0===this.props.layer.opacity||this.props.layer.opacity?o().createElement("div",{className:"mapstore-slider dataset-transparency with-tooltip",onClick:function(e){e.stopPropagation()},style:this.props.canEditMap&&this.canEditLayer(this.props.layer)?(null===(a=this.props.layer)||void 0===a?void 0:a.title)===this.state.newTitle?{display:"inline-block",float:"right",width:"170px",marginRight:"10px",marginLeft:"10px",marginBottom:"-10px",marginTop:"2px"}:{display:"inline-block",float:"right",width:"140px",marginRight:"10px",marginLeft:"10px",marginBottom:"-10px",marginTop:"2px"}:{display:"inline-block",float:"right",width:"170px",marginRight:"40px",marginLeft:"10px",marginBottom:"-10px",marginTop:"2px"}},o().createElement(_,{step:1,start:100*(null===(p=this.props.layer)||void 0===p?void 0:p.opacity),range:{min:0,max:100},onChange:function(e){var n;l.props.setOpacity(null===(n=l.props.layer)||void 0===n?void 0:n.id,e),console.log("tracking simpleview-menu-row-set-opacity-".concat(l.props.layer.title," -> ").concat(e)),s.Aw.trackEvent("button","click","tracking simpleview-menu-row-set-opacity-".concat(l.props.layer.title," -> ").concat(e))}})):null)):o().createElement("div",{className:"row menu-row"},o().createElement("div",{className:"inline pull-left menu-row-button"},o().createElement("div",{className:"h5 menu-row-text"},"No datasets here yet...")))}}])&&E(t.prototype,r),Object.defineProperty(t,"prototype",{writable:!1}),t;var t,r}(o().Component);m(A,"propTypes",{layer:g.object,svSelectLayer:g.func,toggleLayer:g.func,setOpacity:g.func,setOpenMenuGroupId:g.func,canEditMap:g.bool,editLayer:g.func,featureTypeSelected:g.func,browseData:g.func,setPermission:g.func,closeFeatureGrid:g.func,selectFeatures:g.func,updateDatasetTitle:g.func,removeNode:g.func,removeLayer:g.func,refreshlayerVersion:g.func,updateLayerTitle:g.func,refreshLayers:g.func,svDownloadLayer:g.func,setVisibleUploaderPanel:g.func,selectNode:g.func,lineThrough:g.bool,importerTargetObjectId:g.number});var S=(0,i.connect)((function(e){var n,t,r;return{canEditMap:!["placeholder.com"].map((function(n){var t;return!(null!=e&&null!==(t=e.gnsettings)&&void 0!==t&&t.geonodeUrl.includes(n))})).includes(!1)&&(null==e||null===(n=e.gnresource)||void 0===n||null===(t=n.initialResource)||void 0===t||null===(r=t.perms)||void 0===r?void 0:r.includes("change_resourcebase"))}}),(function(e){return{toggleLayer:function(n,t){return e((0,a.He)(n,{visibility:!t}))},svSelectLayer:function(n){return e((0,p.svSelectLayer)(n))},setOpacity:function(n,t){return e((0,a.He)(n,{opacity:.01*parseFloat(t)}))},setOpenMenuGroupId:function(n){return e((0,p.setOpenMenuGroupId)(n))},featureTypeSelected:function(n,t){return e((0,l.gT)(n,t))},browseData:function(n){return e((0,a.Qr)(n))},setPermission:function(n){return e((0,u.HT)(n))},closeFeatureGrid:function(){return e((0,u.YV)())},selectFeatures:function(n,t){return e((0,u.KD)(n,t))},updateDatasetTitle:function(n,t){return e((0,p.updateDatasetTitle)(n,t))},removeNode:function(n,t){return e((0,a.ZF)(n,t))},removeLayer:function(n){return e((0,a.$o)(n))},updateLayerTitle:function(n,t){return e((0,a.He)(n,{title:t}))},refreshLayers:function(n){return e((0,a.oZ)(n))},svDownloadLayer:function(n){return e((0,p.svDownloadLayer)(n))},setVisibleUploaderPanel:function(n,t,r){return e((0,p.setVisibleUploaderPanel)(n,t,r))}}}))(A)},39162:(e,n,t)=>{"use strict";t.d(n,{Z:()=>i});var r=t(923645),o=t.n(r)()((function(e){return e[1]}));o.push([e.id,".msgapi .simple-view-menu-button {\n    position: absolute;\n    z-index: 1021;\n    top: 11px;\n    width: 85px;\n    height: 50px;\n    background-color: rgba(0, 60, 136, 0.6);\n    border-color: rgba(255, 255, 255, 0.7);\n    border-width: 2px;\n    padding: 3px 5px;\n    font-size: 12px;\n    line-height: 1.3;\n    border-radius: 4px;\n    color: white;\n    text-align: center\n}\n\n.msgapi .simple-view-panel {\n    position: absolute;\n    z-index: 1021;\n    top: 65px;\n    left: 20px;\n    min-width: 500px;\n    background-color: rgba(0, 60, 136, 0.8);\n    border: #ffffff99 solid 1px;\n    border-radius: 4px;\n    padding: 5px 10px;\n    font-size: 12px;\n    line-height: 1.5;\n    color: white;\n    text-align: center;\n}\n\n.msgapi .simple-view-panel-item-row {\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    height: 40px;\n    padding: 4px 10px;\n    border: solid 1px rgba(255, 255, 255, 0.2);\n    border-radius: 5px;\n}\n\n.msgapi .simple-view-panel input {\n    background-color: #5178af;\n    border: 0;\n    border-radius: 4px;\n    color: white;\n}\n\n.msgapi .simple-view-panel ::-webkit-scrollbar {\n    width: 1em;\n    margin-left: 1em;\n    margin-right: 1em;\n    padding-left: 1em;\n    padding-right: 1em;\n}\n\n.msgapi .simple-view-panel ::-webkit-scrollbar-thumb {\n    background-color: #5178af;\n    outline: 1px solid rgba(255, 255, 255, 0.2);\n    border-radius: 4px;\n}\n\n.msgapi .simple-view-panel-header {\n    font-size: x-large;\n    border-bottom: 2px solid #ffffffad;\n    padding-left: 5px;\n    margin: 0;\n}\n\n.msgapi .simple-view-panel-body {\n    display: flex;\n    flex-direction: row;\n    height: 80%;\n    max-height: 80vh;\n    overflow-y: scroll;\n}\n\n.msgapi .simple-view-panel-col-one {\n    display: flex;\n    flex-direction: column;\n    margin-right: 20px;\n    padding: 10px;\n    max-height: 100%;\n    overflow-y: auto;\n    width: 100%;\n    min-width: 300px;\n    border: solid 1px rgba(53, 133, 176);\n    border-radius: 4px;\n}\n\n.msgapi .simple-view-panel-footer {\n    border-top: solid 1px #3585b0;\n    width: 100%;\n    padding: 10px;\n    display: flex;\n    flex-direction: row-reverse;\n    position: absolute;\n    bottom: 0;\n    right: 0;\n}\n\n.msgapi #simple-view-editor > * {\n    text-align: left;\n}\n\n.msgapi .legend-button {\n    right: 12px;\n}\n\n.msgapi .legend-panel {\n    top: 10px;\n    right: 60px;\n    left: unset;\n    text-align: right;\n    padding-bottom: 20px;\n    overflow-y: auto;\n    overflow-x: hidden;\n    max-height: 92%;\n    max-width: 400px;\n}\n\n.msgapi .legend-button-with-search {\n    top: 65px;\n    right: 15px;\n}\n\n.msgapi .legend-panel-with-search {\n    top: 65px;\n    right: 15px;\n    left: unset;\n    text-align: right;\n    padding-bottom: 20px;\n    overflow-y: auto;\n    overflow-x: hidden;\n    max-height: 92%;\n    max-width: 400px;\n}\n\n.msgapi .legend-row {\n    padding: 10px;\n    margin: -1px 10px -1px 10px;\n    border: 1px solid #ffffffad;\n    border-radius: 3px;\n}\n\n.msgapi .legend-background {\n    background-color: white;\n    padding: 3px;\n    border-radius: 3px;\n}\n\n.msgapi .legend-image {                                                \n    display: block;\n    text-align: center;\n    margin-left: auto;\n    margin-right: auto;\n    max-width: 80%;\n}\n\n.msgapi .legend-text-label {\n    text-align: left;\n}\n\n.msgapi .legend-heading {\n    text-align: center;\n}\n\n.msgapi .legend-close {\n    position: absolute;\n    right: 0;\n    color: red;\n}\n\n.msgapi .uploader-panel {\n    position: fixed;\n    top: 70px;\n    right: 10px;\n    left: unset;\n    padding-bottom: 20px;\n    overflow-y: auto;\n    overflow-x: hidden;\n    max-height: 92%;\n    max-width: 800px;\n}\n\n.msgapi .uploader-panel>tbody {\n    background-color: transparent;\n}\n\n\n.msgapi #simple-view-attribute-form-panel {\n    top: 70px;\n    display: flex;\n    flex-direction: column;\n    background-color: #063167;\n    text-align: left;\n    width: 95%;\n    height: 80%;\n    font-size: small;\n    background-color: rgba(43, 89, 148);\n}\n\n.msgapi .menu-rows-container {\n}\n\n.msgapi .menu-row {\n    padding-left: 5px;\n    margin: 0;\n}\n\n.msgapi .menu-row-header {\n    font-size: larger;\n    border-bottom: 2px solid #ffffffad;\n    padding-left: 5px;\n    margin: 0;\n}\n\n.msgapi .menu-row-button {\n    display: inline-block;\n    vertical-align: middle;\n}\n\n\n.msgapi .menu-row-glyph {\n    background: #ffffff;\n    border-radius: 3px;\n    margin: 2px 5px 4px 0;\n    color: limegreen;\n    font-size: 14px;\n    padding: 3px 4px;\n}\n\n.msgapi .menu-row-text {\n    font-size: 14px;\n    white-space: nowrap;\n    padding-left: 3px;\n    vertical-align: middle;\n    text-overflow: ellipsis ellipsis;\n    overflow: hidden;\n}\n\n.msgapi .menu-row-mini-heading {\n    width: 100%;\n    margin-top: 10px;\n    margin-left: 10px;\n    text-align: left;\n}\n\n.msgapi .menu-row-mini-container {\n    border: 1px solid #ffffff80;\n    border-radius: 3px;\n    margin: 1px;\n}\n\n.msgapi .dataset-transparency {\n    margin-left: 330px;\n}\n\n.msgapi .data-title-input {\n    float: right;\n    margin-top: 0;\n    font-size: 12px;\n    white-space: nowrap;\n    padding-left: 3px;\n    vertical-align: middle;\n    text-overflow: ellipsis ellipsis;\n    overflow: hidden;\n    border: white;\n    text-align: left;\n    background: rgba(255, 255, 255, 0.22);\n    color: #f4f4f4;\n}\n\n.msgapi .mapstore-slider.with-tooltip.dataset-transparency .noUi-target.noUi-horizontal .noUi-base .noUi-origin .noUi-handle {\n    width: 20px;\n    left: -10px;\n    border: 2px solid #dddddd;\n    border-radius: 10px;\n    cursor: default;\n}\n\n.msgapi .mapstore-slider.with-tooltip.dataset-transparency .noUi-target {\n    box-shadow: none;\n    border: 1px solid rgba(255, 255, 255, 0.68);\n    background-color: #335781;\n}\n\n.msgapi .sk-circle:before {\n    background-color: white !important;\n}\n\n.msgapi .introduction-modal {\n    background-color: #335781;\n    color: white;\n    opacity: 0.95;\n}\n\n.msgapi #gn-brand-navbar {\n    background-color: #335781;\n}\n\n.msgapi #mapstore-drawermenu {\n    display: none;\n}",""]);const i=o},472619:(e,n,t)=>{"use strict";var r=t(893379),o=t.n(r),i=t(39162);o()(i.Z,{insert:"head",singleton:!1}),i.Z.locals}}]);