(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[6287],{43143:(t,e,r)=>{"use strict";r.d(e,{qH:()=>s,qj:()=>l,qq:()=>u});var n,o=r(17621),i=r.n(o),a=r(89796),c=r.n(a),s=function(t,e,r,o){var i=t;isNaN(parseFloat(t))&&(i=n.hexToHsv(t)[0]);var a=.5/(r-1),c=e/(r-1),s=[];1===r&&(a=.5,c=e/2);for(var l=0;l<r;l++){var u=i+l*c-e/2,h=a*l+.3,f=h;o&&(u=o.h||u,h=o.s||h,f=o.v||f),s.push(n.hsvToHex(u,h,f,l))}return s},l=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"red";return i()(t).toHexString()},u=function(t,e,r){var n=i()(t);return t&&n.setAlpha(c()(void 0!==e?e:n.getAlpha())).toRgbString()||r};n={decToHex:function(t){var e="0123456789ABCDEF",r=parseInt(t,10);return r=isNaN(r)?0:r,e.charAt(((r=r>255||r<0?0:r)-r%16)/16)+e.charAt(r%16)},rgbToHex:function(t,e,r){return t instanceof Array?n.rgbToHex(t[0],t[1],t[2]):"#"+n.decToHex(t)+n.decToHex(e)+n.decToHex(r)},realToDec:function(t){return Math.min(255,Math.round(256*t))},rgbToHsv:function(t,e,r){if(t instanceof Array)return n.rgbToHsv(t[0],t[1],t[2]);var o,i,a,c,s,l=t/255,u=e/255,h=r/255;switch(o=Math.min(Math.min(l,u),h),a=(i=Math.max(Math.max(l,u),h))-o,i){case o:c=0;break;case l:c=60*(u-h)/a,u<h&&(c+=360);break;case u:c=60*(h-l)/a+120;break;case h:c=60*(l-u)/a+240}return s=0===i?0:1-o/i,[Math.round(c),s,i]},distributedColorsHEX:function(t){for(var e=360/(t-1),r=[],o=function t(e,r,o){var i=t(e,r,o);return n.rgbToHex(i)},i=0;i<t;i++)r.push(o(e*i,.57,.63));return r},sameToneRangeColors:s,hsvToRgb:function(t,e,r){if(t instanceof Array)return n.hsvToRgb(t[0],t[1],t[2]);var o,i,a,c=Math.floor(t/60%6),s=t/60-c,l=r*(1-e),u=r*(1-s*e),h=r*(1-(1-s)*e);switch(c){case 0:o=r,i=h,a=l;break;case 1:o=u,i=r,a=l;break;case 2:o=l,i=r,a=h;break;case 3:o=l,i=u,a=r;break;case 4:o=h,i=l,a=r;break;case 5:o=r,i=l,a=u}return[n.realToDec(o),n.realToDec(i),n.realToDec(a)]},hsvToHex:function(t,e,r){var o=n.hsvToRgb(t,e,r);return n.rgbToHex(o)},hexToHsv:function(t){var e=t;if(e.length>0){"#"===e[0]&&(e=t.substring(1));var r=n.hexToRgb(e);return n.rgbToHsv(r)}return null},hexToRgb:function(t){var e,r,n,o=t;return"#"===o.charAt(0)&&(o=t.substring(1)),e=o.charAt(0)+o.charAt(1),r=o.charAt(2)+o.charAt(3),n=o.charAt(4)+o.charAt(5),[parseInt(e,16),parseInt(r,16),parseInt(n,16)]},colorToHexStr:l,colorToRgbaStr:u}},66287:(t,e,r)=>{"use strict";r.r(e),r.d(e,{isAttrPresent:()=>b,isStrokeStyle:()=>p,isFillStyle:()=>m,isTextStyle:()=>w,isCircleStyle:()=>S,isMarkerStyle:()=>T,isSymbolStyle:()=>A,getStylerTitle:()=>C,geometryFunctions:()=>x,getGeometryFunction:()=>O,registerGeometryFunctions:()=>P,addOpacityToColor:()=>k,hashCode:()=>H,registerStyle:()=>F,setSymbolsStyles:()=>U,fetchStyle:()=>M,getSymbolsStyles:()=>R,hashAndStringify:()=>D,domNodeToString:()=>z,createSvgUrl:()=>E,createStylesAsync:()=>N,getStyleParser:()=>q});var n=r(82920),o=r.n(n),i=r(61868),a=r(43143),c=r(9669),s=r.n(c),l=r(42757),u=r.n(l),h=r(50436),f=r.n(h);function g(t,e){var r=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),r.push.apply(r,n)}return r}function v(t){for(var e=1;e<arguments.length;e++){var r=null!=arguments[e]?arguments[e]:{};e%2?g(Object(r),!0).forEach((function(e){y(t,e,r[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(r)):g(Object(r)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(r,e))}))}return t}function y(t,e,r){return e in t?Object.defineProperty(t,e,{value:r,enumerable:!0,configurable:!0,writable:!0}):t[e]=r,t}var d={sld:new(u()),css:new(f())},b=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=arguments.length>1?arguments[1]:void 0;return e.filter((function(e){return!o()(t[e])})).length>0},p=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:["color","opacity","dashArray","dashOffset","lineCap","lineJoin","weight"];return b(t,e)},m=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:["fillColor","fillOpacity"];return b(t,e)},w=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:["label","font","fontFamily","fontSize","fontStyle","fontWeight","textAlign","textRotationDeg"];return b(t,e)},S=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:["radius"];return b(t,e)},T=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:["iconGlyph","iconShape","iconUrl"];return b(t,e)},A=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:["symbolUrl"];return b(t,e)},C=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return T(t)?"Marker":A(t)?"Symbol":w(t)?"Text":S(t)||"Circle Style"===t.title?"Circle":m(t)?"Polygon":p(t)?"Polyline":""},x={centerPoint:{type:"Point",func:function(){}},lineToArc:{type:"LineString",func:function(){}},startPoint:{type:"Point",func:function(){}},endPoint:{type:"Point",func:function(){}}},O=function(t,e){return x[t]&&x[t][e]},P=function(t,e,r){if(!(t&&e&&r))throw new Error("specify all the params: functionName, func, type");x[t]={func:e,type:r}},k=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"#FFCC33",e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:.2;return(0,i.t8)("a",e,t)},H=function(t){var e,r=0;if(0===t.length)return r;for(e=0;e<t.length;e++)r=(r<<5)-r+t.charCodeAt(e),r|=0;return r},j={},F=function(t,e){if(!t||!e)throw new Error("specify all the params: sha, style");j[t]=e},U=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};j=t},M=function(t){var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"style";return j[t]&&j[t][e]},R=function(){return j},D=function(t){if(t)return H(JSON.stringify(t));throw new Error("hashAndStringify: specify mandatory params: style")},z=function(t){var e=document.createElement("div");return e.appendChild(t),e.innerHTML},E=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e=arguments.length>1?arguments[1]:void 0;return A(t)&&t.symbolUrl?s().get(e,{"Content-Type":"image/svg+xml;charset=utf-8"}).then((function(e){var r=window.URL||window.webkitURL||window,n=(new DOMParser).parseFromString(e.data,"image/svg+xml").firstElementChild;n.setAttribute("fill",t.fillColor||"#FFCC33"),n.setAttribute("fill-opacity",o()(t.fillOpacity)?.2:t.fillOpacity),n.setAttribute("stroke",(0,a.qq)(t.color||"#FFCC33",o()(t.opacity)?1:t.opacity)),n.setAttribute("stroke-opacity",o()(t.opacity)?1:t.opacity),n.setAttribute("stroke-width",t.weight||1),n.setAttribute("width",t.size||32),n.setAttribute("height",t.size||32),n.setAttribute("stroke-dasharray",t.dashArray||"none");var i=new Blob([z(n)],{type:"image/svg+xml;charset=utf-8"}),c=r.createObjectURL(i),s=document.createElement("canvas");s.width=t.size,s.height=t.size;var l=s.getContext("2d"),u=new Image;u.src=c;var h="",f=D(t);return u.onload=function(){try{l.drawImage(u,s.width/2-u.width/2,s.height/2-u.height/2),h=s.toDataURL("image/png"),s=null,F(f,{style:v(v({},t),{},{symbolUrlCustomized:c}),base64:h})}catch(t){return}},F(f,{style:v(v({},t),{},{symbolUrlCustomized:c}),svg:n,base64:h}),c})).catch((function(){return r(70898)})):new Promise((function(t){t(null)}))},N=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:[];return t.map((function(t){return A(t)&&!M(D(t))?E(t,t.symbolUrl||t.symbolUrlCustomized).then((function(e){return e?v(v({},t),{},{symbolUrlCustomized:e}):M(D(t))})).catch((function(){return v(v({},t),{},{symbolUrlCustomized:r(70898)})})):new Promise((function(e){e(A(t)?M(D(t)):t)}))}))},q=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"sld";return d[t]}},70898:(t,e,r)=>{t.exports=r.p+"symbolMissing.svg"}}]);