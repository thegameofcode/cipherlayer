var clone = require('clone');
var nock = require('nock');
var request = require('request');
var ciphertoken = require('ciphertoken');
var assert = require('assert');
var fs = require('fs');
var redisMng = require('../../src/managers/redis');

var dao = require('../../src/dao.js');
var config = require('../../config.json');

var notifServiceURL = config.services.notifications;

module.exports = {
    itCreated: function created(accessTokenSettings, refreshTokenSettings){
        it.skip('201 Created', function (done) {
            var expectedUsername = 'valid' + (config.allowedDomains[0] ? config.allowedDomains[0] : '');
            var expectedUserId = 'a1b2c3d4e5f6';
            var expectedUserPhone = '111111111';
            var expectedUserCountry = 'US';
            var expectedPublicRequest = {};
            expectedPublicRequest[config.passThroughEndpoint.username] = expectedUsername;
            expectedPublicRequest[config.passThroughEndpoint.password] = '12345678';
            expectedPublicRequest.phone = expectedUserPhone;
            expectedPublicRequest.country = expectedUserCountry;

            var expectedPrivateResponse = clone(expectedPublicRequest);
            delete(expectedPrivateResponse[config.passThroughEndpoint.password]);

            nock('http://' + config.private_host + ':' + config.private_port)
                .post(config.passThroughEndpoint.path, expectedPrivateResponse)
                .reply(201, {id: expectedUserId});

            var redisKey = config.redisKeys.user_phone_verify.key;
            redisKey = redisKey.replace('{userId}',expectedUsername).replace('{phone}','+1' + expectedUserPhone);

            var pin = 'xxxx';

            redisMng.insertKeyValue(redisKey + '.pin', pin, config.redisKeys.user_phone_verify.expireInSec, function(err){
                assert.equal(err, null);
                redisMng.insertKeyValue(redisKey + '.attempts', config.userPIN.attempts , config.redisKeys.user_phone_verify.expireInSec, function(err){
                    assert.equal(err, null);

                    nock('http://' + config.private_host + ':' + config.private_port)
                        .post(config.passThroughEndpoint.path, expectedPrivateResponse)
                        .reply(201, {id: expectedUserId});

                    var options = {
                        url: 'http://' + config.private_host + ':' + config.public_port + config.passThroughEndpoint.path,
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'x-otp-pin': pin
                        },
                        method: 'POST',
                        body: JSON.stringify(expectedPublicRequest)
                    };
                    options.headers[config.version.header] = "test/1";

                    request(options, function (err, res, body) {
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 201, body);
                        body = JSON.parse(body);

                        assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
                        assert.notEqual(body.accessToken, undefined);
                        ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function (err, accessTokenInfo) {
                            assert.equal(err, null);
                            assert.equal(accessTokenInfo.userId, expectedUserId);

                            assert.notEqual(body.refreshToken, undefined);
                            ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function (err, refreshTokenInfo) {
                                assert.equal(err, null);
                                assert.equal(refreshTokenInfo.userId, expectedUserId);

                                dao.getFromUsername(expectedUsername, function (err, foundUser) {
                                    assert.equal(err, null);
                                    assert.equal(foundUser.platforms, undefined);
                                    done();
                                });
                            });
                        });
                    });

                });
            });

        });
    },
    itPlatformInfo: function platformInfo(accessTokenSettings, refreshTokenSettings){
        it.skip('203 Platform Info', function (done) {

            var expectedUsername = 'valid' + (config.allowedDomains[0] ? config.allowedDomains[0] : '');
            var expectedUserId = 'a1b2c3d4e5f6';
            var expectedUserPhone = '222222222';
            var expectedUserCountry = 'US';
            var expectedPublicRequest = {};
            expectedPublicRequest[config.passThroughEndpoint.username] = expectedUsername;
            expectedPublicRequest.phone = expectedUserPhone;
            expectedPublicRequest.country = expectedUserCountry;

            ciphertoken.createToken(accessTokenSettings, expectedUserId, null, {
                accessToken: 'acc',
                refreshToken: 'ref',
                expiresIn: accessTokenSettings.tokenExpirationMinutes * 60
            }, function (err, sfToken) {
                expectedPublicRequest.sf = sfToken;

                var expectedPrivateResponse = clone(expectedPublicRequest);
                delete(expectedPrivateResponse[config.passThroughEndpoint.password]);

                nock('http://' + config.private_host + ':' + config.private_port)
                    .post(config.passThroughEndpoint.path, expectedPrivateResponse)
                    .reply(203, {id: expectedUserId});

                var redisKey = config.redisKeys.user_phone_verify.key;
                redisKey = redisKey.replace('{userId}',expectedUsername).replace('{phone}','+1'+expectedUserPhone);

                var pin = 'xxxx';

                redisMng.insertKeyValue(redisKey + '.pin', pin, config.redisKeys.user_phone_verify.expireInSec, function(err){
                    assert.equal(err, null);
                    redisMng.insertKeyValue(redisKey + '.attempts', config.userPIN.attempts , config.redisKeys.user_phone_verify.expireInSec, function(err){
                        assert.equal(err, null);

                        var options = {
                            url: 'http://' + config.private_host + ':' + config.public_port + config.passThroughEndpoint.path,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8',
                                'x-otp-pin': pin
                            },
                            method: 'POST',
                            body: JSON.stringify(expectedPublicRequest)
                        };
                        options.headers[config.version.header] = "test/1";

                        nock(notifServiceURL)
                            .post('/notification/email')
                            .reply(204);

                        request(options, function (err, res, body) {
                            assert.equal(err, null);
                            assert.equal(res.statusCode, 201);
                            body = JSON.parse(body);

                            assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
                            assert.notEqual(body.accessToken, undefined);
                            ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function (err, accessTokenInfo) {
                                assert.equal(err, null);
                                assert.equal(accessTokenInfo.userId, expectedUserId);

                                assert.notEqual(body.refreshToken, undefined);
                                ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function (err, refreshTokenInfo) {
                                    assert.equal(err, null);
                                    assert.equal(refreshTokenInfo.userId, expectedUserId);

                                    dao.getFromUsername(expectedUsername, function (err, foundUser) {
                                        assert.equal(err, null);
                                        assert.notEqual(foundUser.platforms, undefined);
                                        assert.equal(foundUser.platforms.length, 1);
                                        assert.equal(foundUser.platforms[0].platform, 'sf');
                                        assert.equal(foundUser.platforms[0].accessToken, 'acc');
                                        assert.equal(foundUser.platforms[0].refreshToken, 'ref');
                                        assert.notEqual(foundUser.platforms[0].expiry, undefined);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });

            });
        });
    },
    itAlreadyExists: function alreadyExists(accessTokenSettings, refreshTokenSettings){
        it.skip('409 already exists', function (done) {
            var expectedUsername = 'valid'+ (config.allowedDomains[0] ? config.allowedDomains[0] : '');
            var expectedUserId = 'a1b2c3d4e5f6';
            var expectedPublicRequest = {};
            var expectedUserPhone = '222222222';
            var expectedUserCountry = 'US';
            expectedPublicRequest[config.passThroughEndpoint.username] = 'valid'+ (config.allowedDomains[0] ? config.allowedDomains[0] : '');
            expectedPublicRequest[config.passThroughEndpoint.password] = '12345678';
            expectedPublicRequest.phone = expectedUserPhone;
            expectedPublicRequest.country = expectedUserCountry;

            var expectedPrivateResponse = clone(expectedPublicRequest);
            delete(expectedPrivateResponse[config.passThroughEndpoint.password]);

            nock('http://' + config.private_host + ':' + config.private_port)
                .post(config.passThroughEndpoint.path, expectedPrivateResponse)
                .reply(201, {id: expectedUserId});

            var redisKey = config.redisKeys.user_phone_verify.key;
            redisKey = redisKey.replace('{userId}',expectedUsername).replace('{phone}','+1'+expectedUserPhone);

            var pin = 'xxxx';

            redisMng.insertKeyValue(redisKey + '.pin', pin, config.redisKeys.user_phone_verify.expireInSec, function(err){
                assert.equal(err, null);
                redisMng.insertKeyValue(redisKey + '.attempts', config.userPIN.attempts , config.redisKeys.user_phone_verify.expireInSec, function(err){
                    assert.equal(err, null);

                    var options = {
                        url: 'http://' + config.private_host + ':' + config.public_port + config.passThroughEndpoint.path,
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'x-otp-pin': pin
                        },
                        method: 'POST',
                        body: JSON.stringify(expectedPublicRequest)
                    };
                    options.headers[config.version.header] = "test/1";

                    nock(notifServiceURL)
                        .post('/notification/email')
                        .reply(204);

                    request(options, function (err, res, body) {
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 201, body);
                        body = JSON.parse(body);

                        assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
                        assert.notEqual(body.accessToken, undefined);
                        ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function (err, accessTokenInfo) {
                            assert.equal(err, null);
                            assert.equal(accessTokenInfo.userId, expectedUserId);

                            assert.notEqual(body.refreshToken, undefined);
                            ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function (err, refreshTokenInfo) {
                                assert.equal(err, null);
                                assert.equal(refreshTokenInfo.userId, expectedUserId);
                                done();
                            });
                        });
                    });
                });
            });
        });
    },
    itNotSecurityToken: function notSecurityToken(){
        it('400 not security token', function (done) {
            var expectedPublicRequest = {};
            expectedPublicRequest[config.passThroughEndpoint.username] = 'valid' + (config.allowedDomains[0] ? config.allowedDomains[0] : '');

            var options = {
                url: 'http://' + config.private_host + ':' + config.public_port + config.passThroughEndpoint.path,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method: 'POST',
                body: JSON.stringify(expectedPublicRequest)
            };
            options.headers[config.version.header] = "test/1";

            request(options, function (err, res, body) {
                assert.equal(err, null);
                assert.equal(res.statusCode, 400);
                body = JSON.parse(body);
                assert.equal(body.err, 'invalid_security_token');
                assert.equal(body.des, 'you must provide a password or a salesforce token to create the user');
                done();
            });
        });
    },
    itCreatedVerifyMail: function createdVerifyMail(accessTokenSettings, refreshTokenSettings){
        it.skip('201 Created (Verify email)', function (done) {
            var expectedUsername = 'valid' + (config.allowedDomains[0] ? config.allowedDomains[0] : '');
            var expectedUserId = 'a1b2c3d4e5f6';
            var expectedUserPhone = '111111111';
            var expectedUserCountry = 'US';
            var expectedPublicRequest = {};
            expectedPublicRequest[config.passThroughEndpoint.username] = expectedUsername;
            expectedPublicRequest[config.passThroughEndpoint.password] = '12345678';
            expectedPublicRequest.phone = expectedUserPhone;
            expectedPublicRequest.country = expectedUserCountry;

            var expectedPrivateResponse = clone(expectedPublicRequest);
            delete(expectedPrivateResponse[config.passThroughEndpoint.password]);

            nock('http://' + config.private_host + ':' + config.private_port)
                .post(config.passThroughEndpoint.path, expectedPrivateResponse)
                .times(2)
                .reply(201, {id: expectedUserId});

            nock(notifServiceURL)
                .post('/notification/email')
                .reply(204);

            var redisKey = config.redisKeys.user_phone_verify.key;
            redisKey = redisKey.replace('{userId}',expectedUsername).replace('{phone}','+1' + expectedUserPhone);

            var pin = 'xxxx';

            redisMng.insertKeyValue(redisKey + '.pin', pin, config.redisKeys.user_phone_verify.expireInSec, function(err){
                assert.equal(err, null);
                redisMng.insertKeyValue(redisKey + '.attempts', config.userPIN.attempts, config.redisKeys.user_phone_verify.expireInSec, function(err){
                    assert.equal(err, null);

                    var options = {
                        url: 'http://' + config.private_host + ':' + config.public_port + config.passThroughEndpoint.path,
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'x-otp-pin': pin
                        },
                        method: 'POST',
                        body: JSON.stringify(expectedPublicRequest)
                    };
                    options.headers[config.version.header] = "test/1";

                    request(options, function (err, res, body) {
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 200, body);
                        body = JSON.parse(body);
                        assert.deepEqual(body, {des: expectedUsername}, body);

                        //Check the redis transactionId for the user
                        var redisKey = config.redisKeys.direct_login_transaction.key;
                        redisKey = redisKey.replace('{username}', expectedUsername);

                        redisMng.getKeyValue(redisKey, function(err, transactionId) {
                            assert.equal(err,null);
                            assert.notEqual(transactionId, null);
                            assert.equal(transactionId.length, 24);
                            done();
                        });
                    });

                });
            });

        });
    }
};
