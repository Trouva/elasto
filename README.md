# Elasto

Elasto is a simple library to query Elastic Search.

## Installation

```bash
npm install git+ssh://git@github.com:streethub/elasto.git --save
```

## Getting started

```javascript
var Elasto = require('elasto');

Elasto.basePath = 'http://localhost:9200/boulevard-development'; // where boulevard-development is index
```

All-in-one example:

```javascript
Elasto.query('boutiques')
      .near({ // documents near this location
          lat: 51.5,
          lon: -0.1467912,
          radius: 3
      })
      .where('name', 'London') // where name matches London
      .size(2) // return only 2 documents
      .from(1) // skip 1 document (searching after 1 document)
      .returns('name', 'address') // return only name and address fields
      .find().then(function (boutiques) { // execute
         // done! 
      });
```