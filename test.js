var Elasto = require('./');

Elasto.basePath = 'http://localhost:9200/boulevard-development';

Elasto.query('boutiques')
        .where('name', 'London')
        .returns('name', 'address')
        .sort('name', 'desc')
        .size(1)
        .from(1)
        .search().then(function (documents){
   console.log(documents); 
});