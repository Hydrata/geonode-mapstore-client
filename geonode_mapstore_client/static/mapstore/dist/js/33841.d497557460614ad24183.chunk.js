(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[33841],{233841:(e,r,t)=>{"use strict";t.r(r),t.d(r,{default:()=>A});var n=t(124852),o=t.n(n),a=t(929656),i=(t(672632),t(203256),t(462193),t(796876),t(854086),t(799715),t(729589),t(121994),t(232095),t(164020),t(316179),t(471707),t(304631)),l=t.n(i),s=t(410240),u=t.n(s),c=t(92742),p=t.n(c);function f(e,r){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);r&&(n=n.filter((function(r){return Object.getOwnPropertyDescriptor(e,r).enumerable}))),t.push.apply(t,n)}return t}function d(e){for(var r=1;r<arguments.length;r++){var t=null!=arguments[r]?arguments[r]:{};r%2?f(Object(t),!0).forEach((function(r){m(e,r,t[r])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):f(Object(t)).forEach((function(r){Object.defineProperty(e,r,Object.getOwnPropertyDescriptor(t,r))}))}return e}function m(e,r,t){var n;return n=function(e,r){if("object"!=b(e)||!e)return e;var t=e[Symbol.toPrimitive];if(void 0!==t){var n=t.call(e,"string");if("object"!=b(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(r),(r="symbol"==b(n)?n:n+"")in e?Object.defineProperty(e,r,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[r]=t,e}function b(e){return b="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},b(e)}var y=t(91175),g=t.n(y);function h(e){return h="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},h(e)}function v(e){return function(e){if(Array.isArray(e))return k(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||function(e,r){if(e){if("string"==typeof e)return k(e,r);var t=Object.prototype.toString.call(e).slice(8,-1);return"Object"===t&&e.constructor&&(t=e.constructor.name),"Map"===t||"Set"===t?Array.from(e):"Arguments"===t||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t)?k(e,r):void 0}}(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function k(e,r){(null==r||r>e.length)&&(r=e.length);for(var t=0,n=new Array(r);t<r;t++)n[t]=e[t];return n}function w(e,r){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);r&&(n=n.filter((function(r){return Object.getOwnPropertyDescriptor(e,r).enumerable}))),t.push.apply(t,n)}return t}function O(e){for(var r=1;r<arguments.length;r++){var t=null!=arguments[r]?arguments[r]:{};r%2?w(Object(t),!0).forEach((function(r){var n,o,a,i;n=e,o=r,a=t[r],i=function(e,r){if("object"!=h(e)||!e)return e;var t=e[Symbol.toPrimitive];if(void 0!==t){var n=t.call(e,"string");if("object"!=h(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(o),(o="symbol"==h(i)?i:i+"")in n?Object.defineProperty(n,o,{value:a,enumerable:!0,configurable:!0,writable:!0}):n[o]=a})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):w(Object(t)).forEach((function(r){Object.defineProperty(e,r,Object.getOwnPropertyDescriptor(t,r))}))}return e}var j,x,P={short:"number",float:"number",double:"number",long:"number",decimal:"number",integer:"number",int:"number"},S=["editorDidMount"];function z(){return z=Object.assign?Object.assign.bind():function(e){for(var r=1;r<arguments.length;r++){var t=arguments[r];for(var n in t)Object.prototype.hasOwnProperty.call(t,n)&&(e[n]=t[n])}return e},z.apply(this,arguments)}!function(e){e.defineMode("geocss",(function(r){var t,n,o=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},a=r.indentUnit,i=o.propertyKeywords&&o||e.resolveMode("text/geocss"),l=i.propertyKeywords,s=void 0===l?{}:l,c=i.colorKeywords,f=void 0===c?{}:c,d=i.valueKeywords,m=void 0===d?{}:d,y=i.logicKeywords,g=void 0===y?{}:y,h=i.allowNested,v={},k=function(e,r){return t=r,e},w=function(e,r){for(var t=!1,n=e.next();n;){if(t&&"/"===n){r.tokenize=null;break}t="*"===n,n=e.next()}return["comment","comment"]},O=function(e,r){var t,n=e.next();if("@"===n)return e.eat("{")?[null,"interpolation"]:e.match(/^(sd|scale)\b/)?["filter",null]:(e.eatWhile(/[\w\\\-]/),e.match(/^\s*:/,!1)?["variable-2","variable-definition"]:["variable-2","variable"]);if("/"===n)return e.eat("*")?(r.tokenize=w,w(e,r)):["operator","operator"];if('"'===n||"'"===n)return r.tokenize=(t=n,function(e,r){for(var n=!1,o=e.next();o;){if(o===t&&!n){")"===t&&e.backUp(1);break}n=!n&&"\\"===o,o=e.next()}return(o===t||!n&&")"!==t)&&(r.tokenize=null),k("string","string")}),r.tokenize(e,r);if("#"===n)return e.eatWhile(/[\w\\\-]/),k("atom","hash");if(/\d/.test(n)||"."===n&&e.eat(/\d/))return e.eatWhile(/[\w.%]/),k("number","unit");if("-"===n){if(/[\d.]/.test(e.peek()))return e.eatWhile(/[\w.%]/),k("number","unit");if(e.match(/^-[\w\\\-]+/))return e.eatWhile(/[\w\\\-]/),e.match(/^\s*:/,!1)?k("variable-2","variable-definition"):k("variable-2","variable");if(e.match(/^\w+-/))return k("meta","meta")}else{if(/[,+>*\/]/.test(n))return k(null,"select-op");if("."===n&&e.match(/^-?[_a-z][_a-z0-9-]*/i))return k("qualifier","qualifier");if(/[:;{}\[\]\(\)]/.test(n))return k(null,n);if(/[\w\\\-]/.test(n))return e.eatWhile(/[\w\\\-]/),k("property","word")}return k(null,null)};function j(e,r,t){this.type=e,this.indent=r,this.prev=t}var x=function(e,r,t,n){return e.context=new j(t,r.indentation()+(!1===n?0:a),e.context),t},P=function(e){return e.context.prev&&(e.context=e.context.prev),e.context.type},S=function(e,r,t){return v[t.context.type](e,r,t)},z=function(e,r,t,n){for(var o=n||1;o>0;o--)t.context=t.context.prev;return S(e,r,t)},A=function(e){var r=e.current().toLowerCase();n=m.hasOwnProperty(r)?"atom":f.hasOwnProperty(r)?"keyword":"variable"};return v.top=function(e,r,t){if("{"===e)return x(t,r,"block");if("}"===e&&t.context.prev)return P(t);if("hash"===e)n="builtin";else if("word"===e)n="tag";else{if("variable-definition"===e)return"maybeprop";if("interpolation"===e)return x(t,r,"interpolation");if(":"===e)return"pseudo";if(h&&"("===e)return x(t,r,"parens")}return t.context.type},v.block=function(e,r,t){if("word"===e){var o=r.current().toLowerCase();return s.hasOwnProperty(o)?(n="property","maybeprop"):g.hasOwnProperty(p()(o))?(n="logic","maybeprop"):u()(p()(r.string),"[")?(n="filter","maybeprop"):(n+=" error","maybeprop")}return"meta"===e?"block":h||"hash"!==e&&"qualifier"!==e?v.top(e,r,t):(n="error","block")},v.maybeprop=function(e,r,t){return":"===e?x(t,r,"prop"):S(e,r,t)},v.prop=function(e,r,t){if(";"===e)return P(t);if("{"===e&&h)return x(t,r,"propBlock");if("}"===e||"{"===e)return z(e,r,t);if("("===e)return x(t,r,"parens");if("hash"!==e||/^#([0-9a-fA-f]{3,4}|[0-9a-fA-f]{6}|[0-9a-fA-f]{8})$/.test(r.current())){if("word"===e)A(r);else if("interpolation"===e)return x(t,r,"interpolation")}else n+=" error";return"prop"},v.propBlock=function(e,r,t){return"}"===e?P(t):"word"===e?(n="property","maybeprop"):t.context.type},v.parens=function(e,r,t){return"{"===e||"}"===e?z(e,r,t):")"===e?P(t):"("===e?x(t,r,"parens"):"interpolation"===e?x(t,r,"interpolation"):("word"===e&&A(r),"parens")},v.pseudo=function(e,r,o){return"word"===e?(n="variable-3",o.context.type):S(t,r,o)},v.at=function(e,r,t){return";"===e?P(t):"{"===e||"}"===e?z(e,r,t):("word"===e?n="tag":"hash"===e&&(n="builtin"),"at")},v.interpolation=function(e,r,t){return"}"===e?P(t):"{"===e||";"===e?z(e,r,t):("word"===e?n="variable":"variable"!==e&&"("!==e&&")"!==e&&(n="error"),"interpolation")},{startState:function(e){return{tokenize:null,state:"top",stateArg:null,context:new j("block",e||0,null)}},token:function(e,r){if(!r.tokenize&&e.eatSpace())return null;var o=(r.tokenize||O)(e,r);return o&&"object"===b(o)&&(t=o[1],o=o[0]),n=o,r.state=v[r.state](t,e,r),n},indent:function(e,r){var t=e.context,n=r&&r.charAt(0),o=t.indent;return"prop"!==t.type||"}"!==n&&")"!==n||(t=t.prev),t.prev&&("}"!==n||"block"!==t.type&&"top"!==t.type&&"interpolation"!==t.type?(")"===n&&"parens"===t.type||"{"===n&&("at"===t.type||"atBlock"===t.type))&&(o=Math.max(0,t.indent-a),t=t.prev):o=(t=t.prev).indent),o},electricChars:"}",blockCommentStart:"/*",blockCommentEnd:"*/",fold:"brace"}}));var r={colorKeywords:["aliceblue","antiquewhite","aqua","aquamarine","azure","beige","bisque","black","blanchedalmond","blue","blueviolet","brown","burlywood","cadetblue","chartreuse","chocolate","coral","cornflowerblue","cornsilk","crimson","cyan","darkblue","darkcyan","darkgoldenrod","darkgray","darkgreen","darkkhaki","darkmagenta","darkolivegreen","darkorange","darkorchid","darkred","darksalmon","darkseagreen","darkslateblue","darkslategray","darkturquoise","darkviolet","deeppink","deepskyblue","dimgray","dodgerblue","firebrick","floralwhite","forestgreen","fuchsia","gainsboro","ghostwhite","gold","goldenrod","gray","grey","green","greenyellow","honeydew","hotpink","indianred","indigo","ivory","khaki","lavender","lavenderblush","lawngreen","lemonchiffon","lightblue","lightcoral","lightcyan","lightgoldenrodyellow","lightgray","lightgreen","lightpink","lightsalmon","lightseagreen","lightskyblue","lightslategray","lightsteelblue","lightyellow","lime","limegreen","linen","magenta","maroon","mediumaquamarine","mediumblue","mediumorchid","mediumpurple","mediumseagreen","mediumslateblue","mediumspringgreen","mediumturquoise","mediumvioletred","midnightblue","mintcream","mistyrose","moccasin","navajowhite","navy","oldlace","olive","olivedrab","orange","orangered","orchid","palegoldenrod","palegreen","paleturquoise","palevioletred","papayawhip","peachpuff","peru","pink","plum","powderblue","purple","rebeccapurple","red","rosybrown","royalblue","saddlebrown","salmon","sandybrown","seagreen","seashell","sienna","silver","skyblue","slateblue","slategray","snow","springgreen","steelblue","tan","teal","thistle","tomato","turquoise","violet","wheat","white","whitesmoke","yellow","yellowgreen"],valueKeywords:["round"],pseudoProperties:["mark","shield","stroke","fill","symbol","nth-mark","nth-shield","nth-stroke","nth-fill","nth-symbol"],logicKeywords:["and","or"]};e.defineMIME("text/geocss",d(d({},Object.keys(r).reduce((function(e,t){return d(d({},e),{},m({},t,r[t].reduce((function(e,r){return d(d({},e),{},m({},r,!0))}),{})))}),{})),{},{propertyKeywords:{mark:{values:{"symbol(circle)":!0}},"mark-composite":!0,"mark-mime":!0,"mark-geometry":!0,"mark-size":!0,"mark-rotation":!0,"mark-label-obstacle":!0,"mark-anchor":!0,"mark-offset":!0,"z-index":!0,stroke:!0,"stroke-composite":!0,"stroke-geometry":!0,"stroke-offset":!0,"stroke-mime":!0,"stroke-opacity":!0,"stroke-width":!0,"stroke-size":!0,"stroke-rotation":!0,"stroke-linecap":!0,"stroke-linejoin":!0,"stroke-dasharray":!0,"stroke-dashoffset":!0,"stroke-repeat":!0,"stroke-label-obstacle":!0,fill:!0,"fill-composite":!0,"fill-geometry":!0,"fill-mime":!0,"fill-opacity":!0,"fill-size":!0,"fill-rotation":!0,"fill-label-obstacle":!0,"graphic-margin":!0,random:!0,"random-seed":!0,"random-rotation":!0,"random-symbol-count":!0,"random-tile-size":!0,"fill-random":!0,"fill-random-seed":!0,"fill-random-rotation":!0,"fill-random-symbol-count":!0,"fill-random-tile-size":!0,label:!0,"label-geometry":!0,"label-anchor":!0,"label-offset":!0,"label-rotation":!0,"label-z-index":!0,shield:!0,"shield-mime":!0,"font-family":!0,"font-fill":!0,"font-style":!0,"font-weight":!0,"font-size":!0,"halo-radius":!0,"halo-color":!0,"halo-opacity":!0,"label-padding":!0,"label-group":!0,"label-max-displacement":!0,"label-min-group-distance":!0,"label-repeat":!0,"label-all-group":!0,"label-remove-overlaps":!0,"label-allow-overruns":!0,"label-follow-line":!0,"label-max-angle-delta":!0,"label-auto-wrap":!0,"label-force-ltr":!0,"label-conflict-resolution":!0,"label-fit-goodness":!0,"label-priority":!0,"shield-resize":!0,"shield-margin":!0,"label-underline-text":!0,"label-strikethrough-text":!0,"label-char-spacing":!0,"label-word-spacing":!0,"raster-channels":!0,"raster-composite":!0,"raster-geometry":!0,"raster-opacity":!0,"raster-contrast-enhancement":!0,"raster-contrast-enhancement-algorithm":!0,"raster-contrast-enhancement-min":!0,"raster-contrast-enhancement-max":!0,"raster-gamma":!0,"raster-z-index":!0,"raster-color-map":!0,"raster-color-map-type":!0,composite:!0,"composite-base":!0,geometry:!0,"sort-by":!0,"sort-by-group":!0,transform:!0,size:!0,rotation:!0},envKeywords:{sd:{localPart:"env"},scale:{localPart:"env"}},allowNested:!0,name:"geocss"}))}(l()),j=l(),x=j.Pos,j.registerHelper("hint","geocss",(function(e){var r=e.getCursor(),t=e.getTokenAt(r),n=e.getLineTokens(r.line),o=n&&g()(n.filter((function(e){var r=e.type,n=e.start;return"property"===r&&n<t.start})).map((function(e){return e.string}))),a=j.innerMode(e.getMode(),t.state);if("geocss"!==a.mode.name)return null;var i=t.start,l=r.ch,s=t.string.slice(0,l-i);/[^\w$_-]/.test(s)&&(s="",i=l=r.ch);var u=j.resolveMode("text/geocss")||{},c=u.propertyKeywords,p=u.pseudoProperties,f=u.envKeywords,d=(j.getMode({},"text/geocss")||{}).hintProperties,m={},b=!1,y=a.state.state;"pseudo"===y||"variable-3"===t.type?m=O({},p):"prop"===y?(b=!0,m=c&&c[o]&&c[o].values&&O({},c[o].values)||{}):"variable-2"===t.type?m=O({},f):"filter"===t.type?(b=!0,m=O({},d)):"block"!==y&&"maybeprop"!==y||(m=O({},c));var h=Object.keys(m).reduce((function(e,r){var t=!s||0===r.lastIndexOf(s,0);return[].concat(v(e),v(t&&[r]||[]))}),[]);return(h=0===h.length&&b?Object.keys(m).reduce((function(e,r){return[].concat(v(e),[r])}),[]):v(h)).length>0?{list:h.map((function(e){return{text:e,displayText:e,render:function(e,r,t){var n,o,a=document.createElement("span"),i=(o=(n=m[t.displayText]||{}).localType,("gml"===n.prefix?"geometry":P[o])||o||"");a.innerHTML=i&&'{<span class="cm-desc">'.concat(i,"</span>} ")||"";var l=document.createElement("span");l.innerText=t.displayText,e.appendChild(a),e.appendChild(l)}}})),from:x(r.line,i),to:x(r.line,l)}:null}));const A=(0,n.forwardRef)((function(e,r){var t=e.editorDidMount,n=void 0===t?function(){}:t,i=function(e,r){if(null==e)return{};var t,n,o=function(e,r){if(null==e)return{};var t,n,o={},a=Object.keys(e);for(n=0;n<a.length;n++)t=a[n],r.indexOf(t)>=0||(o[t]=e[t]);return o}(e,r);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(n=0;n<a.length;n++)t=a[n],r.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(o[t]=e[t])}return o}(e,S);return o().createElement(a.Controlled,z({ref:r},i,{editorDidMount:function(){for(var e=arguments.length,r=new Array(e),t=0;t<e;t++)r[t]=arguments[t];return n.apply(void 0,r.concat([l()]))}}))}))}}]);