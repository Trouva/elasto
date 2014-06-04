var Elasto = require('./');

Elasto.basePath = 'http://localhost:9200/boulevard-development';

Elasto.query('boutiques')
        .near({
            lat: 51.5,
            lon: -0.1467912,
            radius: 3
        })
        .returns('name', 'address')
        .search().then(function (documents){
   console.log(documents); 
});