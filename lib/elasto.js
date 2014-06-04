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
    this.options.filters = [];
    this.options.sort = [];

    this.near = function (location) {
      var radius = location.radius || 100;
      var lat = parseFloat(location.lat) || 0.1275;
      var lon = parseFloat(location.lon) || 51.5072;

      // Filter the items in the radius (miles)
      this.options.filters.push({
        'geo_distance' : {
          'distance' : radius + 'mi',
          'distance_type' : 'arc',
          'location' : {
            'lat' : lat,
            'lon' : lon
          }
        }
      });

      // Compute the distance in miles
      this.options.script_fields = {
        'distance' : {
            'params' : {
              'lat' : lat,
              'lon' : lon
            },
            'script' : 'doc[\u0027location\u0027].arcDistance(lat,lon)'
        }
      };

      // Sort by the distance
      this.options.sort.push({
        '_geo_distance' : {
          'location' : {
            'lat' : lat,
            'lon' : lon
          },
          'order' : 'asc',
          'unit' : 'miles'
        }
      });

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
