(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[68784],{909211:(e,t,r)=>{"use strict";r.d(t,{Z:()=>a});var o=r(61351),n=r(838815),i=r(726659),s=r(149232);const a=function(e){function t(t){if(e.call(this),this.id_=void 0,this.geometryName_="geometry",this.style_=null,this.styleFunction_=void 0,this.geometryChangeKey_=null,(0,n.oL)(this,(0,s.v_)(this.geometryName_),this.handleGeometryChanged_,this),t)if("function"==typeof t.getSimplifiedGeometry){var r=t;this.setGeometry(r)}else{var o=t;this.setProperties(o)}}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.clone=function(){var e=new t(this.getProperties());e.setGeometryName(this.getGeometryName());var r=this.getGeometry();r&&e.setGeometry(r.clone());var o=this.getStyle();return o&&e.setStyle(o),e},t.prototype.getGeometry=function(){return this.get(this.geometryName_)},t.prototype.getId=function(){return this.id_},t.prototype.getGeometryName=function(){return this.geometryName_},t.prototype.getStyle=function(){return this.style_},t.prototype.getStyleFunction=function(){return this.styleFunction_},t.prototype.handleGeometryChange_=function(){this.changed()},t.prototype.handleGeometryChanged_=function(){this.geometryChangeKey_&&((0,n.bN)(this.geometryChangeKey_),this.geometryChangeKey_=null);var e=this.getGeometry();e&&(this.geometryChangeKey_=(0,n.oL)(e,i.Z.CHANGE,this.handleGeometryChange_,this)),this.changed()},t.prototype.setGeometry=function(e){this.set(this.geometryName_,e)},t.prototype.setStyle=function(e){var t,r;this.style_=e,this.styleFunction_=e?"function"==typeof(t=e)?t:(Array.isArray(t)?r=t:((0,o.h)("function"==typeof t.getZIndex,41),r=[t]),function(){return r}):void 0,this.changed()},t.prototype.setId=function(e){this.id_=e,this.changed()},t.prototype.setGeometryName=function(e){(0,n.Ev)(this,(0,s.v_)(this.geometryName_),this.handleGeometryChanged_,this),this.geometryName_=e,(0,n.oL)(this,(0,s.v_)(this.geometryName_),this.handleGeometryChanged_,this),this.handleGeometryChanged_()},t}(s.ZP)},69371:(e,t,r)=>{"use strict";r.d(t,{Z:()=>a,j:()=>u});var o=r(624242),n=r(194719),i=r(164547),s=function(){this.dataProjection=null,this.defaultFeatureProjection=null};s.prototype.getReadOptions=function(e,t){var r;return t&&(r={dataProjection:t.dataProjection?t.dataProjection:this.readProjection(e),featureProjection:t.featureProjection}),this.adaptOptions(r)},s.prototype.adaptOptions=function(e){return(0,o.f0)({dataProjection:this.dataProjection,featureProjection:this.defaultFeatureProjection},e)},s.prototype.getLastExtent=function(){return null},s.prototype.getType=function(){return(0,n.O3)()},s.prototype.readFeature=function(e,t){return(0,n.O3)()},s.prototype.readFeatures=function(e,t){return(0,n.O3)()},s.prototype.readGeometry=function(e,t){return(0,n.O3)()},s.prototype.readProjection=function(e){return(0,n.O3)()},s.prototype.writeFeature=function(e,t){return(0,n.O3)()},s.prototype.writeFeatures=function(e,t){return(0,n.O3)()},s.prototype.writeGeometry=function(e,t){return(0,n.O3)()};const a=s;function u(e,t,r){var o,n=r?(0,i.U2)(r.featureProjection):null,s=r?(0,i.U2)(r.dataProjection):null;if(o=n&&s&&!(0,i.OP)(n,s)?Array.isArray(e)?(0,i.$A)(e,s,n):(t?e.clone():e).transform(t?n:s,t?s:n):e,t&&r&&void 0!==r.decimals&&!Array.isArray(o)){var a=Math.pow(10,r.decimals);o===e&&(o=e.clone()),o.applyTransform((function(e){for(var t=0,r=e.length;t<r;++t)e[t]=Math.round(e[t]*a)/a;return e}))}return o}},90988:(e,t,r)=>{"use strict";r.d(t,{Z:()=>o});const o={ARRAY_BUFFER:"arraybuffer",JSON:"json",TEXT:"text",XML:"xml"}},368784:(e,t,r)=>{"use strict";r.d(t,{Z:()=>O});var o=r(61351),n=r(909211),i=r(69371),s=r(98279),a=r(76625),u=r(888272),c=r(359995),p=r(643267),y=r(796069),h=r(310699),m=r(668612),f=r(624242),l=r(164547),g=r(880559);function d(e,t){if(!e)return null;var r;switch(e.type){case g.Z.POINT:r=function(e){return new h.Z(e.coordinates)}(e);break;case g.Z.LINE_STRING:r=function(e){return new u.Z(e.coordinates)}(e);break;case g.Z.POLYGON:r=function(e){return new m.ZP(e.coordinates)}(e);break;case g.Z.MULTI_POINT:r=function(e){return new p.Z(e.coordinates)}(e);break;case g.Z.MULTI_LINE_STRING:r=function(e){return new c.Z(e.coordinates)}(e);break;case g.Z.MULTI_POLYGON:r=function(e){return new y.Z(e.coordinates)}(e);break;case g.Z.GEOMETRY_COLLECTION:r=function(e,t){var r=e.geometries.map((function(e){return d(e,undefined)}));return new a.default(r)}(e);break;default:throw new Error("Unsupported GeoJSON type: "+e.type)}return(0,i.j)(r,!1,t)}function _(e,t){var r,o=(e=(0,i.j)(e,!0,t)).getType();switch(o){case g.Z.POINT:r=function(e,t){return{type:"Point",coordinates:e.getCoordinates()}}(e);break;case g.Z.LINE_STRING:r=function(e,t){return{type:"LineString",coordinates:e.getCoordinates()}}(e);break;case g.Z.POLYGON:r=function(e,t){var r;return t&&(r=t.rightHanded),{type:"Polygon",coordinates:e.getCoordinates(r)}}(e,t);break;case g.Z.MULTI_POINT:r=function(e,t){return{type:"MultiPoint",coordinates:e.getCoordinates()}}(e);break;case g.Z.MULTI_LINE_STRING:r=function(e,t){return{type:"MultiLineString",coordinates:e.getCoordinates()}}(e);break;case g.Z.MULTI_POLYGON:r=function(e,t){var r;return t&&(r=t.rightHanded),{type:"MultiPolygon",coordinates:e.getCoordinates(r)}}(e,t);break;case g.Z.GEOMETRY_COLLECTION:r=function(e,t){return{type:"GeometryCollection",geometries:e.getGeometriesArray().map((function(e){var r=(0,f.f0)({},t);return delete r.featureProjection,_(e,r)}))}}(e,t);break;case g.Z.CIRCLE:r={type:"GeometryCollection",geometries:[]};break;default:throw new Error("Unsupported geometry type: "+o)}return r}const O=function(e){function t(t){var r=t||{};e.call(this),this.dataProjection=(0,l.U2)(r.dataProjection?r.dataProjection:"EPSG:4326"),r.featureProjection&&(this.defaultFeatureProjection=(0,l.U2)(r.featureProjection)),this.geometryName_=r.geometryName,this.extractGeometryName_=r.extractGeometryName}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.readFeatureFromObject=function(e,t){var r,o=d((r="Feature"===e.type?e:{type:"Feature",geometry:e,properties:null}).geometry,t),i=new n.Z;return this.geometryName_?i.setGeometryName(this.geometryName_):this.extractGeometryName_&&"geometry_name"in r!==void 0&&i.setGeometryName(r.geometry_name),i.setGeometry(o),"id"in r&&i.setId(r.id),r.properties&&i.setProperties(r.properties),i},t.prototype.readFeaturesFromObject=function(e,t){var r=null;if("FeatureCollection"===e.type){r=[];for(var o=e.features,n=0,i=o.length;n<i;++n)r.push(this.readFeatureFromObject(o[n],t))}else r=[this.readFeatureFromObject(e,t)];return r},t.prototype.readGeometryFromObject=function(e,t){return d(e,t)},t.prototype.readProjectionFromObject=function(e){var t,r=e.crs;return r?"name"==r.type?t=(0,l.U2)(r.properties.name):(0,o.h)(!1,36):t=this.dataProjection,t},t.prototype.writeFeatureObject=function(e,t){t=this.adaptOptions(t);var r={type:"Feature",geometry:null,properties:null},o=e.getId();void 0!==o&&(r.id=o);var n=e.getGeometry();n&&(r.geometry=_(n,t));var i=e.getProperties();return delete i[e.getGeometryName()],(0,f.xb)(i)||(r.properties=i),r},t.prototype.writeFeaturesObject=function(e,t){t=this.adaptOptions(t);for(var r=[],o=0,n=e.length;o<n;++o)r.push(this.writeFeatureObject(e[o],t));return{type:"FeatureCollection",features:r}},t.prototype.writeGeometryObject=function(e,t){return _(e,this.adaptOptions(t))},t}(s.Z)},98279:(e,t,r)=>{"use strict";r.d(t,{Z:()=>a});var o=r(194719),n=r(69371),i=r(90988);function s(e){return"string"==typeof e?JSON.parse(e)||null:null!==e?e:null}const a=function(e){function t(){e.call(this)}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.getType=function(){return i.Z.JSON},t.prototype.readFeature=function(e,t){return this.readFeatureFromObject(s(e),this.getReadOptions(e,t))},t.prototype.readFeatures=function(e,t){return this.readFeaturesFromObject(s(e),this.getReadOptions(e,t))},t.prototype.readFeatureFromObject=function(e,t){return(0,o.O3)()},t.prototype.readFeaturesFromObject=function(e,t){return(0,o.O3)()},t.prototype.readGeometry=function(e,t){return this.readGeometryFromObject(s(e),this.getReadOptions(e,t))},t.prototype.readGeometryFromObject=function(e,t){return(0,o.O3)()},t.prototype.readProjection=function(e){return this.readProjectionFromObject(s(e))},t.prototype.readProjectionFromObject=function(e){return(0,o.O3)()},t.prototype.writeFeature=function(e,t){return JSON.stringify(this.writeFeatureObject(e,t))},t.prototype.writeFeatureObject=function(e,t){return(0,o.O3)()},t.prototype.writeFeatures=function(e,t){return JSON.stringify(this.writeFeaturesObject(e,t))},t.prototype.writeFeaturesObject=function(e,t){return(0,o.O3)()},t.prototype.writeGeometry=function(e,t){return JSON.stringify(this.writeGeometryObject(e,t))},t.prototype.writeGeometryObject=function(e,t){return(0,o.O3)()},t}(n.Z)},76625:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>p});var o=r(838815),n=r(726659),i=r(187982),s=r(598816),a=r(880559),u=r(624242);function c(e){for(var t=[],r=0,o=e.length;r<o;++r)t.push(e[r].clone());return t}const p=function(e){function t(t){e.call(this),this.geometries_=t||null,this.listenGeometriesChange_()}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.unlistenGeometriesChange_=function(){if(this.geometries_)for(var e=0,t=this.geometries_.length;e<t;++e)(0,o.Ev)(this.geometries_[e],n.Z.CHANGE,this.changed,this)},t.prototype.listenGeometriesChange_=function(){if(this.geometries_)for(var e=0,t=this.geometries_.length;e<t;++e)(0,o.oL)(this.geometries_[e],n.Z.CHANGE,this.changed,this)},t.prototype.clone=function(){var e=new t(null);return e.setGeometries(this.geometries_),e},t.prototype.closestPointXY=function(e,t,r,o){if(o<(0,i.qf)(this.getExtent(),e,t))return o;for(var n=this.geometries_,s=0,a=n.length;s<a;++s)o=n[s].closestPointXY(e,t,r,o);return o},t.prototype.containsXY=function(e,t){for(var r=this.geometries_,o=0,n=r.length;o<n;++o)if(r[o].containsXY(e,t))return!0;return!1},t.prototype.computeExtent=function(e){(0,i.YN)(e);for(var t=this.geometries_,r=0,o=t.length;r<o;++r)(0,i.l7)(e,t[r].getExtent());return e},t.prototype.getGeometries=function(){return c(this.geometries_)},t.prototype.getGeometriesArray=function(){return this.geometries_},t.prototype.getSimplifiedGeometry=function(e){if(this.simplifiedGeometryRevision!=this.getRevision()&&((0,u.ZH)(this.simplifiedGeometryCache),this.simplifiedGeometryMaxMinSquaredTolerance=0,this.simplifiedGeometryRevision=this.getRevision()),e<0||0!==this.simplifiedGeometryMaxMinSquaredTolerance&&e<this.simplifiedGeometryMaxMinSquaredTolerance)return this;var r=e.toString();if(this.simplifiedGeometryCache.hasOwnProperty(r))return this.simplifiedGeometryCache[r];for(var o=[],n=this.geometries_,i=!1,s=0,a=n.length;s<a;++s){var c=n[s],p=c.getSimplifiedGeometry(e);o.push(p),p!==c&&(i=!0)}if(i){var y=new t(null);return y.setGeometriesArray(o),this.simplifiedGeometryCache[r]=y,y}return this.simplifiedGeometryMaxMinSquaredTolerance=e,this},t.prototype.getType=function(){return a.Z.GEOMETRY_COLLECTION},t.prototype.intersectsExtent=function(e){for(var t=this.geometries_,r=0,o=t.length;r<o;++r)if(t[r].intersectsExtent(e))return!0;return!1},t.prototype.isEmpty=function(){return 0===this.geometries_.length},t.prototype.rotate=function(e,t){for(var r=this.geometries_,o=0,n=r.length;o<n;++o)r[o].rotate(e,t);this.changed()},t.prototype.scale=function(e,t,r){var o=r;o||(o=(0,i.qg)(this.getExtent()));for(var n=this.geometries_,s=0,a=n.length;s<a;++s)n[s].scale(e,t,o);this.changed()},t.prototype.setGeometries=function(e){this.setGeometriesArray(c(e))},t.prototype.setGeometriesArray=function(e){this.unlistenGeometriesChange_(),this.geometries_=e,this.listenGeometriesChange_(),this.changed()},t.prototype.applyTransform=function(e){for(var t=this.geometries_,r=0,o=t.length;r<o;++r)t[r].applyTransform(e);this.changed()},t.prototype.translate=function(e,t){for(var r=this.geometries_,o=0,n=r.length;o<n;++o)r[o].translate(e,t);this.changed()},t.prototype.disposeInternal=function(){this.unlistenGeometriesChange_(),e.prototype.disposeInternal.call(this)},t}(s.Z)}}]);