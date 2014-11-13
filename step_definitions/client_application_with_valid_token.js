var world = require('../support/world');
var request = require('request');
var assert = require('assert');
var async = require('async');

module.exports = function(){
    this.Given(/^a client application with a valid access token$/, function (callback) {

        async.series([

            // User post
            function(done){
                world.getUser().username = 'valid_user';
                world.getUser().password = 'valid_password';

                var options = {
                    url: 'http://localhost:3000/auth/user',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method:'POST',
                    body : JSON.stringify(world.getUser())
                };

                request(options, function(err,res,body) {
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 201);
                    done();
                });
            },

            //User login
            function(done){
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
                    done();
                });
            }
        ],function(err){
            assert.equal(err,null);
            callback();
        });
    });
};
