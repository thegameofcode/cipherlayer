var world = require('../../support/world');
var request = require('request');
var assert = require('assert');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

module.exports = function(){
    this.Given(/^a user with valid credentials in SalesForce linked to SalesForce$/, function (callback) {
        world.getUser().id = 'a1b2c3d4e5f6';
        world.getUser().username = 'name.lastname@email.com';
        world.getUser().platforms = [{
            platform:'sf',
            accessToken: 'a1b2c3...d4e5f6',
            refreshToken: 'a1b2c3...d4e5f6',
            expiry: new Date().getTime() + 60 * 1000
        }];

        var options = {
            url: 'http://localhost:'+config.public_port+'/auth/user',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method:'POST',
            body : JSON.stringify(world.getUser())
        };

        request(options, function(err,res,body) {
            assert.equal(err,null);
            assert.equal(res.statusCode, 201);
            callback();
        });
    });
};