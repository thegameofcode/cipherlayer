var world = require('../support/world');
var request = require('request');
var assert = require('assert');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

var myStepDefinitionsWrapper = function () {
    this.Then(/^the response has no error$/, function (callback) {
        assert.equal(world.getResponse().err, null);
        callback();
    });
};
module.exports = myStepDefinitionsWrapper;