var Elasto = require('./');

Elasto.connect('http://localhost:9200/boulevard-development');

var Boutique = Elasto.Document.extend({
   name: 'boutiques' 
});

Boutique.find().then(function (boutiques) {
   console.log(boutiques); 
});