var request = require('request');
var assert = require('assert');

var cipherlayer = require('../../cipherlayer');
var world = require('./world');

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

module.exports = function(){
    this.Before(function(done){

        world.resetUser();

        cipherlayer.start(config.public_port, config.private_port, function(err){

            assert.equal(err,null);
            var options = {
                url: 'http://localhost:'+config.public_port+'/auth/user',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Authorization basic': new Buffer(config.management.clientId + ':' + config.management.clientSecret).toString('base64')
                },
                method:'DELETE'
            };

            options.headers[config.version.header] = "test/1";
            request(options, function(err,res,body) {
                assert.equal(err,null);
                assert.equal(res.statusCode, 204);
                assert.equal(body,'');
                done();
            });
        });
    });

    this.After(function(done){
       cipherlayer.stop(done);
    });
};
