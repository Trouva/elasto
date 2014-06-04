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
    this.options = options;

    this.find = function () {
        var url = Elasto.basePath + '/' + this.options.name + '/_search';
        
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
};

module.exports = Elasto;