(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[6190],{34990:(t,e,r)=>{"use strict";r.d(e,{D7:()=>a,mN:()=>s,vb:()=>l,KT:()=>d,QK:()=>O,cc:()=>E,XH:()=>S,lX:()=>p,tP:()=>y,Dq:()=>T,LE:()=>f,SW:()=>v,si:()=>R,i2:()=>g,IY:()=>m,Zf:()=>G,ij:()=>h,Hb:()=>_,Mk:()=>Y,c:()=>b,NZ:()=>A,Cx:()=>C,wb:()=>D,km:()=>I,un:()=>P,Ro:()=>L,jr:()=>N,ZY:()=>w,EQ:()=>j,IH:()=>U,rp:()=>k,D_:()=>M,zJ:()=>V,wJ:()=>Z,OS:()=>F,YP:()=>q,Ct:()=>z,Od:()=>W,y6:()=>H,g5:()=>K,_e:()=>B,DF:()=>Q,GD:()=>X,K0:()=>x,kB:()=>J,Xn:()=>$,G5:()=>tt,Vx:()=>et,RZ:()=>rt,pB:()=>nt,$A:()=>ot,m7:()=>ct,YM:()=>ut,o2:()=>it,ql:()=>at,c0:()=>st,nL:()=>lt,Fu:()=>dt});var n=r(37153),o=r.n(n),c=r(55877),u=r.n(c),i=r(92579),a="GEOSTORY:ADD",s="GEOSTORY:ADD_RESOURCE",l="GEOSTORY:CHANGE_MODE",d="GEOSTORY:CLEAR_SAVE_ERROR",O="GEOSTORY:EDIT_RESOURCE",E="GEOSTORY:EDIT_WEBPAGE",S="GEOSTORY:LOAD_GEOSTORY",p="GEOSTORY:LOADING_GEOSTORY",y="GEOSTORY:MOVE",T="GEOSTORY:REMOVE",f="GEOSTORY:SAVE_STORY",v="GEOSTORY:SAVE_ERROR",R="GEOSTORY:STORY_SAVED",g="GEOSTORY:SELECT_CARD",m="GEOSTORY:SET_CONTROL",G="GEOSTORY:SET_RESOURCE",h="GEOSTORY:SET_CURRENT_STORY",_="GEOSTORY:SET_WEBPAGE_URL",Y="GEOSTORY:TOGGLE_CARD_PREVIEW",b="GEOSTORY:TOGGLE_SETTINGS_PANEL",A="GEOSTORY:TOGGLE_SETTING",C="GEOSTORY:TOGGLE_CONTENT_FOCUS",D="GEOSTORY:UPDATE",I="GEOSTORY:UPDATE_SETTING",P="GEOSTORY:UPDATE_CURRENT_PAGE",L="GEOSTORY:REMOVE_RESOURCE",N="GEOSTORY:SET_PENDING_CHANGES",w="GEOSTORY:SET_UPDATE_URL_SCROLL",j="GEOSTORY:UPDATE_MEDIA_EDITOR_SETTINGS",U=function(t,e,r){var n=arguments.length>3&&void 0!==arguments[3]?arguments[3]:function(t){return t};return{type:a,id:r&&r.id||u()(),path:t,position:e,element:o()(r)&&(0,i.nq)(r,n)||r}},k=function(t,e,r){return{type:s,id:t,mediaType:e,data:r}},M=function(t){return{type:l,mode:t?i.nl.EDIT:i.nl.VIEW}},V=function(t,e,r){return{type:O,id:t,mediaType:e,data:r}},Z=function(t,e){return{type:S,id:t,options:e}},F=function(t){return{type:"GEOSTORY:GEOSTORY_LOADED",id:t}},q=function(){var t=arguments.length>0&&void 0!==arguments[0]&&arguments[0],e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"loading";return{type:p,value:t,name:e}},z=function(t){return{type:"GEOSTORY:LOAD_GEOSTORY_ERROR",error:t}},W=function(t){return{type:T,path:t}},H=function(t){return{type:v,error:t}},K=function(t,e){return{type:m,control:t,value:e}},B=function(t){return{type:g,card:t}},Q=function(t){return{type:G,resource:t}},X=function(t){return{type:R,id:t}},x=function(t){return{type:h,story:t}},J=function(){return{type:Y}},$=function(t){return{type:A,option:t}},tt=function(){var t=arguments.length>0&&void 0!==arguments[0]&&arguments[0];return{type:b,withSave:t}},et=function(t,e){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:"replace";return{type:D,path:t,element:e,mode:r}},rt=function(t){var e=t.sectionId,r=t.columnId;return{type:P,sectionId:e,columnId:r}},nt=function(t,e,r){return{type:y,source:t,target:e,position:r}},ot=function(t,e,r,n,o){return{type:C,status:t,target:e,selector:r,hideContent:n,path:o}},ct=function(t,e){return{type:I,prop:t,value:e}},ut=function(t){return{type:_,src:t}},it=function(t){var e=t.path,r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"GEOSTORY";return{type:E,path:e,owner:r}},at=function(t,e){return{type:L,id:t,mediaType:e}},st=function(t){return{type:N,value:t}},lt=function(t){return{type:w,value:t}},dt=function(t){return{type:j,mediaEditorSettings:t}}},66190:(t,e,r)=>{"use strict";r.d(e,{Z:()=>P});var n=r(57546),o=r.n(n),c=r(37153),u=r.n(c),i=r(77263),a=r.n(i),s=r(46713),l=r.n(s),d=r(50542),O=r.n(d),E=r(53893),S=r.n(E),p=r(80643),y=r.n(p),T=r(9626),f=r.n(T),v=r(42401),R=r.n(v),g=r(61868),m=r(92579),G=r(34990);function h(t,e){var r=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),r.push.apply(r,n)}return r}function _(t){for(var e=1;e<arguments.length;e++){var r=null!=arguments[e]?arguments[e]:{};e%2?h(Object(r),!0).forEach((function(e){Y(t,e,r[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(r)):h(Object(r)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(r,e))}))}return t}function Y(t,e,r){return e in t?Object.defineProperty(t,e,{value:r,enumerable:!0,configurable:!0,writable:!0}):t[e]=r,t}function b(t){return function(t){if(Array.isArray(t))return A(t)}(t)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||function(t,e){if(t){if("string"==typeof t)return A(t,e);var r=Object.prototype.toString.call(t).slice(8,-1);return"Object"===r&&t.constructor&&(r=t.constructor.name),"Map"===r||"Set"===r?Array.from(t):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?A(t,e):void 0}}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function A(t,e){(null==e||e>t.length)&&(e=t.length);for(var r=0,n=new Array(e);r<e;r++)n[r]=t[r];return n}var C=function(t,e){var r=t.length,n=0;return e||0===e||(n=r),u()(e)?n=l()(t,{id:e})+1:a()(e)&&(n=Math.min(e,t.length)),n},D=function t(e,r,n){var o=n.contents,c=n.background,u=n.id,i=n.resourceId,a=[],s=r+'{"id": "'.concat(u,'"}]');return i===e?[s]:(c&&c.resourceId===e&&a.push(s+".background"),o?o.reduce((function(r,n){return[].concat(b(r),b(t(e,s+".contents[",n)))}),a):a)},I={mode:"view",isCollapsed:!1,focusedContent:{},currentPage:{},settings:{},oldSettings:{},updateUrlOnScroll:!1};const P=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:I,e=arguments.length>1?arguments[1]:void 0;switch(e.type){case G.D7:var r=e.id,n=e.path,c=e.position,i=e.element,a=(0,m.Ll)("currentStory.".concat(n),t),s=o()(t,a,[]),l=C(s,c),d=s.slice();return d.splice(l,0,_({id:r},i)),(0,g.t8)(a,d,t);case G.mN:var E=e.id,p=e.mediaType,T=e.data;return(0,g.t8)("currentStory.resources",R()([{id:E,type:p,data:T}].concat(b(t.currentStory&&t.currentStory.resources||[])),"id"),t);case G.vb:return(0,g.t8)("mode",e.mode,t);case G.QK:var v=e.id,h=e.mediaType,A=e.data,P=(0,g.cc)("currentStory.resources",{id:v,type:h,data:A},{id:v},t);return h===m.Tr.MAP&&t.currentStory.sections.reduce((function(t,e){return[].concat(b(t),b(D(v,"sections[",e)))}),[]).map((function(e){var r=(0,m.Ll)("currentStory.".concat(e,".map"),t);P=(0,g.t8)(r,void 0,P)})),P;case G.Ro:var L=e.id,N=e.mediaType,w=(0,g.z6)("currentStory.resources",{id:L},t);return t.currentStory.sections.reduce((function(t,e){return[].concat(b(t),b(D(L,"sections[",e)))}),[]).map((function(e){var r=(0,m.Ll)("currentStory.".concat(e,".resourceId"),t);if(w=(0,g.zN)(r,w),N===m.Tr.MAP){var n=(0,m.Ll)("currentStory.".concat(e,".map"),t);w=(0,g.zN)(n,w)}})),w;case G.lX:return(0,g.t8)("loading"===e.name?"loading":"loadFlags.".concat(e.name),e.value,(0,g.t8)("loading",e.value,t));case G.Dq:var j=e.path,U=(0,m.Ll)("currentStory.".concat(j),t),k=b(U),M=k.pop(),V=o()(t,k);return y()(V)?(u()(M)&&(M=parseInt(M,10)),(0,g.t8)(k,[].concat(b(V.slice(0,M)),b(V.slice(M+1))),t)):(0,g.zN)(U,t);case G.ij:var Z,F,q,z,W,H=t.defaultSettings||{},K=e.story.settings||H,B=(null===(Z=K)||void 0===Z||null===(F=Z.theme)||void 0===F?void 0:F.fontFamilies)||[],Q=null===(q=t.currentStory)||void 0===q||null===(z=q.settings)||void 0===z||null===(W=z.theme)||void 0===W?void 0:W.fontFamilies;return Q&&Q.length>0&&(K=(0,g.t8)("theme.fontFamilies",R()([].concat(b(Q),b(B)),"family"),K)),(0,g.t8)("currentStory",_(_({},e.story),{},{settings:K}),t);case G.i2:return(0,g.t8)("selectedCard",t.selectedCard===e.card?"":e.card,t);case G.IY:var X=e.control,x=e.value;return(0,g.t8)("controls.".concat(X),x,t);case G.Zf:var J=e.resource,$=t.currentStory&&t.currentStory.settings||{};return(0,g.qC)((0,g.t8)("resource",J),(0,g.t8)("currentStory.settings.storyTitle",$.storyTitle||J.name))(t);case G.si:case G.KT:return(0,g.zN)("errors.save",t);case G.SW:return(0,g.t8)("errors.save",f()(e.error),t);case G.Mk:return(0,g.t8)("isCollapsed",!t.isCollapsed,t);case G.NZ:var tt=o()(t,"currentStory.settings.".concat(e.option));return(0,g.t8)("currentStory.settings.".concat(e.option),!tt,t);case G.c:var et=!t.isSettingsEnabled,rt=t.currentStory&&t.currentStory.settings||{};return(0,g.qC)((0,g.t8)("isSettingsEnabled",et),(0,g.t8)("oldSettings",et?rt:{}),(0,g.t8)("currentStory.settings",et?_({},rt):e.withSave?rt:t.oldSettings))(t);case G.wb:var nt=e.path,ot=e.mode,ct=e.element,ut=(0,m.Ll)("currentStory.".concat(nt),t),it=o()(t,ut);return S()(it)&&S()(ct)&&"merge"===ot&&(ct=_(_({},it),ct)),y()(it)&&y()(ct)&&"merge"===ot&&(ct=[].concat(b(it),b(ct))),(0,g.t8)(ut,ct,t);case G.km:return(0,g.t8)("currentStory.settings.".concat(e.prop),e.value,t);case G.un:if(e.columnId){var at=O()(t.currentStory.sections,(function(t){return O()(t.contents,{id:e.columnId})}));return at&&O()(at.contents,{id:e.columnId})?(0,g.t8)("currentPage",_(_({},t.currentPage),{},{columns:_(_({},t.currentPage.columns),{},Y({},at.id,e.columnId))}),t):t}return(0,g.t8)("currentPage",_(_({},t.currentPage),{},{sectionId:e.sectionId}),t);case G.Cx:var st=e.status,lt=e.target,dt=e.selector,Ot=void 0===dt?"":dt,Et=e.hideContent,St=void 0!==Et&&Et,pt=e.path,yt=st?{target:lt,selector:Ot,hideContent:St,path:pt}:void 0;return(0,g.t8)("focusedContent",yt,t);case G.jr:return(0,g.t8)("pendingChanges",e.value,t);case G.ZY:return(0,g.t8)("updateUrlOnScroll",e.value,t);case G.EQ:return(0,g.t8)("mediaEditorSettings",e.mediaEditorSettings,t);default:return t}}}}]);