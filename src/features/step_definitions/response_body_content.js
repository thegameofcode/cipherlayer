var world = require('../support/world');
var assert = require('assert');

module.exports = function(){
    this.Given(/^the response body must be (.*)$/, function (PAYLOAD, callback) {
        assert.deepEqual(world.getResponse().body, JSON.parse(PAYLOAD));
        callback();
    });
};