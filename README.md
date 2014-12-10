# Elasto
## Introduction

Elasto is a simple library to query Elasticsearch.
[Documentation](http://streethub.github.io/elasto/)

## Installation

```bash
npm install elasto
```

## Getting started

```javascript
var Elasto = require('elasto');
Elasto.config({
    host: 'localhost:9200',
});
```

## All-in-one example

```javascript
Elasto.query({
      index: 'development',
      type: 'tweets'
})
.near({ // documents near this location
    lat: 51.5,
    lon: -0.1467912,
    radius: 3
})
.where('name', 'London') // where name matches London
.size(2) // return only 2 documents
.from(1) // skip 1 document (searching after 1 document)
.returns('name', 'address') // return only name and address fields
.exec()
.then(function (res) { // execute
   // done! 
});
```


### License
`elasto` is released under the MIT license. See `LICENSE.txt` for the complete text.

### Contributors

* [Arnaud Benard](github.com/arnaudbenard)
* [Vadim Demes](https://github.com/vdemedes)
* [Peter Kadlot](github.com/daralthus)
* [Alex Loizou](github.com/alexloi)
