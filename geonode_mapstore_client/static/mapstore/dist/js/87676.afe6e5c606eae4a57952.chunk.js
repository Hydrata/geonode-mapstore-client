(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[87676],{242780:(t,e,n)=>{"use strict";n.d(e,{Xp:()=>i,A1:()=>u,Mf:()=>a,wq:()=>c,CD:()=>p,DX:()=>s,GW:()=>E,c4:()=>l,Ne:()=>T,hv:()=>f,x9:()=>O,Lv:()=>A,mA:()=>N,Ge:()=>y,sL:()=>I,B6:()=>d,vG:()=>R,QY:()=>b,X2:()=>S,dC:()=>m,bO:()=>g,eY:()=>D,bI:()=>_,Rr:()=>h,Np:()=>G,pC:()=>v,cM:()=>C,iO:()=>F,R_:()=>L,zT:()=>U,$l:()=>P,qO:()=>w,eK:()=>M,HN:()=>j,Bm:()=>H,Kz:()=>Y,gT:()=>V,JT:()=>x,CO:()=>k,NV:()=>W,Ns:()=>B,Fz:()=>Z,Nj:()=>z,op:()=>K,GI:()=>X,Cg:()=>$,WD:()=>q,rb:()=>Q,it:()=>J,br:()=>tt,Hf:()=>et,Ps:()=>nt,U7:()=>rt,aH:()=>ot,qX:()=>it,cv:()=>ut,M_:()=>at,QT:()=>ct,z_:()=>pt,Y5:()=>st,wP:()=>Et,pv:()=>lt,bM:()=>Tt,Zw:()=>ft,Ay:()=>Ot,aS:()=>At,LR:()=>Nt,VR:()=>yt,A9:()=>It,i9:()=>dt,$f:()=>Rt,F4:()=>bt,r1:()=>St,Om:()=>mt,_x:()=>gt,dT:()=>Dt,jw:()=>_t,iY:()=>ht,QD:()=>Gt,xD:()=>vt,kg:()=>Ct,ob:()=>Ft,nk:()=>Lt,A_:()=>Ut,nY:()=>Pt,Bp:()=>wt,CH:()=>Mt,Rx:()=>jt,MQ:()=>Ht,l7:()=>Yt,VP:()=>Vt,g:()=>xt,L0:()=>kt,if:()=>Wt,tp:()=>Bt,TA:()=>Zt,yg:()=>zt,Hl:()=>Kt,y$:()=>Xt,ts:()=>$t,UJ:()=>qt,yw:()=>Qt,nz:()=>Jt,RC:()=>te,om:()=>ee,XW:()=>ne,WB:()=>re,pI:()=>oe,Dd:()=>ie,V_:()=>ue,TW:()=>ae,$:()=>ce,Y_:()=>pe,Ib:()=>se,_n:()=>Ee});var r=n(91175),o=n.n(r),i="ANNOTATIONS:INIT_PLUGIN",u="ANNOTATIONS:EDIT",a="ANNOTATIONS:OPEN_EDITOR",c="ANNOTATIONS:SHOW",p="ANNOTATIONS:NEW",s="ANNOTATIONS:REMOVE",E="ANNOTATIONS:REMOVE_GEOMETRY",l="ANNOTATIONS:CONFIRM_REMOVE",T="ANNOTATIONS:CANCEL_REMOVE",f="ANNOTATIONS:CANCEL_EDIT",O="ANNOTATIONS:CANCEL_SHOW",A="ANNOTATIONS:SAVE",N="ANNOTATIONS:TOGGLE_ADD",y="ANNOTATIONS:TOGGLE_STYLE",I="ANNOTATIONS:SET_STYLE",d="ANNOTATIONS:RESTORE_STYLE",R="ANNOTATIONS:SET_INVALID_SELECTED",b="ANNOTATIONS:VALIDATION_ERROR",S="ANNOTATIONS:HIGHLIGHT",m="ANNOTATIONS:CLEAN_HIGHLIGHT",g="ANNOTATIONS:FILTER",D="ANNOTATIONS:CLOSE",_="ANNOTATIONS:CONFIRM_CLOSE",h="ANNOTATIONS:CANCEL_CLOSE",G="ANNOTATIONS:START_DRAWING",v="ANNOTATIONS:UNSAVED_CHANGES",C="ANNOTATIONS:VISIBILITY",F="ANNOTATIONS:TOGGLE_CHANGES_MODAL",L="ANNOTATIONS:TOGGLE_GEOMETRY_MODAL",U="ANNOTATIONS:CHANGED_PROPERTIES",P="ANNOTATIONS:UNSAVED_STYLE",w="ANNOTATIONS:TOGGLE_STYLE_MODAL",M="ANNOTATIONS:ADD_TEXT",j="ANNOTATIONS:DOWNLOAD",H="ANNOTATIONS:LOAD_ANNOTATIONS",Y="ANNOTATIONS:CHANGED_SELECTED",V="ANNOTATIONS:RESET_COORD_EDITOR",x="ANNOTATIONS:CHANGE_RADIUS",k="ANNOTATIONS:CHANGE_TEXT",W="ANNOTATIONS:ADD_NEW_FEATURE",B="ANNOTATIONS:SET_EDITING_FEATURE",Z="ANNOTATIONS:HIGHLIGHT_POINT",z="ANNOTATIONS:TOGGLE_DELETE_FT_MODAL",K="ANNOTATIONS:CONFIRM_DELETE_FEATURE",X="ANNOTATIONS:CHANGE_FORMAT",$="ANNOTATIONS:UPDATE_SYMBOLS",q="ANNOTATIONS:ERROR_SYMBOLS",Q="ANNOTATIONS:SET_DEFAULT_STYLE",J="ANNOTATIONS:LOAD_DEFAULT_STYLES",tt="ANNOTATIONS:LOADING",et="ANNOTATIONS:CHANGE_GEOMETRY_TITLE",nt="ANNOTATIONS:FILTER_MARKER",rt="ANNOTATIONS:HIDE_MEASURE_WARNING",ot="ANNOTATIONS:TOGGLE_SHOW_AGAIN",it="ANNOTATIONS:GEOMETRY_HIGHLIGHT",ut="ANNOTATIONS:UNSELECT_FEATURE",at="ANNOTATIONS:VALIDATE_FEATURE",ct=function(){return{type:i}},pt=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:[];return{type:$,symbols:t}},st=function(t){return{type:q,symbolErrors:t}},Et=function(t){var e=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return{type:H,features:t,override:e}},lt=function(){return{type:K}},Tt=function(t){return{type:a,id:t}},ft=function(t){return{type:X,format:t}},Ot=function(){return{type:z}},At=function(t){return{type:Z,point:t}},Nt=function(t){return{type:j,annotation:t}},yt=function(t){return function(e,n){var r=o()(o()(n().layers.flat.filter((function(t){return"annotations"===t.id}))).features.filter((function(e){return e.properties.id===t})));"FeatureCollection"===r.type?e({type:u,feature:r,featureType:r.type}):e({type:u,feature:r,featureType:r.geometry.type})}},It=function(){return{type:p}},dt=function(t,e,n,r){return{type:Y,coordinates:t,radius:e,text:n,crs:r}},Rt=function(t,e){return{type:R,errorFrom:t,coordinates:e}},bt=function(){return{type:M}},St=function(t,e){return{type:C,id:t,visibility:e}},mt=function(t,e){return{type:U,field:t,value:e}},gt=function(t){return{type:s,id:t}},Dt=function(t){return{type:E,id:t}},_t=function(t,e){return{type:l,id:t,attribute:e}},ht=function(){return{type:T}},Gt=function(t){return{type:f,properties:t}},vt=function(t,e,n,r,o,i){return{type:A,id:t,fields:e,geometry:n,style:r,newFeature:o,properties:i}},Ct=function(t){return{type:N,featureType:t}},Ft=function(t){return{type:y,styling:t}},Lt=function(){return{type:d}},Ut=function(t){return{type:I,style:t}},Pt=function(t,e,n){return{type:"ANNOTATIONS:UPDATE_GEOMETRY",geometry:t,textChanged:e,circleChanged:n}},wt=function(t){return{type:b,errors:t}},Mt=function(t){return{type:S,id:t}},jt=function(){return{type:m}},Ht=function(t){return{type:c,id:t}},Yt=function(){return{type:O}},Vt=function(t){return{type:g,filter:t}},xt=function(){return{type:D}},kt=function(t){return{type:_,properties:t}},Wt=function(t){return{type:v,unsavedChanges:t}},Bt=function(t){return{type:P,unsavedStyle:t}},Zt=function(){return{type:W}},zt=function(t){return{type:B,feature:t}},Kt=function(){return{type:h}},Xt=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return{type:G,options:t}},$t=function(){return{type:F}},qt=function(){return{type:L}},Qt=function(){return{type:w}},Jt=function(){return{type:V}},te=function(){return{type:ut}},ee=function(t,e,n){return{type:x,radius:t,components:e,crs:n}},ne=function(t,e){return{type:k,text:t,components:e}},re=function(t,e){return{type:Q,path:t,style:e}},oe=function(t,e,n,r,o){return{type:J,shape:t,size:e,fillColor:n,strokeColor:r,symbolsPath:o}},ie=function(t){return{type:et,title:t}},ue=function(t){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"loading";return{type:tt,name:e,value:t}},ae=function(t){return{type:nt,filter:t}},ce=function(t,e){return{type:it,id:t,state:e}},pe=function(){return{type:rt}},se=function(){return{type:ot}},Ee=function(){return{type:at}}},433528:(t,e,n)=>{"use strict";n.d(e,{gJ:()=>r,Oj:()=>o,jp:()=>i,CM:()=>u,DU:()=>a,aO:()=>c,v6:()=>p,K8:()=>s,IN:()=>E,zh:()=>l,AH:()=>T,Ub:()=>f,_9:()=>O,JB:()=>A,oh:()=>N,AY:()=>y,yi:()=>I,SW:()=>d,Hk:()=>R,iQ:()=>b,dY:()=>S,$:()=>m,_u:()=>g,gG:()=>D,DI:()=>_,dZ:()=>h,qw:()=>G,f$:()=>v,bZ:()=>C,$O:()=>F,sF:()=>L,Gk:()=>U,vO:()=>P,ut:()=>w,MK:()=>M,VV:()=>j,B8:()=>H,VM:()=>Y,a3:()=>V,Xp:()=>x,DA:()=>k,sK:()=>W,yA:()=>B,r:()=>Z,iB:()=>z,WB:()=>K,EH:()=>X,Yd:()=>$,Hg:()=>q,Lz:()=>Q,ye:()=>J,Jb:()=>tt,d:()=>et,fT:()=>nt,Ib:()=>rt,Pl:()=>ot,UB:()=>it,Uh:()=>ut,QT:()=>at,oL:()=>ct,Ap:()=>pt,KD:()=>st,Zk:()=>Et,Z_:()=>lt,Vw:()=>Tt,sY:()=>ft,kA:()=>Ot,gr:()=>At,pX:()=>Nt,F5:()=>yt,MO:()=>It,dq:()=>dt,DY:()=>Rt,oO:()=>bt,uF:()=>St,a8:()=>mt,Pv:()=>gt,an:()=>Dt,lg:()=>_t,nY:()=>ht,nG:()=>Gt,lx:()=>vt,$S:()=>Ct,gc:()=>Ft,Uz:()=>Lt,fO:()=>Ut,$E:()=>Pt,cE:()=>wt,JK:()=>Mt,YV:()=>jt,t9:()=>Ht,YG:()=>Yt,HT:()=>Vt,MY:()=>xt,ve:()=>kt,hB:()=>Wt,Ox:()=>Bt,zd:()=>Zt,aT:()=>zt,VH:()=>Kt,Yb:()=>Xt,Jr:()=>$t,pP:()=>qt,gL:()=>Qt});var r="FEATUREGRID:SET_UP",o="FEATUREGRID:SELECT_FEATURES",i="FEATUREGRID:DESELECT_FEATURES",u="FEATUREGRID:CLEAR_SELECTION",a="FEATUREGRID:SET_SELECTION_OPTIONS",c="FEATUREGRID:TOGGLE_MODE",p="FEATUREGRID:TOGGLE_FEATURES_SELECTION",s="FEATUREGRID:FEATURES_MODIFIED",E="FEATUREGRID:NEW_FEATURE",l="FEATUREGRID:SAVE_CHANGES",T="FEATUREGRID:SAVING",f="FEATUREGRID:START_EDITING_FEATURE",O="FEATUREGRID:START_DRAWING_FEATURE",A="FEATUREGRID:DELETE_GEOMETRY",N="FEATUREGRID:DELETE_GEOMETRY_FEATURE",y="FEATUREGRID:SAVE_SUCCESS",I="FEATUREGRID:CLEAR_CHANGES",d="FEATUREGRID:SAVE_ERROR",R="FEATUREGRID:DELETE_SELECTED_FEATURES",b="SET_FEATURES",S="FEATUREGRID:SORT_BY",m="FEATUREGRID:SET_LAYER",g="QUERY:UPDATE_FILTER",D="FEATUREGRID:CHANGE_PAGE",_="FEATUREGRID:GEOMETRY_CHANGED",h="DOCK_SIZE_FEATURES",G="FEATUREGRID:TOGGLE_TOOL",v="FEATUREGRID:CUSTOMIZE_ATTRIBUTE",C="ASK_CLOSE_FEATURE_GRID_CONFIRM",F="FEATUREGRID:OPEN_GRID",L="FEATUREGRID:CLOSE_GRID",U="FEATUREGRID:CLEAR_CHANGES_CONFIRMED",P="FEATUREGRID:FEATURE_GRID_CLOSE_CONFIRMED",w="FEATUREGRID:SET_PERMISSION",M="FEATUREGRID:DISABLE_TOOLBAR",j="FEATUREGRID:ACTIVATE_TEMPORARY_CHANGES",H="FEATUREGRID:DEACTIVATE_GEOMETRY_FILTER",Y="FEATUREGRID:ADVANCED_SEARCH",V="FEATUREGRID:ZOOM_ALL",x="FEATUREGRID:INIT_PLUGIN",k="FEATUREGRID:SIZE_CHANGE",W="FEATUREGRID:TOGGLE_SHOW_AGAIN_FLAG",B="FEATUREGRID:HIDE_SYNC_POPOVER",Z="FEATUREGRID:UPDATE_EDITORS_OPTIONS",z="FEATUREGRID:LAUNCH_UPDATE_FILTER_FUNC",K="FEATUREGRID:SET_SYNC_TOOL",X={EDIT:"EDIT",VIEW:"VIEW"},$="FEATUREGRID:START_SYNC_WMS",q="FEATUREGRID:STOP_SYNC_WMS",Q="STORE_ADVANCED_SEARCH_FILTER",J="LOAD_MORE_FEATURES",tt="FEATUREGRID:QUERY_RESULT",et="FEATUREGRID:SET_TIME_SYNC",nt="FEATUREGRID:SET_PAGINATION";function rt(){return{type:W}}function ot(){return{type:B}}function it(t,e){return{type:tt,features:t,pages:e}}function ut(t){return{type:Q,filterObj:t}}function at(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return{type:x,options:t}}function ct(){return{type:U}}function pt(){return{type:P}}function st(t,e){return{type:o,features:t,append:e}}var Et=function(t){return{type:Z,payload:t}};function lt(t){return{type:r,options:t}}function Tt(t){return{type:_,features:t}}function ft(){return{type:f}}function Ot(){return{type:O}}function At(t){return{type:i,features:t}}function Nt(){return{type:A}}function yt(t){return{type:N,features:t}}function It(){return{type:u}}function dt(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=t.multiselect,n=t.showCheckbox;return{type:a,multiselect:e,showCheckbox:n}}function Rt(t,e){return{type:S,sortBy:t,sortOrder:e}}function bt(t,e){return{type:D,page:t,size:e}}function St(t){return{type:m,id:t}}function mt(t){var e=arguments.length>1&&void 0!==arguments[1]&&arguments[1];return{type:g,update:t,append:e}}function gt(t,e){return{type:G,tool:t,value:e}}function Dt(t,e,n){return{type:v,name:t,key:e,value:n}}function _t(){return{type:c,mode:X.EDIT}}function ht(){return{type:c,mode:X.VIEW}}function Gt(t,e){return{type:s,features:t,updated:e}}function vt(t){return{type:E,features:t}}function Ct(){return{type:l}}function Ft(){return{type:y}}function Lt(){return{type:R}}function Ut(){return{type:T}}function Pt(){return{type:I}}function wt(){return{type:d}}function Mt(){return{type:C}}function jt(){return{type:L}}function Ht(){return{type:F}}function Yt(t){return{type:M,disabled:t}}function Vt(t){return{type:w,permission:t}}function xt(){return{type:Y}}function kt(){return{type:V}}function Wt(){return{type:$}}function Bt(t,e){return{type:k,size:t,dockProps:e}}var Zt=function(t){return{type:J,pages:t}},zt=function(t){return{type:j,activated:t}},Kt=function(t){return{type:H,deactivated:t}},Xt=function(t){return{type:et,value:t}},$t=function(t){return{type:nt,size:t}},qt=function(t){return{type:z,updateFilterAction:t}},Qt=function(t){return{type:K,syncWmsFilter:t}}},965539:(t,e,n)=>{"use strict";n.d(e,{Z:()=>c});var r=n(124852),o=n.n(r);function i(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(t);e&&(r=r.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.push.apply(n,r)}return n}function u(t){for(var e=1;e<arguments.length;e++){var n=null!=arguments[e]?arguments[e]:{};e%2?i(Object(n),!0).forEach((function(e){a(t,e,n[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(n,e))}))}return t}function a(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}const c=function(t){var e=t.id,n=t.children,r=t.header,i=t.footer,a=t.columns,c=t.height,p=t.style,s=void 0===p?{}:p,E=t.className,l=t.bodyClassName,T=void 0===l?"ms2-border-layout-body":l;return o().createElement("div",{id:e,className:E,style:u({display:"flex",flexDirection:"column",width:"100%",height:"100%",overflow:"hidden"},s)},r,o().createElement("div",{className:T,style:{display:"flex",flex:1,overflowY:"auto"}},o().createElement("main",{className:"ms2-border-layout-content",style:{flex:1,overflowX:"hidden"}},c?o().createElement("div",{style:{height:c}},n):n),c?o().createElement("div",{style:{height:c}},a):a),i)}},438261:(t,e,n)=>{"use strict";n.d(e,{Z:()=>_});var r=n(124852),o=n.n(r),i=n(45697),u=n.n(i),a=n(774141),c=n(80717),p=n(625311),s=n(799509),E=n(805346),l=n(618446),T=n.n(l),f=n(281763),O=n.n(f),A=n(777900);function N(t){return(N="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}function y(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(t);e&&(r=r.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.push.apply(n,r)}return n}function I(t){for(var e=1;e<arguments.length;e++){var n=null!=arguments[e]?arguments[e]:{};e%2?y(Object(n),!0).forEach((function(e){g(t,e,n[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(n)):y(Object(n)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(n,e))}))}return t}function d(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}function R(t,e){return(R=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t})(t,e)}function b(t,e){return!e||"object"!==N(e)&&"function"!=typeof e?S(t):e}function S(t){if(void 0===t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return t}function m(t){return(m=Object.setPrototypeOf?Object.getPrototypeOf:function(t){return t.__proto__||Object.getPrototypeOf(t)})(t)}function g(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}var D=function(t){!function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function");t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,writable:!0,configurable:!0}}),e&&R(t,e)}(p,t);var e,n,r,i,u=(r=p,i=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(t){return!1}}(),function(){var t,e=m(r);if(i){var n=m(this).constructor;t=Reflect.construct(e,arguments,n)}else t=e.apply(this,arguments);return b(this,t)});function p(t){var e;return function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,p),g(S(e=u.call(this,t)),"onChangeLatLon",(function(t,n){e.setState(I(I({},e.state),{},g({},t,parseFloat(n))),(function(){var t=parseFloat(e.state.lat)!==parseFloat(e.props.component.lat),n=parseFloat(e.state.lon)!==parseFloat(e.props.component.lon);e.setState(I(I({},e.state),{},{disabledApplyChange:!(t||n)}),(function(){e.props.onValidateFeature(),"annotations"===e.props.renderer&&e.props.onSubmit(e.props.idx,e.state)}))}))})),g(S(e),"onSubmit",(function(){e.props.onSubmit(e.props.idx,e.state)})),e.state={lat:O()(e.props.component.lat)?e.props.component.lat:"",lon:O()(e.props.component.lon)?e.props.component.lon:"",disabledApplyChange:!0},e}return e=p,(n=[{key:"UNSAFE_componentWillReceiveProps",value:function(t){if(!T()(t.component,this.props.component)){var e=O()(t.component.lat)?t.component.lat:"",n=O()(t.component.lon)?t.component.lon:"";this.setState({lat:e,lon:n,disabledApplyChange:!0})}}},{key:"render",value:function(){var t=this,e=this.props.idx,n=[{visible:this.props.removeVisible,disabled:!this.props.removeEnabled||this.props.disabled,glyph:"trash",onClick:function(){t.props.onRemove(e)}},{buttonConfig:{title:o().createElement(a.Glyphicon,{glyph:"cog"}),className:"square-button-md no-border",pullRight:!0,tooltipId:"identifyChangeCoordinateFormat"},menuOptions:[{active:"decimal"===this.props.format,onClick:function(){t.props.onChangeFormat("decimal")},text:o().createElement(E.Z,{msgId:"search.decimal"})},{active:"aeronautical"===this.props.format,onClick:function(){t.props.onChangeFormat("aeronautical")},text:o().createElement(E.Z,{msgId:"search.aeronautical"})}],disabled:this.props.disabled,visible:this.props.formatVisible,Element:A.Z},{glyph:"ok",disabled:this.state.disabledApplyChange||this.props.disabled,tooltipId:"identifyCoordinateApplyChanges",onClick:this.onSubmit,visible:"annotations"!==this.props.renderer}],r=o().createElement("div",{role:"button",className:"square-button-md no-border btn btn-default",style:{display:"table",color:!this.props.isDraggableEnabled&&"#999999",pointerEvents:this.props.isDraggableEnabled?"auto":"none",cursor:this.props.isDraggableEnabled&&"grab"}},o().createElement(a.Glyphicon,{glyph:"menu-hamburger"}));return o().createElement("div",{className:"coordinateRow ".concat(this.props.format||""," ").concat(this.props.customClassName||""),onMouseEnter:function(){t.props.onMouseEnter&&t.props.component.lat&&t.props.component.lon&&t.props.onMouseEnter(t.props.component)},onMouseLeave:function(){t.props.onMouseLeave&&t.props.component.lat&&t.props.component.lon&&t.props.onMouseLeave()}},o().createElement("div",{style:{cursor:this.props.isDraggableEnabled?"grab":"not-allowed"}},this.props.showDraggable?this.props.isDraggable?this.props.connectDragSource(r):r:null),o().createElement("div",{className:"coordinate"},o().createElement("div",{className:"input-group-container"},o().createElement(a.InputGroup,null,o().createElement(a.InputGroup.Addon,null,o().createElement(E.Z,{msgId:"latitude"})),o().createElement(s.Z,{disabled:this.props.disabled,format:this.props.format,aeronauticalOptions:this.props.aeronauticalOptions,coordinate:"lat",idx:e,value:this.state.lat,onChange:function(e){return t.onChangeLatLon("lat",e)},constraints:{decimal:{lat:{min:-90,max:90},lon:{min:-180,max:180}}},onKeyDown:this.onSubmit}))),o().createElement("div",{className:"input-group-container"},o().createElement(a.InputGroup,null,o().createElement(a.InputGroup.Addon,null,o().createElement(E.Z,{msgId:"longitude"})),o().createElement(s.Z,{disabled:this.props.disabled,format:this.props.format,aeronauticalOptions:this.props.aeronauticalOptions,coordinate:"lon",idx:e,value:this.state.lon,onChange:function(e){return t.onChangeLatLon("lon",e)},constraints:{decimal:{lat:{min:-90,max:90},lon:{min:-180,max:180}}},onKeyDown:this.onSubmit})))),this.props.showToolButtons&&o().createElement("div",{key:"tools"},o().createElement(c.Z,{btnGroupProps:{className:"tools"},btnDefaultProps:{className:"square-button-md no-border"},buttons:n})))}}])&&d(e.prototype,n),p}(o().Component);g(D,"propTypes",{idx:u().number,component:u().object,onRemove:u().func,onSubmit:u().func,onChangeFormat:u().func,onMouseEnter:u().func,format:u().string,type:u().string,onMouseLeave:u().func,connectDragSource:u().func,aeronauticalOptions:u().object,customClassName:u().string,isDraggable:u().bool,isDraggableEnabled:u().bool,showLabels:u().bool,showDraggable:u().bool,showToolButtons:u().bool,removeVisible:u().bool,formatVisible:u().bool,removeEnabled:u().bool,renderer:u().string,disabled:u().bool,onValidateFeature:u().func}),g(D,"defaultProps",{showLabels:!1,formatVisible:!1,onMouseEnter:function(){},onMouseLeave:function(){},onValidateFeature:function(){},showToolButtons:!0,disabled:!1});const _=(0,p.Z)(D)},625311:(t,e,n)=>{"use strict";n.d(e,{Z:()=>l});var r=n(124852),o=n.n(r),i=n(590937),u=n(867076),a=["connectDragSource","connectDragPreview","connectDropTarget","isDragging","isOver"];function c(){return(c=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var n=arguments[e];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(t[r]=n[r])}return t}).apply(this,arguments)}function p(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(t);e&&(r=r.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.push.apply(n,r)}return n}function s(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}var E={beginDrag:function(t){return function(t){for(var e=1;e<arguments.length;e++){var n=null!=arguments[e]?arguments[e]:{};e%2?p(Object(n),!0).forEach((function(e){s(t,e,n[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(n)):p(Object(n)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(n,e))}))}return t}({},t)}};const l=(0,u.branch)((function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=t.isDraggable;return e}),(0,u.compose)((0,i.Ej)("row",E,(function(t,e){return{connectDragSource:t.dragSource(),connectDragPreview:t.dragPreview(),isDragging:e.isDragging(),draggingItem:e.getItem()||null}})),(0,i.GR)("row",{drop:function(t,e){var n=e.getItem();n.sortId!==t.sortId&&t.onSort(t.sortId,n.sortId,{id:t.id,containerId:t.containerId},{id:n.id,containerId:n.containerId})}},(function(t,e){return{connectDropTarget:t.dropTarget(),isOver:e.isOver()}})),(function(t){return function(e){var n=e.connectDragSource,r=e.connectDragPreview,i=e.connectDropTarget,u=e.isDragging,p=e.isOver,s=function(t,e){if(null==t)return{};var n,r,o=function(t,e){if(null==t)return{};var n,r,o={},i=Object.keys(t);for(r=0;r<i.length;r++)n=i[r],e.indexOf(n)>=0||(o[n]=t[n]);return o}(t,e);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(t);for(r=0;r<i.length;r++)n=i[r],e.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(t,n)&&(o[n]=t[n])}return o}(e,a),E=s.draggingItem&&s.draggingItem.sortId<s.sortId,l=s.draggingItem&&s.draggingItem.containerId===s.containerId,T=l&&u?" ms-dragging":"",f=l&&p?" ms-over":"",O=l&&E?" ms-above":" ms-below";return r(i(o().createElement("div",{className:"ms-dragg".concat(T).concat(f," ").concat(O)},o().createElement("div",null,o().createElement(t,c({},s,{connectDragSource:n,isDragging:u,isOver:p,onDrop:function(t){return t.stopPropagation()}}))))))}})))}}]);