(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[35701],{761444:(t,e,r)=>{"use strict";r.r(e);var n=r(845243),i=r.n(n),o=r(244712),a=r.n(o),l=(r(371851),r(737295)),s=r.n(l);i().BingLayer.prototype.loadMetadata=function(){if(!this.metaRequested){this.metaRequested=!0;var t=this,e="_bing_metadata_"+i().Util.stamp(this);window[e]=function(r){t.meta=r,window[e]=void 0;var n=document.getElementById(e);return n.parentNode.removeChild(n),r.errorDetails?(t.fire("load",{layer:t}),t.onError(r)):(t.initMetadata(r),null)};var r="file:"===document.location.protocol?"https":document.location.protocol.slice(0,-1),n=r+"://dev.virtualearth.net/REST/v1/Imagery/Metadata/"+this.options.type+"?include=ImageryProviders&jsonp="+e+"&key="+this._key+"&UriScheme="+r,o=document.createElement("script");o.type="text/javascript",o.src=n,o.id=e,document.getElementsByTagName("head")[0].appendChild(o)}},i().BingLayer.prototype.onError=function(t){return this.options.onError?this.options.onError(t):null},a().registerType("bing",{create:function(t){var e=t.apiKey,r={subdomains:[0,1,2,3],type:t.name,attribution:"Bing",culture:"",onError:t.onError,maxNativeZoom:t.maxNativeZoom||19,maxZoom:t.maxZoom||23};return t.zoomOffset&&(r=s()({},r,{zoomOffset:t.zoomOffset})),new(i().BingLayer)(e,r)},isValid:function(t){return!t.meta||!t.meta.statusCode||200===t.meta.statusCode}})},951735:(t,e,r)=>{var n=r(845243);t.exports=n.TileLayer.extend({initialize:function(t){n.TileLayer.prototype.initialize.call(this,this.url,t)}})},826696:(t,e,r)=>{"use strict";r.r(e);var n=r(244712),i=r.n(n),o=r(845243),a=r.n(o);r(514767),i().registerType("google",(function(t){return(null===(e=window)||void 0===e||null===(r=e.google)||void 0===r?void 0:r.maps)?a().gridLayer.googleMutant({type:t.name.toLowerCase(),maxNativeZoom:t.maxNativeZoom||18,maxZoom:t.maxZoom||20}):null;var e,r}))},790671:(t,e,r)=>{"use strict";r.r(e);var n=r(244712),i=r.n(n),o=r(471305),a=r.n(o),l=r(737295),s=r.n(l);r(522729),i().registerType("graticule",{create:function(t){var e=s()({interval:20,showOriginLabel:!0,redraw:"move"},t);return a()?new(a())(e):null},isValid:function(){return!!a()}})},352031:(t,e,r)=>{"use strict";r.r(e);var n=r(244712),i=r.n(n),o=r(357167),a=r.n(o);function l(t){return l="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},l(t)}function s(t,e){var r=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),r.push.apply(r,n)}return r}i().registerType("mapquest",{create:function(t){return a()?a().mapLayer(function(t){for(var e=1;e<arguments.length;e++){var r=null!=arguments[e]?arguments[e]:{};e%2?s(Object(r),!0).forEach((function(e){var n,i,o,a;n=t,i=e,o=r[e],a=function(t,e){if("object"!=l(t)||!t)return t;var r=t[Symbol.toPrimitive];if(void 0!==r){var n=r.call(t,"string");if("object"!=l(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(t)}(i),(i="symbol"==l(a)?a:String(a))in n?Object.defineProperty(n,i,{value:o,enumerable:!0,configurable:!0,writable:!0}):n[i]=o})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(r)):s(Object(r)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(r,e))}))}return t}({maxZoom:23},t)):(t&&t.onError&&t.onError(),!1)},isValid:function(){return!!a()}})},151254:(t,e,r)=>{"use strict";r.r(e);var n=r(244712),i=r.n(n),o=r(845243),a=r.n(o);i().registerType("osm",(function(t){return a().tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:'&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',zoomOffset:t.zoomOffset||0,maxNativeZoom:t.maxNativeZoom||19,maxZoom:t.maxZoom||23})}))},135659:(t,e,r)=>{"use strict";r.r(e);var n=r(244712),i=r.n(n),o=r(845243),a=r.n(o);i().registerType("tms",(function(t){return a().tileLayer("".concat(t.tileMapUrl,"/{z}/{x}/{y}.").concat(t.extension),{hideErrors:t.hideErrors||!0,tms:!0})}))},70826:(t,e,r)=>{"use strict";r.r(e);var n=r(244712),i=r.n(n),o=r(845243),a=r.n(o),l=r(45992);function s(t){return s="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},s(t)}function u(t,e){var r=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),r.push.apply(r,n)}return r}function c(t,e){(null==e||e>t.length)&&(e=t.length);for(var r=0,n=new Array(e);r<e;r++)n[r]=t[r];return n}i().registerType("tileprovider",(function(t){var e,r,n=l.Z.getLayerConfig(t.provider,function(t){for(var e=1;e<arguments.length;e++){var r=null!=arguments[e]?arguments[e]:{};e%2?u(Object(r),!0).forEach((function(e){var n,i,o,a;n=t,i=e,o=r[e],a=function(t,e){if("object"!=s(t)||!t)return t;var r=t[Symbol.toPrimitive];if(void 0!==r){var n=r.call(t,"string");if("object"!=s(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(t)}(i),(i="symbol"==s(a)?a:String(a))in n?Object.defineProperty(n,i,{value:o,enumerable:!0,configurable:!0,writable:!0}):n[i]=o})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(r)):u(Object(r)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(r,e))}))}return t}({maxZoom:23},t)),i=(r=2,function(t){if(Array.isArray(t))return t}(e=n)||function(t,e){var r=null==t?null:"undefined"!=typeof Symbol&&t[Symbol.iterator]||t["@@iterator"];if(null!=r){var n,i,o,a,l=[],s=!0,u=!1;try{if(o=(r=r.call(t)).next,0===e){if(Object(r)!==r)return;s=!1}else for(;!(s=(n=o.call(r)).done)&&(l.push(n.value),l.length!==e);s=!0);}catch(t){u=!0,i=t}finally{try{if(!s&&null!=r.return&&(a=r.return(),Object(a)!==a))return}finally{if(u)throw i}}return l}}(e,r)||function(t,e){if(t){if("string"==typeof t)return c(t,e);var r=Object.prototype.toString.call(t).slice(8,-1);return"Object"===r&&t.constructor&&(r=t.constructor.name),"Map"===r||"Set"===r?Array.from(t):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?c(t,e):void 0}}(e,r)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()),o=i[0],y=i[1];return a().tileLayer(o,y)}))},510733:(t,e,r)=>{"use strict";r.r(e);var n=r(244712),i=r.n(n),o=r(618446),a=r.n(o),l=r(414293),s=r.n(l),u=r(845243),c=r.n(u),y=r(166287),f=function t(e,r){e.eachLayer&&e.eachLayer((function(e){e.setOpacity&&e.setOpacity(r),t(e,r)}))},m=function(t){var e,r;return(null==t||null===(e=t.style)||void 0===e?void 0:e.body)&&(null==t||null===(r=t.style)||void 0===r?void 0:r.format)},p=function(t){var e=function(t){var e=t.hideLoading,r=c().geoJson([],{pointToLayer:"marker"!==t.styleName?function(e,r){return c().circleMarker(r,e.style||t.style)}:null,hideLoading:e});return r.setOpacity=function(t){f(r,t)},r.on("layeradd",(function(e){var n=e.layer;r.setOpacity(s()(r.opacity)?t.opacity:r.opacity,n)})),r}(t);return e.opacity=s()(t.opacity)?1:t.opacity,e._msLegacyGeoJSON=!0,e},d=function(t){var e=t.hideLoading,r=c().geoJson(t.features,{hideLoading:e});return(0,y.getStyle)((0,y.applyDefaultStyleToLayer)(t),"leaflet").then((function(e){var n=e&&e({opacity:t.opacity})||{},i=n.style,o=n.pointToLayer,a=void 0===o?function(){return null}:o,l=n.filter,s=void 0===l?function(){return!0}:l;r.clearLayers(),r.options.pointToLayer=a,r.options.filter=s,r.addData(t.features),r.setStyle(i)})),r};i().registerType("vector",{create:function(t){return m(t)?d(t):p(t)},update:function(t,e,r){return t._msLegacyGeoJSON?function(t,e,r){return e.opacity!==r.opacity&&(t.opacity=e.opacity),a()(e.style,r.style)?null:m(e)?d(e):p(e)}(t,e,r):function(t,e,r){return a()(r.style,e.style)&&e.opacity===r.opacity||(0,y.getStyle)((0,y.applyDefaultStyleToLayer)(e),"leaflet").then((function(r){var n=r&&r({opacity:e.opacity})||{},i=n.style,o=n.pointToLayer,a=void 0===o?function(){return null}:o,l=n.filter,s=void 0===l?function(){return!0}:l;t.clearLayers(),t.options.pointToLayer=a,t.options.filter=s,t.addData(e.features),t.setStyle(i)})),null}(t,e,r)},render:function(){return null}})},622946:(t,e,r)=>{"use strict";var n=r(618446),i=r.n(n),o=r(845243),a=r.n(o),l=r(896309),s=r(244712),u=r.n(s),c=r(143378),y=r(432420),f=r(838848),m=r(166287);function p(t){return p="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},p(t)}function d(t,e){var r=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),r.push.apply(r,n)}return r}function v(t){for(var e=1;e<arguments.length;e++){var r=null!=arguments[e]?arguments[e]:{};e%2?d(Object(r),!0).forEach((function(e){var n,i,o,a;n=t,i=e,o=r[e],a=function(t,e){if("object"!=p(t)||!t)return t;var r=t[Symbol.toPrimitive];if(void 0!==r){var n=r.call(t,"string");if("object"!=p(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(t)}(i),(i="symbol"==p(a)?a:String(a))in n?Object.defineProperty(n,i,{value:o,enumerable:!0,configurable:!0,writable:!0}):n[i]=o})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(r)):d(Object(r)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(r,e))}))}return t}var g=function(t,e){(0,m.layerToGeoStylerStyle)(e).then((function(r){(0,m.getStyle)((0,m.applyDefaultStyleToLayer)(v(v({},e),{},{style:r})),"leaflet").then((function(r){var n=r&&r({opacity:e.opacity})||{},i=n.style,o=n.pointToLayer,a=void 0===o?function(){return null}:o,l=n.filter,s=void 0===l?function(){return!0}:l;t.clearLayers(),t.options.pointToLayer=a,t.options.filter=s,t.addData(t._msFeatures),t.setStyle(i)}))}))},h=function(t,e){t.fireEvent("loading");var r=(0,c.v)(e),n=function(){t.fireEvent("loadError")};return(0,y.Bm)(e.url,e.name,v({outputFormat:"application/json",maxFeatures:1e3,srsname:(0,l.normalizeSRS)("EPSG:4326")},r)).then((function(r){return 200===r.status?(t.clearLayers(),t._msFeatures=v({},r.data),t.addData(r.data),t.fireEvent("load"),g(t,e)):(console.error(r),n(new Error("status code of response:"+r.status))),t})).catch((function(t){n()}))};u().registerType("wfs",{create:function(t){var e=new(a().GeoJSON)([],{});return h(e,t),e},update:function(t,e,r){return(0,f.Es)(r,e)&&h(t,e),i()(e.style,r.style)&&e.styleName===r.styleName&&e.opacity===r.opacity||g(t,e),null},render:function(){return null}})},136366:(t,e,r)=>{"use strict";r.r(e);var n=r(124852),i=r.n(n),o=r(805346),a=r(244712),l=r.n(a),s=r(143378),u=r(73785),c=r.n(u),y=r(845243),f=r.n(y),m=r(737295),p=r.n(m),d=r(701469),v=r.n(d),g=r(414293),h=r.n(g),S=r(233044),b=r(503901),x=r(624262),w=r(333358);function O(t){return O="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},O(t)}function T(t,e,r){var n;return n=function(t,e){if("object"!=O(t)||!t)return t;var r=t[Symbol.toPrimitive];if(void 0!==r){var n=r.call(t,"string");if("object"!=O(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(t)}(e),(e="symbol"==O(n)?n:String(n))in t?Object.defineProperty(t,e,{value:r,enumerable:!0,configurable:!0,writable:!0}):t[e]=r,t}r(312787),f().NonTiledLayer.WMSCustom=f().NonTiledLayer.WMS.extend({initialize:function(t,e){this._wmsUrl=t;var r=f().extend({},this.defaultWmsParams);for(var n in e)this.options.hasOwnProperty(n)||"CRS"===n.toUpperCase()||"maxNativeZoom"===n||(r[n]=e[n]);this.wmsParams=r,f().setOptions(this,e)},removeParams:function(){var t=this,e=arguments.length>1?arguments[1]:void 0;return(arguments.length>0&&void 0!==arguments[0]?arguments[0]:[]).forEach((function(e){return delete t.wmsParams[e]})),e||this.redraw(),this}}),f().nonTiledLayer.wmsCustom=function(t,e){return new(f().NonTiledLayer.WMSCustom)(t,e)},f().TileLayer.MultipleUrlWMS=f().TileLayer.WMS.extend({initialize:function(t,e){this._url=t[0],this._urls=t,this._urlsIndex=0;var r=f().extend({},this.defaultWmsParams),n=e.tileSize||this.options.tileSize;for(var i in e.detectRetina&&f().Browser.retina?r.width=r.height=2*n:r.width=r.height=n,e)this.options.hasOwnProperty(i)||"CRS"===i.toUpperCase()||"maxNativeZoom"===i||(r[i]=e[i]);this.wmsParams=r,f().setOptions(this,e)},getTileUrl:function(t){var e=this._map,r=this.options.tileSize,n=t.multiplyBy(r),i=n.add([r,r]),o=this._crs.project(e.unproject(n,t.z)),a=this._crs.project(e.unproject(i,t.z)),l=this._wmsVersion>=1.3&&this._crs===f().CRS.EPSG4326?[a.y,o.x,o.y,a.x].join(","):[o.x,a.y,a.x,o.y].join(",");this._urlsIndex++,this._urlsIndex===this._urls.length&&(this._urlsIndex=0);var s=f().Util.template(this._urls[this._urlsIndex],{s:this._getSubdomain(t)});return s+f().Util.getParamString(this.wmsParams,s,!0)+"&BBOX="+l},removeParams:function(){var t=this,e=arguments.length>1?arguments[1]:void 0;return(arguments.length>0&&void 0!==arguments[0]?arguments[0]:[]).forEach((function(e){return delete t.wmsParams[e]})),e||this.redraw(),this}}),f().tileLayer.multipleUrlWMS=function(t,e){return new(f().TileLayer.MultipleUrlWMS)(t,e)},f().TileLayer.ElevationWMS=f().TileLayer.MultipleUrlWMS.extend({initialize:function(t,e,r,n){this._tiles={},this._nodata=r,this._littleendian=n,f().TileLayer.MultipleUrlWMS.prototype.initialize.apply(this,arguments)},_addTile:function(t){var e=this.getTileUrl(t);(0,b.qR)(e,t,this._tileCoordsToKey(t))},getElevation:function(t,e){try{var r=this._getTileFromCoords(t),n=(0,b.yQ)(this._tileCoordsToKey(r),this._getTileRelativePixel(r,e),this.getTileSize().x,this._nodata,this._littleendian);return n.available?n.value:i().createElement(o.Z,{msgId:n.message})}catch(t){return i().createElement(o.Z,{msgId:"elevationLoadingError"})}},_getTileFromCoords:function(t){var e=this._map.project(t).divideBy(256).floor();return p()(e,{z:this._tileZoom})},_getTileRelativePixel:function(t,e){var r=Math.floor(e.x-this._getTilePos(t).x-this._map._getMapPanePos().x),n=Math.min(this.getTileSize().x-1,Math.floor(e.y-this._getTilePos(t).y-this._map._getMapPanePos().y));return new(f().Point)(r,n)},_removeTile:function(){},_abortLoading:function(){}}),f().tileLayer.elevationWMS=function(t,e,r,n){return new(f().TileLayer.ElevationWMS)(t,e,r,n)};var P=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return Object.keys(t).reduce((function(e,r){return h()(t[r])?e:p()(e,T({},r,t[r]))}),{})};function L(t){var e=void 0!==t.opacity?t.opacity:1,r=(0,s.v)(t),n=p()({},t.baseParams,{attribution:t.credits&&(0,x.go)(t.credits),layers:t.name,styles:t.style||"",format:((0,w.z)(t.format)?"image/png":t.format)||"image/png",transparent:void 0===t.transparent||t.transparent,tiled:void 0===t.tiled||t.tiled,opacity:e,zIndex:t.zIndex,version:t.version||"1.3.0",tileSize:t.tileSize||256,maxZoom:t.maxZoom||23,maxNativeZoom:t.maxNativeZoom||18},p()(t._v_?{_v_:t._v_}:{},r||{}));return(0,S.addAuthenticationToSLD)(n,t)}function j(t){return t.map((function(t){return t.split("?")[0]}))}l().registerType("wms",{create:function(t){var e=j(v()(t.url)?t.url:[t.url]),r=P(L(t)||{});return e.forEach((function(e){return(0,S.addAuthenticationParameter)(e,r,t.securityToken)})),t.useForElevation?f().tileLayer.elevationWMS(e,r,t.nodata||-9999,t.littleendian||!1):t.singleTile?f().nonTiledLayer.wmsCustom(e[0],r):f().tileLayer.multipleUrlWMS(e,r)},update:function(t,e,r){if(r.singleTile!==e.singleTile||r.tileSize!==e.tileSize||r.securityToken!==e.securityToken&&e.visibility){var n=j(v()(e.url)?e.url:[e.url]),i=L(e)||{};return n.forEach((function(t){return(0,S.addAuthenticationParameter)(t,i,e.securityToken)})),e.singleTile?f().nonTiledLayer.wmsCustom(n[0],i):f().tileLayer.multipleUrlWMS(n,i)}var o=p()({},c().filterWMSParamOptions(L(r)),(0,S.addAuthenticationToSLD)(r.params||{},r)),a=p()({},c().filterWMSParamOptions(L(e)),(0,S.addAuthenticationToSLD)(e.params||{},e)),l=Object.keys(a).filter((function(t){return a[t]!==o[t]})),s=Object.keys(o).filter((function(t){return o[t]!==a[t]})),u={};return s.length>0&&t.removeParams(s,l.length>0),l.length>0&&(u=l.reduce((function(t,e){return p()({},t,T({},e,a[e]))}),u),t.setParams(P(p()(u,u.params,(0,S.addAuthenticationToSLD)(e.params||{},e))))),null}})},485365:(t,e,r)=>{"use strict";r.r(e);var n=r(244712),i=r.n(n),o=r(896309),a=r(845243),l=r.n(a),s=r(737295),u=r.n(s),c=r(233044),y=r(624262),f=r(707294),m=r(552259),p=r(91175),d=r.n(p),v=r(281763),g=r.n(v);function h(t){return function(t){if(Array.isArray(t))return S(t)}(t)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||function(t,e){if(t){if("string"==typeof t)return S(t,e);var r=Object.prototype.toString.call(t).slice(8,-1);return"Object"===r&&t.constructor&&(r=t.constructor.name),"Map"===r||"Set"===r?Array.from(t):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?S(t,e):void 0}}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function S(t,e){(null==e||e>t.length)&&(e=t.length);for(var r=0,n=new Array(e);r<e;r++)n[r]=t[r];return n}const b=l().TileLayer.extend({defaultWmtsParams:{service:"WMTS",request:"GetTile",version:"1.3.0",layer:"",style:"",tileMatrixSet:"",format:"image/jpeg"},initialize:function(t,e,r){this._url=t[0],this._urls=t,this._urlsIndex=0;var n=l().extend({},this.defaultWmtsParams),i=e.tileSize||this.options.tileSize;for(var o in e.detectRetina&&l().Browser.retina?n.width=n.height=2*i:n.width=n.height=i,e)this.options.hasOwnProperty(o)||"crs"===o||"attribution"===o||(n[o]=e[o]);this.wmtsParams=n,this.matrixIds=r.matrixIds&&this.getMatrix(r.matrixIds,r)||this.getDefaultMatrix(r),this.matrixSet=r.matrixSet&&r.matrixSet.TileMatrix||[],this.ignoreErrors=r.ignoreErrors||!1,l().setOptions(this,e)},getWMTSParams:function(t,e,r,n,i){var a=(0,m.getScales)()[r],l=d()(t.map((function(e,r){if(r===t.length-1)return null;var n=parseFloat(e.ScaleDenominator),i=parseFloat(t[r+1].ScaleDenominator);return n>=a&&i<a?a-i>(n-i)/2?{id:r,data:e}:{id:r+1,data:t[r+1]}:null})).filter((function(t){return t}))),s=l&&g()(l.id)&&l.id+""||0===t.length&&r||null;if(!e[s])return null;var u=e[s].identifier,c=l.data&&l.data.TopLeftCorner&&(0,o.parseString)(l.data.TopLeftCorner)||e[s].topLeftCorner,y=c.lng||c.x,f=c.lat||c.y,p=Math.round((n.x-y)/i),v=-Math.round((n.y-f)/i),h=l.data&&l.data.MatrixWidth&&l.data.MatrixHeight&&{cols:{min:0,max:l.data.MatrixWidth-1},rows:{min:0,max:l.data.MatrixHeight-1}},S=e[s].ranges||h;return S&&!function(t,e,r){return!(t<r.cols.min||t>r.cols.max||e<r.rows.min||e>r.rows.max)}(p,v,S)?null:{ident:u,tilecol:p,tilerow:v}},getTileUrl:function(t){var e=this._map,r=e.options.crs,n=this.options.tileSize,i=t.multiplyBy(n);i.x+=1,i.y-=1;var o=i.add([n,n]),a=r.project(e.unproject(i,t.z)),s=r.project(e.unproject(o,t.z)).x-a.x,u=this.getWMTSParams(h(this.matrixSet),h(this.matrixIds),t.z,a,s);if(!u)return"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";this._urlsIndex++,this._urlsIndex===this._urls.length&&(this._urlsIndex=0);var c=l().Util.template(this._urls[this._urlsIndex],{s:this._getSubdomain(t),TileRow:u.tilerow,TileCol:u.tilecol,TileMatrixSet:this.options.tileMatrixSet,TileMatrix:u.ident,Style:this.options.style});return"RESTful"===this.options.requestEncoding?c:c+l().Util.getParamString(this.wmtsParams,c,!0)+"&tilematrix="+u.ident+"&tilerow="+u.tilerow+"&tilecol="+u.tilecol},getMatrix:function(t,e){return t.map((function(t){return{identifier:t.identifier,topLeftCorner:new(l().LatLng)(e.originY,e.originX),ranges:t.ranges||null}}))},getDefaultMatrix:function(t){for(var e=new Array(22),r=0;r<22;r++)e[r]={identifier:t.tileMatrixPrefix+r,topLeftCorner:new(l().LatLng)(t.originY,t.originX)};return e},onError:function(){return!this.ignoreErrors}});var x=r(701469),w=r.n(x),O=r(333358);l().tileLayer.wmts=function(t,e,r){return new b(t,e,r)};var T=function(t){var e=function(t){return t.map((function(t){return t.split("?")[0]}))}(w()(t.url)?t.url:[t.url]),r=function(t){var e=(0,o.normalizeSRS)(t.srs||"EPSG:3857",t.allowedSRS),r=t.credits&&(0,y.go)(t.credits)||"",n=f.C2(t.tileMatrixSet,e,t.allowedSRS,t.matrixIds);return u()({requestEncoding:t.requestEncoding,layer:t.name,style:t.style||"",attribution:r,format:((0,O.z)(t.format)?"image/png":t.format)||"image/png",tileMatrixSet:n,version:t.version||"1.0.0",tileSize:t.tileSize||256,CRS:(0,o.normalizeSRS)(t.srs||"EPSG:3857",t.allowedSRS),maxZoom:t.maxZoom||23,maxNativeZoom:t.maxNativeZoom||18},t.params||{})}(t)||{};e.forEach((function(e){return(0,c.addAuthenticationParameter)(e,r,t.securityToken)}));var n=(0,o.normalizeSRS)(t.srs||"EPSG:3857",t.allowedSRS),i=f.h7(t,n),a=i.tileMatrixSet,s=i.matrixIds;return l().tileLayer.wmts(e,r,{tileMatrixPrefix:t.tileMatrixPrefix||r.tileMatrixSet+":"||n+":",originY:t.originY||20037508.3428,originX:t.originX||-20037508.3428,ignoreErrors:t.ignoreErrors||!1,matrixIds:s,matrixSet:a})};i().registerType("wmts",{create:T,update:function(t,e,r){return r.securityToken!==e.securityToken||r.format!==e.format||r.credits!==e.credits?T(e):null}})},935701:(t,e,r)=>{t.exports={BingLayer:r(761444),Commons:r(951735),GraticuleLayer:r(790671),GoogleLayer:r(826696),MapQuest:r(352031),OSMLayer:r(151254),TMSLayer:r(135659),TileProviderLayer:r(70826),WFSLayer:r(622946).default,WMSLayer:r(136366),WMTSLayer:r(485365),VectorLayer:r(510733)}},357167:t=>{t.exports=window.MQ},503901:(t,e,r)=>{"use strict";r.d(e,{qR:()=>c,yQ:()=>y});var n=r(375875),i=r.n(n),o=r(581399),a=r.n(o),l=r(882702),s=new(a())(100),u=function(t,e,r,n){var i=arguments.length>4&&void 0!==arguments[4]?arguments[4]:-9999,o=arguments.length>5&&void 0!==arguments[5]&&arguments[5],a=n*t+r;try{var l=e.dataView.getInt16(2*a,o);if(l!==i&&32767!==l&&-32768!==l)return l}catch(t){}return null},c=function(t,e,r){return s.has(r)?null:new l.Promise((function(n,o){i().get(t,{responseType:"arraybuffer"}).then((function(t){!function(t,e,r){s.set(r,{data:t,dataView:new DataView(t),coords:e,current:!0,status:"success"})}(t.data,e,r),n()})).catch((function(t){!function(t,e,r){s.set(r,{coords:e,current:!0,status:"error: "+t})}(t.message,e,r),o(t)}))}))},y=function(t,e,r){var n=arguments.length>3&&void 0!==arguments[3]?arguments[3]:-9999,i=arguments.length>4&&void 0!==arguments[4]&&arguments[4],o=s.get(t);return o&&"success"===o.status?{available:!0,value:u(r,o,e.x,e.y,n,i)}:o&&"loading"===o.status?{available:!1,message:"elevationLoading"}:o&&"error"===o.status?{available:!1,message:"elevationLoadingError"}:{available:!1,message:"elevationNotAvailable"}}},333358:(t,e,r)=>{"use strict";r.d(e,{z:()=>i});var n=["application/vnd.mapbox-vector-tile","application/json;type=geojson","application/json;type=topojson"],i=function(t){return-1!==n.indexOf(t)}},73785:(t,e,r)=>{var n=r(737295),i={PARAM_OPTIONS:["layers","styles","format","transparent","version","tiled","zindex","_v_","cql_filter","sld"],wmsToLeafletOptions:function(t){var e=void 0!==t.opacity?t.opacity:1;return n({layers:t.name,styles:t.style||"",format:t.format||"image/png",transparent:void 0===t.transparent||t.transparent,tiled:void 0===t.tiled||t.tiled,opacity:e},t.params||{})},getWMSURL:function(t){return t.split("?")[0]},filterWMSParamOptions:function(t){var e={};return Object.keys(t).forEach((function(r){r&&r.toLowerCase&&i.PARAM_OPTIONS.indexOf(r.toLowerCase())>=0&&(e[r]=t[r])})),e}};t.exports=i}}]);