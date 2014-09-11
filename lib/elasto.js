var Bluebird  = require('bluebird');
var request  = require('request');
var _        = require('lodash');

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


    create: function(resourceName){
        return new CreateOperation(resourceName);
    },

    /**
     * creates index from the base path... what a shit idea
     * @param  {Object} settings settings
     * @return {Object}          Promise
     */
    createIndex: function(settings){
        var query = settings || {};
        var url = [this.basePath].join('/');

        return new Bluebird(function (resolve, reject) {
            request({
                url: url,
                method: 'PUT',
                json: query
            }, function (err, res, body) {
                if (err) return reject(err);

                resolve(body);
            });
        });
    },

    createBasePathIndex: function () {
        return this.createIndex.apply(this, arguments);
    },

    deleteIndex: function(){
        var indexUrl = Elasto.basePath; // 1: index

        return new Bluebird(function (resolve, reject) {
            request({
                url: indexUrl,
                method: 'DELETE',
            }, function (err, res, body) {
                if (err) return reject(err);

                resolve(body);
            });
        });
    },

    deleteBasePathIndex: function () {
        return this.deleteIndex.apply(this, arguments);
    },

    deleteType: function(typeName) {
        var url = [this.basePath, typeName].join('/');

        return new Bluebird(function (resolve, reject) {
            request({
                url: url,
                method: 'DELETE',
            }, function (err, res, body) {
                if (err) return reject(err);

                resolve(body);
            });
        });
    },

    /**
     * [setMapping Set the mapping of a ressource. ]
     * @param {String} resourceName [name of the resource]
     * @param {Object} mapping      [Mapping of the resource]
     */
    setMapping: function(resourceName, mapping){
        var url = [this.basePath, resourceName, '_mapping'].join('/');
        var query = {};
        query[resourceName] = mapping;

        return new Bluebird(function (resolve, reject) {
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
* Create instance
* @constructor
* @param {string} resourceName - Resource name
*/
var CreateOperation = function(resourceName){

    this.resourceName = resourceName;
    this.doc = {};

    /**
     * [set set the document]
     * @param {Object} doc [document]
     */
    this.set = function(doc){
        this.doc = doc;
        return this;
    };

    /**
     * save Save the document to elasticsearch
     *         and uses the mongoid as the id on the index
     * @return {Object} Promise
     */
    this.save = function(){
        var doc = this.doc;
        var url = [Elasto.basePath, this.resourceName, doc._id].join('/');

        return new Bluebird(function (resolve, reject) {
            request({
                url: url,
                method: 'PUT',
                json: doc
            }, function (err, res, body) {
                if (err) return reject(err || body);

                resolve(body);
            });
        });
    };

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
        sort: [],
        location: {}
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

        // Save to use in sorting later
        this.options.location = {
            lat: lat,
            lon: lon
        };

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

        if(key === 'distance'){
            var location = this.options.location;
            this.sort('_geo_distance', {
                location: {
                    lat: location.lat,
                    lon: location.lon
                },
                order: 'asc',
                unit: 'miles'
            });
        } else {
            if (key && order) {
                var obj = {};
                obj[key] = order;
                this.options.sort.push(obj);
            } else {
                this.options.sort.push(key);
            }
        }

        return this;
    };

    /**
     * Search in a range - range is a filter
     * @return Query
     * @example
     * query.range('price', [0, 10]);
     */
    this.range = function(key, interval){

        if(key && _.isArray(interval)){
            var range = {};
            range.range = {};

            range.range[key] = {
                gte : interval[0],
                lte : interval[1],
            };

            this.options.filters.push(range);
        }
        return this;
    };

    /**
     * Autocomplete wrapper
     * @param  {String} term term
     * @return {Object}      Promise
     */
    this.autocomplete = function(term) {

        var url = Elasto.basePath + '/' + this.resourceName + '/_search';

        var query = {
            query: {
                match: {
                    name: term
                }
            }
        };

        var highlight = {
            fields : {
                name: {}
            },
            pre_tags: ["<strong>"],
            post_tags: ["</strong>"]
        };

        query.highlight = highlight;
        return new Bluebird(function (resolve, reject) {
            request({
                url: url,
                method: 'GET',
                json: query
            }, function (err, res, body) {
                if (err || res.statusCode != 200) return reject(err || body);

                var documents = [];

                body.hits.hits.forEach(function (hit) {
                    var obj = hit._source;
                    obj.highlight = hit.highlight;
                    documents.push(obj);
                });

                resolve(documents);
            });
        });
    };

    this._buildQuery = function(term) {
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
        if (options.highlight) query.highlight = options.highlight;

        return query;
    };

    /**
     * Count function
     * @param  {String} term
     * @return {Object}      Promise
     */
    this.count = function(term) {

        var query = this._buildQuery(term).query;
        var url = Elasto.basePath + '/' + this.resourceName + '/_count';
        return new Bluebird(function (resolve, reject) {
            request({
                url: url,
                method: 'GET',
                json: query
            }, function (err, res, body) {
                if (err || res.statusCode != 200) return reject(err || body);

                resolve(body.count);
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
    this.search = function (term) {

        var query = this._buildQuery(term);
        var url = Elasto.basePath + '/' + this.resourceName + '/_search';

        return new Bluebird(function (resolve, reject) {
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

    /**
     * Get document by id
     * @param  {String} id id
     * @return {Object}    Promise
     */
    this.byId = function(id){
        var url = [Elasto.basePath, this.resourceName, id].join('/');

        return new Bluebird(function (resolve, reject) {
            request({
                url: url,
                method: 'GET',
            }, function (err, res, body) {
                if (err) return reject(err);

                try {
                    body = JSON.parse(body);
                } catch (e) {
                    return reject(e);
                }

                resolve(body._source);
            });
        });
    };

    /**
     * Remove documents
     * @return {Promise} Promise
     */
    this.remove = function () {
        var query = this._buildRemoveQuery();
        var url = Elasto.basePath + '/' + this.resourceName + '/_query';

        return new Bluebird(function (resolve, reject) {

            if(_.keys(query.term).length === 0) return reject(new Error('No term for remove'));

            request({
                url: url,
                method: 'DELETE',
                json: query
            }, function (err, res, body) {
                if (err || res.statusCode != 200) return reject(err || body);

                resolve();
            });
        });
    },

    /**
     * builds the query to remove a document
     * @return {Object} Query object
     */
    this._buildRemoveQuery = function () {
        var query = {};

        var options = this.options;

        if (options.filters.length) {
            query.term = {};

            options.filters.forEach(function (filter) {
                for (var key in filter.term) {
                    query.term[key] = filter.term[key];
                }
            });
        }

        return query;
    }
};

module.exports = Elasto;
