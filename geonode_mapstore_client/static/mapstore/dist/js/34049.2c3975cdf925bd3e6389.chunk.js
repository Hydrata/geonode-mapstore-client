(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[34049],{38842:(e,t,r)=>{"use strict";r.d(t,{wk:()=>p,Yf:()=>f,c3:()=>y,fY:()=>m});var n=r(218721),o=r.n(n),i=r(227361),a=r.n(i),l=r(313311),s=r.n(l),u=r(22222),c=r(308316),p=function(e){return o()(e,"localConfig.localizedLayerStyles")},f=function(e){var t=a()(e,"localConfig.plugins.dashboard",[]),r=s()(t,(function(e){return"DashboardEditor"===e.name}))||{};return a()(r,"cfg.catalog.localizedLayerStyles",!1)},y=function(e){return a()(e,"localConfig.localizedLayerStyles.name","mapstore_language")},m=(0,u.P1)(p,y,c.KV,(function(e,t,r){var n=[];return e&&n.push({name:t,value:r}),n}))},134049:(e,t,r)=>{"use strict";r.r(t),r.d(t,{getGeomType:()=>Q,isAnnotationLayer:()=>ee,getOpacity:()=>te,preloadData:()=>re,toAbsoluteURL:()=>ne,normalizeUrl:()=>oe,getLayoutName:()=>ie,getPrintScales:()=>ae,getNearestZoom:()=>le,getMapZoom:()=>se,getMapSize:()=>ue,mapProjectionSelector:()=>ce,getMapfishPrintSpecification:()=>pe,localizationFilter:()=>fe,wfsPreloaderFilter:()=>ye,toMapfish:()=>me,getSpecTransformerChain:()=>ve,getMapTransformerChain:()=>Oe,getValidatorsChain:()=>Le,resetDefaultPrintingService:()=>Fe,addTransformer:()=>xe,addMapTransformer:()=>Pe,addValidator:()=>Ce,getDefaultPrintingService:()=>je,DEFAULT_PRINT_RATIO:()=>Te,getResolutionMultiplier:()=>we,getMapfishLayersSpecification:()=>Ee,specCreators:()=>Me,getWMTSMatrixIds:()=>ze,rgbaTorgb:()=>Ae,toOpenLayers2TextStyle:()=>Re,toOpenLayers2Style:()=>Ue,getOlDefaultStyle:()=>We});var n=r(896309),o=r(233044),i=r(552259),a=r(143378),l=r(672781),s=r(443143),u=r(45992),c=r(218056),p=r(707294),f=r(993201),y=r(218672),m=r(701469),d=r.n(m),g=r(763105),b=r.n(g),S=r(313311),h=r.n(S),v=r(441609),O=r.n(v),L=r(14841),F=r.n(L),x=r(984596),P=r.n(x),C=r(531351),j=r.n(C),T=r(432420),w=r(253231),E=r(531940),M=r.n(E),z=r(876825),A=r(38842),k=r(308316),R=r(650148),U=r(737295),W=r.n(U),G=r(189734),N=r.n(G),I=r(91175),D=r.n(I),_=r(984023),Y=["params"];function V(e){return V="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},V(e)}function X(e){return function(e){if(Array.isArray(e))return q(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||Z(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function Z(e,t){if(e){if("string"==typeof e)return q(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?q(e,t):void 0}}function q(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}function J(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function $(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?J(Object(r),!0).forEach((function(t){H(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):J(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function H(e,t,r){var n;return n=function(e,t){if("object"!=V(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=V(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(t),(t="symbol"==V(n)?n:String(n))in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}var K,B=(0,i.getGoogleMercatorScales)(0,21),Q=function(e){return e.features&&e.features[0]&&e.features[0].geometry?e.features[0].geometry.type:e.features&&e.features[0].features&&e.features[0].style&&e.features[0].style.type?e.features[0].style.type:void 0},ee=function(e){return"annotations"===e.id||"Measurements"===e.name},te=function(e){return e.opacity||(0===e.opacity?0:1)},re=function(e){var t=b()(e.layers,{type:"wfs"});return t.length>0?Promise.all(t.map((function(t){return(0,T.Bm)(t.url,t.name,$({outputFormat:"application/json",srsName:e.projection},(0,a.v)(t)||{})).then((function(e){var r=e.data;return{id:t.id,geoJson:r}}))}))).then((function(t){return $($({},e),{},{layers:(e.layers||[]).map((function(e){var r=h()(t,{id:e.id});return"wfs"===e.type&&r?$($({},e),r):e}))})})):Promise.resolve(e)},ne=function(e,t){return-1!==e.search(/^\/\//)?window.location.protocol+e:-1!==e.search(/:\/\//)?e:-1!==e.search(/^\//)?(t||window.location.origin)+e:e},oe=function(e){var t=d()(e)?e[0]:e;return-1!==t.indexOf("?")&&(t=t.substring(0,t.indexOf("?"))),K.toAbsoluteURL(t)},ie=function(e){var t=[e.sheet];return e.includeLegend?e.twoPages&&t.push("2_pages_legend"):t.push("no_legend"),e.landscape&&t.push("landscape"),t.join("_")},ae=function(e){return e.scales.slice(0).reverse().map((function(e){return parseFloat(e.value)}))||[]},le=function(e,t){var r=(arguments.length>2&&void 0!==arguments[2]?arguments[2]:B)[Math.round(e)];return t.reduce((function(e,t,n){return t<r?e:n}),0)},se=function(e,t){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:B,n=t[Math.round(e)];return r.reduce((function(e,t,r){return t<n?e:r}),0)+1},ue=function(e,t){if(e){var r=e.rotation?e.map.height:e.map.width;return{width:t,height:(e.rotation?e.map.width:e.map.height)/r*t}}return{width:100,height:100}},ce=function(e){var t,r,n;return null!==(t=null==e||null===(r=e.print)||void 0===r||null===(n=r.map)||void 0===n?void 0:n.projection)&&void 0!==t?t:"EPSG:3857"},pe=function(e,t){var r=e.params,o=$($({},function(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},i=Object.keys(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(n=0;n<i.length;n++)r=i[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}(e,Y)),r),a=ce(t),l=(0,n.reproject)(o.center,"EPSG:4326",o.projection),s=Math.round((0,i.reprojectZoom)(o.scaleZoom,a,o.projection)),u=(o.scales||(0,i.getScales)(o.projection))[s]||B[s],c=$($({},o),{},{center:l,scaleZoom:s});return $({units:(0,n.getUnits)(o.projection),srs:(0,n.normalizeSRS)(o.projection||"EPSG:3857"),layout:K.getLayoutName(c),dpi:parseInt(o.resolution,10),outputFilename:"mapstore-print",geodetic:!1,mapTitle:o.name||"",comment:o.description||"",layers:K.getMapfishLayersSpecification(o.layers,c,t,"map"),pages:[{center:[l.x,l.y],scale:u,rotation:0}],legends:K.getMapfishLayersSpecification(o.layers,c,t,"legend")},r)},fe=function(e,t){var r=(0,A.wk)(e),n=(0,A.fY)(e),o=r?$($({},t),{},{env:n,currentLanguage:(0,k.KV)(e)}):t;return Promise.resolve(o)},ye=function(e,t){return re(t)},me=function(e,t){return Promise.resolve(pe(t,e))},de=[{name:"localization",transformer:fe},{name:"wfspreloader",transformer:ye},{name:"mapfishSpecCreator",transformer:me}],ge=[],be=[],Se=[];function he(e,t){return t.reduce((function(e,t){return-1===e.findIndex((function(e){return e.name===t.name}))?[].concat(X(e),[t]):e.map((function(e){return e.name===t.name?t:e}))}),e)}function ve(){var e=de.length;return N()(he(de.map((function(e,t){return $($({},e),{},{position:t})})),ge.map((function(t,r){var n;return $($({},t),{},{position:null!==(n=t.position)&&void 0!==n?n:r+e})}))),["position"])}function Oe(){return be}function Le(){return Se}function Fe(){ge=[],be=[],Se=[]}function xe(e,t,r){ge=he(ge,[{name:e,transformer:t,position:r}])}function Pe(e,t){be=he(be,[{name:e,transformer:t}])}function Ce(e,t,r){Se=[{id:e,name:t,validator:r}].reduce((function(e,t){return-1===e.findIndex((function(e){return e.id===t.id}))?[].concat(X(e),[t]):e.map((function(e){return e.id===t.id?t:e}))}),Se)}var je=function(){return{print:function(e){var t=(0,z.bh)().getState(),r=(0,R.DX)(t),n=e?$($({},r),e):r;return ve().map((function(e){return e.transformer})).reduce((function(e,r){return e.then((function(e){return r(t,e)}))}),Promise.resolve(n))},validate:function(){var e=(0,z.bh)().getState();return Le().reduce((function(t,r){var n,o=null!==(n=t[r.name])&&void 0!==n?n:{valid:!0,errors:[]},i=r.validator(e,o);return $($({},t),{},H({},r.name,{valid:o.valid&&i.valid,errors:[].concat(X(o.errors),X(i.errors||[]))}))}),{})},getMapConfiguration:function(){var e,t=(0,z.bh)().getState();return Oe().map((function(e){return e.transformer})).reduce((function(e,r){return r(t,e)}),(null==t||null===(e=t.print)||void 0===e?void 0:e.map)||{})}}},Te=96/72;function we(e,t){return e/t*(arguments.length>2&&void 0!==arguments[2]?arguments[2]:Te)}var Ee=function(e,t,r,n){return e.filter((function(e){return K.specCreators[e.type]&&K.specCreators[e.type][n]})).map((function(e){return K.specCreators[e.type][n](e,t,r)}))},Me={wms:{map:function(e,t){return{baseURL:K.normalizeUrl(e.url)+"?",opacity:te(e),singleTile:!1,type:"WMS",layers:[e.name],format:e.format||"image/png",styles:[e.style||""],customParams:(0,o.addAuthenticationParameter)(K.normalizeUrl(e.url),W()({TRANSPARENT:!0,TILED:!0,EXCEPTIONS:"application/vnd.ogc.se_inimage",scaleMethod:"accurate",ENV:(0,w.h)(t.env)},e.baseParams||{},e.params||{},$({},(0,a.v)({layerFilter:e.layerFilter,filterObj:e.filterObj}))))}},legend:function(e,t){return{name:e.title||e.name,classes:[{name:"",icons:[K.normalizeUrl(e.url)+M().format({query:(0,o.addAuthenticationParameter)(K.normalizeUrl(e.url),$({TRANSPARENT:!0,EXCEPTIONS:"application/vnd.ogc.se_xml",VERSION:"1.1.1",SERVICE:"WMS",REQUEST:"GetLegendGraphic",LAYER:e.name,LANGUAGE:t.language||"",STYLE:e.style||"",SCALE:t.scale,height:t.iconSize,width:t.iconSize,minSymbolSize:t.iconSize,LEGEND_OPTIONS:"forceLabels:"+(t.forceLabels?"on":"")+";fontAntialiasing:"+t.antiAliasing+";dpi:"+t.legendDpi+";fontStyle:"+((t.bold?"bold":t.italic&&"italic")||"")+";fontName:"+t.fontFamily+";fontSize:"+t.fontSize,format:"image/png"},W()({},e.params)))})]}]}}},vector:{map:function(e,t){return{type:"Vector",name:e.name,opacity:te(e),styleProperty:"ms_style",styles:{1:K.toOpenLayers2Style(e,e.style),Polygon:K.toOpenLayers2Style(e,e.style,"Polygon"),LineString:K.toOpenLayers2Style(e,e.style,"LineString"),Point:K.toOpenLayers2Style(e,e.style,"Point"),FeatureCollection:K.toOpenLayers2Style(e,e.style,"FeatureCollection")},geoJson:(0,n.reprojectGeoJson)({type:"FeatureCollection",features:ee(e)||!e.style?(0,l._P)(e.features):e.features.map((function(e){return $($({},e),{},{properties:$($({},e.properties),{},{ms_style:e&&e.geometry&&e.geometry.type&&e.geometry.type.replace("Multi","")||1})})}))},"EPSG:4326",t.projection)}}},graticule:{map:function(e,t,r){var n,o,a,l,s,u=D()(null==r||null===(n=r.print)||void 0===n?void 0:n.capabilities.layouts.filter((function(e){return e.name===ie(t)}))),c=null!==(o=we(null==u||null===(a=u.map)||void 0===a?void 0:a.width,null!==(l=null===(s=t.size)||void 0===s?void 0:s.width)&&void 0!==l?l:370))&&void 0!==o?o:1,p=(0,i.getResolutionsForProjection)(t.projection).map((function(e){return e*c})),f=p[t.scaleZoom];return{type:"Vector",name:e.name||"graticule",opacity:te(e),styleProperty:"ms_style",styles:{lines:K.toOpenLayers2Style(e,e.style,"GraticuleLines"),xlabels:K.toOpenLayers2TextStyle(e,e.labelXStyle,"GraticuleXLabels"),ylabels:K.toOpenLayers2TextStyle(e,e.labelYStyle,"GraticuleYLabels"),frame:K.toOpenLayers2Style(e,e.frameStyle,"GraticuleFrame")},geoJson:(0,_.XA)({resolutions:p,mapProjection:t.projection,gridProjection:e.srs||t.projection,extent:(0,i.calculateExtent)(t.center,f,t.size,t.projection),zoom:t.scaleZoom,withLabels:!0,xLabelFormatter:e.xLabelFormatter,yLabelFormatter:e.yLabelFormatter,xLabelStyle:K.toOpenLayers2TextStyle(e,e.labelXStyle,"GraticuleXLabels"),yLabelStyle:K.toOpenLayers2TextStyle(e,e.labelYStyle,"GraticuleYLabels"),frameSize:e.frameRatio})}}},wfs:{map:function(e){return{type:"Vector",name:e.name,opacity:te(e),styleProperty:"ms_style",styles:{1:K.toOpenLayers2Style(e,e.style),Polygon:K.toOpenLayers2Style(e,e.style,"Polygon"),LineString:K.toOpenLayers2Style(e,e.style,"LineString"),Point:K.toOpenLayers2Style(e,e.style,"Point"),FeatureCollection:K.toOpenLayers2Style(e,e.style,"FeatureCollection")},geoJson:e.geoJson&&{type:"FeatureCollection",features:e.geoJson.features.map((function(e){return $($({},e),{},{properties:$($({},e.properties),{},{ms_style:e&&e.geometry&&e.geometry.type&&e.geometry.type.replace("Multi","")||1})})}))}}}},osm:{map:function(){return{baseURL:"http://a.tile.openstreetmap.org/",opacity:te(arguments.length>0&&void 0!==arguments[0]?arguments[0]:{}),singleTile:!1,type:"OSM",maxExtent:[-20037508.3392,-20037508.3392,20037508.3392,20037508.3392],tileSize:[256,256],extension:"png",resolutions:[156543.03390625,78271.516953125,39135.7584765625,19567.87923828125,9783.939619140625,4891.9698095703125,2445.9849047851562,1222.9924523925781,611.4962261962891,305.74811309814453,152.87405654907226,76.43702827453613,38.218514137268066,19.109257068634033,9.554628534317017,4.777314267158508,2.388657133579254,1.194328566789627,.5971642833948135]}}},mapquest:{map:function(){return{baseURL:"http://otile1.mqcdn.com/tiles/1.0.0/map/",opacity:te(arguments.length>0&&void 0!==arguments[0]?arguments[0]:{}),singleTile:!1,type:"OSM",maxExtent:[-20037508.3392,-20037508.3392,20037508.3392,20037508.3392],tileSize:[256,256],extension:"png",resolutions:[156543.03390625,78271.516953125,39135.7584765625,19567.87923828125,9783.939619140625,4891.9698095703125,2445.9849047851562,1222.9924523925781,611.4962261962891,305.74811309814453,152.87405654907226,76.43702827453613,38.218514137268066,19.109257068634033,9.554628534317017,4.777314267158508,2.388657133579254,1.194328566789627,.5971642833948135]}}},wmts:{map:function(e,t){var r=t.projection,n=(0,p.h7)(e,r),i=n.tileMatrixSet,a=n.tileMatrixSetName;if(!i)throw Error("tile matrix not found for pdf EPSG"+r);var l=K.getWMTSMatrixIds(e,i),s=K.normalizeUrl(P()(e.url)[0]),u={};return s.indexOf("{Style}")>=0&&(u={dimensions:["Style"],params:{STYLE:e.style}}),$($({baseURL:encodeURI(s),format:e.format||"image/png",type:"WMTS",layer:e.name,"customParams ":(0,o.addAuthenticationParameter)(e.capabilitiesURL,W()({TRANSPARENT:!0}))},u),{},{matrixIds:l,matrixSet:a,style:e.style,name:e.name,requestEncoding:"RESTful"===e.requestEncoding?"REST":e.requestEncoding||"KVP",opacity:te(e),version:e.version||"1.0.0"})}},tileprovider:{map:function(e){var t,r,n=(t=(0,u.h)(e.provider,e),r=2,function(e){if(Array.isArray(e))return e}(t)||function(e,t){var r=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null!=r){var n,o,i,a,l=[],s=!0,u=!1;try{if(i=(r=r.call(e)).next,0===t){if(Object(r)!==r)return;s=!1}else for(;!(s=(n=i.call(r)).done)&&(l.push(n.value),l.length!==t);s=!0);}catch(e){u=!0,o=e}finally{try{if(!s&&null!=r.return&&(a=r.return(),Object(a)!==a))return}finally{if(u)throw o}}return l}}(t,r)||Z(t,r)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()),o=n[0],i=n[1];if(!O()(i)){var a,l=(0,c.ut)($($({},i),{},{url:null!==(a=null==i?void 0:i.url)&&void 0!==a?a:o}));if(!l)throw Error("No base URL found for this layer");var s=l.indexOf("?"),p=l.indexOf("{"),f=l.slice(0,p),y=s<0?l.slice(p):l.slice(p,s);return{baseURL:f,path_format:y.replace("{x}","${x}").replace("{y}","${y}").replace("{z}","${z}"),type:"xyz",extension:y.split(".").pop()||"png",opacity:te(e),tileSize:[256,256],maxExtent:[-20037508.3392,-20037508.3392,20037508.3392,20037508.3392],resolutions:[156543.03390625,78271.516953125,39135.7584765625,19567.87923828125,9783.939619140625,4891.9698095703125,2445.9849047851562,1222.9924523925781,611.4962261962891,305.74811309814453,152.87405654907226,76.43702827453613,38.218514137268066,19.109257068634033,9.554628534317017,4.777314267158508,2.388657133579254,1.194328566789627,.5971642833948135].filter((function(e,t){var r=!0;return i.maxNativeZoom&&(r=r&&t<=i.maxNativeZoom),r})),customParams:Object.fromEntries(new URL(l).searchParams)}}return{}}},tms:{map:function(e){var t=e.tileMapUrl.split(e.tileMapService+"/")[1];return{type:"tms",opacity:te(e),layer:t,baseURL:e.tileMapService.substring(0,e.tileMapService.lastIndexOf("/1.0.0")),tileSize:e.tileSize,format:(0,f.A)(e.tileMapUrl),maxExtent:[-20037508.3392,-20037508.3392,20037508.3392,20037508.3392],resolutions:e.tileSets.map((function(e){return e.resolution}))}}}},ze=function(e,t){var r=[],o=(0,n.normalizeSRS)(e.srs||"EPSG:3857",e.allowedSRS),i=(0,y.U2)(o).getMetersPerUnit();return t&&t.TileMatrix.map((function(e){var t=e["ows:Identifier"],n=28e-5*e.ScaleDenominator/i,o=[F()(e.TileWidth),F()(e.TileHeight)],a=e.TopLeftCorner&&e.TopLeftCorner.split(" ").map((function(e){return F()(e)})),l=[F()(e.MatrixWidth),F()(e.MatrixHeight)];return r.push({identifier:t,matrixSize:l,resolution:n,tileSize:o,topLeftCorner:a})})),r},Ae=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"";return-1!==e.indexOf("rgba")?"rgb".concat(e.slice(e.indexOf("("),e.lastIndexOf(",")),")"):e};function ke(e,t){return["start"===e?"l":"end"===e?"r":"c","top"===t?"t":"bottom"===t?"b":"m"].join("")}var Re=function(e,t,r){if(!t)return K.getOlDefaultStyle(e,r);switch(r){case"GraticuleXLabels":return{fontColor:t.color||"#000000",fontFamily:t.font||"12px Calibri,sans-serif",fontWeight:t.fontWeight||"bold",fontSize:t.fontSize||"14",label:"{properties.valueText}",labelAlign:ke(t.textAlign||"center",t.verticalAlign||"bottom"),labelOutlineColor:t.labelOutlineColor||"#FFFFFF",labelOutlineWidth:t.labelOutlineWidth/4||.5,rotation:t.rotation?-t.rotation:0};case"GraticuleYLabels":return{fontColor:t.color||"#000000",fontFamily:t.font||"12px Calibri,sans-serif",fontWeight:t.fontWeight||"bold",fontSize:t.fontSize||"14",label:"{properties.valueText}",labelAlign:ke(t.textAlign||"end",t.verticalAlign||"middle"),labelOutlineColor:t.labelOutlineColor||"#FFFFFF",labelOutlineWidth:t.labelOutlineWidth/4||.5,rotation:t.rotation?-t.rotation:0};default:return{fontColor:"#000000",fontFamily:"12px Calibri,sans-serif",fontWeight:"bold",fontSize:"14",label:"{properties.valueText}",labelAlign:"cb",labelOutlineColor:"#FFFFFF",labelOutlineWidth:.5}}},Ue=function(e,t,r){return t&&"marker"!==e.styleName?{fillColor:(0,s.qj)(t.fillColor),fillOpacity:t.fillOpacity,externalGraphic:t.iconUrl,pointRadius:t.radius,strokeColor:(0,s.qj)(t.color),strokeOpacity:t.opacity,strokeWidth:t.weight,strokeDashstyle:t.lineDash?j()(t.lineDash).join(" "):void 0}:K.getOlDefaultStyle(e,r)},We=function(e,t){switch(t||Q(e)||""){case"Polygon":case"MultiPolygon":return{fillColor:"#0000FF",fillOpacity:.1,strokeColor:"#0000FF",strokeOpacity:1,strokeWidth:3,strokeDashstyle:"dash",strokeLinecap:"round"};case"MultiLineString":case"LineString":return{strokeColor:"#0000FF",strokeOpacity:1,strokeWidth:3};case"Point":case"MultiPoint":return"marker"===e.styleName?{externalGraphic:"http://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.3/images/marker-icon.png",graphicWidth:25,graphicHeight:41,graphicXOffset:-12,graphicYOffset:-41}:{fillColor:"#FF0000",fillOpacity:0,strokeColor:"#FF0000",pointRadius:5,strokeOpacity:1,strokeWidth:1};case"GraticuleLines":return{strokeColor:"#ff7800",strokeOpacity:.9,strokeWidth:2,strokeDashstyle:"4 0.5"};case"GraticuleFrame":return{strokeColor:"#000000",strokeOpacity:1,strokeWidth:1,fillColor:"#FFFFFF",fillOpacity:1};case"GraticuleXLabels":return{fontColor:"#000000",fontFamily:"12px Calibri,sans-serif",fontWeight:"bold",fontSize:"14",label:"{properties.valueText}",labelAlign:"cb",labelOutlineColor:"#FFFFFF",labelOutlineWidth:.5};case"GraticuleYLabels":return{fontColor:"#000000",fontFamily:"12px Calibri,sans-serif",fontWeight:"bold",fontSize:"14",label:"{properties.valueText}",labelAlign:"rm",labelOutlineColor:"#FFFFFF",labelOutlineWidth:.5};default:return{fillColor:"#0000FF",fillOpacity:.1,strokeColor:"#0000FF",pointRadius:5,strokeOpacity:1,strokeWidth:1}}};K={toAbsoluteURL:ne,getLayoutName:ie,getMapfishLayersSpecification:Ee,specCreators:Me,normalizeUrl:oe,toOpenLayers2Style:Ue,toOpenLayers2TextStyle:Re,getWMTSMatrixIds:ze,getOlDefaultStyle:We}},993201:(e,t,r)=>{"use strict";r.d(t,{A:()=>i});var n=r(264721),o=r.n(n),i=function(){var e=(arguments.length>0&&void 0!==arguments[0]?arguments[0]:"").split("?")[0].split("@");if(e.length>1){var t=e[e.length-1];if(o()(["png","png8","jpeg","vnd.jpeg-png","gif"],t))return t}return null}}}]);