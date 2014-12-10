# Elasto
## Introduction

Elasto is a simple library to query Elasticsearch.

## Topics
- [Installation](#installation)
- [Getting started](#getting-started)
- [Example](#example)
- [API](#api)
- [License](#license)
- [Contributors](#contributors)

## Installation

```bash
npm install elasto
```

## Getting started

More infos about the config options [here](http://www.elasticsearch.org/guide/en/elasticsearch/client/javascript-api/current/configuration.html).
```javascript
var Elasto = require('elasto');
Elasto.config({
    host: 'localhost:9200',
});
```

Elasto provides a simple query interface for the common usecases. You can have access to the [elasticsearch.js](http://www.elasticsearch.org/guide/en/elasticsearch/client/javascript-api/current/index.html) client via `Elasto.client`.
The client gets instantiated when you set the config with a host.

## Example

All-in-one example. Find more options on [API](#api).
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
.fields('name', 'address') // return only name and address fields
.exec()
.then(function (res) { // execute
   // done!
});
```

## API

### Basic query

```javascript
return Elasto.query({
    index: 'development',
    type: 'tweets'
})
.exec();
```
### Fields matching

- `.where`

`.where` accepts two types of arguments. Either an object with the fields to match.

```javascript
Elasto.query({
    index: 'development',
    type: 'tweets'
})
.where({ username: '@jack'})
.exec();
```

Or key value pair of arguments

```javascript
Elasto.query({
    index: 'development',
    type: 'tweets'
})
.where('username', '@jack'})
.exec();
```

### Size

- `.size`
- `.limit`

Limit the size of the query.

```javascript
Elasto.query({
    index: 'development',
    type: 'tweets'
})
.limit(3)
.exec();
```

### Sort

- `.sort`
- `.limit`

Sorts the query by a field the size of the query.

```javascript
Elasto.query({
    index: 'development',
    type: 'tweets'
})
.sort('description', 'asc')
.exec();
```

You can also sort by distance. It will sort based on the `location` field in the document.

```javascript
Elasto.query({
    index: 'development',
    type: 'tweets'
})
.sort('distance', {
    lat: 51.5,
    lon: -0.1467912,
})
.exec();
```

### Distance

- `.near`

Finds documents in an area. The radius is in miles.


```javascript
Elasto.query({
    index: 'development',
    type: 'tweets'
})
.near({
    lat: 51.5,
    lon: -0.1467912,
    radius: 2
})
.exec();
```

### From

- `.from`
- `.offset`

Skips documents in the query.

```javascript
Elasto.query({
    index: 'development',
    type: 'tweets'
})
.from(3)
.exec();
```

### Range

- `.range`

Find documents where the field matches a range.


```javascript
Elasto.query({
    index: 'development',
    type: 'tweets'
})
.range('characters', [120, 150])
.exec();
```

You can also query the distance range. It will sort based on the `location` field in the document. All the distances are in miles.

```javascript
Elasto.query({
    index: 'development',
    type: 'tweets'
})
.range('distance', {
    lat: 51.5,
    lon: -0.1467912,
    from: 2,
    to: 3
})
.exec();
```

### Fields


- `.fields`

Only return the specific fields.

```javascript
Elasto.query({
    index: 'development',
    type: 'tweets'
})
.fields(['name', 'id'])
.exec();
```

### Exclude

- `.exclude`
- `.not`

Excludes documents where the query gets matched (opposite of `.where`).


```javascript
Elasto.query({
    index: 'development',
    type: 'tweets'
})
.not('username', '@hater666')
.exec();
```

### License
`elasto` is released under the MIT license. See `LICENSE.txt` for the complete text.

### Contributors

* [Arnaud Benard](github.com/arnaudbenard)
* [Vadim Demedes](https://github.com/vdemedes)
* [Peter Kadlot](github.com/daralthus)
* [Alex Loizou](github.com/alexloi)
