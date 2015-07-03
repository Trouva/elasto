var chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));
var _ = require('lodash');
var Bluebird  = require('bluebird');
var chance = require('chance')();
var Elasto = require('../');
Elasto.config({
    host: 'localhost:9200',
    // log: 'trace',
    apiVersion: '1.5'
});

var CIRCLECI = process.env.CIRCLECI === "true";
console.log('Executing test on', CIRCLECI ? 'CircleCI' : 'local');

describe('Elasto', function() {

    var london =  {
        lat: 51.5,
        lon: -0.1467912,
    };

    before(function cleanTestingIndex(done) {
        this.timeout(60000);

        var mapping = {
            'properties': {
                'location' : { 'type' : 'geo_point' },
                'embeds': { 'properties': { 'url': { 'type': 'string', "index": "not_analyzed" } } }
            }
        };

        // Circle ci takes a few seconds to start the elasticsearch service
        Bluebird.resolve().delay(CIRCLECI ? 10000 : 0)
        .then(function() {
            return Elasto.client.indices.exists({ index: 'circle_test'});
        })
        .then(function(exists) {
            var deleteIndex = Elasto.client.indices.delete({ index: 'circle_test'});
            return exists ? deleteIndex : '';
        })
        .delay(1000) // small delay to set mapping
        .then(function(){
            return Elasto.client.indices.create({ index: 'circle_test' });
        })
        .then(function(){
            return Elasto.client.indices.putMapping({
                index: 'circle_test',
                type: 'tweets',
                body: {
                    tweets: mapping
                }
            });
        })
        .delay(1000) // small delay to set mapping
        .should.eventually.notify(done);
    });


    describe('query DSL', function() {

        var doc = function() {
            var lat = london.lat * (1 + chance.integer({min: -10, max: 10})/1000);
            var lon = london.lon * (1 + chance.integer({min: -10, max: 10})/1000);
            return {
                id: chance.natural({ min: 100000, max: 200000 }),
                name: chance.word(),
                characters: chance.integer({min: 1, max: 150}),
                location: { lat: lat, lon: lon},
                description: 'twitty tweet' //leave static
            };
        };

        before(function(done) {
            var promises = [];
            _.times(30, function() {
                var body = doc();
                promises.push(Elasto.client.create({
                    index: 'circle_test',
                    type: 'tweets',
                    refresh: true,
                    id: body.id,
                    body: body
                }));
            });

            Bluebird.all(promises)
            .should.eventually.notify(done);
        });

        it('should find a document with a where query', function (done) {

            var source = doc();

            Elasto.client.create({
                index: 'circle_test',
                type: 'tweets',
                refresh: true,
                id: source.id,
                body: source
            })
            .then(function() {
                return Elasto.query({
                    index: 'circle_test',
                    type: 'tweets'
                })
                .where({ name: source.name })
                .exec();
            })
            .then(function(res){
                var data = res.hits.hits[0]._source;
                source.id.should.equal(data.id);
                source.name.should.equal(data.name);
            })
            .should.eventually.notify(done);
        });

        it('should find a document with the alternative where query syntax ("key", "val")', function (done) {

            var source = doc();

            Elasto.client.create({
                index: 'circle_test',
                type: 'tweets',
                refresh: true,
                id: source.id,
                body: source
            })
            .then(function() {
                return Elasto.query({
                    index: 'circle_test',
                    type: 'tweets'
                })
                .where('name', source.name)
                .exec();
            })
            .then(function(res){
                var data = res.hits.hits[0]._source;
                source.id.should.equal(data.id);
                source.name.should.equal(data.name);
            })
            .should.eventually.notify(done);
        });

        it('should find a document with the alternative where query syntax ([{"key": "val"}])', function (done) {

            var source = doc();
            source.embeds = [
              {url: 'https://media1.giphy.com/media/xig1JXCmS9xpm/200.gif'},
              {url: 'https://media1.giphy.com/media/PxFGykZD9QnCw/200.gif'}
            ];

            Elasto.client.create({
                index: 'circle_test',
                type: 'tweets',
                refresh: true,
                id: source.id,
                body: source
            })
            .then(function() {
                var raw = Elasto.query({
                    index: 'circle_test',
                    type: 'tweets'
                })
                .where([{'embeds.url': source.embeds[0].url}, {'embeds.url': source.embeds[1].url}]).raw()

                raw.body.query.filtered.filter.bool.must.should.have.a.lengthOf(2);

                return Elasto.query({
                    index: 'circle_test',
                    type: 'tweets'
                })
                .where([{'embeds.url': source.embeds[0].url}, {'embeds.url': source.embeds[1].url}])
                .exec();
            })
            .then(function(res){
                var data = res.hits.hits[0]._source;
                source.id.should.equal(data.id);
                source.name.should.equal(data.name);
            })
            .should.eventually.notify(done);
        });

        it('should return a specific size of objects', function(done) {
            var size = 6;

            Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .size(size)
            .exec()
            .then(function(data){
                data.hits.hits.length.should.be.equal(size);
            })
            .should.eventually.notify(done);
        });

        it('should sort documents', function (done) {

            Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .sort('characters')
            .exec()
            .then(function(res) {
                var previous = 0;

                res.hits.hits.map(function(doc){
                    return doc._source.characters;
                })
                .forEach(function(value){
                    value.should.not.be.lessThan(previous);
                    previous = value;
                });
            })
            .should.eventually.notify(done);
        });

        it('should find documents in a location with a radius', function (done) {

            Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .near(_.extend(london, { radius: 10 }))
            .exec()
            .then(function(res) {
                var docs = _.pluck(res.hits.hits, '_source');
                docs.forEach(function(doc){
                    doc.location.lat.should.be.a.Number;
                    doc.location.lon.should.be.a.Number;
                });
            })
            .should.eventually.notify(done);

        });

       it('should handle paging', function (done) {
            var old = [];

            Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .from(0)
            .size(3)
            .exec()
            .then(function(res) {

                var docs = _.pluck(res.hits.hits, '_source');
                docs.length.should.be.equal(3);

                old = docs;

                return Elasto.query({
                    index: 'circle_test',
                    type: 'tweets'
                })
                .from(1)
                .size(1)
                .exec();

            })
            .then(function(res) {
                var docs = _.pluck(res.hits.hits, '_source');
                docs[0].name.should.be.equal(old[1].name);
            })
            .should.eventually.notify(done);
        });

        it('should get documents in a range', function (done) {

            Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .range('characters', [120, 150])
            .exec()
            .then(function(res) {
                var docs = _.pluck(res.hits.hits, '_source');
                docs.forEach(function(doc){
                    doc.characters.should.be.lessThan(151);
                    doc.characters.should.be.greaterThan(119);
                });
            })
            .should.eventually.notify(done);
        });

        it('should get documents in a geodistance range', function(done) {

            Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .range('distance', _.extend(london, {from: 0, to: 100}))
            .exec()
            .then(function(res) {
                var docs = _.pluck(res.hits.hits, '_source');
                docs.length.should.be.greaterThan(0);
            })
            .should.eventually.notify(done);
        });

        it('should return objects in a certain location and sort by distance', function(done) {

            var radius = 5;

            Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .near(_.extend(london, { radius: radius }))
            .sort('distance')
            .exec()
            .then(function(res) {
                var sorts = _.pluck(res.hits.hits, 'sort');

                _.flatten(sorts).forEach(function(sort){
                    sort.should.be.lessThan(radius);
                });
            })
            .should.eventually.notify(done);
        });

        it('should query specific fields', function(done) {

            Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .fields(['name', 'id'])
            .exec()
            .then(function(res) {
                var docs = _.pluck(res.hits.hits, '_source');
                docs.forEach(function(doc){
                    _.keys(doc).length.should.equal(2);
                });
            })
            .should.eventually.notify(done);
        });

        it('should query specific fields (no array)', function(done) {

            Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .fields('name', 'id')
            .exec()
            .then(function(res) {
                var docs = _.pluck(res.hits.hits, '_source');
                docs.forEach(function(doc){
                    _.keys(doc).length.should.equal(2);
                });
            })
            .should.eventually.notify(done);
        });

        it('should exclude documents', function (done) {
            var response = {};

            Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .size(10000)
            .exec()
            .then(function(res) {
                var docs = _.pluck(res.hits.hits, '_source');

                response.len = docs.length;
                response.excluded = docs[0].name;

                return Elasto.query({
                    index: 'circle_test',
                    type: 'tweets'
                })
                .size(10000)
                .not('name', response.excluded)
                .exec();
            })
            .then(function(res) {
                var docs = _.pluck(res.hits.hits, '_source');
                docs.length.should.be.equal(response.len - 1);
                docs.forEach(function(doc) {
                    doc.name.should.not.be.equal(response.excluded);
                });
            })
            .should.eventually.notify(done);
        });

        it('should find with a term', function(done) {

            Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .exec()
            .then(function(res) {
                var docs = _.pluck(res.hits.hits, '_source');
                return Bluebird.props({
                    docs: Elasto.query({
                         index: 'circle_test',
                         type: 'tweets'
                        })
                        .term(docs[0].name)
                        .exec(),
                    term: Bluebird.resolve(docs[0].name)
                });
            })
            .then(function(opts) {
                var docs = _.pluck(opts.docs.hits.hits, '_source');
                docs[0].name.should.be.equal(opts.term);
            })
            .should.eventually.notify(done);
        });

        it('should count documents', function(done) {
            Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .count()
            .then(function(res) {
                res.count.should.be.greaterThan(0);
            })
            .should.eventually.notify(done);

        });

        it('should return a search query by default when calling .raw()', function() {
            var raw = Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .fields('name')
            .from(10)
            .raw();

            raw.should.be.ok;
        });

        it('should return a search query when calling .raw() with query', function() {
            var raw = Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .fields('name')
            .from(10)
            .raw('query');

            raw.should.be.ok;
        });

        it('should return a search query by default when calling .raw() with count', function() {
            var raw = Elasto.query({
                index: 'circle_test',
                type: 'tweets'
            })
            .fields('name')
            .from(10)
            .raw('count');

            raw.should.be.ok;
        });
    });
});
