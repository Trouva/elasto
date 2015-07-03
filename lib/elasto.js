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
    },

    index: function(opts) {
        return new Index(this.client, opts.index, opts.type);
    }
};

/**
 * INDEX API
 */
var Index = function(client, index, type) {

    /**
    * Bulk indexing for documents
    * @param {array} data - Array of documents to index
    * @param {string} id field name (optional) - Field to use as id. If none specified,
    * id will be created automatically by elasticsearch.
    * @returns Promise
    * @example
    * index.bulk([doc1, doc2, doc3], 'id');
    *
    */
    this.bulk = function(data, id) {
        var actions = [];
        for (var i = 0; i < data.length; i++) {
            var document = data[i], meta = { _index: index, _type: type};
            if (typeof id !== "undefined") {
                meta._id = document[id];
            }
            actions.push({ index:  meta });
            actions.push(document);
        }
        return client.bulk({ body: actions});
    };
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
        aggregations: {}
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
    * query.where([{
    *     name: 'London'
    * },
    * {
    *     name: 'Budapest'
    * }]);
    */
    this.where = function (key, value) {
        if (Array.isArray(key)) {
            // basically an AND query
            var arr = key;
            arr.forEach(this.where.bind(this));

            return this;
        } else if(typeof key === 'object') {
            var obj = key;
            for (var k in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, k)){
                    this.where(k, obj[k]);
                }
            }

            return this;
        }

        var condition = {};

        if (isArray(value)) {
            // basically an OR query
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
    * Aggregation query for matching documents
    * @param {string} name - Name for aggregation bucket
    * @param {string} type - Aggregation type
    * @param {value} value - Aggregation query value
    * @returns Query
    * @example
    * query.aggregation('my_significant_names', 'significant_terms', {
    *   'filed': 'name'
    * });
    *
    */
    this.aggregation = function(name, type, value) {
      var aggregation = {};
      aggregation[type] = value;
      this.options.aggregations[name] = aggregation;
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
        var fields = isArray(keys) ? keys : Array.prototype.slice.call(arguments);
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

    this._buildQuery = function(opts) {
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

        if (Object.keys(options.aggregations).length) {
          body.aggregations = options.aggregations;
        }

        if (Object.keys(options.facets).length) query.facets = options.facets;
        if (options.fields.length) query._source = options.fields;
        if (options.sort.length && opts.output === 'search') body.sort = options.sort;
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
        var query = this._buildQuery({output: 'search'});
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
        var query = this._buildQuery({output: 'count'});
        return client.count(query);
    };

    /**
     * Returns the raw query that Elasticsearch will execute
     * Useful methood for debugging or modify raw ElasticSearch queries
     * @param  {String} type Type of queries: search, count (search by default)
     * @return {Object}      ElasticSearch Query
     */
    this.raw = function(type) {
        return this._buildQuery({output: type || 'search'});
    };
};

module.exports = Elasto;
