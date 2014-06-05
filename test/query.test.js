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

      // assert(foobar.sayHello() === 'funky chicken');
    });
  });
});
