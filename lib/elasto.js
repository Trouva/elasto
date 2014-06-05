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
        filters: {},
        fields: [],
        scriptFields: {},
        conditions: {},
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

        this.options.filters['geo_distance'] = {
            'distance': radius + 'mi',
            'distance_type': 'arc',
            'location': {
                'lat': lat,
                'lon': lon
            }
        };

        this.options.scriptFields.distance = {
            'params': {
                'lat': lat,
                'lon': lon
            },
            'script': 'doc[\u0027location\u0027].arcDistance(lat,lon)'
        };

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
            _.extend(this.options.conditions, key);
        } else {
            this.options.conditions[key] = value;
        }

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
    * Perform an exact-match query
    * @returns Promise
    * @example
    * query.find().then(function (documents) {
    *
    * });
    */
    this.find = function () {
        var query = {};
        var options = this.options;

        if (options.fields.length) query.fields = options.fields;

        if (_.keys(options.conditions).length) {
            query.query = {
              term: options.conditions
            };
        }

        if (_.keys(options.scriptFields).length) {
            query.script_fields = options.scriptFields;
        }

        if (_.keys(options.filters).length) {
            query.filter = options.filters;
        }

        if (options.size) query.size = options.size;
        if (options.from) query.from = options.from;
        if (options.sort.length) query.sort = options.sort;

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
                    documents.push(hit.fields || hit._source);
                });

                resolve(documents);
            });
        });
    };

    /**
    * Perform a search
    * @returns Promise
    * @example
    * query.search().then(function (documents) {
    *
    * });
    */
    this.search = function () {
        var query = {};
        var options = this.options;

        if (options.fields.length) query.fields = options.fields;

        if (_.keys(options.conditions).length) {
            query.query = {
              term: options.conditions
            };
        }

        if (_.keys(options.scriptFields).length) {
            query.script_fields = options.scriptFields;
        }

        if (_.keys(options.filters).length) {
            query.filter = options.filters;
        }

        if (options.size) query.size = options.size;
        if (options.from) query.from = options.from;
        if (options.sort.length) query.sort = options.sort;

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
                    documents.push(hit.fields || hit._source);
                });

                resolve(documents);
            });
        });
    };
};

module.exports = Elasto;
