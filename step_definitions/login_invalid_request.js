var world = require('../support/world');
var request = require('request');
var assert = require('assert');

module.exports = function(){
    this.When(/^the client app requests log in the protected application with invalid credentials$/, function (callback) {
        world.getUser().password = '';

        var options = {
            url: 'http://localhost:3000/auth/login',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method:'POST',
            body : JSON.stringify(world.getUser())
        };

        request(options, function(err,res,body) {
            assert.equal(err,null);
            world.getResponse().statusCode = res.statusCode;
            world.getResponse().body = JSON.parse(body);
            callback();
        });
    });
};
