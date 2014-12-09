// # Elasto v2

// ## Require
// type 1
var Elasto = require('elasto');

// type 2
// var elasticsearch = require('elasticsearch');
// var Elasto = require('elasto');
// elasticsearch.extend.elasto = Elasto;



// ## Basic methods

// - Setup
// - Host setter
// Elasto.host('localhost:9200');
// LATER
Elasto.setup(); // Makes http calls to setup

// Elasto.set({ host: 'localhost:9200' });
var Elasto.set('host', 'localhost:9200');

// - Definition
// var Tweet = Elasto.index('dev_index').type('tweet');
var Tweet = Elasto.Model({
    index: 'dev_index',
    type: 'tweet'
});


// - Set mapping
// var Tweet = Elasto({ index: 'dev_index', type: 'tweet'});
// Tweet.set({ mapping: mapping });

// var Tweet = Elasto.Model({
//     index: 'dev_index',
//     type: 'tweet',
//     mapping: mapping
// });

// Should create a new instance for each setter -> GC?
// Tweet.set({ mapping: mapping });
// -> throws Error: Can't reset mapping of type

// - Getter functions
Tweet.get('type');
Tweet.get('index');
// Tweet.get('client');

// - Full-text search
Tweet.find('hat');
Tweet.find({ name: 'hat'});

// - Size:
Tweet.size(10).find();

// - Size:
Tweet.sort(10).find();

// - From:
Tweet.from(10).find();

// - Fields:
Tweet.fields('name').find();
Tweet.fields(['name', 'description']).find();

// - Range:
Tweet.range('created_at', start, end);

// - Autocomplete
Tweet.autocomplete({});

// - Highlight


// - Get native client and search
Tweet.client.search({});


// - Index setter
Elasto.index('dev_index');

// - Save a document
var instance = new Tweet();
instance.save()
.then(function(doc) {
    // Promise
});

// - Save a document with version
var instance = new Tweet();
instance.version(2, 'external').save()
.then(function(doc) {
    // Promise
});

// - Serializer
// Same as .then -> not that useful
// Tweet.serialize(function(resp) {
//     return resp.hits.hits;
// });

// Tweet.serialize(function(resp) {
//     return {
//         tweets: resp.hits.hits
//     };
// });

// - Create index
Elasto.createIndex('dev_index');

// - Delete index
Elasto.deleteIndex('dev_index');

// - Create type
Elasto.createType({
    index: 'dev_index',
    type: 'tweet'
});

// - Delete type
Elasto.deleteType({
    index: 'dev_index',
    type: 'tweet'
});

// - Remove
Tweet.remove({id: 'abc'});

// - Helper functions
// ['where', 'near', ...]
Tweet.where({
    published: true,
    category: 'abc123'
});

// - Search by id
Tweet.find({id: 'abc'});
Tweet.byId('abc');


// - Count
Tweet.count();
Elasto.count({
    index: 'dev_index',
    type: 'tweet'
});

// Errors - v1
var Tweet = Elasto.type('tweet');
// -> throw ValidationError: No index specified


// ## examples

// - bootstrap

// var Tweet = Elasto({
//     host: config.host,
//     index: config.index,
//     type: 'tweet'
// });

// - query
// Tweet.search({ author: 'Robert' });

// // - native
// Tweet.get('client').search({
//     body: {
//         query: {
//             match: {
//                 author; 'Robert'
//             }
//         }
//     }
// });
