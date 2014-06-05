var assert = require("assert");
var should = require("should");

var Elasto = require('../');

Elasto.basePath = 'http://localhost:9200/boulevard-development';

describe('Elasto', function() {
  describe('find', function() {

    it('should find a specific item', function(done) {

        Elasto.query('boutiques')
        .where('slug', 'cosi-homewares-in-n103hp')
        .find().then(function (documents){

            assert.equal(documents.length, 1);
            documents.should.not.be.equal(undefined);

            console.log('putain');
            console.log(documents);
            done();
        });

    });

    it('should find a specific item with multiple params', function(done) {

        Elasto.query('products')
        .where({
            slug: 'cosi-homewares-in-n103hp',
            boutique_slug: 'fig-tree-reed-diffuser-from-orla-kiely'
        })
        .find().then(function (documents){

            documents.length.should.be.equal(1);
            documents.should.not.be.equal(undefined);

            done();
        });
    });
  });
});
