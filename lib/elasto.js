var Promise  = require('bluebird'),
request  = require('request'),
_        = require('lodash');

var Elasto = {
    basePath: null,

    connect: function (url) {
        this.basePath = url;
    },

    query: function (resource) {
        return new Query({ name: resource });
    }
};

var Query = function (options) {
    this.resourceName = options.name;
    this.options = {};

    this.near = function (location) {
        this.options = location;
        return this;
    };

    this.where = function (key, value) {
        var conditions = this.options.conditions || {};

        if (typeof key === 'object') {
            _.extend(conditions, key);
        } else {
            conditions[key] = value;
        }
        
        this.options.conditions = conditions;

        return this;
    };

    this.size = this.limit = function (size) {
        this.options.size = size;
        return this;
    };

    this.from = this.offset = function (from) {
        this.options.from = from;
        return this;  
    };

    this.fields = this.select = this.returns = function (keys) {
        var fields = [];
        
        if (_.isArray(keys)) {
            fields = keys;
        } else {
            _.each(arguments, function (arg, index) {
                fields.push(arg);
            });
        }
        
        this.options.fields = fields;
        return this;
    };

    this.find = function () {
        var url = Elasto.basePath + '/' + this.resourceName + '/_search';

        return new Promise(function (resolve, reject) {
            request({
                url: url,
                method: 'GET'
            }, function (err, res, body) {
                if (err) return reject(err);

                var response = JSON.parse(body);
                var documents = [];

                response.hits.hits.forEach(function (hit) {
                    documents.push(hit._source);
                });

                resolve(documents);
            });
        });
    };

    this.search = function () {
        console.log(this.options);  
    };
};

module.exports = Elasto;