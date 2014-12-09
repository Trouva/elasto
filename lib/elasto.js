var Bluebird = require('bluebird');
var _ = require('lodash');
var elasticsearch = require('elasticsearch');

var Elasto = {

    config: {},

    set: function(key, value) {
        this.config[key] = value;
        if (key === 'host') {
            this._setupClient();
        }
    },

    _setupClient: function() {
        var instance = new elasticsearch.Client({
            host: this.config.host,
            log: 'trace'
        });
        this.client = instance;
    }

};


function Model(config) {

    var Document = function(attrs){
        this.index = config.index;
        this.type = config.type;
        this.save = function(){
            console.log('save ', attrs);
        };
    };

    Document.find = function(opts){
        console.log('find ', config.type, opts);
            return Bluebird.resolve({});
    };

    Document.setup = function() {
        console.log('putaiiiin');
        return Bluebird.resolve({});
    };

    return Document;
};


module.exports = Elasto;
module.exports.Model = Model;

