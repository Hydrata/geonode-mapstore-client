(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[20940],{399534:(t,e,n)=>{"use strict";n.d(e,{Z:()=>i});var r=n(461365),o=n(569334);const i=(0,r.Z)(o.h_)},556724:(t,e,n)=>{"use strict";n.d(e,{Z:()=>E});var r=n(124852),o=n.n(r),i=n(426656),c=n.n(i),u=n(675263),a=n.n(u),f=n(868195),s=n(86638),l=n(399534),p=["notifications","onRemove"];function y(t){return y="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},y(t)}function b(){return b=Object.assign?Object.assign.bind():function(t){for(var e=1;e<arguments.length;e++){var n=arguments[e];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(t[r]=n[r])}return t},b.apply(this,arguments)}function m(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(t);e&&(r=r.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.push.apply(n,r)}return n}function v(t){for(var e=1;e<arguments.length;e++){var n=null!=arguments[e]?arguments[e]:{};e%2?m(Object(n),!0).forEach((function(e){P(t,e,n[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(n)):m(Object(n)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(n,e))}))}return t}function O(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function d(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,S(r.key),r)}}function h(t,e){return h=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(t,e){return t.__proto__=e,t},h(t,e)}function g(t,e){if(e&&("object"===y(e)||"function"==typeof e))return e;if(void 0!==e)throw new TypeError("Derived constructors may only return object or undefined");return j(t)}function j(t){if(void 0===t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return t}function w(t){return w=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(t){return t.__proto__||Object.getPrototypeOf(t)},w(t)}function P(t,e,n){return(e=S(e))in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}function S(t){var e=function(t,e){if("object"!==y(t)||null===t)return t;var n=t[Symbol.toPrimitive];if(void 0!==n){var r=n.call(t,"string");if("object"!==y(r))return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(t)}(t);return"symbol"===y(e)?e:String(e)}var R=function(t){!function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function");t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,writable:!0,configurable:!0}}),Object.defineProperty(t,"prototype",{writable:!1}),e&&h(t,e)}(a,t);var e,n,r,i,u=(r=a,i=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(t){return!1}}(),function(){var t,e=w(r);if(i){var n=w(this).constructor;t=Reflect.construct(e,arguments,n)}else t=e.apply(this,arguments);return g(this,t)});function a(){var t;O(this,a);for(var e=arguments.length,n=new Array(e),r=0;r<e;r++)n[r]=arguments[r];return P(j(t=u.call.apply(u,[this].concat(n))),"system",(function(){return t.refs.notify})),P(j(t),"updateNotifications",(function(e){var n=e.map((function(t){return t.uid})),r=t.system().state.notifications||[];r.forEach((function(e){n.indexOf(e.uid)<0&&t.system().removeNotification(e.uid)})),e.forEach((function(e){if(r.indexOf(e.uid)<0){var n,o=e.message,i=(0,s.S$)(t.context.messages,o);n=e.values?(0,t.props.intl.formatMessage)(n=(0,f.defineMessages)({id:o,defaultMessage:i}),e.values):i||o,t.system().addNotification(v(v({},e),{},{title:(0,s.S$)(t.context.messages,e.title)||e.title,message:n,action:e.action&&{label:(0,s.S$)(t.context.messages,e.action.label)||e.action.label,callback:e.action.dispatch?function(){t.props.onDispatch(e.action.dispatch)}:e.action.callback},onRemove:function(){t.props.onRemove(e.uid),e.onRemove&&e.onRemove()}}))}}))})),t}return e=a,(n=[{key:"componentDidMount",value:function(){this.updateNotifications(this.props.notifications)}},{key:"componentDidUpdate",value:function(){var t=(this.props||[]).notifications;this.updateNotifications(t)}},{key:"render",value:function(){var t=this.props,e=(t.notifications,t.onRemove,function(t,e){if(null==t)return{};var n,r,o=function(t,e){if(null==t)return{};var n,r,o={},i=Object.keys(t);for(r=0;r<i.length;r++)n=i[r],e.indexOf(n)>=0||(o[n]=t[n]);return o}(t,e);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(t);for(r=0;r<i.length;r++)n=i[r],e.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(t,n)&&(o[n]=t[n])}return o}(t,p));return o().createElement(l.Z,null,o().createElement(c(),b({ref:"notify"},e)))}}])&&d(e.prototype,n),Object.defineProperty(e,"prototype",{writable:!1}),a}(o().Component);P(R,"propTypes",{notifications:a().array,intl:f.intlShape.isRequired,onRemove:a().func,onDispatch:a().func}),P(R,"contextTypes",{messages:a().object}),P(R,"defaultProps",{notifications:[],onRemove:function(){},onDispatch:function(){}});const E=(0,f.injectIntl)(R)},20301:(t,e,n)=>{"use strict";n.d(e,{R:()=>u});var r=n(49977),o=n.n(r),i=n(197395),c=n(275982),u=function(t){return t.ofType(c.nk).switchMap((function(){return o().Observable.of((0,i.ZH)())}))}},157355:(t,e,n)=>{"use strict";n.r(e),n.d(e,{default:()=>u});var r=n(171703),o=n(197395),i=n(556724),c=n(20301);const u={NotificationsPlugin:(0,r.connect)((function(t){return{notifications:t&&t.notifications}}),{onRemove:o.Cp,onDispatch:o.Ce})(i.Z),reducers:{notifications:n(897080).Z},epics:{clearNotificationOnLocationChange:c.R}}},897080:(t,e,n)=>{"use strict";n.d(e,{Z:()=>p});var r=n(197395);function o(t){return o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},o(t)}var i=["type"];function c(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(t);e&&(r=r.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.push.apply(n,r)}return n}function u(t){for(var e=1;e<arguments.length;e++){var n=null!=arguments[e]?arguments[e]:{};e%2?c(Object(n),!0).forEach((function(e){a(t,e,n[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(n)):c(Object(n)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(n,e))}))}return t}function a(t,e,n){return(e=function(t){var e=function(t,e){if("object"!==o(t)||null===t)return t;var n=t[Symbol.toPrimitive];if(void 0!==n){var r=n.call(t,"string");if("object"!==o(r))return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(t)}(t);return"symbol"===o(e)?e:String(e)}(e))in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}function f(t){return function(t){if(Array.isArray(t))return s(t)}(t)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||function(t,e){if(t){if("string"==typeof t)return s(t,e);var n=Object.prototype.toString.call(t).slice(8,-1);return"Object"===n&&t.constructor&&(n=t.constructor.name),"Map"===n||"Set"===n?Array.from(t):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?s(t,e):void 0}}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function s(t,e){(null==e||e>t.length)&&(e=t.length);for(var n=0,r=new Array(e);n<e;n++)r[n]=t[n];return r}function l(t,e){if(null==t)return{};var n,r,o=function(t,e){if(null==t)return{};var n,r,o={},i=Object.keys(t);for(r=0;r<i.length;r++)n=i[r],e.indexOf(n)>=0||(o[n]=t[n]);return o}(t,e);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(t);for(r=0;r<i.length;r++)n=i[r],e.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(t,n)&&(o[n]=t[n])}return o}const p=function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:[],e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:{};switch(e.type){case r.e2:e.type;var n=l(e,i);return[].concat(f(t),[u({},n)]);case r.Zz:return t.filter((function(t){return t.uid!==e.uid}));case r.wt:return[];default:return t}}}}]);