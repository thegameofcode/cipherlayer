var cipherlayer = require('../cipherlayer.js');
var assert = require('assert');
var net = require('net');
var request = require('request');


var PORT = 3000;
var CIPHER_KEY = 'zUTaFRu7raze';
var SIGN_KEY = '3aBuvuQatres';
var EXPIRATION = 10;

var ciphertoken = require('ciphertoken');
var cToken = ciphertoken.create(CIPHER_KEY,SIGN_KEY, {
    accessTokenExpirationMinutes: EXPIRATION
});

describe('server control ', function(){

    it(':: start & stops', function(done){
        cipherlayer.start(PORT, function() {
            var client = net.connect({port:PORT}, function(){
                client.end();

                cipherlayer.stop(function () {
                    var free = true;
                    var tester = net.createServer();
                    tester.once('error', function(err){
                        if(err.code === 'EADDRINUSE'){
                            free = false;
                        }
                    });

                    tester.once('listening', function(){
                        tester.close();
                        if(free) done();
                    });

                    tester.listen(PORT);
                });
            });
        });
    })
});

describe('/auth', function(){

    beforeEach(function(done){
        cipherlayer.setCryptoKeys(CIPHER_KEY, SIGN_KEY, EXPIRATION);
        cipherlayer.start(PORT, done);
    });

    afterEach(function(done){
        cipherlayer.stop(done);
    });

    it('set crypto keys', function(done){
        cipherlayer.setCryptoKeys(CIPHER_KEY, SIGN_KEY, EXPIRATION);
        done();
    });

    it('/login OK', function(done){
        var username = 'validuser';
        var password = 'validpassword';

        var options = {
            url: 'http://localhost:3000/auth/login',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method:'POST',
            body : JSON.stringify({username:username,password:password})
        };

        request(options, function(err,res,body) {
            assert.equal(err,null);
            assert.equal(res.statusCode, 200);
            body = JSON.parse(body);
            assert.notEqual(body,undefined);

            assert.notEqual(body.accessToken,undefined);
            var accessTokenInfo = cToken.getAccessTokenSet(body.accessToken);
            assert.equal(accessTokenInfo.err,null);
            assert.equal(accessTokenInfo.consummerId,'validuser');

            assert.notEqual(body.refreshToken,undefined);
            var refreshTokenInfo = cToken.getAccessTokenSet(body.refreshToken);
            assert.equal(refreshTokenInfo.err,null);
            assert.equal(refreshTokenInfo.consummerId,'validuser');

            assert.equal(body.expiresIn, EXPIRATION*60);
            done();
        });
    });
});
