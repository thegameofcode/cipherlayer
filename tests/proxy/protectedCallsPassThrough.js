var clone = require('clone');
var nock = require('nock');
var request = require('request');
var ciphertoken = require('ciphertoken');
var assert = require('assert');
var redisMng = require('../../src/managers/redis');

var dao = require('../../src/managers/dao.js');
var config = require('../../config.json');

var notificationsServiceURL = config.externalServices.notifications.base;
var notificationsServicePath = config.externalServices.notifications.pathEmail;

module.exports = {
    itCreated: function created(accessTokenSettings, refreshTokenSettings){
        it('201 Created', function (done) {

            // This is required to skip the email verification step and avoid a hanging request targeted at the email verification endpoint
            config.emailVerification = false;

            var expectedUsername = 'valid' + (config.allowedDomains[0] ? config.allowedDomains[0] : '');
            var expectedUserId = 'a1b2c3d4e5f6';
            var expectedUserPhone = '111111111';
            var expectedUserCountry = 'US';
            var expectedPublicRequest = {};
            expectedPublicRequest[config.passThroughEndpoint.username] = expectedUsername;
            expectedPublicRequest[config.passThroughEndpoint.password] = 'P4ssword';
            expectedPublicRequest.phone = expectedUserPhone;
            expectedPublicRequest.country = expectedUserCountry;

            var redisKey = config.phoneVerification.redis.key;
            redisKey = redisKey.replace('{userId}',expectedUsername).replace('{phone}','+1' + expectedUserPhone);

            var pin = 'xxxx';

            redisMng.insertKeyValue(redisKey + '.pin', pin, config.phoneVerification.redis.expireInSec, function(err){
                assert.equal(err, null);
                redisMng.insertKeyValue(redisKey + '.attempts', config.phoneVerification.attempts , config.phoneVerification.redis.expireInSec, function(err){
                    assert.equal(err, null);

                    nock('http://' + config.private_host + ':' + config.private_port)
                        .post(config.passThroughEndpoint.path, expectedPublicRequest)
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
        it('203 Platform Info', function (done) {

            // This is required to skip the email verification step and avoid a hanging request targeted at the email verification endpoint
            config.emailVerification = false;

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

                var redisKey = config.phoneVerification.redis.key;
                redisKey = redisKey.replace('{userId}',expectedUsername).replace('{phone}','+1'+expectedUserPhone);

                var pin = 'xxxx';

                redisMng.insertKeyValue(redisKey + '.pin', pin, config.phoneVerification.redis.expireInSec, function(err){
                    assert.equal(err, null);
                    redisMng.insertKeyValue(redisKey + '.attempts', config.phoneVerification.attempts , config.phoneVerification.redis.expireInSec, function(err){
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

                        nock(notificationsServiceURL)
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
        it('409 already exists', function (done) {
            // This is required to skip the email verification step and avoid a hanging request targeted at the email verification endpoint
            config.emailVerification = false;

            var expectedUsername = 'valid'+ (config.allowedDomains[0] ? config.allowedDomains[0] : '');
            var expectedUserId = 'a1b2c3d4e5f6';
            var expectedPublicRequest = {};
            var expectedUserPhone = '222222222';
            var expectedUserCountry = 'US';

            expectedPublicRequest[config.passThroughEndpoint.username] = 'valid'+ (config.allowedDomains[0] ? config.allowedDomains[0] : '');
            expectedPublicRequest[config.passThroughEndpoint.password] = 'P4ssword';
            expectedPublicRequest.phone = expectedUserPhone;
            expectedPublicRequest.country = expectedUserCountry;

            nock('http://' + config.private_host + ':' + config.private_port)
                .post(config.passThroughEndpoint.path, expectedPublicRequest)
                .reply(201, {id: expectedUserId});

            var redisKey = config.phoneVerification.redis.key;
            redisKey = redisKey.replace('{userId}',expectedUsername).replace('{phone}','+1'+expectedUserPhone);

            var pin = 'xxxx';

            redisMng.insertKeyValue(redisKey + '.pin', pin, config.phoneVerification.redis.expireInSec, function(err){
                assert.equal(err, null);
                redisMng.insertKeyValue(redisKey + '.attempts', config.phoneVerification.attempts , config.phoneVerification.redis.expireInSec, function(err){
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

                    nock(notificationsServiceURL)
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

            // This is required to skip the email verification step and avoid a hanging request targeted at the email verification endpoint
            config.emailVerification = false;

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
    itCreatedVerifyMail: function createdVerifyMail(){
        it('201 Created (Verify email)', function (done) {

            config.emailVerification = {
              "subject": "Example email verification",
              "from": "hello@example.com",
              "body": "<p>Thanks for register into Example, here is a link to activate your account click</p> <p><a href='{link}' >here</a></p> <p>If you have any problems on this process, please contact <a href='mailto:support@example.com'>support@example.com</a> and we will be pleased to help you.</p>",
              "compatibleEmailDevices": [ "*iPhone*", "*iPad*", "*iPod*" , "*Android*"],
              "nonCompatibleEmailMsg": "Your user has been created correctly, try to access to Example app in your device.",
              "redis": {
                "key":"user.{username}.transaction",
                "expireInSec": 86400
              },
              "scheme":"mycomms",
              "redirectUrl": "http://www.google.com"
            };

            var expectedUsername = 'valid' + (config.allowedDomains[0] ? config.allowedDomains[0] : '');
            var expectedUserId = 'a1b2c3d4e5f6';
            var expectedUserPhone = '111111111';
            var expectedUserCountry = 'US';
            var expectedPublicRequest = {};
            expectedPublicRequest[config.passThroughEndpoint.username] = expectedUsername;
            expectedPublicRequest[config.passThroughEndpoint.password] = 'P4ssword';
            expectedPublicRequest.phone = expectedUserPhone;
            expectedPublicRequest.country = expectedUserCountry;

            var expectedPrivateResponse = clone(expectedPublicRequest);
            delete(expectedPrivateResponse[config.passThroughEndpoint.password]);

            nock('http://' + config.private_host + ':' + config.private_port)
                .post(config.passThroughEndpoint.path, expectedPublicRequest)
                .times(2)
                .reply(201, {id: expectedUserId});

            nock(notificationsServiceURL)
                .post(notificationsServicePath)
                .reply(200, {des: expectedUsername});

            var redisKey = config.phoneVerification.redis.key;
            redisKey = redisKey.replace('{userId}',expectedUsername).replace('{phone}','+1' + expectedUserPhone);

            var pin = 'xxxx';

            redisMng.insertKeyValue(redisKey + '.pin', pin, config.phoneVerification.redis.expireInSec, function(err){
                assert.equal(err, null);
                redisMng.insertKeyValue(redisKey + '.attempts', config.phoneVerification.attempts, config.phoneVerification.redis.expireInSec, function(err){
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
                        var redisKey = config.emailVerification.redis.key;
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
