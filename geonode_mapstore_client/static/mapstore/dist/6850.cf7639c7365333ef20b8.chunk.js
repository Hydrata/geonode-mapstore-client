(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[6850],{86850:(e,t,r)=>{"use strict";r.d(t,{Mc:()=>W,v$:()=>L,ED:()=>M});var n=r(72500),o=r.n(n),a=r(9626),c=r.n(a),i=r(82920),s=r.n(i),u=r(33716),p=r.n(u),l=r(49977),f=r.n(l),y=r(5055),m=r(7526),g=r(75875),b=r.n(g),w=r(47805),v=r(24262),h=r(10284),d=r(35268),O=["totalFeatures","features"],j=["sortOptions","propertyName"];function S(e){return function(e){if(Array.isArray(e))return x(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||function(e,t){if(e){if("string"==typeof e)return x(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?x(e,t):void 0}}(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function x(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}function F(e){return(F="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function P(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},a=Object.keys(e);for(n=0;n<a.length;n++)r=a[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(n=0;n<a.length;n++)r=a[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}function N(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function A(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?N(Object(r),!0).forEach((function(t){q(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):N(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function q(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var D=r.n(d)()({wfsVersion:"1.1.0"}),I=D.getFeature,C=D.query,E=D.sortBy,k=D.propertyName,B=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.totalFeatures,r=e.features,n=P(e,O),o=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{},a=o.startIndex,c=arguments.length>2?arguments[2]:void 0;return c>t&&c===a+r.length&&t===r.length?A(A({},n),{},{features:r,totalFeatures:c}):A(A({},n),{},{features:r,totalFeatures:t})},G=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};return e.pagination||!s()(t.startIndex)&&!s()(t.maxFeatures)&&{startIndex:t.startIndex,maxFeatures:t.maxFeatures}},T=function(e,t){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{},n=(0,w.getWFSFilterData)(t,r),a=o().parse(e,!0),c=p()(a.query)?a.query:{};c.service="WFS",c.outputFormat="json";var i=o().format({protocol:a.protocol,host:a.host,pathname:a.pathname,query:c});return f().Observable.defer((function(){return b().post(i,n,{timeout:6e4,headers:{Accept:"application/json","Content-Type":"application/json"}})})).let(h.oB).map((function(e){return B(e.data,G(t,r),r.totalFeatures)}))},W=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.search,r=void 0===t?{}:t,n=e.url,o=e.name,a=arguments.length>1?arguments[1]:void 0,i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{},s=i.sortOptions,u=i.propertyName,p=P(i,j);return T(r.url||n,a&&"object"===F(a)?A(A({},a),{},{typeName:o||a.typeName}):I(C(o,[].concat(S(s?[E(s.sortBy,s.sortOrder)]:[]),S(u?[k(u)]:[]),S(a?c()(a):[]))),p),p).catch((function(e){if("OGCError"===e.name&&"NoApplicableCode"===e.code&&!s&&u&&u[0])return T(r.url||n,a&&"object"===F(a)?A(A({},a),{},{typeName:o||a.typeName}):I(C(o,[E(u[0])].concat(S(u?[k(u)]:[]),S(a?c()(a):[]))),p),p);throw e}))},L=function(e){var t=e.layer;return f().Observable.defer((function(){return b().get(function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.name,r=e.search,n=void 0===r?{}:r,a=e.url,c=e.describeFeatureTypeURL,i=o().parse(c||n.url||a,!0);return o().format(A(A({},i),{},{search:void 0,query:A(A({},i.query),{},{service:"WFS",version:"1.1.0",typeName:t,outputFormat:"application/json",request:"DescribeFeatureType"})}))}(t))})).let(h.oB)},M=function(e){var t=e.layer;return f().Observable.defer((function(){return b().get(function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.name,r=e.search,n=void 0===r?{}:r,a=e.url,c=(0,v.Fh)({name:t,url:n&&n.url||a}),i=o().parse(c,!0);return o().format(A(A({},i),{},{search:void 0,query:A(A({},i.query),{},{service:"WFS",version:"1.1.1",request:"GetCapabilities"})}))}(t))})).let(h.oB).switchMap((function(e){return f().Observable.bindNodeCallback((function(e,t){return(0,y.parseString)(e,{tagNameProcessors:[m.stripPrefix],explicitArray:!1,mergeAttrs:!0},t)}))(e.data)}))}},35268:(e,t,r)=>{function n(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function o(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?n(Object(r),!0).forEach((function(t){a(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):n(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function a(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var c=r(2245),i=r(9626),s=r(78889).wfsToGmlVersion,u=function(e){return'service="WFS" version="'+e+'" '+("1.0.0"===e?'outputFormat="GML2" ':"")+'xmlns:gml="http://www.opengis.net/gml" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wfs '+"http://schemas.opengis.net/wfs/".concat(e,"1.0.0"===e?'/WFS-basic.xsd"':'/wfs.xsd"')},p=function(e){return'service="WFS" version="'+e+'" xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/wfs/2.0 http://schemas.opengis.net/wfs/2.0/wfs.xsd http://www.opengis.net/gml/3.2 http://schemas.opengis.net/gml/3.2.1/gml.xsd"'};e.exports=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.wfsVersion,r=void 0===t?"1.1.0":t,n=e.gmlVersion,a=e.filterNS,l=e.wfsNS,f=void 0===l?"wfs":l,y=n;!y&&r?y=s(r):y||(y="3.1.1");var m=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},t=e.viewParams,n=e.resultType,o=e.outputFormat,a=e.startIndex,c=e.maxFeatures,i=function(e){return 0===r.indexOf("2.")?'count="'.concat(e,'"'):'maxFeatures="'.concat(e,'"')};return(0===r.indexOf("1.")?u(r):p(r))+(n?' resultType="'.concat(n,'"'):"")+(o?' outputFormat="'.concat(o,'"'):"")+(a||0===a?' startIndex="'.concat(a,'"'):"")+(c||0===c?" ".concat(i(c)):"")+(t?' viewParams="'.concat(t,'"'):"")},g=function(e){return i(e).map((function(e){return"<".concat("2.0"===r?"fes":"ogc",":PropertyName>").concat(e,"</").concat("2.0"===r?"fes":"ogc",":PropertyName>")})).join("")};return o(o({propertyName:g},c({gmlVersion:y,wfsVersion:r,filterNS:a||"2.0"===r?"fes":"ogc"})),{},{getFeature:function(e,t){return"<".concat(f,":GetFeature ").concat(m(t),">").concat(Array.isArray(e)?e.join(""):e,"</").concat(f,":GetFeature>")},sortBy:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"ASC";return"<".concat(f,":SortBy><").concat(f,":SortProperty>").concat(g(e),"<").concat(f,":SortOrder>").concat(t,"</").concat(f,":SortOrder></").concat(f,":SortProperty></").concat(f,":SortBy>")},query:function(e,t){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{},o=n.srsName,a=void 0===o?"EPSG:4326":o;return"<".concat(f,":Query ").concat("2.0"===r?"typeNames":"typeName",'="').concat(e,'" srsName="').concat(a,'">')+"".concat(Array.isArray(t)?t.join(""):t)+"</".concat(f,":Query>")}})}}}]);