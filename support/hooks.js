var cipherlayer = require('../cipherlayer');

var world = require('../support/world');
var request = require('request');
var assert = require('assert');

var PORT = 3000;
var CIPHER_KEY = 'zUTaFRu7raze';
var SIGN_KEY = '3aBuvuQatres';
var EXPIRATION = 10;

module.exports = function(){
    this.Before(function(done){
        cipherlayer.setCryptoKeys(CIPHER_KEY, SIGN_KEY, EXPIRATION);
        cipherlayer.start(PORT, function(err){
            assert.equal(err,null);

            var options = {
                url: 'http://localhost:3000/auth/user',
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