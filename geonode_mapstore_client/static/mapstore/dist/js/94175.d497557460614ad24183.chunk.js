(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[94175],{39480:(t,e,i)=>{"use strict";i.d(e,{Z:()=>a});var s=i(187982),o=i(880559),n=i(190109),h=i(63190),r=function(t){function e(e,i,s){if(t.call(this),void 0!==s&&void 0===i)this.setFlatCoordinates(s,e);else{var o=i||0;this.setCenterAndRadius(e,o,s)}}return t&&(e.__proto__=t),e.prototype=Object.create(t&&t.prototype),e.prototype.constructor=e,e.prototype.clone=function(){return new e(this.flatCoordinates.slice(),void 0,this.layout)},e.prototype.closestPointXY=function(t,e,i,s){var o=this.flatCoordinates,n=t-o[0],h=e-o[1],r=n*n+h*h;if(r<s){if(0===r)for(var a=0;a<this.stride;++a)i[a]=o[a];else{var d=this.getRadius()/Math.sqrt(r);i[0]=o[0]+d*n,i[1]=o[1]+d*h;for(var _=2;_<this.stride;++_)i[_]=o[_]}return i.length=this.stride,r}return s},e.prototype.containsXY=function(t,e){var i=this.flatCoordinates,s=t-i[0],o=e-i[1];return s*s+o*o<=this.getRadiusSquared_()},e.prototype.getCenter=function(){return this.flatCoordinates.slice(0,this.stride)},e.prototype.computeExtent=function(t){var e=this.flatCoordinates,i=e[this.stride]-e[0];return(0,s.T9)(e[0]-i,e[1]-i,e[0]+i,e[1]+i,t)},e.prototype.getRadius=function(){return Math.sqrt(this.getRadiusSquared_())},e.prototype.getRadiusSquared_=function(){var t=this.flatCoordinates[this.stride]-this.flatCoordinates[0],e=this.flatCoordinates[this.stride+1]-this.flatCoordinates[1];return t*t+e*e},e.prototype.getType=function(){return o.Z.CIRCLE},e.prototype.intersectsExtent=function(t){var e=this.getExtent();if((0,s.kK)(t,e)){var i=this.getCenter();return t[0]<=i[0]&&t[2]>=i[0]||t[1]<=i[1]&&t[3]>=i[1]||(0,s.H6)(t,this.intersectsCoordinate,this)}return!1},e.prototype.setCenter=function(t){var e=this.stride,i=this.flatCoordinates[e]-this.flatCoordinates[0],s=t.slice();s[e]=s[0]+i;for(var o=1;o<e;++o)s[e+o]=t[o];this.setFlatCoordinates(this.layout,s),this.changed()},e.prototype.setCenterAndRadius=function(t,e,i){this.setLayout(i,t,0),this.flatCoordinates||(this.flatCoordinates=[]);var s=this.flatCoordinates,o=(0,h.IG)(s,0,t,this.stride);s[o++]=s[0]+e;for(var n=1,r=this.stride;n<r;++n)s[o++]=s[n];s.length=o,this.changed()},e.prototype.getCoordinates=function(){return null},e.prototype.setCoordinates=function(t,e){},e.prototype.setRadius=function(t){this.flatCoordinates[this.stride]=this.flatCoordinates[0]+t,this.changed()},e}(n.ZP);r.prototype.transform;const a=r},994175:(t,e,i)=>{"use strict";i.d(e,{ZP:()=>x});var s=i(726659),o=i(909211),n=i(495397),h=i(422074),r=i(149232),a=i(77394),d=i(838815),_=i(109608),c=i(682980),u=i(324919),l=i(39480),p=i(880559),f=i(888272),y=i(359995),C=i(643267),g=i(796069),m=i(308128),k=i(310699),v=i(668612),w=i(769254),T=i(673751),P=i(326700),F=i(135218),Z=i(287299),L="Point",D="LineString",E="Polygon",N="Circle",I="drawstart",O=function(t){function e(e,i){t.call(this,e),this.feature=i}return t&&(e.__proto__=t),e.prototype=Object.create(t&&t.prototype),e.prototype.constructor=e,e}(_.ZP);const x=function(t){function e(e){var i=e;i.stopDown||(i.stopDown=u.Dv),t.call(this,i),this.shouldHandle_=!1,this.downPx_=null,this.downTimeout_,this.lastDragTime_,this.freehand_=!1,this.source_=e.source?e.source:null,this.features_=e.features?e.features:null,this.snapTolerance_=e.snapTolerance?e.snapTolerance:12,this.type_=e.type,this.mode_=function(t){var e;return t===p.Z.POINT||t===p.Z.MULTI_POINT?e=L:t===p.Z.LINE_STRING||t===p.Z.MULTI_LINE_STRING?e=D:t===p.Z.POLYGON||t===p.Z.MULTI_POLYGON?e=E:t===p.Z.CIRCLE&&(e=N),e}(this.type_),this.stopClick_=!!e.stopClick,this.minPoints_=e.minPoints?e.minPoints:this.mode_===E?3:2,this.maxPoints_=e.maxPoints?e.maxPoints:1/0,this.finishCondition_=e.finishCondition?e.finishCondition:u.uX;var s,o=e.geometryFunction;if(!o)if(this.type_===p.Z.CIRCLE)o=function(t,e){var i=e||new l.Z([NaN,NaN]),s=(0,a.bI)(t[0],t[1]);return i.setCenterAndRadius(t[0],Math.sqrt(s)),i};else{var n,h=this.mode_;h===L?n=k.Z:h===D?n=f.Z:h===E&&(n=v.ZP),o=function(t,e){var i=e;return i?h===E?t[0].length?i.setCoordinates([t[0].concat([t[0][0]])]):i.setCoordinates([]):i.setCoordinates(t):i=new n(t),i}}this.geometryFunction_=o,this.dragVertexDelay_=void 0!==e.dragVertexDelay?e.dragVertexDelay:500,this.finishCoordinate_=null,this.sketchFeature_=null,this.sketchPoint_=null,this.sketchCoords_=null,this.sketchLine_=null,this.sketchLineCoords_=null,this.squaredClickTolerance_=e.clickTolerance?e.clickTolerance*e.clickTolerance:36,this.overlay_=new P.Z({source:new F.Z({useSpatialIndex:!1,wrapX:!!e.wrapX&&e.wrapX}),style:e.style?e.style:(s=(0,Z.createEditingStyle)(),function(t,e){return s[t.getGeometry().getType()]}),updateWhileInteracting:!0}),this.geometryName_=e.geometryName,this.condition_=e.condition?e.condition:c.rM,this.freehandCondition_,e.freehand?this.freehandCondition_=c.Bx:this.freehandCondition_=e.freehandCondition?e.freehandCondition:c.vY,(0,d.oL)(this,(0,r.v_)(T.Z.ACTIVE),this.updateState_,this)}return t&&(e.__proto__=t),e.prototype=Object.create(t&&t.prototype),e.prototype.constructor=e,e.prototype.setMap=function(e){t.prototype.setMap.call(this,e),this.updateState_()},e.prototype.getOverlay=function(){return this.overlay_},e.prototype.handleEvent=function(e){e.originalEvent.type===s.Z.CONTEXTMENU&&e.preventDefault(),this.freehand_=this.mode_!==L&&this.freehandCondition_(e);var i=e.type===n.Z.POINTERMOVE,o=!0;return!this.freehand_&&this.lastDragTime_&&e.type===n.Z.POINTERDRAG&&(Date.now()-this.lastDragTime_>=this.dragVertexDelay_?(this.downPx_=e.pixel,this.shouldHandle_=!this.freehand_,i=!0):this.lastDragTime_=void 0,this.shouldHandle_&&void 0!==this.downTimeout_&&(clearTimeout(this.downTimeout_),this.downTimeout_=void 0)),this.freehand_&&e.type===n.Z.POINTERDRAG&&null!==this.sketchFeature_?(this.addToDrawing_(e),o=!1):this.freehand_&&e.type===n.Z.POINTERDOWN?o=!1:i?(o=e.type===n.Z.POINTERMOVE)&&this.freehand_?o=this.handlePointerMove_(e):(e.pointerEvent.pointerType==m.T2||e.type===n.Z.POINTERDRAG&&void 0===this.downTimeout_)&&this.handlePointerMove_(e):e.type===n.Z.DBLCLICK&&(o=!1),t.prototype.handleEvent.call(this,e)&&o},e.prototype.handleDownEvent=function(t){return this.shouldHandle_=!this.freehand_,this.freehand_?(this.downPx_=t.pixel,this.finishCoordinate_||this.startDrawing_(t),!0):!!this.condition_(t)&&(this.lastDragTime_=Date.now(),this.downTimeout_=setTimeout(function(){this.handlePointerMove_(new h.Z(n.Z.POINTERMOVE,t.map,t.pointerEvent,!1,t.frameState))}.bind(this),this.dragVertexDelay_),this.downPx_=t.pixel,!0)},e.prototype.handleUpEvent=function(t){var e=!0;this.downTimeout_&&(clearTimeout(this.downTimeout_),this.downTimeout_=void 0),this.handlePointerMove_(t);var i=this.mode_===N;return this.shouldHandle_?(this.finishCoordinate_?this.freehand_||i?this.finishDrawing():this.atFinish_(t)?this.finishCondition_(t)&&this.finishDrawing():this.addToDrawing_(t):(this.startDrawing_(t),this.mode_===L&&this.finishDrawing()),e=!1):this.freehand_&&(this.finishCoordinate_=null,this.abortDrawing_()),!e&&this.stopClick_&&t.stopPropagation(),e},e.prototype.handlePointerMove_=function(t){if(this.downPx_&&(!this.freehand_&&this.shouldHandle_||this.freehand_&&!this.shouldHandle_)){var e=this.downPx_,i=t.pixel,s=e[0]-i[0],o=e[1]-i[1],n=s*s+o*o;if(this.shouldHandle_=this.freehand_?n>this.squaredClickTolerance_:n<=this.squaredClickTolerance_,!this.shouldHandle_)return!0}return this.finishCoordinate_?this.modifyDrawing_(t):this.createOrUpdateSketchPoint_(t),!0},e.prototype.atFinish_=function(t){var e=!1;if(this.sketchFeature_){var i=!1,s=[this.finishCoordinate_];if(this.mode_===D)i=this.sketchCoords_.length>this.minPoints_;else if(this.mode_===E){var o=this.sketchCoords_;i=o[0].length>this.minPoints_,s=[o[0][0],o[0][o[0].length-2]]}if(i)for(var n=t.map,h=0,r=s.length;h<r;h++){var a=s[h],d=n.getPixelFromCoordinate(a),_=t.pixel,c=_[0]-d[0],u=_[1]-d[1],l=this.freehand_?1:this.snapTolerance_;if(e=Math.sqrt(c*c+u*u)<=l){this.finishCoordinate_=a;break}}}return e},e.prototype.createOrUpdateSketchPoint_=function(t){var e=t.coordinate.slice();this.sketchPoint_?this.sketchPoint_.getGeometry().setCoordinates(e):(this.sketchPoint_=new o.Z(new k.Z(e)),this.updateSketchFeatures_())},e.prototype.startDrawing_=function(t){var e=t.coordinate;this.finishCoordinate_=e,this.mode_===L?this.sketchCoords_=e.slice():this.mode_===E?(this.sketchCoords_=[[e.slice(),e.slice()]],this.sketchLineCoords_=this.sketchCoords_[0]):this.sketchCoords_=[e.slice(),e.slice()],this.sketchLineCoords_&&(this.sketchLine_=new o.Z(new f.Z(this.sketchLineCoords_)));var i=this.geometryFunction_(this.sketchCoords_);this.sketchFeature_=new o.Z,this.geometryName_&&this.sketchFeature_.setGeometryName(this.geometryName_),this.sketchFeature_.setGeometry(i),this.updateSketchFeatures_(),this.dispatchEvent(new O(I,this.sketchFeature_))},e.prototype.modifyDrawing_=function(t){var e,i,s,n=t.coordinate,h=this.sketchFeature_.getGeometry();if(this.mode_===L?i=this.sketchCoords_:this.mode_===E?(i=(e=this.sketchCoords_[0])[e.length-1],this.atFinish_(t)&&(n=this.finishCoordinate_.slice())):i=(e=this.sketchCoords_)[e.length-1],i[0]=n[0],i[1]=n[1],this.geometryFunction_(this.sketchCoords_,h),this.sketchPoint_&&this.sketchPoint_.getGeometry().setCoordinates(n),h.getType()==p.Z.POLYGON&&this.mode_!==E){this.sketchLine_||(this.sketchLine_=new o.Z);var r=h.getLinearRing(0);(s=this.sketchLine_.getGeometry())?(s.setFlatCoordinates(r.getLayout(),r.getFlatCoordinates()),s.changed()):(s=new f.Z(r.getFlatCoordinates(),r.getLayout()),this.sketchLine_.setGeometry(s))}else this.sketchLineCoords_&&(s=this.sketchLine_.getGeometry()).setCoordinates(this.sketchLineCoords_);this.updateSketchFeatures_()},e.prototype.addToDrawing_=function(t){var e,i,s=t.coordinate,o=this.sketchFeature_.getGeometry();this.mode_===D?(this.finishCoordinate_=s.slice(),(i=this.sketchCoords_).length>=this.maxPoints_&&(this.freehand_?i.pop():e=!0),i.push(s.slice()),this.geometryFunction_(i,o)):this.mode_===E&&((i=this.sketchCoords_[0]).length>=this.maxPoints_&&(this.freehand_?i.pop():e=!0),i.push(s.slice()),e&&(this.finishCoordinate_=i[0]),this.geometryFunction_(this.sketchCoords_,o)),this.updateSketchFeatures_(),e&&this.finishDrawing()},e.prototype.removeLastPoint=function(){if(this.sketchFeature_){var t,e=this.sketchFeature_.getGeometry();this.mode_===D?((t=this.sketchCoords_).splice(-2,1),this.geometryFunction_(t,e),t.length>=2&&(this.finishCoordinate_=t[t.length-2].slice())):this.mode_===E&&((t=this.sketchCoords_[0]).splice(-2,1),this.sketchLine_.getGeometry().setCoordinates(t),this.geometryFunction_(this.sketchCoords_,e)),0===t.length&&(this.finishCoordinate_=null),this.updateSketchFeatures_()}},e.prototype.finishDrawing=function(){var t=this.abortDrawing_();if(t){var e=this.sketchCoords_,i=t.getGeometry();this.mode_===D?(e.pop(),this.geometryFunction_(e,i)):this.mode_===E&&(e[0].pop(),this.geometryFunction_(e,i),e=i.getCoordinates()),this.type_===p.Z.MULTI_POINT?t.setGeometry(new C.Z([e])):this.type_===p.Z.MULTI_LINE_STRING?t.setGeometry(new y.Z([e])):this.type_===p.Z.MULTI_POLYGON&&t.setGeometry(new g.Z([e])),this.dispatchEvent(new O("drawend",t)),this.features_&&this.features_.push(t),this.source_&&this.source_.addFeature(t)}},e.prototype.abortDrawing_=function(){this.finishCoordinate_=null;var t=this.sketchFeature_;return t&&(this.sketchFeature_=null,this.sketchPoint_=null,this.sketchLine_=null,this.overlay_.getSource().clear(!0)),t},e.prototype.extend=function(t){var e=t.getGeometry();this.sketchFeature_=t,this.sketchCoords_=e.getCoordinates();var i=this.sketchCoords_[this.sketchCoords_.length-1];this.finishCoordinate_=i.slice(),this.sketchCoords_.push(i.slice()),this.updateSketchFeatures_(),this.dispatchEvent(new O(I,this.sketchFeature_))},e.prototype.updateSketchFeatures_=function(){var t=[];this.sketchFeature_&&t.push(this.sketchFeature_),this.sketchLine_&&t.push(this.sketchLine_),this.sketchPoint_&&t.push(this.sketchPoint_);var e=this.overlay_.getSource();e.clear(!0),e.addFeatures(t)},e.prototype.updateState_=function(){var t=this.getMap(),e=this.getActive();t&&e||this.abortDrawing_(),this.overlay_.setMap(e?t:null)},e}(w.Z)}}]);