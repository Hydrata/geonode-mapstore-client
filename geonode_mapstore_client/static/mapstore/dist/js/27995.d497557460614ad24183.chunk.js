(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[27995],{838167:(e,t,n)=>{"use strict";n.d(t,{t6:()=>O,k9:()=>S,v0:()=>j,ZP:()=>E});var r=n(675263),o=n.n(r),i=n(124852),l=n.n(i),a=n(868195);function u(e){return u="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},u(e)}function c(){return c=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e},c.apply(this,arguments)}function s(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,y(r.key),r)}}function p(e,t,n){return t=d(t),function(e,t){if(t&&("object"===u(t)||"function"==typeof t))return t;if(void 0!==t)throw new TypeError("Derived constructors may only return object or undefined");return function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e)}(e,f()?Reflect.construct(t,n||[],d(e).constructor):t.apply(e,n))}function f(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(f=function(){return!!e})()}function d(e){return d=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(e){return e.__proto__||Object.getPrototypeOf(e)},d(e)}function m(e,t){return m=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(e,t){return e.__proto__=t,e},m(e,t)}function b(e,t,n){return(t=y(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function y(e){var t=function(e,t){if("object"!=u(e)||!e)return e;var n=e[Symbol.toPrimitive];if(void 0!==n){var r=n.call(e,"string");if("object"!=u(r))return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==u(t)?t:t+""}var v=function(e){function t(){return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),p(this,t,arguments)}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&m(e,t)}(t,e),n=t,(r=[{key:"render",value:function(){return this.context.intl?l().createElement(a.FormattedDate,c({value:this.props.value},this.props.dateParams)):l().createElement("span",null,this.props.value&&this.props.value.toString()||"")}}])&&s(n.prototype,r),Object.defineProperty(n,"prototype",{writable:!1}),n;var n,r}(l().Component);b(v,"propTypes",{value:o().object,dateParams:o().object}),b(v,"contextTypes",{intl:o().object}),b(v,"defaultProps",{value:new Date});const h=v;var w=n(615402),g=n(805346),j=g.Z,S=w.Z,O=h;const E={Message:g.Z,HTML:S,DateFormat:O}},427995:(e,t,n)=>{"use strict";n.d(t,{h:()=>I});var r=n(124852),o=n.n(r),i=n(171703),l=n(480681),a=n(855033),u=n.n(a),c=n(351288);function s(e){return s="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},s(e)}function p(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,f(r.key),r)}}function f(e){var t=function(e,t){if("object"!=s(e)||!e)return e;var n=e[Symbol.toPrimitive];if(void 0!==n){var r=n.call(e,"string");if("object"!=s(r))return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==s(t)?t:t+""}function d(e,t,n){return t=b(t),function(e,t){if(t&&("object"===s(t)||"function"==typeof t))return t;if(void 0!==t)throw new TypeError("Derived constructors may only return object or undefined");return function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e)}(e,m()?Reflect.construct(t,n||[],b(e).constructor):t.apply(e,n))}function m(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(m=function(){return!!e})()}function b(e){return b=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(e){return e.__proto__||Object.getPrototypeOf(e)},b(e)}function y(e,t){return y=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(e,t){return e.__proto__=t,e},y(e,t)}n(472619);var v=function(e){function t(){var e;return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),(e=d(this,t)).state={time:{},seconds:180},e.timer=0,e.startTimer=e.startTimer.bind(e),e.countDown=e.countDown.bind(e),e}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&y(e,t)}(t,e),n=t,(r=[{key:"componentDidMount",value:function(){this.startTimer();var e=this.secondsToTime(this.state.seconds);this.setState({time:e})}},{key:"componentDidUpdate",value:function(){}},{key:"render",value:function(){return o().createElement(o().Fragment,null,this.state.time.m,":",this.state.time.s)}},{key:"secondsToTime",value:function(e){var t=e%3600,n=t%60;return{h:Math.floor(e/3600),m:Math.floor(t/60),s:String(Math.ceil(n)).padStart(2,"0")}}},{key:"startTimer",value:function(){0===this.timer&&this.state.seconds>0&&(this.timer=setInterval(this.countDown,1e3))}},{key:"countDown",value:function(){var e=this.state.seconds-1;this.setState({time:this.secondsToTime(e),seconds:e}),0===e&&clearInterval(this.timer)}}])&&p(n.prototype,r),Object.defineProperty(n,"prototype",{writable:!1}),n;var n,r}(o().Component),h=n(838167),w=n(197395),g=n(375875),j=n.n(g),S=n(357218);function O(e){return O="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},O(e)}function E(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,V(r.key),r)}}function T(e,t,n){return t=k(t),function(e,t){if(t&&("object"===O(t)||"function"==typeof t))return t;if(void 0!==t)throw new TypeError("Derived constructors may only return object or undefined");return function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e)}(e,P()?Reflect.construct(t,n||[],k(e).constructor):t.apply(e,n))}function P(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(P=function(){return!!e})()}function k(e){return k=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(e){return e.__proto__||Object.getPrototypeOf(e)},k(e)}function F(e,t){return F=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(e,t){return e.__proto__=t,e},F(e,t)}function _(e,t,n){return(t=V(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function V(e){var t=function(e,t){if("object"!=O(e)||!e)return e;var n=e[Symbol.toPrimitive];if(void 0!==n){var r=n.call(e,"string");if("object"!=O(r))return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==O(t)?t:t+""}var x=n(675263),U=function(e){function t(e){var n;return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),_(n=T(this,t,[e]),"isBaseFile",(function(e){return["shp","tif","zip"].includes(e.extension)})),_(n,"prepareFiles",(function(e){console.log("files1: ",e),e.map((function(e){return Object.defineProperty(e,"status",{value:"begin",writable:!0}),Object.defineProperty(e,"extension",{value:e.name.split(".").slice(-1)[0],writable:!0}),e}));var t=e.findIndex((function(e){return"shp"===e.extension||"tif"===e.extension})),n=e.splice(t,1)[0];return e.unshift(n),e})),_(n,"humanFileSize",(function(e){var t=Math.floor(Math.log(e)/Math.log(1024));return 1*(e/Math.pow(1024,t)).toFixed(2)+" "+["B","kB","MB","GB","TB"][t]})),_(n,"uploadFile",(function(e){var t,r=new FormData;e.map((function(e){r.append(e.extension,e)}));var o,i=e[0];if(r.append("title",n.state.newTitle),r.append("importerTargetObjectId",null===(t=n.props)||void 0===t?void 0:t.importerTargetObjectId),n.setState((function(e){return{itemList:e.uploaderFiles.map((function(e){return e.preview===i.preview?Object.assign(e,{status:"uploading"}):e}))}})),o=n.props.serverUrl.includes("localhost")?"http://localhost:8081/":n.props.serverUrl,n.props.importerTargetObjectId){var l,a,u="".concat(o).concat(null===(l=n.props)||void 0===l||null===(a=l.config)||void 0===a?void 0:a.app_name,"/api/").concat(n.props.projectId,"/").concat(n.props.importerConfigKey,"/").concat(n.props.importerTargetObjectId,"/importer-config/");console.log("put to extend: ",u),j().put(u,r,n.uploadManager).then((function(e){n.setState((function(e){return{itemList:e.uploaderFiles.map((function(e){return e.preview===i.preview?Object.assign(e,{status:"complete"}):e}))}})),n.props.setVisibleSimpleViewAttributeForm(!0),n.props.createSimpleViewAttributeForm(null==e?void 0:e.data),console.log("tracking simpleview-uploader-complete"),S.Aw.trackEvent("process","complete","simpleview-uploader-complete")}))}else{var c,s,p="".concat(o).concat(null===(c=n.props)||void 0===c||null===(s=c.config)||void 0===s?void 0:s.app_name,"/api/").concat(n.props.projectId,"/").concat(n.props.importerConfigKey,"/importer-create/");j().put(p,r,n.uploadManager).then((function(e){var t;n.setState((function(e){return{itemList:e.uploaderFiles.map((function(e){return e.preview===i.preview?Object.assign(e,{status:"complete"}):e}))}})),null!=e&&null!==(t=e.data)&&void 0!==t&&t.form?(n.props.setVisibleSimpleViewAttributeForm(!0),n.props.createSimpleViewAttributeForm(null==e?void 0:e.data),console.log("tracking simpleview-uploader-complete"),S.Aw.trackEvent("process","complete","simpleview-uploader-complete")):n.props.show({message:"Import processing - the layer will appear when it's ready.",title:"Processing started",uid:1e3,position:"tc"})}))}})),_(n,"uploadManager",{onUploadProgress:function(e){var t=Math.round(100*e.loaded/e.total);n.props.updateUploadStatus(t)}}),n.state={uploaderFiles:[],newTitle:null},n.beginTooltip=o().createRef(),n}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&F(e,t)}(t,e),n=t,(r=[{key:"render",value:function(){var e,t,n,r,i=this;return console.log("simpleViewUploader state: ",this.state),this.props.visibleUploaderPanel?o().createElement("div",{className:"simple-view-panel uploader-panel"},o().createElement("div",{className:"row h4 legend-heading"},"Upload ",null===(e=this.props)||void 0===e||null===(t=e.config)||void 0===t?void 0:t.title," File (",null===(n=this.props)||void 0===n||null===(r=n.config)||void 0===r?void 0:r.filetype,")",o().createElement("span",{className:"btn glyphicon glyphicon-remove legend-close",onClick:function(){i.props.setVisibleUploaderPanel(!1),console.log("tracking simpleview-uploader-close"),S.Aw.trackEvent("button","click","simpleview-uploader-close")}})),this.state.uploaderFiles.length>0?o().createElement(l.Table,{bordered:!0,condensed:!0,hover:!0,ref:this.beginTooltip,style:{tableLayout:"fixed"}},o().createElement("thead",null,o().createElement("tr",null,o().createElement("th",{width:"160px",key:"hname"},"Title"),o().createElement("th",{width:"200px",key:"hname"},"Filename"),o().createElement("th",{width:"80px",key:"hsize"},"Filesize"),o().createElement("th",{width:"80px",key:"hlast"},"Modified"),o().createElement("th",{width:"80px",key:"hstatus"},"Status"))),o().createElement("tbody",null,this.state.uploaderFiles&&this.state.uploaderFiles.map((function(e,t){return o().createElement("tr",{key:"row_"+t},o().createElement("td",{key:"title"},i.isBaseFile(e)?o().createElement("input",{id:"newTitle",key:"newTitle",className:"data-title-input",type:"text",value:i.state.newTitle||e.name.split(".").slice(0)[0],onChange:function(e){return i.setState({newTitle:e.target.value})}}):""),o().createElement("td",{key:"name"},e.name),o().createElement("td",{key:"size"},i.humanFileSize(e.size)),o().createElement("td",{key:"last"},o().createElement(h.t6,{value:e.lastModifiedDate})),o().createElement("td",{key:"status"},i.isBaseFile(e)?"begin"===e.status?o().createElement(l.Button,{onClick:function(){i.uploadFile(i.state.uploaderFiles,i.props.fileType||"file"),console.log("tracking simpleview-uploader-begin"),S.Aw.trackEvent("button","click","simpleview-uploader-begin")},style:{borderRadius:"3px"},bsSize:"small",bsStyle:"success"},"Begin"):o().createElement("span",null,o().createElement(l.ProgressBar,{active:!0,bsStyle:"success",now:parseInt(i.props.uploadStatus,10)}),100===parseInt(i.props.uploadStatus,10)?o().createElement("span",null,"importing: ",o().createElement(v,null)):i.props.uploadStatus,isNaN(parseInt(i.props.uploadStatus,10))||100===parseInt(i.props.uploadStatus,10)?"":"%"):null))})))):o().createElement(u(),{key:"dropzone",rejectClassName:"alert-danger",className:"alert alert-info",onDrop:function(e){var t;return i.setState({uploaderFiles:i.prepareFiles(e),newTitle:null==e||null===(t=e[0])||void 0===t?void 0:t.name.split(".").slice(0)[0]})},style:this.props.dropZoneStyle,activeStyle:this.props.dropZoneActiveStyle},o().createElement("div",{style:{display:"flex",alignItems:"center",width:"100%",height:"100%",justifyContent:"center"}},o().createElement("span",{style:{width:"100px",height:"100px",textAlign:"center"}},o().createElement(l.Glyphicon,{glyph:"upload"}),o().createElement("br",null),"Drag files or",o().createElement("br",null),"click here")))):null}}])&&E(n.prototype,r),Object.defineProperty(n,"prototype",{writable:!1}),n;var n,r}(o().Component);_(U,"propTypes",{setVisibleUploaderPanel:x.func,updateUploaderFile:x.func,setUploaderFiles:x.func,uploaderFiles:x.object,updateUploadStatus:x.func,uploadStatus:x.string,visibleUploaderPanel:x.bool,serverUrl:x.string,projectId:x.number,newTitle:x.string,dataTypeTitle:x.string,suggestedFileType:x.string,uploadUrl:x.string,fileType:x.string,config:x.object,setVisibleSimpleViewAttributeForm:x.func,createSimpleViewAttributeForm:x.func,show:x.func,importerConfigKey:x.string,importerTargetObjectId:x.number});var I=(0,i.connect)((function(e){var t,n,r,o,i,l,a,u,c,s,p;return{visibleUploaderPanel:null==e||null===(t=e.simpleView)||void 0===t?void 0:t.visibleUploaderPanel,importerConfigKey:null==e||null===(n=e.simpleView)||void 0===n?void 0:n.importerConfigKey,config:null==e||null===(r=e.simpleView)||void 0===r||null===(o=r.config)||void 0===o||null===(i=o.importer_config)||void 0===i?void 0:i[null==e||null===(l=e.simpleView)||void 0===l?void 0:l.importerConfigKey],serverUrl:null==e||null===(a=e.gnsettings)||void 0===a?void 0:a.geonodeUrl,projectId:null==e||null===(u=e.simpleView)||void 0===u||null===(c=u.config)||void 0===c?void 0:c.project_id,uploadStatus:(null==e||null===(s=e.simpleView)||void 0===s?void 0:s.uploadStatus)||0,importerTargetObjectId:null==e||null===(p=e.simpleView)||void 0===p?void 0:p.importerTargetObjectId}}),(function(e){return{setVisibleUploaderPanel:function(t,n,r){return e((0,c.setVisibleUploaderPanel)(t,n,r))},updateUploadStatus:function(t){return e((0,c.updateUploadStatus)(t))},setVisibleSimpleViewAttributeForm:function(t){return e((0,c.setVisibleSimpleViewAttributeForm)(t))},createSimpleViewAttributeForm:function(t,n){return e((0,c.createSimpleViewAttributeForm)(t,n))},show:function(t,n){return e((0,w.show)(t,n))}}}))(U)}}]);