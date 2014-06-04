var Promise  = require('bluebird'),
request  = require('request'),
_        = require('lodash');

/**
 * Elasto
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
    this.options = {};
    
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
        this.options = location;
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
        var conditions = this.options.conditions || {};

        if (typeof key === 'object') {
            _.extend(conditions, key);
        } else {
            conditions[key] = value;
        }
        
        this.options.conditions = conditions;

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
    
    /**
     * Limit the number of documents in response
     * @param {number} size - number of documents to return
     * @returns Query
     * @alias size
     * @example
     * query.limit(5);
    */
    this.limit = function () {
        return this.size.apply(this, arguments);
    };
    
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
    
    /**
     * Skip N documents
     * @param {number} from - number of documents to skip
     * @returns Query
     * @alias from
     * @example
     * query.offset(10);
    */
    this.offset = function () { 
        return this.from.apply(this, arguments);
    };
    
    /**
     * Return only specified fields
     * @param {array} keys - array of keys/fields
     * @returns Query
     * @example
     * query.fields(['name', 'address']);
     * query.fields('name', 'address');
    */
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
    
    /**
     * Return only specified fields
     * @param {array} keys - array of keys/fields
     * @returns Query
     * @alias fields
     * @example
     * query.select(['name', 'address']);
     * query.select('name', 'address');
    */
    this.select = function () {
        return this.fields.apply(this, arguments);
    };
    
    /**
     * Return only specified fields
     * @param {array} keys - array of keys/fields
     * @returns Query
     * @alias fields
     * @example
     * query.select(['name', 'address']);
     * query.select('name', 'address');
    */
    this.returns = function () {
        return this.fields.apply(this, arguments);
    };
    
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
        var sort = this.options.sort || [];
        
        if (key && order) {
            var obj = {};
            obj[key] = order;
            sort.push(obj);
        } else {
            sort.push(key);
        }
        
        this.options.sort = sort;
        
        return this;
    };

    this.find = function () {
        // @TODO
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
        var query = { query: {} };
        var options = this.options;
        
        if (options.conditions) query.query.match = options.conditions;
        if (options.size) query.size = options.size;
        if (options.from) query.from = options.from;
        if (options.fields) query.fields = options.fields;
        if (options.sort) query.sort = options.sort;
        
        var url = Elasto.basePath + '/' + this.resourceName + '/_search';
        
        return new Promise(function (resolve, reject) {
           request({
               url: url,
               method: 'POST',
               json: query
           }, function (err, res, body) {
              if (err) return reject(err);
              
              var documents = [];
              
              body.hits.hits.forEach(function (hit) {
                  documents.push(options.fields ? hit.fields : hit._source);
              });
              
              resolve(documents);
           });
        });
    };
};

module.exports = Elasto;