var Backbone = require('backbone'),
    Promise  = require('bluebird'),
    request  = require('request'),
    _        = require('lodash');

var Class = Backbone.Model;

var Elasto = {
    basePath: null,
    
    connect: function (url) {
        this.basePath = url;
    }
};

var Document = Elasto.Document = Backbone.Model.extend({
    idAttribute: '_id',
    
    save: function () {
        var url = Elasto.basePath + '/' + this.name + '/' + this.id;
        var body = this.toJSON();
        
        return new Promise(function (resolve, reject) {
           request({
              url: url,
              method: 'PUT',
              json: body
           }, function (err, res, body) {
               if (err) return reject(err);
               
               resolve();
           });
        });
    }
}, {
    find: function () {
        var query = new Query({ model: this });
        return query.find.apply(query, arguments);
    }
});

var Query = Class.extend({
   initialize: function (options) {
       this.options = options;
   },
   
   find: function () {
       var Model = this.options.model;
       var url = Elasto.basePath + '/' + Model.name + '/_search';
       
       return new Promise(function (resolve, reject) {
           request({
               url: url,
               method: 'GET'
           }, function (err, res, body) {
              if (err) return reject(err);
              
              var response = JSON.parse(body);
              var documents = [];
              
              response.hits.hits.forEach(function (hit) {
                  var attrs = _.extend(hit._source, { _id: hit._id });
                  var doc = new Model(attrs);
                  documents.push(doc);
              });
              
              resolve(documents);
           });
       });
   }
});

module.exports = Elasto;