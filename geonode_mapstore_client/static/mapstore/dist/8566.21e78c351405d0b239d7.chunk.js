(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[8566],{56307:t=>{t.exports=window.L},43143:(t,e,n)=>{"use strict";n.d(e,{qH:()=>c,qj:()=>u,qq:()=>h});var r,a=n(17621),i=n.n(a),o=n(89796),s=n.n(o),c=function(t,e,n,a){var i=t;isNaN(parseFloat(t))&&(i=r.hexToHsv(t)[0]);var o=.5/(n-1),s=e/(n-1),c=[];1===n&&(o=.5,s=e/2);for(var u=0;u<n;u++){var h=i+u*s-e/2,l=o*u+.3,f=l;a&&(h=a.h||h,l=a.s||l,f=a.v||f),c.push(r.hsvToHex(h,l,f,u))}return c},u=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"red";return i()(t).toHexString()},h=function(t,e,n){var r=i()(t);return t&&r.setAlpha(s()(void 0!==e?e:r.getAlpha())).toRgbString()||n};r={decToHex:function(t){var e="0123456789ABCDEF",n=parseInt(t,10);return n=isNaN(n)?0:n,e.charAt(((n=n>255||n<0?0:n)-n%16)/16)+e.charAt(n%16)},rgbToHex:function(t,e,n){return t instanceof Array?r.rgbToHex(t[0],t[1],t[2]):"#"+r.decToHex(t)+r.decToHex(e)+r.decToHex(n)},realToDec:function(t){return Math.min(255,Math.round(256*t))},rgbToHsv:function(t,e,n){if(t instanceof Array)return r.rgbToHsv(t[0],t[1],t[2]);var a,i,o,s,c,u=t/255,h=e/255,l=n/255;switch(a=Math.min(Math.min(u,h),l),o=(i=Math.max(Math.max(u,h),l))-a,i){case a:s=0;break;case u:s=60*(h-l)/o,h<l&&(s+=360);break;case h:s=60*(l-u)/o+120;break;case l:s=60*(u-h)/o+240}return c=0===i?0:1-a/i,[Math.round(s),c,i]},distributedColorsHEX:function(t){for(var e=360/(t-1),n=[],a=function t(e,n,a){var i=t(e,n,a);return r.rgbToHex(i)},i=0;i<t;i++)n.push(a(e*i,.57,.63));return n},sameToneRangeColors:c,hsvToRgb:function(t,e,n){if(t instanceof Array)return r.hsvToRgb(t[0],t[1],t[2]);var a,i,o,s=Math.floor(t/60%6),c=t/60-s,u=n*(1-e),h=n*(1-c*e),l=n*(1-(1-c)*e);switch(s){case 0:a=n,i=l,o=u;break;case 1:a=h,i=n,o=u;break;case 2:a=u,i=n,o=l;break;case 3:a=u,i=h,o=n;break;case 4:a=l,i=u,o=n;break;case 5:a=n,i=u,o=h}return[r.realToDec(a),r.realToDec(i),r.realToDec(o)]},hsvToHex:function(t,e,n){var a=r.hsvToRgb(t,e,n);return r.rgbToHex(a)},hexToHsv:function(t){var e=t;if(e.length>0){"#"===e[0]&&(e=t.substring(1));var n=r.hexToRgb(e);return r.rgbToHsv(n)}return null},hexToRgb:function(t){var e,n,r,a=t;return"#"===a.charAt(0)&&(a=t.substring(1)),e=a.charAt(0)+a.charAt(1),n=a.charAt(2)+a.charAt(3),r=a.charAt(4)+a.charAt(5),[parseInt(e,16),parseInt(n,16),parseInt(r,16)]},colorToHexStr:u,colorToRgbaStr:h}},3901:(t,e,n)=>{"use strict";n.d(e,{qR:()=>h,yQ:()=>l});var r=n(75875),a=n.n(r),i=n(81399),o=n.n(i),s=n(82702),c=new(o())(100),u=function(t,e,n,r){var a=arguments.length>4&&void 0!==arguments[4]?arguments[4]:-9999,i=arguments.length>5&&void 0!==arguments[5]&&arguments[5],o=r*t+n;try{var s=e.dataView.getInt16(2*o,i);if(s!==a&&32767!==s&&-32768!==s)return s}catch(t){}return null},h=function(t,e,n){return c.has(n)?null:new s.Promise((function(r,i){a().get(t,{responseType:"arraybuffer"}).then((function(t){!function(t,e,n){c.set(n,{data:t,dataView:new DataView(t),coords:e,current:!0,status:"success"})}(t.data,e,n),r()})).catch((function(t){!function(t,e,n){c.set(n,{coords:e,current:!0,status:"error: "+t})}(t.message,e,n),i(t)}))}))},l=function(t,e,n){var r=arguments.length>3&&void 0!==arguments[3]?arguments[3]:-9999,a=arguments.length>4&&void 0!==arguments[4]&&arguments[4],i=c.get(t);return i&&"success"===i.status?{available:!0,value:u(n,i,e.x,e.y,r,a)}:i&&"loading"===i.status?{available:!1,message:"elevationLoading"}:i&&"error"===i.status?{available:!1,message:"elevationLoadingError"}:{available:!1,message:"elevationNotAvailable"}}},45992:(t,e,n)=>{"use strict";n.d(e,{h:()=>h,Z:()=>l});var r=n(23225),a=n.n(r),i=n(36882),o=n(37275);function s(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(t);e&&(r=r.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.push.apply(n,r)}return n}function c(t){for(var e=1;e<arguments.length;e++){var n=null!=arguments[e]?arguments[e]:{};e%2?s(Object(n),!0).forEach((function(e){u(t,e,n[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(n)):s(Object(n)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(n,e))}))}return t}function u(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}var h=function(t,e){var n,r,s,u,h=i.Z;if("custom"===t)n=e;else if(s=(u=t.split("."))[0],r=u[1],!(n=h[s]))throw new Error("No such provider ("+s+")");var l={url:n.url,options:n.options||{}};if(r&&"variants"in n){if(!(r in n.variants))throw new Error("No such variant of "+(s||n.url)+" ("+r+")");var f,p=n.variants[r];f="string"==typeof p?{variant:p}:p.options,l={url:p.url||l.url,options:c(c({},l.options||{}),f)}}else"function"==typeof l.url&&(l.url=l.url(u.splice(1,u.length-1).join(".")));var d="file:"===window.location.protocol||l.options.forceHTTP;0===l.url.indexOf("//")&&d&&(l.url="http:"+l.url),l.options.retina&&(e.detectRetina&&o.ZP.getBrowserProperties().retina?e.detectRetina=!1:l.options.retina=""),l.options.attribution&&(l.options.attribution=function t(e){return-1===e.indexOf("{attribution.")?e:e.replace(/\{attribution.(\w*)\}/,(function(e,n){return t(h[n].options.attribution)}))}(l.options.attribution));var v=c(c({},l.options),a()(e,(function(t){return void 0!==t})));return[l.url,v]};const l={getLayerConfig:h}},33358:(t,e,n)=>{"use strict";n.d(e,{z:()=>a});var r=["application/vnd.mapbox-vector-tile","application/json;type=geojson","application/json;type=topojson"],a=function(t){return-1!==r.indexOf(t)}},81399:function(t,e){var n,r,a;!function(i,o){"use strict";"object"==typeof t.exports?t.exports=o():(r=[],void 0===(a="function"==typeof(n=o)?n.apply(e,r):n)||(t.exports=a))}("object"==typeof window&&window,(function(){"use strict";function t(e){if(!(this instanceof t))return new t(e);this._LRUCacheState=new n(e)}var e=t.prototype;function n(t){this.capacity=t>0?+t:Number.MAX_SAFE_INTEGER||Number.MAX_VALUE,this.data=Object.create?Object.create(null):{},this.hash=Object.create?Object.create(null):{},this.linkedList=new r}function r(){this.length=0,this.head=null,this.end=null}function a(t){this.key=t,this.p=null,this.n=null}function i(t,e){e!==t.head&&(t.end?t.end===e&&(t.end=e.n):t.end=e,o(e.n,e.p),o(e,t.head),t.head=e,t.head.n=null)}function o(t,e){t!==e&&(t&&(t.p=e),e&&(e.n=t))}return e.get=function(t){var e=this._LRUCacheState,n=e.hash[t];if(n)return i(e.linkedList,n),e.data[t]},e.set=function(t,e){var n=this._LRUCacheState,r=n.hash[t];return void 0===e||(r||(n.hash[t]=new a(t),n.linkedList.length+=1,r=n.hash[t]),i(n.linkedList,r),n.data[t]=e,n.linkedList.length>n.capacity&&this.remove(n.linkedList.end.key)),this},e.update=function(t,e){return this.has(t)&&this.set(t,e(this.get(t))),this},e.remove=function(t){var e=this._LRUCacheState,n=e.hash[t];return n?(n===e.linkedList.head&&(e.linkedList.head=n.p),n===e.linkedList.end&&(e.linkedList.end=n.n),o(n.n,n.p),delete e.hash[t],delete e.data[t],e.linkedList.length-=1,this):this},e.removeAll=function(){return this._LRUCacheState=new n(this._LRUCacheState.capacity),this},e.info=function(){var t=this._LRUCacheState;return{capacity:t.capacity,length:t.linkedList.length}},e.keys=function(){for(var t=[],e=this._LRUCacheState.linkedList.head;e;)t.push(e.key),e=e.p;return t},e.has=function(t){return!!this._LRUCacheState.hash[t]},e.staleKey=function(){return this._LRUCacheState.linkedList.end&&this._LRUCacheState.linkedList.end.key},e.popStale=function(){var t=this.staleKey();if(!t)return null;var e=[t,this._LRUCacheState.data[t]];return this.remove(t),e},t}))}}]);