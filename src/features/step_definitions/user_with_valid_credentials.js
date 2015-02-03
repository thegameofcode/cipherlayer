var world = require('../support/world');
var request = require('request');
var assert = require('assert');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

module.exports = function(){
    this.Given(/^a user of client app with valid credentials$/, function (callback) {
        world.getUser().username = 'valid_user' + (config.allowedDomains[0] ? config.allowedDomains[0] : '');
        world.getUser().password = 'valid_password';

        var options = {
            url: 'http://localhost:'+config.public_port+'/auth/user',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization basic': new Buffer(config.management.clientId + ':' + config.management.clientSecret).toString('base64')
            },
            method:'POST',
            body : JSON.stringify(world.getUser())
        };

        options.headers[config.version.header] = "test/1";

        request(options, function(err,res,body) {
            assert.equal(err,null);
            assert.equal(res.statusCode, 201);
            callback();
        });
    });
};