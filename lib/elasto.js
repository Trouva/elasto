var elasticsearch = require('elasticsearch');
var isArray = require('isarray');

var Elasto = {

    config: function(opts) {
        var self = this;
        Object.keys(opts).forEach(function(key) {
            if(key === 'host') self._setupClient(opts);
        });
    },

    _setupClient: function(config) {
        this.client = new elasticsearch.Client(config);
    },

    query: function(opts) {
        return new Query(this.client, opts.index, opts.type);
    }
};

/**
 * Query DSL API
 */
var Query = function(client, index, type) {

    this.options = {
        fields: [],
        sort: [],
        facets: {},
        location: {},
        must: [],
        must_not: [],
        should: [],
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

            var obj = key;
            for (var k in obj) {
                if (obj.hasOwnProperty(k)) {
                    this.where(k, obj[k]);
                }
            };

            return this;
        }

        var condition = {};

        if (isArray(value)) {
            condition.terms = {};
            condition.terms[key] = value;
        } else {
            condition.term = {};
            condition.term[key] = value;
        }

        this.options.must.push(condition);

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
    * Apply sorting
    * @param {string} key - field name
    * @param {string} opts - opts (asc/desc or location)
    * @returns Query
    * @example
    * query.sort('name', 'desc');
    * query.sort('_score');
    * query.sort('location', {
    *     lat: 0.1,
    *     lon: 10
    * });
    */
    this.sort = function (key, opts) {

        if(key === 'distance'){
            var location = this.options.location;
            // take from sort or near
            var lat = opts && opts.lat ? opts.lat: location.lat;
            var lon = opts && opts.lon ? opts.lon: location.lon;

            this.sort('_geo_distance', {
                location: {
                    lat: lat,
                    lon: lon
                },
                order: 'asc',
                unit: 'miles'
            });
        } else {
            if (key && opts) {
                var obj = {};
                obj[key] = opts;
                this.options.sort.push(obj);
            } else {
                this.options.sort.push(key);
            }
        }

        return this;
    };

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

        if (isArray(keys)) {
            fields = keys;
        } else {
            var args = Array.prototype.slice.call(arguments);
            args.forEach(arguments, function (arg) {
                fields.push(arg);
            });
        }

        this.options.fields = fields;
        return this;
    };

    /**
     * Search in a range - range is a filter
     * @return Query
     * @example
     * query.range('price', [0, 10]);
     */
    this.range = function(key, interval) {

        if (key && isArray(interval)) {
            var range = {};
            range.range = {};

            range.range[key] = {
                gte : interval[0],
                lte : interval[1],
            };

            this.options.must.push(range);
        } else if (key && key === 'distance' && typeof interval === 'object') {

            this.options.must.push({
                geo_distance_range: {
                    from : interval.from + 'mi',
                    to : interval.to + 'mi',
                    location: {
                       lat: interval.lat,
                       lon: interval.lon
                   }
               }
            });
        }
        return this;
    };

    /**
     * Exclude all the documents containing this field
     * @return Query
     * @example
     * query.not('areas._id', '5441152714aa8e110a000a38');
     * query.exclude('price', 0);
     */
    this.not = function(field, value) {
        var filter = { term: {}};
        filter.term[field] = value;
        this.options.must_not.push(filter);
        return this;
    };

    this.exclude = this.not;

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
        var radius = location.radius;
        var lat = parseFloat(location.lat);
        var lon = parseFloat(location.lon);

        // Save to use in sorting later
        this.options.location = {
            lat: lat,
            lon: lon
        };

        this.options.must.push({
           geo_distance: {
               distance: radius + 'mi',
               distance_type: 'arc',
               location: {
                   lat: lat,
                   lon: lon
               }
           }
        });

        return this;
    };

    /**
     * Search by term
     */
    this.term = function(value) {
        this.options.term = value;
        return this;
    };

    this._buildQuery = function() {
        var query = {
            index: index,
            type: type
        };

        var body = {
            query: {
                filtered: {
                    query: {
                        match_all: {}
                    }
                }
            }
        };

        var options = this.options;

        var bool = {};

        if (options.must.length) {
            bool.must = options.must;
        }

        if (options.must_not.length) {
            bool.must_not = options.must_not;
        }

        if (options.should.length) {
            bool.should = options.should;
        }

        if (Object.keys(bool).length) {
            body.query.filtered = {
                filter: {
                    bool: bool
                }
            };
        }

         if (options.term) {
            body.query.filtered.query = {
                query_string: {
                    query: options.term
                }
            };
        }

        if (Object.keys(options.facets).length) query.facets = options.facets;
        if (options.fields.length) query.fields = options.fields;
        if (options.sort.length) body.sort = options.sort;
        if (options.size) query.size = options.size;
        if (options.from) query.from = options.from;
        if (options.highlight) query.highlight = options.highlight;

        query.body = body;

        return query;
    };

    /**
    * Perform a search
    * @returns Promise
    * @example
    * query.exec().then(function (documents) {
    *
    * });
    */
    this.exec = function() {
        var query = this._buildQuery();
        return client.search(query);
    };

    /**
     * Get the number of documents matching the query
     * @return Promise
     * @example
     * query.count().then(function(res) {
     *
     * });
     */
    this.count = function() {
        var query = this._buildQuery();
        return client.count(query);
    };
}

module.exports = Elasto;

