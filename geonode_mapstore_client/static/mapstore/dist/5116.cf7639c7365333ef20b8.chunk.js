(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[5116],{88691:(e,t,r)=>{var n=r(59130);e.exports=function(e,t){var r=[];return n(e,(function(e,n,o){t(e,n,o)&&r.push(e)})),r}},25548:(e,t,r)=>{var n=r(6583),o=r(93889),a=r(89796),c=r(30851),i=n.isFinite,u=Math.min;e.exports=function(e){var t=Math[e];return function(e,r){if(e=a(e),(r=null==r?0:u(o(r),292))&&i(e)){var n=(c(e)+"e").split("e"),l=t(n[0]+"e"+(+n[1]+r));return+((n=(c(l)+"e").split("e"))[0]+"e"+(+n[1]-r))}return t(e)}}},95671:(e,t,r)=>{var n=r(40158),o=r(88691),a=r(83733),c=r(80643);e.exports=function(e,t){return(c(e)?n:o)(e,a(t,3))}},45559:(e,t,r)=>{var n=r(77676);e.exports=function(e,t,r){var o=(r="function"==typeof r?r:void 0)?r(e,t):void 0;return void 0===o?n(e,t,void 0,r):!!o}},37422:(e,t,r)=>{var n=r(25548)("round");e.exports=n},25108:(e,t,r)=>{"use strict";r.d(t,{Z:()=>i});var n=r(82904),o=r(27418),a=r.n(o);function c(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}const i=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=arguments.length>1?arguments[1]:void 0;switch(t.type){case n.kM:var r=t.property||"enabled";return a()({},e,c({},t.control,a()({},e[t.control],c({},r,!(e[t.control]||{})[r]))));case n.At:return!0===t.toggle&&e[t.control]&&e[t.control][t.property]===t.value?a()({},e,c({},t.control,a()({},e[t.control],c({},t.property,void 0)))):a()({},e,c({},t.control,a()({},e[t.control],c({},t.property,t.value))));case n.dc:return a()({},e,c({},t.control,a()({},e[t.control],t.properties)));case n.l:var o=Object.keys(e).filter((function(e){return-1===(t.skip||[]).indexOf(e)})),i=o.reduce((function(t,r){return a()(t,c({},r,a()({},e[r],!0===e[r].enabled?{enabled:!1}:{})))}),{});return a()({},e,i);default:return e}}},31935:(e,t,r)=>{"use strict";r.d(t,{YL:()=>i,B0:()=>u,Mz:()=>l,TC:()=>s,qS:()=>f,Pe:()=>p,TP:()=>d});var n=r(22222),o=r(75110),a=r(93152),c=r(24262),i=function(e){return e.backgroundSelector&&e.backgroundSelector.source},u=function(e){return e.backgroundSelector&&e.backgroundSelector.modalParams},l=function(e){return e.backgroundSelector&&e.backgroundSelector.backgrounds||[]},s=function(e){return e.backgroundSelector&&e.backgroundSelector.lastRemovedId},f=function(e){return e.backgroundSelector&&e.backgroundSelector.confirmDeleteBackgroundModal},p=function(e){return e.backgroundSelector&&e.backgroundSelector.allowDeletion},d=(0,n.P1)(o.l2,a.$v,(function(e,t){return e.filter((function(e){return e&&"background"===e.group})).map((function(e){return(0,c.kf)(e,t)}))||[]}))},88113:(e,t,r)=>{"use strict";r.d(t,{b6:()=>d,PG:()=>g,_x:()=>b,Mm:()=>v,dP:()=>m,SX:()=>O,ZL:()=>y,_S:()=>h,iH:()=>S,R7:()=>w,Q7:()=>E,n7:()=>j,bA:()=>k,hm:()=>P,E2:()=>D,Cb:()=>A,eK:()=>C,Im:()=>N,e8:()=>_,$t:()=>T,kS:()=>z,y:()=>M,l2:()=>G,HN:()=>B,BM:()=>R,am:()=>L,LV:()=>x,CK:()=>U});var n=r(22222),o=r(57546),a=r.n(o),c=r(69533),i=r.n(c),u=r(827),l=r(76712);function s(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function f(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?s(Object(r),!0).forEach((function(t){p(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):s(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function p(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var d=function(e){return a()(e,"catalog.services")},g=(0,n.P1)((function(e){return a()(e,"catalog.default.staticServices")}),d,(function(e,t){return f(f({},t),i()(e,"default_map_backgrounds"))})),b=function(e){return a()(e,"catalog.default.tileSizes",[256,512])},v=function(e){return a()(e,"controls.metadataexplorer.group")},m=function(e){return a()(e,"catalog.saving")},O=function(e){return a()(e,"catalog.result")},y=function(e){return a()(e,"catalog.openCatalogServiceList")},h=function(e){return a()(e,"catalog.newService")},S=function(e){return a()(e,"catalog.newService.type","csw")},w=function(e){return a()(e,'catalog.services["'.concat(a()(e,"catalog.selectedService"),'"]'))},E=function(e){return a()(e,'catalog.services["'.concat(a()(e,"catalog.selectedService"),'"].type'),function(e){return a()(e,'catalog.default.staticServices["'.concat(a()(e,"catalog.selectedService"),'"].type'),"csw")}(e))},j=function(e){return a()(e,'catalog.services["'.concat(a()(e,"catalog.selectedService"),'"].layerOptions'),{})},k=function(e){return a()(e,"catalog.searchOptions")},P=function(e){return a()(e,"catalog.loadingError")},D=function(e){return a()(e,"catalog.loading",!1)},A=function(e){return a()(e,"catalog.selectedService")},C=function(e){return a()(e,"catalog.mode","view")},N=function(e){return a()(e,"catalog.layerError")},_=function(e){return a()(e,"catalog.searchOptions.text","")},T=function(e){return"metadataexplorer"===a()(e,"controls.toolbar.active")||a()(e,"controls.metadataexplorer.enabled")},z=function(e){return(a()(e,"localConfig.authenticationRules")||[]).filter((function(e){return"authkey"===e.method})).map((function(e){return e.authkeyParamName}))||[]},M=function(e){return a()(e,"catalog.pageSize",4)},G=function(e){return a()(e,"catalog.delayAutoSearch",1e3)},B=(0,n.zB)({projection:u.uy}),R=function(e){return a()(e,"catalog.formatsLoading",!1)},L=function(e){return a()(e,"catalog.newService.supportedFormats.imageFormats",l.QQ)},x=function(e){return a()(e,"catalog.newService.supportedFormats.infoFormats",(0,l.B8)())},U=function(e){return a()(e,"catalog.newService.formatUrlUsed","")}},73443:(e,t,r)=>{"use strict";r.d(t,{rs:()=>n,AY:()=>o,SW:()=>a,yB:()=>c,oG:()=>i,XG:()=>u,oz:()=>l,id:()=>s,gc:()=>f,cE:()=>p,rG:()=>d,Vj:()=>g,Pg:()=>b,nY:()=>v});var n="GEONODE:SAVING_RESOURCE",o="GEONODE:SAVE_SUCCESS",a="GEONODE:SAVE_ERROR",c="GEONODE:CLEAR_SAVE",i="GEONODE:SAVE_CONTENT",u="GEONODE:UPDATE_RESOURCE_BEFORE_SAVE",l="GEONODE:SAVE_DIRECT_CONTENT";function s(){return{type:n}}function f(e){return{type:o,success:e}}function p(e){return{type:a,error:e}}function d(){return{type:c}}function g(e,t,r,n){return{type:i,id:e,metadata:t,reload:r,showNotifications:n}}function b(e){return{type:u,id:e}}function v(){return{type:l}}},14689:(e,t,r)=>{"use strict";r.d(t,{fk:()=>i,Gg:()=>u,_u:()=>l});var n=r(75875),o=r.n(n),a=r(37275),c=r(55035),i=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=(0,a.u8)("geoNodeApi")||{},r=t.endpointAdapter,n=void 0===r?"/mapstore/rest":r;return o().post((0,c.zL)("".concat(n,"/resources/")),e,{timeout:1e4,params:{full:!0}}).then((function(e){return e.data}))},u=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},r=(0,a.u8)("geoNodeApi")||{},n=r.endpointAdapter,i=void 0===n?"/mapstore/rest":n;return o().patch((0,c.zL)("".concat(i,"/resources/").concat(e,"/")),t,{params:{full:!0}}).then((function(e){return e.data}))},l=function(e){var t=((0,a.u8)("geoNodeApi")||{}).endpointAdapter,r=void 0===t?"/mapstore/rest":t;return o().get((0,c.zL)("".concat(r,"/resources/").concat(e,"/")),{params:{full:!0}}).then((function(e){return e.data}))}},12547:(e,t,r)=>{"use strict";r.d(t,{ZP:()=>B});var n=r(49977),o=r(827),a=r(75110),c=r(31935),i=r(52259),u=r(22222),l=r(88113),s=r(25958),f=r(7877),p=r(85148),d=r(97291);function g(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function b(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?g(Object(r),!0).forEach((function(t){v(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):g(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function v(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var m={},O=(0,u.zB)({catalogServices:(0,u.zB)({services:l.b6,selectedService:l.Cb}),widgetsConfig:(0,u.zB)({widgets:s.zm,layouts:s.p,collapsed:s.lF}),mapInfoConfiguration:f.bI,dimensionData:(0,u.zB)({currentTime:p.WT,offsetTime:p.ns}),timelineData:(0,u.zB)({selectedLayer:d.Li})}),y=r(37275),h=r(66113),S=r(74621),w=r(97395),E=r(14689),j=r(73443),k=r(43892),P=r(99380),D=r(55035),A=r(55877),C=r.n(A);function N(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function _(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?N(Object(r),!0).forEach((function(t){T(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):N(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function T(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function z(e){return function(e){if(Array.isArray(e))return M(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||function(e,t){if(e){if("string"==typeof e)return M(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?M(e,t):void 0}}(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function M(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}var G={map:function(e,t,r,n){var u=(0,o.Od)(e)||{},l=(0,a.l2)(e),s=(0,a.Bt)(e),f=(0,c.Mz)(e),p=function(e){return e.searchconfig&&e.searchconfig.textSearchConfig}(e),d=function(e){return e.searchbookmarkconfig&&e.searchbookmarkconfig.bookmarkSearchConfig}(e),g=function(e){var t=Object.keys(m).reduce((function(t,r){return b(b({},t),{},v({},r,m[r](e)))}),{});return b(b({},O(e)),t)}(e),h=(0,i.saveMapConfiguration)(u,l,s,f,p,d,g),S=r.name,w=r.description,j=r.thumbnail,k={name:S,data:h,attributes:[{type:"string",name:"title",value:S,label:"Title"},{type:"string",name:"abstract",value:w,label:"Abstract"}].concat(z(j?[{type:"string",name:"thumbnail",value:j,label:"Thumbnail"}]:[]))};return t?(0,E.Gg)(t,_(_({},k),{},{id:t})):(0,E.fk)(k).then((function(e){return n&&(window.location.href=(0,D.zL)("".concat((0,y.u8)("geonodeUrl"),"maps/").concat(e.id,"/edit"))),e.data}))},geostory:function(e,t,r,n){var o=(0,h.Kg)(e),a=(0,S.np)(e),c={title:r.name,abstract:r.description,data:JSON.stringify(o),thumbnail_url:r.thumbnail};return t?(0,P.Tw)(t,c):(0,P.NJ)(_({name:r.name+" "+C()(),owner:a.name},c)).then((function(e){return n&&(window.location.href=(0,D.zL)("".concat((0,y.u8)("geonodeUrl"),"apps/").concat(e.pk,"/edit"))),e.data}))}};const B={gnSaveContent:function(e,t){return e.ofType(j.oG).switchMap((function(e){var r,o=t.getState(),a=(null===(r=o.gnresource)||void 0===r?void 0:r.type)||"map";return n.Observable.defer((function(){return G[a](o,e.id,e.metadata,e.reload)})).switchMap((function(t){return n.Observable.of.apply(n.Observable,[(0,j.gc)(t),(0,k.QN)({title:e.metadata.name,abstract:e.metadata.description,thumbnail_url:e.metadata.thumbnail})].concat(z(e.showNotifications?[(0,w.success)({title:"saveDialog.saveSuccessTitle",message:"saveDialog.saveSuccessMessage"})]:[])))})).catch((function(t){return n.Observable.of.apply(n.Observable,[(0,j.cE)(t.data||t.message)].concat(z(e.showNotifications?[(0,w.error)({title:"map.mapError.errorTitle",message:"map.mapError.errorDefault"})]:[])))})).startWith((0,j.id)())}))},gnUpdateResource:function(e,t){return e.ofType(j.XG).switchMap((function(e){var r,o=(null===(r=t.getState().gnresource)||void 0===r?void 0:r.data)||{};return!e.id||o.pk&&e.id&&o.pk+""==e.id+""?n.Observable.empty():n.Observable.defer((function(){return(0,P.iv)(e.id)})).switchMap((function(e){return n.Observable.of((0,k.DF)(e))})).catch((function(e){return n.Observable.of((0,k.mN)(e.data||e.message))})).startWith((0,k.Q$)())}))},gnSaveDirectContent:function(e,t){return e.ofType(j.oz).switchMap((function(){var e,r=t.getState(),a=(0,o._H)(r),c=(null==a?void 0:a.id)||(null==r||null===(e=r.gnresource)||void 0===e?void 0:e.id);return n.Observable.defer((function(){return(0,P.iv)(c)})).switchMap((function(e){var t={name:null==e?void 0:e.title,description:null==e?void 0:e.abstract,thumbnail:null==e?void 0:e.thumbnail_url};return n.Observable.of((0,k.DF)(e),(0,j.Vj)(c,t,!1,!0))})).catch((function(e){return n.Observable.of((0,j.cE)(e.data||e.message),(0,w.error)({title:"map.mapError.errorTitle",message:e.data||e.message||"map.mapError.errorDefault"}))})).startWith((0,j.id)())}))}}},62170:(e,t,r)=>{"use strict";r.d(t,{Z:()=>o});var n=r(73443);const o=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=arguments.length>1?arguments[1]:void 0;switch(t.type){case n.rs:case n.oz:return{saving:!0,error:void 0,success:void 0};case n.AY:return{success:t.success,saving:!1};case n.SW:return{error:t.error,saving:!1};case n.yB:return{};default:return e}}}}]);