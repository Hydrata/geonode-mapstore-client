(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[4551],{25548:(t,e,r)=>{var o=r(6583),i=r(93889),n=r(89796),s=r(30851),a=o.isFinite,u=Math.min;t.exports=function(t){var e=Math[t];return function(t,r){if(t=n(t),(r=null==r?0:u(i(r),292))&&a(t)){var o=(s(t)+"e").split("e"),l=e(o[0]+"e"+(+o[1]+r));return+((o=(s(l)+"e").split("e"))[0]+"e"+(+o[1]-r))}return e(t)}}},39145:(t,e,r)=>{var o=r(21072),i=r(93889);t.exports=function(t,e,r){var n=null==t?0:t.length;return n?(e=r||void 0===e?1:i(e),o(t,0,(e=n-e)<0?0:e)):[]}},37422:(t,e,r)=>{var o=r(25548)("round");t.exports=o},47735:(t,e,r)=>{"use strict";r.d(e,{Z:()=>s});var o=r(29346);function i(t,e,r){if(null!==t)for(var o,n,s,a,u,l,f,h,c=0,d=0,p=t.type,g="FeatureCollection"===p,y="Feature"===p,v=g?t.features.length:1,C=0;C<v;C++){u=(h=!!(f=g?t.features[C].geometry:y?t.geometry:t)&&"GeometryCollection"===f.type)?f.geometries.length:1;for(var m=0;m<u;m++){var k=0,P=0;if(null!==(a=h?f.geometries[m]:f)){l=a.coordinates;var w=a.type;switch(c=!r||"Polygon"!==w&&"MultiPolygon"!==w?0:1,w){case null:break;case"Point":if(!1===e(l,d,C,k,P))return!1;d++,k++;break;case"LineString":case"MultiPoint":for(o=0;o<l.length;o++){if(!1===e(l[o],d,C,k,P))return!1;d++,"MultiPoint"===w&&k++}"LineString"===w&&k++;break;case"Polygon":case"MultiLineString":for(o=0;o<l.length;o++){for(n=0;n<l[o].length-c;n++){if(!1===e(l[o][n],d,C,k,P))return!1;d++}"MultiLineString"===w&&k++,"Polygon"===w&&P++}"Polygon"===w&&k++;break;case"MultiPolygon":for(o=0;o<l.length;o++){for("MultiPolygon"===w&&(P=0),n=0;n<l[o].length;n++){for(s=0;s<l[o][n].length-c;s++){if(!1===e(l[o][n][s],d,C,k,P))return!1;d++}P++}k++}break;case"GeometryCollection":for(o=0;o<a.geometries.length;o++)if(!1===i(a.geometries[o],e,r))return!1;break;default:throw new Error("Unknown Geometry Type")}}}}}const n=function(t){var e=[1/0,1/0,-1/0,-1/0];return i(t,(function(t){e[0]>t[0]&&(e[0]=t[0]),e[1]>t[1]&&(e[1]=t[1]),e[2]<t[0]&&(e[2]=t[0]),e[3]<t[1]&&(e[3]=t[1])})),e},s=function(t,e){if(e=e||{},!(0,o.Kn)(e))throw new Error("options is invalid");var r=e.properties;if(!t)throw new Error("geojson is required");var i=n(t),s=(i[0]+i[2])/2,a=(i[1]+i[3])/2;return(0,o.xm)([s,a],r)}},69669:(t,e,r)=>{"use strict";r.d(e,{Z:()=>u});var o=r(21915),i=r(28795),n=r(32538),s=r(38667),a=function(t){function e(e,r,o){if(t.call(this),void 0!==o&&void 0===r)this.setFlatCoordinates(o,e);else{var i=r||0;this.setCenterAndRadius(e,i,o)}}return t&&(e.__proto__=t),e.prototype=Object.create(t&&t.prototype),e.prototype.constructor=e,e.prototype.clone=function(){return new e(this.flatCoordinates.slice(),void 0,this.layout)},e.prototype.closestPointXY=function(t,e,r,o){var i=this.flatCoordinates,n=t-i[0],s=e-i[1],a=n*n+s*s;if(a<o){if(0===a)for(var u=0;u<this.stride;++u)r[u]=i[u];else{var l=this.getRadius()/Math.sqrt(a);r[0]=i[0]+l*n,r[1]=i[1]+l*s;for(var f=2;f<this.stride;++f)r[f]=i[f]}return r.length=this.stride,a}return o},e.prototype.containsXY=function(t,e){var r=this.flatCoordinates,o=t-r[0],i=e-r[1];return o*o+i*i<=this.getRadiusSquared_()},e.prototype.getCenter=function(){return this.flatCoordinates.slice(0,this.stride)},e.prototype.computeExtent=function(t){var e=this.flatCoordinates,r=e[this.stride]-e[0];return(0,o.T9)(e[0]-r,e[1]-r,e[0]+r,e[1]+r,t)},e.prototype.getRadius=function(){return Math.sqrt(this.getRadiusSquared_())},e.prototype.getRadiusSquared_=function(){var t=this.flatCoordinates[this.stride]-this.flatCoordinates[0],e=this.flatCoordinates[this.stride+1]-this.flatCoordinates[1];return t*t+e*e},e.prototype.getType=function(){return i.Z.CIRCLE},e.prototype.intersectsExtent=function(t){var e=this.getExtent();if((0,o.kK)(t,e)){var r=this.getCenter();return t[0]<=r[0]&&t[2]>=r[0]||t[1]<=r[1]&&t[3]>=r[1]||(0,o.H6)(t,this.intersectsCoordinate,this)}return!1},e.prototype.setCenter=function(t){var e=this.stride,r=this.flatCoordinates[e]-this.flatCoordinates[0],o=t.slice();o[e]=o[0]+r;for(var i=1;i<e;++i)o[e+i]=t[i];this.setFlatCoordinates(this.layout,o),this.changed()},e.prototype.setCenterAndRadius=function(t,e,r){this.setLayout(r,t,0),this.flatCoordinates||(this.flatCoordinates=[]);var o=this.flatCoordinates,i=(0,s.IG)(o,0,t,this.stride);o[i++]=o[0]+e;for(var n=1,a=this.stride;n<a;++n)o[i++]=o[n];o.length=i,this.changed()},e.prototype.getCoordinates=function(){return null},e.prototype.setCoordinates=function(t,e){},e.prototype.setRadius=function(t){this.flatCoordinates[this.stride]=this.flatCoordinates[0]+t,this.changed()},e}(n.ZP);a.prototype.transform;const u=a}}]);