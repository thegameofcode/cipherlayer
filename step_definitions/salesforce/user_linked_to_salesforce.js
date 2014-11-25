var world = require('../../support/world');
var request = require('request');
var assert = require('assert');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

module.exports = function(){
    this.Given(/^a user with valid credentials in SalesForce linked to SalesForce$/, function (callback) {
        world.getUser().username = 'valid_user';
        world.getUser().password = 'valid_password';

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