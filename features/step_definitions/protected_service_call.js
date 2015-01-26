var world = require('../support/world');
var request = require('request');
var assert = require('assert');

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

module.exports = function(){
    this.When(/^the application makes a (.*) with (.*) to a protected (.*)$/, function (METHOD, PAYLOAD, PATH, callback) {
        var options = {
            url: 'http://localhost:' + config.public_port + PATH,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': 'bearer ' + world.getTokens().accessToken
            },
            method: METHOD
        };

        if (METHOD == 'POST'){
            options.body = PAYLOAD
        }
        options.headers[config.version.header] = "test/1";

        request(options, function(err,res,body) {
            assert.equal(err,null);
            world.getResponse().statusCode = res.statusCode;
            world.getResponse().body = JSON.parse(body);
            callback();
        });
    });
};
