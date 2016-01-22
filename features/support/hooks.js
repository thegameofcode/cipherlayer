var request = require('request');
var assert = require('assert');
var clone = require('clone');

var cipherlayer = require('../../src/cipherlayer');
var world = require('./world');

var config = require('../../config.json');

module.exports = function(){
    this.Before(function(done){

        world.resetUser();
        world.config = clone(config);

        cipherlayer.start(config.public_port, config.internal_port, function(err){

            assert.equal(err,null);
            var options = {
                url: 'http://localhost:'+config.public_port+'/auth/user',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Authorization': 'basic ' + new Buffer(config.management.clientId + ':' + config.management.clientSecret).toString('base64')
                },
                method:'DELETE'
            };

            options.headers[config.version.header] = "test/1";
            request(options, function(err,res,body) {
                assert.equal(err,null);
                assert.equal(res.statusCode, 204, body);
                assert.equal(body,'');
                done();
            });
        });
    });

    this.After(function(done){
        config = world.config;
        cipherlayer.stop(done);
    });
};
