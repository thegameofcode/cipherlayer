var assert = require('assert');
var spawn = require('child_process').spawn;
var net = require('net');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));
var async = require('async');
var nock = require('nock');
var request = require('request');
var cipherlayer = require('../cipherlayer');
var clone = require('clone');
var dao = require('../dao.js');
var ciphertoken = require('ciphertoken');

var accessTokenSettings = {
    cipherKey: config.accessToken.cipherKey,
    firmKey: config.accessToken.signKey,
    tokenExpirationMinutes: config.accessToken.expiration * 60
};

var refreshTokenSettings = {
    cipherKey: config.accessToken.cipherKey,
    firmKey: config.accessToken.signKey,
    tokenExpirationMinutes: config.accessToken.expiration * 1000
};

describe('proxy', function(){

    it('launchs', function(done){
        var cipherlayer;
        async.series([
            function(done){
                cipherlayer = spawn('node', ['main']);
                cipherlayer.stdout.on('data', function(data){
                    if(String(data).indexOf('listening on port') > -1){
                        done();
                    }
                });
            },
            function(done){
                var client = net.connect({port:config.public_port}, function(){
                    client.destroy();
                    cipherlayer.kill('SIGTERM');
                    done();
                });
            }
        ],function(){
            done();
        });
    });

    describe('protected calls', function(){
        beforeEach(function(done){
            cipherlayer.setCryptoKeys(config.accessToken.cipherKey, config.accessToken.signKey, config.accessToken.expiration);
            cipherlayer.start(config.public_port, config.private_port, function(err){
                assert.equal(err,null);
                dao.deleteAllUsers(function(err){
                    assert.equal(err,null);
                    done();
                });
            });
        });

        afterEach(function(done){
            cipherlayer.stop(done);
        });

        describe('standard', function(){
            it('401 Unauthorized', function(done){
                var expectedBody = {field1:'value1', field2:'value2'};

                var options = {
                    url: 'http://localhost:' + config.public_port + '/api/standard',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method: 'POST',
                    body: JSON.stringify(expectedBody)
                };

                request(options, function(err,res,body) {
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 401);
                    assert.notEqual(body, undefined);
                    done();
                });
            });
        });

        describe('pass through', function(){
            it('201 Created', function(done){
                var expectedUsername='valid@my-comms.com';
                var expectedUserId = 'a1b2c3d4e5f6';
                var expectedPublicRequest = {};
                expectedPublicRequest[config.passThroughEndpoint.username]=expectedUsername;
                expectedPublicRequest[config.passThroughEndpoint.password]='12345678';

                var expectedPrivateResponse = clone(expectedPublicRequest);
                delete(expectedPrivateResponse[config.passThroughEndpoint.password]);

                nock('http://localhost:'+config.private_port)
                    .post(config.passThroughEndpoint.path, expectedPrivateResponse)
                    .reply(201, {id:expectedUserId});

                var options = {
                    url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method: 'POST',
                    body: JSON.stringify(expectedPublicRequest)
                };

                request(options, function(err,res,body) {
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 201);
                    body = JSON.parse(body);

                    assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
                    assert.notEqual(body.accessToken,undefined);
                    ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function(err, accessTokenInfo){
                        assert.equal(err,null);
                        assert.equal(accessTokenInfo.userId,expectedUserId);

                        assert.notEqual(body.refreshToken,undefined);
                        ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function(err, refreshTokenInfo){
                            assert.equal(err,null);
                            assert.equal(refreshTokenInfo.userId,expectedUserId);

                            dao.getFromUsername(expectedUsername, function(err, foundUser){
                                assert.equal(err,null);
                                assert.equal(foundUser.platforms,undefined);
                                done();
                            });
                        });
                    });
                });
            });

            it('203 Platform Info', function(done){

                var expectedUsername = 'valid@my-comms.com';
                var expectedUserId = 'a1b2c3d4e5f6';
                var expectedPublicRequest = {};
                expectedPublicRequest[config.passThroughEndpoint.username]=expectedUsername;

                ciphertoken.createToken(accessTokenSettings, expectedUserId, null, {accessToken:'acc', refreshToken:'ref', expiresIn:1234}, function(err, sfToken){
                    expectedPublicRequest.sf = sfToken;

                    var expectedPrivateResponse = clone(expectedPublicRequest);
                    delete(expectedPrivateResponse[config.passThroughEndpoint.password]);

                    nock('http://localhost:'+config.private_port)
                        .post(config.passThroughEndpoint.path, expectedPrivateResponse)
                        .reply(203, {id:expectedUserId});

                    var options = {
                        url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8'
                        },
                        method: 'POST',
                        body: JSON.stringify(expectedPublicRequest)
                    };

                    request(options, function(err,res,body) {
                        assert.equal(err,null);
                        console.log(body);
                        assert.equal(res.statusCode, 201);
                        body = JSON.parse(body);

                        assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
                        assert.notEqual(body.accessToken,undefined);
                        ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function(err, accessTokenInfo){
                            assert.equal(err,null);
                            assert.equal(accessTokenInfo.userId,expectedUserId);

                            assert.notEqual(body.refreshToken,undefined);
                            ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function(err, refreshTokenInfo){
                                assert.equal(err,null);
                                assert.equal(refreshTokenInfo.userId,expectedUserId);

                                dao.getFromUsername(expectedUsername, function(err, foundUser){
                                    assert.equal(err,null);
                                    assert.notEqual(foundUser.platforms,undefined);
                                    assert.equal(foundUser.platforms.length, 1);
                                    assert.equal(foundUser.platforms[0].platform, 'sf');
                                    assert.notEqual(foundUser.platforms[0].accessToken, undefined);
                                    assert.notEqual(foundUser.platforms[0].refreshToken, undefined);
                                    assert.notEqual(foundUser.platforms[0].expiry, undefined);
                                    done();
                                });
                            });
                        });
                    });                });
            });

            it('409 already exists', function(done){
                var expectedUserId = 'a1b2c3d4e5f6';
                var expectedPublicRequest = {};
                expectedPublicRequest[config.passThroughEndpoint.username]='valid@my-comms.com';
                expectedPublicRequest[config.passThroughEndpoint.password]='12345678';

                var expectedPrivateResponse = clone(expectedPublicRequest);
                delete(expectedPrivateResponse[config.passThroughEndpoint.password]);

                nock('http://localhost:'+config.private_port)
                    .post(config.passThroughEndpoint.path, expectedPrivateResponse)
                    .reply(201, {id:expectedUserId});

                var options = {
                    url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method: 'POST',
                    body: JSON.stringify(expectedPublicRequest)
                };

                request(options, function(err,res,body) {
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 201);
                    body = JSON.parse(body);

                    assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
                    assert.notEqual(body.accessToken,undefined);
                    ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function(err, accessTokenInfo){
                        assert.equal(err,null);
                        assert.equal(accessTokenInfo.userId,expectedUserId);

                        assert.notEqual(body.refreshToken,undefined);
                        ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function(err, refreshTokenInfo){
                            assert.equal(err,null);
                            assert.equal(refreshTokenInfo.userId,expectedUserId);
                            done();
                        });
                    });
                });
            });

            it('400 not security token', function(done){
                var expectedPublicRequest = {};
                expectedPublicRequest[config.passThroughEndpoint.username]='valid@my-comms.com';

                var options = {
                    url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method: 'POST',
                    body: JSON.stringify(expectedPublicRequest)
                };

                request(options, function(err,res,body) {
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 400);
                    body = JSON.parse(body);
                    assert.equal(body.err,'invalid_security_token');
                    assert.equal(body.des,'you must provide a password or a salesforce token to create the user');
                    done();
                });
            });
        });
    });

});
