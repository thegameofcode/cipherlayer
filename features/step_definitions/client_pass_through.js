var request = require('request');
var assert = require('assert');
var world = require('../support/world');

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

module.exports = function(){
    this.When(/^the client makes a pass through (.*) with the following (.*) in the body$/, function (METHOD, PUBLIC_PAYLOAD, callback) {
        var options = {
            url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method: METHOD,
            body: PUBLIC_PAYLOAD
        };

        request(options, function(err,res,body) {
            assert.equal(err,null);
            world.getResponse().statusCode = res.statusCode;
            world.getResponse().body = JSON.parse(body);
            callback();
        });
    });
}