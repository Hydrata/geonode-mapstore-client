(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[89252],{399534:(e,t,n)=>{"use strict";n.d(t,{Z:()=>u});var r=n(461365),o=n(569334);const u=(0,r.Z)(o.h_)},450514:(e,t,n)=>{"use strict";n.r(t),n.d(t,{default:()=>S});var r=n(124852),o=n.n(r),u=n(675263),a=n.n(u),i=n(171703),c=n(227361),l=n.n(c),p=n(399534),s=n(694745),f=n(805346),d=n(757588),b=n(782904),m=n(580416),y=n(322843);function g(e){return g="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},g(e)}function h(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function v(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,P(r.key),r)}}function w(e,t){return w=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(e,t){return e.__proto__=t,e},w(e,t)}function O(e,t){if(t&&("object"===g(t)||"function"==typeof t))return t;if(void 0!==t)throw new TypeError("Derived constructors may only return object or undefined");return E(e)}function E(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function C(e){return C=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(e){return e.__proto__||Object.getPrototypeOf(e)},C(e)}function j(e,t,n){return(t=P(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function P(e){var t=function(e,t){if("object"!==g(e)||null===e)return e;var n=e[Symbol.toPrimitive];if(void 0!==n){var r=n.call(e,"string");if("object"!==g(r))return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"===g(t)?t:String(t)}var _=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&w(e,t)}(i,e);var t,n,r,u,a=(r=i,u=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=C(r);if(u){var n=C(this).constructor;e=Reflect.construct(t,arguments,n)}else e=t.apply(this,arguments);return O(this,e)});function i(){var e;h(this,i);for(var t=arguments.length,n=new Array(t),r=0;r<t;r++)n[r]=arguments[r];return j(E(e=a.call.apply(a,[this].concat(n))),"state",{groupName:""}),j(E(e),"changeName",(function(t){e.setState({groupName:t.target.value})})),j(E(e),"isValid",(function(e){return""!==e})),e}return t=i,(n=[{key:"UNSAFE_componentWillReceiveProps",value:function(e){e.enabled&&!this.props.enabled&&this.setState({groupName:""})}},{key:"render",value:function(){var e=this;return o().createElement(p.Z,null,o().createElement(s.Z,{size:"xs",clickOutEnabled:!1,showClose:!1,title:o().createElement(f.Z,{msgId:"toc.addGroup"}),show:this.props.enabled,buttons:[{text:o().createElement(f.Z,{msgId:"cancel"}),onClick:function(){e.props.onClose()}},{bsStyle:"primary",disabled:!this.isValid(this.state.groupName),text:o().createElement(f.Z,{msgId:"addgroup.addbtn"}),onClick:function(){e.props.onAdd(e.state.groupName,e.props.parent),e.props.onClose()}}]},o().createElement("div",{id:"mapstore-add-toc-group"},o().createElement(d.FormGroup,null,o().createElement("label",{htmlFor:"groupName"},o().createElement(f.Z,{msgId:"addgroup.groupName"})),o().createElement(d.FormControl,{name:"groupName",onChange:this.changeName,value:this.state.groupName})))))}}])&&v(t.prototype,n),Object.defineProperty(t,"prototype",{writable:!1}),i}(r.Component);j(_,"propTypes",{enabled:a().bool,parent:a().string,onClose:a().func,onAdd:a().func}),j(_,"defaultProps",{enabled:!1,parent:null,onClose:function(){},onAdd:function(){}});var N=(0,i.connect)((function(e){return{enabled:l()(e,"controls.addgroup.enabled",!1),parent:l()(e,"controls.addgroup.parent",null)}}),{onClose:b.pu.bind(null,"addgroup","enabled",!1,"parent",null),onAdd:m.Rp})(_);const S=(0,y.rx)("AddGroup",{component:N,containers:{TOC:{doNotHide:!0,name:"AddGroup"}}})},819081:(e,t,n)=>{"use strict";e.exports=n(1174)}}]);