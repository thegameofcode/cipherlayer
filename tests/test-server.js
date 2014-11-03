var cipherlayer = require('../cipherlayer.js');
var assert = require('assert');
var net = require('net');
var request = require('request');
var dao = require('../dao.js');
var async = require('async');

var PORT = 3000;
var CIPHER_KEY = 'zUTaFRu7raze';
var SIGN_KEY = '3aBuvuQatres';
var EXPIRATION = 10;

var ciphertoken = require('ciphertoken');
var cToken = ciphertoken.create(CIPHER_KEY,SIGN_KEY, {
    accessTokenExpirationMinutes: EXPIRATION
});

describe('server control ', function(){

    it('start & stops', function(done){
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

    it('set crypto keys', function(done){
        cipherlayer.setCryptoKeys(CIPHER_KEY, SIGN_KEY, EXPIRATION);
        done();
    });
});

describe('API',function(){
    beforeEach(function(done){
        cipherlayer.setCryptoKeys(CIPHER_KEY, SIGN_KEY, EXPIRATION);
        async.parallel([
            function(done){
                dao.deleteAllUsers(done);
            },
            function(done){
                cipherlayer.start(PORT, done);
            }
        ],done);
    });

    afterEach(function(done){
        cipherlayer.stop(done);
    });

    describe('/auth', function(){
        describe('/login',function(){
            it('POST 200', function(done){
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

                request(options,function(err,res,body){
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

    });

    describe('/user', function(){
        var username = 'validuser';
        var password = 'validpassword';

        it('POST 201', function(done){
            postUser(username,password, function(err,res,body){
                assert.equal(err,null);
                assert.equal(res.statusCode, 201);
                done();
            });
        });

        it('POST 409 already_exists', function(done){
            postUser(username,password, function(err,res,body){
                assert.equal(err,null);
                assert.equal(res.statusCode, 201);
                postUser(username,password, function(err,res,body){
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 409);
                    body = JSON.parse(body);
                    assert.equal(body.err,'username_already_exists');
                    done();
                });
            });
        });
    });

    function postUser(username,password,cbk){
        var options = {
            url: 'http://localhost:3000/user',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method:'POST',
            body : JSON.stringify({username:username,password:password})
        };

        request(options, cbk);
    }
});
