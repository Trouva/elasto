var Elasto = require('./');

Elasto.connect('http://localhost:9200/boulevard-development');

Elasto.query('boutiques').find().then(function (boutiques) {
   console.log(boutiques); 
});