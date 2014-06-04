var Elasto = require('./');

Elasto.connect('http://localhost:9200/boulevard-development');

Elasto.query('boutiques').near({
    lat: 42,
    lon: 13,
    radius: 3
}).where({
   'term1': 'value1',
   'term2': 'value2' 
}).where('term3', 'value3')
  .size(5)
  .from(5)
  .returns('first_field', 'second_field')
  .returns(['first_field', 'second_field'])
  .search();