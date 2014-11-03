var world = require('../support/world');
var request = require('request');
var assert = require('assert');

module.exports = function(){
    this.Given(/^a user of client app with valid credentials$/, function (callback) {
        world.getUser().username = 'valid_user';
        world.getUser().password = 'valid_password';

        var options = {
            url: 'http://localhost:3000/user',
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