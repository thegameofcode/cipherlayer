var world = require('../support/world');
var request = require('request');
var assert = require('assert');
var async = require('async');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

module.exports = function(){
    this.Given(/^a client application with a valid access token$/, function (callback) {

        async.series([

            // User post
            function(done){
                world.getUser().id = 'a1b2c3d4e5f6';
                world.getUser().username = 'valid_user';
                world.getUser().password = 'valid_password';

                var options = {
                    url: 'http://localhost:' + config.public_port+'/auth/user',
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
                    done();
                });
            },

            //User login
            function(done){
                var options = {
                    url: 'http://localhost:'+config.public_port+'/auth/login',
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
                    world.getResponse().statusCode = res.statusCode;
                    body = JSON.parse(body);
                    world.getResponse().body = body;
                    world.getTokens().accessToken = body.accessToken;
                    world.getTokens().refreshToken = body.refreshToken;
                    world.getTokens().expiresIn = body.expiresIn;
                    done();
                });
            }
        ],function(err){
            assert.equal(err,null);
            callback();
        });
    });
};
