'use strict';

var chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));
var expect = chai.expect;
var _ = require('lodash');
var request  = require('request');
var Bluebird  = require('bluebird');
var chance = require('chance')();
var Elasto = require('../');

Elasto.basePath = 'http://localhost:9200/circle_test';
Elasto.DEBUG = true;

describe('Elasto', function() {
    var productList = [];
    var createNewProduct;

    before(function(done){

        var indexSettings = {
            "settings": {
                "number_of_shards": 1,
                "analysis": {
                    "filter": {
                        "autocomplete_filter": {
                            "type": "edge_ngram",
                            "min_gram": 1,
                            "max_gram": 20
                        }
                    },
                    "analyzer": {
                        "autocomplete": {
                            "type": "custom",
                            "tokenizer": "standard",
                            "filter": [
                            "lowercase",
                            "autocomplete_filter"
                            ]
                        }
                    }
                }
            }
        };

        Elasto.deleteIndex()
        .then(function(){
            return Elasto.createIndex(indexSettings);
        })
        .should.eventually.notify(done);
    });

    it('should set the mapping', function(done){
        var productMapping = {
            'properties': {
                'slug': { 'type': 'string', 'index': 'not_analyzed' },
                'name': {
                    'type': 'string',
                    'index_analyzer':  'autocomplete',
                    'search_analyzer': 'standard'
                },
                'location' : { 'type' : 'geo_point' }
            }
        };

        Elasto.setMapping('products', productMapping)
        .should.eventually.notify(done);
    });

    describe('save', function () {

        it('should save a product', function (done) {
            var slug = chance.word();
            var boutique_slug = chance.word();
            var price = chance.integer({min: 1, max: 2000});
            var id = price;
            var productToSave = {
                slug: slug,
                boutique_slug: boutique_slug,
                price: price,
                name: chance.word(),
                location: {
                    lat: 51.5,
                    lon: -0.1467912,
                },
                _id: id // Using price as _id
            };

            var product = Elasto.create('products').set(productToSave);

            product.save()
            .then(function(res){
                return Elasto.query('products').byId(id);
            })
            .then(function(res){
                res._id.should.be.equal(id);
            })
            .should.eventually.notify(done);

        });

        it('should save a product with an external version', function (done) {
            var slug = chance.word();
            var boutique_slug = chance.word();
            var price = chance.integer({min: 1, max: 2000});
            var id = price;
            var productToSave = {
                slug: slug,
                boutique_slug: boutique_slug,
                price: price,
                name: chance.word(),
                location: {
                    lat: 51.5,
                    lon: -0.1467912,
                },
                _id: id // Using price as _id
            };

            var product = Elasto.create('products').set(productToSave);

            product.version(1, 'external').save()
            .then(function(res){
                return Elasto.query('products').byId(id);
            })
            .then(function(res){
                res._id.should.be.equal(id);
            })
            .then(function shouldFailWithVersionConflict(){
                var product = Elasto.create('products').set(productToSave);
                return product.version(1, 'external').save()
                    .then(Bluebird.reject)
                    .catch(function(err){
                        expect(err.message).to.have.string('VersionConflictEngineException');
                        return 'ok';
                    });
            })
            .then(function shouldCommitWithHigherVersion(){
                productToSave.name = '{["."]}';
                var product = Elasto.create('products').set(productToSave);
                return product.version(2, 'external').save();
            })
            .then(function(res){
                return Elasto.query('products').byId(id);
            })
            .then(function(res){
                res._id.should.be.equal(id);
                res.name.should.be.equal('{["."]}');
            })
            .should.eventually.notify(done);

        });
    });

    describe('search', function() {

        before(function(done){

            this.timeout(10000);

            for (var i = 0; i < 20; i++) {
                var slug = chance.word();
                var boutique_slug = chance.word();
                var price = chance.integer({min: 1, max: 2000});

                productList.push({
                    slug: slug,
                    boutique_slug: boutique_slug,
                    price: price,
                    name: 'bro ' + chance.word(),
                    location: {
                        lat: 51.5,
                        lon: -0.1467912,
                    },
                });
            }

            createNewProduct = function(newProduct){
                var id = chance.integer({min: 1, max: 2000});
                var productUrl = [Elasto.basePath, 'products', id].join('/'); // 1: index

                return new Bluebird(function (resolve, reject) {
                    request({
                        url: productUrl,
                        method: 'PUT',
                        json: newProduct
                    }, function (err, res, body) {
                        if (err) return reject(err);
                        return resolve(body);
                    });
                });
            };

            Bluebird.map(productList, function(product){
                return createNewProduct(product);
            })
            // The refresh rate of indexing is 1s by default
            .delay(5000)
            .should.eventually.notify(done);
        });

        it('should return a specific size of objects', function(done) {
            var size = 6;

            Elasto.query('products')
            .size(size)
            .search().then(function (documents){

                documents.should.not.be.equal(undefined);
                documents.length.should.be.equal(size);
            })
            .should.eventually.notify(done);
        });

        it('should return a specific size of objects with where', function(done) {
            var boutique_slug = productList[0].boutique_slug;

            Elasto.query('products')
            .where('boutique_slug', boutique_slug)
            .sort('price')
            .search().then(function (documents){
                documents.should.not.be.equal(undefined);

                var previous = 0;

                documents.map(function(doc){
                    return doc.price;
                }).forEach(function(doc, i){
                    doc.should.not.be.lessThan(previous);
                    previous = doc;
                });

            })
            .should.eventually.notify(done);
        });

        it('should return objects in a certain location', function(done) {
            var radius = 1.5;
            Elasto.query('products')
            .near({
                lat: 51.5,
                lon: -0.1467912,
                radius: radius
            })
            .search().then(function (documents){
                documents.should.not.be.equal(undefined);

                documents.forEach(function(doc){
                    doc.location.lat.should.be.a.Number;
                    doc.location.lon.should.be.a.Number;
                });
            })
            .should.eventually.notify(done);
        });

        it('should return objects in a certain location and sort by distance', function(done) {
            var radius = 1.5;
            Elasto.query('products')
            .near({
                lat: 51.5,
                lon: -0.1467912,
                radius: radius
            })
            .sort('distance')
            .search()
            .then(function (documents){
                documents.should.not.be.equal(undefined);

                documents.forEach(function(doc){
                    doc.location.lat.should.be.a.Number;
                    doc.location.lon.should.be.a.Number;
                });
            })
            .should.eventually.notify(done);
        });

        it('should handle paging', function(done) {
            var oldDocuments = [];

            Elasto.query('products')
            .from(0)
            .size(3)
            .search().then(function (documents){

                documents.should.not.be.equal(undefined);
                documents.length.should.be.equal(3);

                oldDocuments = documents;

                return Elasto.query('products')
                .from(1)
                .size(1)
                .search().then(function (docs){

                    oldDocuments.filter(function(b){
                        return docs[0].slug === b.slug;
                    }).length.should.be.equal(1);
                });

            })
            .should.eventually.notify(done);
        });

        it('should autocomplete the search query', function(done){

            Elasto.query('products').autocomplete('bro')
            .then(function(res){
                res.should.not.be.empty;
                res.forEach(function(product){
                    product.highlight.should.be.ok;
                });
            })
            .should.eventually.notify(done);;
        });

        it('should get documents in a range', function (done) {

            Elasto.query('products').range('price', [0, 1000])
            .search()
            .then(function(res){
                res.should.not.be.empty;
                res.forEach(function(product){
                    product.price.should.be.lessThan(1001);
                    product.price.should.be.greaterThan(-1);
                });
            })
            .should.eventually.notify(done);


        });

        it('should count a query', function (done) {
            Elasto.query('products').count().then(function(count){
                count.should.be.a.Number;
                count.should.be.greaterThan(0);
            })
            .should.eventually.notify(done);
        });

        it('should delete one record by query', function (done) {
            var oldCount = 110;
            Elasto.query('products').count()
            .then(function (newOldCount) { // get product count before delete
                oldCount = newOldCount;
                return Elasto.query('products')
                    .size(1)
                    .search();
            })
            .then(function (docs) {
                var doc = docs[0];
                return Elasto.query('products')
                    .where('slug', doc.slug)
                    .remove();
            })
            .then(function () {
                return Elasto.query('products').count()
                    .then(function (newCount) {
                        newCount.should.equal(oldCount - 1);
                    });
            })
            .should.eventually.notify(done);
        });

        it('should delete one record by query and external version', function (done) {
            var oldCount = 110;

            var slug = chance.word();
            var boutique_slug = chance.word();
            var price = chance.integer({min: 1, max: 2000});
            var id = price;
            var productToSave = {
                slug: slug,
                boutique_slug: boutique_slug,
                price: price,
                name: chance.word(),
                location: {
                    lat: 51.5,
                    lon: -0.1467912,
                },
                _id: id // Using price as _id
            };

            var product = Elasto.create('products').set(productToSave);

            var oldCount = 110;
            Elasto.query('products').count()
            .then(function (newOldCount) { // get product count before delete
                oldCount = newOldCount;
                return Elasto.query('products')
                    .size(1)
                    .search()
            })
            .then(function(){
                return product.version(1, 'external').save();
            })
            .then(function(res){
                return Elasto.query('products').byId(id);
            })
            .tap(function(res){
                res._id.should.be.equal(id);
            })
            .tap(function shouldFailWithVersionConflict(doc){
                 return Elasto.removeFrom('products')
                    .byId(doc._id)
                    .version(1, 'external')
                    .remove()
                    .then(Bluebird.reject.bind(null, new Error('nope')))
                    .catch(function(err){
                        expect(err.message).to.have.string('VersionConflictEngineException');
                        return 'ok';
                    });
            })
            .then(function shouldCommitWithHigherVersion(doc){
                return Elasto.removeFrom('products')
                    .byId(doc._id)
                    .version(2, 'external')
                    .remove();
            })
            .then(function () {
                return Elasto.query('products').count()
                    .then(function (newCount) {
                        newCount.should.equal(oldCount);
                    });
            })
            .should.eventually.notify(done);

        });

        it('should not delete all records if params are missing', function (done) {
            Elasto.query('products').count()
            .then(function (oldCount) {

                return Elasto.query('products').remove()
                .then(Bluebird.reject)
                .catch(function noTerms() {
                    return Elasto.query('products').count()
                        .then(function (newCount) {
                            newCount.should.equal(oldCount);
                        });
                });
            })
            .should.eventually.notify(done);
        });

        it('should get multiple documents at once', function (done) {
            var oldSlugs;

            Elasto.query('products').size(5).search()
            .then(function(docs) {
                var oldSlugs = _.map(docs, 'slug');
                return Elasto.query('products').where('slug', oldSlugs).search();
            })
            .then(function(docs) {
                var newSlugs = _.map(docs, 'slug');

                _.difference(oldSlugs, newSlugs).length.should.equal(0);
            })
            .should.eventually.notify(done);
        });

        it('should search with facets', function(done) {

            Elasto.query('products').facets('price', { "terms" : {"field" : "price"} })
            .search().then(function(facets) {
                facets.price.terms.length.should.be.greaterThan(0);
                done();
            })
            .catch(function(err) {
                console.log(err);
                done();
            });
        });

        it('should do geodistance range', function(done) {

            Elasto.query('products').range('distance', {
                lat: 51.5,
                lon: -0.1467912,
                from: 0,
                to: 1
            })
            .search()
            .then(function(res) {
                res.length.should.be.greaterThan(0);
            })
            .should.eventually.notify(done);
        });

        it('should query specific fields', function(done) {
            Elasto.query('products').fields(['name'])
            .search()
            .then(function(res) {
                res.forEach(function(product){
                    _.keys(product).length.should.equal(1);
                    product.name.should.be.ok;
                })
            })
            .should.eventually.notify(done);
        });

        it('should sort by distance', function (done) {
            Elasto.query('products')
            .sort('distance', {
                lat: 51,
                lon: -0.14672,
            })
            .search()
            .then(function(res) {
                res.forEach(function(product){
                    product.sort[0].should.be.ok;
                });
            })
            .should.eventually.notify(done);
        });

        it('should exclude documents', function (done) {
            var response = {};

            Elasto.query('products')
            .limit(10000)
            .search()
            .then(function(res) {
                response.len = res.length;
                response.excluded = res[0].slug;
                return Elasto.query('products')
                .limit(10000)
                .not('slug', response.excluded)
                .search();
            })
            .then(function(res) {
                res.length.should.be.equal(response.len - 1);
                res.forEach(function(product) {
                    product.slug.should.not.be.equal(response.excluded);
                });
            })
            .should.eventually.notify(done);
        });

        it('should do OR queries', function (done) {
            var results;
            var query;
            Elasto.query('products')
            .size(3)
            .search()
            .then(function(res) {
                results = res;
                query = {
                    slug: res[0].slug,
                    boutique_slug: res[1].boutique_slug,
                    price: res[2].price
                };

                return Elasto.query('products')
                .or(query)
                .search();
            })
            .then(function(res) {
                res.length.should.be.equal(3);
                for(var field in query) {
                    var find = {};
                    find[field] = query[field];
                    _.any(res, find).should.be.true;
                }
            })
            .should.eventually.notify(done);
        });

        it('should do OR and WHERE query', function (done) {
            var products = [];
            _.times(6, function(i) {
                var name = 'lalala' + i%2; // have two types of names
                products.push({
                    name: name,
                    value1: !!(i%2),
                    value2: !(i%2),
                    _id: chance.integer({min: 0})
                });
            });

            Bluebird.map(products, function(product) {
                var p = Elasto.create('products').set(product);
                return p.save();
            })
            .delay(1200)
            .then(function query() {
                return Elasto.query('products')
                .where('name', products[0].name)
                .or({
                    value1: true,
                    value2: true,
                })
                .search();
            })
            .then(function(res) {
                res.length.should.be.equal(3); // 3 because modulo 2
                res.forEach(function(prod) {
                    prod.name.should.be.equal(products[0].name);
                });
                done();
            })
            .catch(function(err) {
                console.log(' err', JSON.stringify(err));
                done();
            });
        });

        it('should list aliases', function(done) {

            Elasto.getAliases()
            .then(function(aliases) {
                var keys = _.keys(aliases);
                _.contains(keys, 'circle_test').should.be.equal(true);
                done();
            });

        });

        it('should create an alias', function(done) {
            var alias = chance.word();
            Elasto.setAlias('circle_test', alias)
            .then(function(res) {
                return Elasto.getAliases();
            })
            .then(function(res) {
                var aliases = _.keys(res.circle_test.aliases);
                _.contains(aliases, alias).should.be.equal(true);
                done();
            });
        });

        it('should delete an alias', function(done) {
            var alias = chance.word();
            Elasto.setAlias('circle_test', alias)
            .then(function(res) {
                return Elasto.getAliases();
            })
            .then(function(res) {
                var aliases = _.keys(res.circle_test.aliases);
                _.contains(aliases, alias).should.be.equal(true);
                return Elasto.removeAlias('circle_test', alias);
            })
            .then(function(res) {
                return Elasto.getAliases();
            })
            .then(function(res) {
                 var aliases = _.keys(res.circle_test.aliases);
                _.contains(aliases, alias).should.be.equal(false);
                done();
            });
        });
    });
});
