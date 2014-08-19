var assert = require("assert");
var should = require("should");
var _ = require('lodash');
var request  = require('request');
var Bluebird  = require('bluebird');
var chance = require('chance')();
var Elasto = require('../');

Elasto.basePath = 'http://localhost:9200/circle_test';

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
        .then(function(){
            done();
        });
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
        .then(function(res){
            done();
        });
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
                done();
            });

        });
    });

    describe('search', function() {

        before(function(done){

            this.timeout(3000);

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
            }).then(function(res){
                setTimeout(function(){
                    done();
                }, 1500); // The refresh rate of indexing is 1s by default
            });
        });

        it('should return a specific size of objects', function(done) {
            var size = 6;

            Elasto.query('products')
            .size(size)
            .search().then(function (documents){

                documents.should.not.be.equal(undefined);
                documents.length.should.be.equal(size);
                done();
            });
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

                done();
            })
            .catch(function(err){
                console.log(err);
            });
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

                done();
            });
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

                done();
            })
            .catch(function(err){
                console.log(err);
            });
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

                Elasto.query('products')
                .from(1)
                .size(1)
                .search().then(function (docs){

                    oldDocuments.filter(function(b){
                        return docs[0].slug === b.slug;
                    }).length.should.be.equal(1);

                    done();
                });

            });
        });

        it('should autocomplete the search query', function(done){

            Elasto.query('products').autocomplete('bro')
            .then(function(res){
                res.should.not.be.empty;
                res.forEach(function(product){
                    product.highlight.should.be.ok;
                });

                done();
            });
        });

        it('should get documents in a range', function (done) {

            Elasto.query('products').range('price', [0, 1000])
            .search()
            .then(function(res){
                res.should.not.be.empty;
                res.forEach(function(product){
                    product.price.should.be.lessThan(1000);
                    product.price.should.be.greaterThan(0);
                });
                done();
            });


        });

        it('should count a query', function (done) {
            Elasto.query('products').count().then(function(count){
                count.should.be.a.Number;
                count.should.be.greaterThan(0);
                done();
            });
        });

        it ('should delete one record by query', function (done) {
            Elasto.query('products').count().then(function (oldCount) { // get product count before delete
                Elasto.query('products')
                    .size(1)
                    .search().then(function (docs) {
                        var doc = docs[0];

                        Elasto.query('products')
                                .where('slug', doc.slug)
                                .remove().then(function () {
                                    Elasto.query('products').count().then(function (newCount) {
                                        newCount.should.equal(oldCount - 1);
                                        done();
                                    });
                                });
                    });
            });
        });

        it ('should not delete all records if params are missing', function (done) {
            Elasto.query('products').count().then(function (oldCount) {
                Elasto.query('products').remove().then(function () {
                    Elasto.query('products').count().then(function (newCount) {
                        newCount.should.equal(oldCount);
                        done();
                    });
                });
            });
        });
    });
});
