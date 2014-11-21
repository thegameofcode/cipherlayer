var cipherlayer = require('../cipherlayer');

var world = require('../support/world');
var request = require('request');
var assert = require('assert');

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

module.exports = function(){
    this.Before(function(done){
        cipherlayer.setCryptoKeys(config.accessToken.cipherKey, config.accessToken.signKey, config.accessToken.expiration);
        cipherlayer.start(config.public_port, config.private_port, function(err){
            assert.equal(err,null);

            var options = {
                url: 'http://localhost:'+config.public_port+'/auth/user',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method:'DELETE'
            };

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