// From lo-dash
// https://github.com/lodash/lodash/blob/2.4.1/dist/lodash.compat.js#L1921
var isArray = Array.isArray || function(value) {
    var toString = Object.prototype.toString;
    return value && typeof value == 'object' && typeof value.length == 'number' &&
    toString.call(value) == '[object Array]' || false;
};

module.exports.isArray = isArray;
