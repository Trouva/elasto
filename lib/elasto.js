var Promise  = require('bluebird'),
    request  = require('request'),
    _        = require('lodash');

/**
* Elasto
* @property {string} basePath - Base path for queries
*/
var Elasto = {
    basePath: null,

    /**
    * Create a new query for specified resource
    * @param {string} resourceName - Resource name
    * @example
    * var query = Elasto.query('boutiques');
    * @returns Query
    */
    query: function (resourceName) {
        return new Query(resourceName);
    },

    setMapping: function(resourceName, mapping){
        var self = this;

        self._setMapping(resourceName, mapping)
        .then(function(){
            console.log('Elasto: mapping of ' + resourceName + ' successful');
        })
        .catch(function(err){
            setTimeout(function(){
                if(err) self.setMapping(resourceName, mapping);
            }, 1000); // 1000ms check
        });
    },

    _setMapping: function(resourceName, mapping){
        var url = [this.basePath, resourceName, '_mapping'].join('/');
        var query = {};
        query[resourceName] = mapping;

        return new Promise(function (resolve, reject) {
            request({
                url: url,
                method: 'PUT',
                json: query
            }, function (err, res, body) {
                if (err || res.statusCode != 200) return reject(err || body);
                resolve(body);
            });
        });
    }
};

/**
* Query instance
* @constructor
* @param {string} resourceName - Resource name
*/
var Query = function (resourceName) {
    this.resourceName = resourceName;
    this.options = {
        filters: [],
        fields: [],
        scriptFields: {},
        sort: []
    };

    /**
    * Specify location properties for a query
    * @param {object} location - Object with lat, lon, radius properties
    * @returns Query
    * @example
    * query.near({
    *     lat: 41,
    *     lon: 13,
    *     radius: 3
    * });
    */
    this.near = function (location) {
        var radius = location.radius || 100;
        var lat = parseFloat(location.lat) || 0.1275;
        var lon = parseFloat(location.lon) || 51.5072;

        this.options.filters.push({
           geo_distance: {
               'distance': radius + 'mi',
               'distance_type': 'arc',
               'location': {
                   'lat': lat,
                   'lon': lon
               }
           }
        });

        this.sort('_geo_distance', {
            location: {
                lat: lat,
                lon: lon
            },
            order: 'asc',
            unit: 'miles'
        });

        return this;
    };

    /**
    * Set conditions for matching documents
    * @param {string} key - Key or field name
    * @param {value} value - Value for a field
    * @returns Query
    * @example
    * query.where('name', 'London')
    * query.where({
    *     name: 'London',
    *     address: 'Baker Street'
    * });
    */
    this.where = function (key, value) {
        if (typeof key === 'object') {
            var self = this;

            _.each(key, function (value, key) {
                self.where(key, value);
            });

            return this;
        }

        var condition = {};

        if (_.isArray(value)) {
            condition.terms = {};
            condition.terms[key] = value;
        } else {
            condition.term = {};
            condition.term[key] = value;
        }

        this.options.filters.push(condition);

        return this;
    };

    /**
    * Limit the number of documents in response
    * @param {number} size - number of documents to return
    * @returns Query
    * @example
    * query.size(5);
    */
    this.size = function (size) {
        this.options.size = size;
        return this;
    };

    this.limit = this.size;

    /**
    * Skip N documents
    * @param {number} from - number of documents to skip
    * @returns Query
    * @example
    * query.from(10);
    */
    this.from = function (from) {
        this.options.from = from;
        return this;
    };

    this.offset = this.from;

    /**
    * Return only specified fields
    * @param {array} keys - array of keys/fields
    * @returns Query
    * @example
    * query.fields(['name', 'address']);
    * query.fields('name', 'address');
    */
    this.fields = function (keys) {
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

    this.select = this.returns = this.fields;

    /**
    * Apply sorting
    * @param {string} key - field name
    * @param {string} order - order (asc/desc)
    * @returns Query
    * @example
    * query.sort('name', 'desc');
    * query.sort('_score');
    */
    this.sort = function (key, order) {
        if (key && order) {
            var obj = {};
            obj[key] = order;
            this.options.sort.push(obj);
        } else {
            this.options.sort.push(key);
        }

        return this;
    };

    /**
    * Perform a search
    * @returns Promise
    * @example
    * query.search().then(function (documents) {
    *
    * });
    */
    this.search = function (term) {
        var query = {
            query: {
                filtered: {
                    query: {}
                }
            }
        };

        var options = this.options;

        if (term) {
            query.query.filtered.query = {
                'query_string': {
                    query: term
                }
            };
        } else {
            query.query.filtered.query = {
                'match_all': {}
            };
        }

        if (options.fields.length) query.fields = options.fields;

        if (_.keys(options.scriptFields).length) {
            query.script_fields = options.scriptFields;
        }

        if (options.filters.length) {
            if (options.filters.length > 1) {
                query.query.filtered.filter = {
                    and: options.filters
                };
            } else {
                query.query.filtered.filter = options.filters[0];
            }
        }

        if (options.sort.length) query.sort = options.sort;
        if (options.size) query.size = options.size;
        if (options.from) query.from = options.from;

        var url = Elasto.basePath + '/' + this.resourceName + '/_search';

        return new Promise(function (resolve, reject) {
            request({
                url: url,
                method: 'POST',
                json: query
            }, function (err, res, body) {
                if (err || res.statusCode != 200) return reject(err || body);

                var documents = [];

                body.hits.hits.forEach(function (hit) {
                    var obj = hit.fields || hit._source;

                    // if geolocation type of query the response returns the distance in sort
                    if (hit.sort) obj.sort = hit.sort;

                    documents.push(obj);
                });

                resolve(documents);
            });
        });
    };
};

module.exports = Elasto;
