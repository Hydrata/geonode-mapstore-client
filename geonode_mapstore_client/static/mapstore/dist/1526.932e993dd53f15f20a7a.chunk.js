(self.webpackChunkgeonode_mapstore_client=self.webpackChunkgeonode_mapstore_client||[]).push([[1526],{98989:(e,t,a)=>{var r=a(30146),i=a(16989),n=a(93889),l=a(30851);e.exports=function(e,t,a){return e=l(e),a=null==a?0:r(n(a),0,e.length),t=i(t),e.slice(a,a+t.length)==t}},69555:(e,t)=>{"use strict";e.exports=function(e){var t=e||"-9,999.90";t=t.trim();var a="",r="",i="",n=-1,l=-1,o="",f="";for(/^([^()]+)?[(]([^09#]+)?[09#., ]+([^)]+)?[)](.+)?$/.test(t)?(a="brackets",i="(",o=(l=t.indexOf("("))>0?t.slice(0,l):t.search(/0|9|#/)>0?t.slice(1,t.search(/0|9|#/)):"",r=")",(n=(t=t.slice(o.length+1)).indexOf(")"))<t.length-1?(f=t.slice(n+1),t=t.slice(0,n)):(f=t.search(/[^09#,.]([^09#](.+)?)?[)]$/)>-1?t.slice(t.search(/[^09#,.]([^09#](.+)?)?[)]$/),-1):"",t=t.slice(0,t.length-f.length-1),n=0)):-1===t.indexOf("-")?(a="none",o=t.search(/[.,]?[09#]/)>0?t.slice(0,t.search(/[.,]?[09#]/)):"",f=(t=t.slice(o.length)).search(/[^09#,.]([^09#]+|$)/)>-1?t.slice(t.search(/[^09#,.]([^09#]+|$)/)):"",t=t.slice(0,t.length-f.length)):/^([^09#-]+)?-.+$/.test(t)?(a="left",i="-",o=(l=t.indexOf("-"))>0?t.slice(0,l):t.search(/[09#]/)>0?t.slice(1,t.search(/[09#]/)):"",f=(t=t.slice(o.length+1)).search(/[^09#,.]([^09#]+|$)/)>-1?t.slice(t.search(/[^09#,.]([^09#]+|$)/)):"",t=t.slice(0,t.length-f.length)):(o=t.search(/[09#]/)>0?t.slice(0,t.search(/[09#]/)):"",a="right",r="-",(n=(t=t.slice(o.length)).lastIndexOf("-"))<t.length-1?(f=t.slice(n+1),t=t.slice(0,n)):(f=t.search(/[^09#,.]([^09#](.+)?)?-$/)>-1?t.slice(t.search(/[^09#,.]([^09#](.+)?)?-$/),t.length-1):"",t=t.slice(0,t.length-f.length-1),n=0));0===l&&o&&" "===o[0];)i+=" ",o=o.slice(1);for(;0===n&&f&&" "===f[f.length-1];)r=" "+r,f=f.slice(0,-1);for(;l>0&&t.length&&" "===t[0];)i+=" ",t=t.slice(1);for(;n>0&&t.length&&" "===t[t.length-1];)r=" "+r,t=t.slice(0,-1);var s=t,g="",c="",u="",h="",p="";for(","===t[t.length-1]&&t.indexOf(",")===t.length-1?g=",":t.indexOf(".")>-1?g=t.indexOf(".")===t.lastIndexOf(".")?".":",":t.indexOf(",")>-1&&(g=t.indexOf(",")===t.lastIndexOf(",")?",":"."),g&&t.indexOf(g)>-1?(c=t.slice(t.indexOf(g)+1),u=t.slice(0,t.indexOf(g))):(u=t,c="");c.length&&c.search(/[., ]$/)>-1;)c=c.slice(0,-1);for(;u.length&&u[0].search(/[., ]/)>-1;)u=u.slice(1);return u&&u.search(/[., ]/)>0&&(p=u[u.search(/[., ]/)],u=u.replace(/[., ]/g,"")),c&&c.search(/[., ]/)>0&&(h=c[c.search(/[., ]/)],c=c.replace(/[., ]/g,"")),!(u.length&&!/^[09#]+$/.test(u)||c.length&&!/^[09#]+$/.test(c))&&{negativeType:a,negativeLeftPos:l,negativeRightPos:n,negativeLeftSymbol:i,negativeRightSymbol:r,suffix:f,prefix:o,absMask:s,decimalChar:g,integerSeparator:p,decimalsSeparator:h,padLeft:u.indexOf("0")>=0?u.length-u.indexOf("0"):-1,maxLeft:0===u.length||"0"===u[0]||"9"===u[0]?u.length:-1,padRight:c.indexOf("0")>=0?c.lastIndexOf("0")+1:-1,maxRight:0===c.length||"0"===c[c.length-1]||"9"===c[c.length-1]?c.length:-1}}},95877:(e,t,a)=>{"use strict";var r=a(69555),i=a(10793);e.exports=function(e,t,a){var n=[];return t&&(n=r(t.trim())),e=null===e?"":e,e=(e+="").length?e.trim():"",i({negativeType:n.negativeType,negativeLeftSymbol:n.negativeLeftSymbol,negativeRightSymbol:n.negativeRightSymbol,negativeLeftOut:0===n.negativeLeftPos,negativeRightOut:0===n.negativeRightPos,prefix:n.prefix,suffix:n.suffix,integerSeparator:n.integerSeparator,decimalsSeparator:n.decimalsSeparator,decimal:n.decimalChar,padLeft:n.padLeft,padRight:n.padRight,round:n.maxRight,truncate:null})(e,a)}},10793:e=>{e.exports=function(e){if((e=e||{}).negativeType=e.negativeType||("R"===e.negative?"right":"left"),"string"!=typeof e.negativeLeftSymbol)switch(e.negativeType){case"left":e.negativeLeftSymbol="-";break;case"brackets":e.negativeLeftSymbol="(";break;default:e.negativeLeftSymbol=""}if("string"!=typeof e.negativeRightSymbol)switch(e.negativeType){case"right":e.negativeRightSymbol="-";break;case"brackets":e.negativeRightSymbol=")";break;default:e.negativeRightSymbol=""}function t(t,a){if(a=a||{},!t&&0!==t)return"";var r,i,n=[],l="-"===(t=""+t).charAt(0);return t=t.replace(/^\-/g,""),e.negativeLeftOut||a.noUnits||n.push(e.prefix),l&&n.push(e.negativeLeftSymbol),e.negativeLeftOut&&!a.noUnits&&n.push(e.prefix),t=t.split("."),null!=e.round&&function(e,t){if(e[1]&&t>=0&&e[1].length>t){var a=e[1].slice(0,t);if(+e[1].substr(t,1)>=5){for(var r="";"0"===a.charAt(0);)r+="0",a=a.substr(1);(a=r+(a=+a+1+"")).length>t&&(e[0]=+e[0]+ +a.charAt(0)+"",a=a.substring(1))}e[1]=a}}(t,e.round),null!=e.truncate&&(t[1]=(r=t[1],i=e.truncate,r&&(r+=""),r&&r.length>i?r.substr(0,i):r)),e.padLeft>0&&(t[0]=function(e,t){e+="";for(var a=[];a.length+e.length<t;)a.push("0");return a.join("")+e}(t[0],e.padLeft)),e.padRight>0&&(t[1]=function(e,t){e?e+="":e="";for(var a=[];a.length+e.length<t;)a.push("0");return e+a.join("")}(t[1],e.padRight)),!a.noSeparator&&t[1]&&(t[1]=function(e,t){if(e+="",!t)return e;for(var a=/(\d{3})(\d+)/;a.test(e);)e=e.replace(a,"$1"+t+"$2");return e}(t[1],e.decimalsSeparator)),!a.noSeparator&&t[0]&&(t[0]=function(e,t){if(e+="",!t)return e;for(var a=/(\d+)(\d{3})/;a.test(e);)e=e.replace(a,"$1"+t+"$2");return e}(t[0],e.integerSeparator)),n.push(t[0]),t[1]&&(n.push(e.decimal),n.push(t[1])),e.negativeRightOut&&!a.noUnits&&n.push(e.suffix),l&&n.push(e.negativeRightSymbol),e.negativeRightOut||a.noUnits||n.push(e.suffix),n.join("")}return"boolean"!=typeof e.negativeLeftOut&&(e.negativeLeftOut=!1!==e.negativeOut),"boolean"!=typeof e.negativeRightOut&&(e.negativeRightOut=!1!==e.negativeOut),e.prefix=e.prefix||"",e.suffix=e.suffix||"","string"!=typeof e.integerSeparator&&(e.integerSeparator="string"==typeof e.separator?e.separator:","),e.decimalsSeparator="string"==typeof e.decimalsSeparator?e.decimalsSeparator:"",e.decimal=e.decimal||".",e.padLeft=e.padLeft||-1,e.padRight=e.padRight||-1,t.negative=e.negative,t.negativeOut=e.negativeOut,t.negativeType=e.negativeType,t.negativeLeftOut=e.negativeLeftOut,t.negativeLeftSymbol=e.negativeLeftSymbol,t.negativeRightOut=e.negativeRightOut,t.negativeRightSymbol=e.negativeRightSymbol,t.prefix=e.prefix,t.suffix=e.suffix,t.separate=e.separate,t.integerSeparator=e.integerSeparator,t.decimalsSeparator=e.decimalsSeparator,t.decimal=e.decimal,t.padLeft=e.padLeft,t.padRight=e.padRight,t.truncate=e.truncate,t.round=e.round,t.unformat=function(t,a){a=a||[],e.allowedSeparators&&e.allowedSeparators.forEach((function(e){a.push(e)})),a.push(e.integerSeparator),a.push(e.decimalsSeparator);var r=t=(t=t.replace(e.prefix,"")).replace(e.suffix,"");do{t=r;for(var i=0;i<a.length;i++)r=r.replace(a[i],"")}while(r!=t);return t},t}},93054:(e,t,a)=>{"use strict";t.__esModule=!0,t.default=function(e){if("function"!=typeof e)throw new TypeError("You must provide a valid moment object");var t="function"==typeof e().locale?"locale":"lang";if(!e.localeData)throw new TypeError("The Moment localizer depends on the `localeData` api, please provide a moment object v2.2.0 or higher");function a(a,r,i){return a?e(r,i)[t](a):e(r,i)}var r={formats:{date:"L",time:"LT",default:"lll",header:"MMMM YYYY",footer:"LL",weekday:"dd",dayOfMonth:"DD",month:"MMM",year:"YYYY",decade:function(t,a,r){return r.format(t,"YYYY",a)+" - "+r.format(function(t){return e(t).add(10,"year").add(-1,"millisecond").toDate()}(t),"YYYY",a)},century:function(t,a,r){return r.format(t,"YYYY",a)+" - "+r.format(function(t){return e(t).add(100,"year").add(-1,"millisecond").toDate()}(t),"YYYY",a)}},firstOfWeek:function(t){return e.localeData(t).firstDayOfWeek()},parse:function(e,t,r){if(!e)return null;var i=a(r,e,t);return i.isValid()?i.toDate():null},format:function(e,t,r){return a(r,e).format(t)}};return i.default.setDateLocalizer(r),r};var r,i=(r=a(77036))&&r.__esModule?r:{default:r};e.exports=t.default},9886:(e,t,a)=>{"use strict";t.__esModule=!0;var r=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var a=arguments[t];for(var r in a)Object.prototype.hasOwnProperty.call(a,r)&&(e[r]=a[r])}return e};t.default=function(e){var t=r({},f,e),a=t.decimal,o={formats:{default:"-#"+t.grouping+"##0"+a},parse:function(e,t,a){if(a){var r=(0,l.default)(a),i=r.negativeLeftSymbol&&-1!==e.indexOf(r.negativeLeftSymbol)||r.negativeRightSymbol&&-1!==e.indexOf(r.negativeRightSymbol),n=(e=e.replace(r.negativeLeftSymbol,"").replace(r.negativeRightSymbol,"").replace(r.prefix,"").replace(r.suffix,"")).split(r.decimalChar);r.integerSeperator&&(n[0]=n[0].replace(new RegExp("\\"+r.integerSeperator,"g"))),r.decimalsSeparator&&(n[1]=n[1].replace(new RegExp("\\"+r.decimalsSeparator,"g"))),""===n[1]&&n.pop(),e=+(e=n.join(".")),i&&(e*=-1)}else e=parseFloat(e);return isNaN(e)?null:e},format:function(e,t){return(0,n.default)(e,t)},decimalChar:function(e){return e&&(0,l.default)(e).decimalsSeparator||"."},precision:function(e){var t=(0,l.default)(e);return-1!==t.maxRight?t.maxRight:null}};return i.default.setNumberLocalizer(o),o};var i=o(a(77036)),n=o(a(95877)),l=o(a(69555));function o(e){return e&&e.__esModule?e:{default:e}}var f={decimal:".",grouping:","};e.exports=t.default}}]);