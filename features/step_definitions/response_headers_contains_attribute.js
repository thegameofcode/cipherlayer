var world = require('../support/world');
var assert = require('assert');

module.exports = function(){
    this.Then(/^the response headers contains attribute "([^"]*)"$/, function (attribute,callback) {
        var headers = world.getResponse().headers;
        if (headers[attribute.toLowerCase()]){
            callback();
        } else {
            callback.fail();
        }
    });

    this.Then(/^the response headers contains attribute "([^"]*)" which contains the custom headers$/, function (attribute, callback) {
        var customHeaders = this.accessControlAllow.headers;
        var headers = world.getResponse().headers;

        customHeaders.forEach(function(header){
            assert.notEqual(headers[attribute.toLowerCase()].indexOf(header), -1);
        });
        callback();
    });

    this.Then(/^the response headers does not contain attribute "([^"]*)"$/, function (attribute,callback) {
        var headers = world.getResponse().headers;
        if (headers[attribute.toLowerCase()]){
            callback.fail();
        } else {
            callback();
        }
    });
};