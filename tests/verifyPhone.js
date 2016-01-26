var assert = require('assert');
var async = require('async');
var request = require('request');
var nock = require('nock');
var clone = require('clone');
var config = require('../config.json');

var dao = require('../src/managers/dao');
var cipherlayer = require('../src/cipherlayer');
var redisMng = require('../src/managers/redis');

    var HEADERS_WITHOUT_AUTHORIZATION_BASIC = {
    'Content-Type': 'application/json; charset=utf-8'
};

describe('/api/profile (verify phone)', function(){

    var notifServiceURL = config.externalServices.notifications.base;

    var baseUser = {
        email : "valid" + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*','') : ''),
        password : "n3wPas5W0rd",
        phone : "444444444",
        country: "US"
    };

    beforeEach(function(done){
        async.series([
            function(done){
                cipherlayer.start(config.public_port, config.internal_port, done);
            },
            function(done){
                redisMng.deleteAllKeys(done);
            },
            function(done){
                dao.deleteAllUsers(done);
            },
        ], done);
    });

    afterEach(function(done){
        async.series([
            function(done){
                cipherlayer.stop(done);
            }
        ],done);
    });

    it.skip('POST empty phone', function(done){
        var user = clone(baseUser);
        user.phone = null;

        var options = {
            url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
            headers: clone(HEADERS_WITHOUT_AUTHORIZATION_BASIC),
            method:'POST',
            body : JSON.stringify(user)
        };
        options.headers[config.version.header] = "test/1";

        nock(notifServiceURL)
            .post('/notification/sms')
            .reply(204);

        request(options, function(err, res, body){
            assert.equal(err, null, body);
            assert.equal(res.statusCode, 400, body);
            body = JSON.parse(body);
            assert.deepEqual(body, {"err":"auth_proxy_error","des":"empty phone or country"});
            done();
        });
    });

    it.skip('POST empty country', function(done){
        var user = clone(baseUser);
        user.country = '';

        var options = {
            url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
            headers: clone(HEADERS_WITHOUT_AUTHORIZATION_BASIC),
            method:'POST',
            body : JSON.stringify(user)
        };
        options.headers[config.version.header] = "test/1";

        nock(notifServiceURL)
            .post('/notification/sms')
            .reply(204);

        request(options, function(err, res, body){
            assert.equal(err, null, body);
            assert.equal(res.statusCode, 400, body);
            body = JSON.parse(body);
            assert.deepEqual(body, {"err":"auth_proxy_error","des":"empty phone or country"});
            done();
        });
    });

    it.skip('POST phone not verified', function(done){
        var user = clone(baseUser);

        var options = {
            url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
            headers: clone(HEADERS_WITHOUT_AUTHORIZATION_BASIC),
            method:'POST',
            body : JSON.stringify(user)
        };
        options.headers[config.version.header] = "test/1";

        nock(notifServiceURL)
            .post('/notification/sms')
            .reply(204);

        request(options, function(err, res, body){
            assert.equal(err, null, body);
            assert.equal(res.statusCode, 403, body);
            body = JSON.parse(body);
            assert.deepEqual(body, {"err":"auth_proxy_verified_error","des":"User phone not verified"});
            done();
        });
    });

    it.skip('POST incorrect PIN sent (1 attempt)', function(done){
        var user = clone(baseUser);

        var options = {
            url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
            headers: clone(HEADERS_WITHOUT_AUTHORIZATION_BASIC),
            method:'POST',
            body : JSON.stringify(user)
        };
        options.headers[config.version.header] = "test/1";

        nock(notifServiceURL)
            .post('/notification/sms')
            .times(2)
            .reply(204);

        //1st call must create the pin
        request(options, function(err, res, body){
            assert.equal(err, null, body);
            assert.equal(res.statusCode, 403, body);

            options.headers['x-otp-pin'] = 'zzzz';

            //2nd call incorrect pin
            request(options, function(err, res, body) {
                assert.equal(err, null, body);
                assert.equal(res.statusCode, 401, body);
                body = JSON.parse(body);
                assert.deepEqual(body, {"err":"verify_phone_error","des":"PIN used is not valid."});
                done();
            });
        });
    });

    it.skip('POST correct PIN sent', function(done){
        this.timeout(10000);

        var user = clone(baseUser);

        var options = {
            url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
            headers: clone(HEADERS_WITHOUT_AUTHORIZATION_BASIC),
            method:'POST',
            body : JSON.stringify(user)
        };
        options.headers[config.version.header] = "test/1";

        nock(notifServiceURL)
            .post('/notification/sms')
            .reply(204);

        //1st call must create the pin
        request(options, function(err, res, body){
            assert.equal(err, null, body);
            assert.equal(res.statusCode, 403, body);

            var redisKey = config.redisKeys.user_phone_verify.key;
            redisKey = redisKey.replace('{userId}',user.email).replace('{phone}','+1' + user.phone);

            redisMng.getKeyValue(redisKey + '.pin', function(err, redisPhonePin) {
                assert.equal(err, null);

                options.headers['x-otp-pin'] = redisPhonePin;

                var expectedUserId = 'a1b2c3d4e5f6';

                nock('http://' + config.private_host + ':' + config.private_port)
                    .post(config.passThroughEndpoint.path)
                    .reply(201, {id: expectedUserId});

                nock(notifServiceURL)
                    .post('/notification/email')
                    .reply(204);

                //2nd call correct pin
                request(options, function(err, res, body) {
                    assert.equal(err, null, body);
                    assert.equal(res.statusCode, 201, body);
                    body = JSON.parse(body);
                    assert.notEqual(body.accessToken, null, body);
                    assert.notEqual(body.refreshToken, null, body);
                    assert.notEqual(body.expiresIn, null, body);
                    done();
                });

            });

        });
    });

    it.skip('POST incorrect PIN sent (3 attempts)', function(done){
        var user = clone(baseUser);

        var options = {
            url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
            headers: clone(HEADERS_WITHOUT_AUTHORIZATION_BASIC),
            method:'POST',
            body : JSON.stringify(user)
        };
        options.headers[config.version.header] = "test/1";

        nock(notifServiceURL)
            .post('/notification/sms')
            .times(3)
            .reply(204);

        //1st call must create the pin
        request(options, function(err, res, body){
            assert.equal(err, null, body);
            assert.equal(res.statusCode, 403, body);

            var redisKey = config.redisKeys.user_phone_verify.key;
            redisKey = redisKey.replace('{userId}',user.email).replace('{phone}','+1' + user.phone);

            //Get the correct PIN
            redisMng.getKeyValue(redisKey + '.pin', function(err, redisPhonePin) {
                assert.equal(err, null);

                options.headers['x-otp-pin'] = 'zzzz';

                //1st call incorrect pin
                request(options, function (err, res, body) {
                    assert.equal(err, null, body);
                    assert.equal(res.statusCode, 401, body);
                    body = JSON.parse(body);
                    assert.deepEqual(body, {"err": "verify_phone_error", "des": "PIN used is not valid."});

                    //2nd call incorrect pin
                    request(options, function (err, res, body) {
                        assert.equal(err, null, body);
                        assert.equal(res.statusCode, 401, body);
                        body = JSON.parse(body);
                        assert.deepEqual(body, {"err": "verify_phone_error", "des": "PIN used is not valid."});

                        //3rd call incorrect pin
                        request(options, function (err, res, body) {
                            assert.equal(err, null, body);
                            assert.equal(res.statusCode, 401, body);
                            body = JSON.parse(body);
                            assert.deepEqual(body, {"err":"verify_phone_error","des":"PIN used has expired."});

                            options.headers['x-otp-pin'] = redisPhonePin;

                            //4th call incorrect (expired pin)
                            request(options, function (err, res, body) {
                                assert.equal(err, null, body);
                                assert.equal(res.statusCode, 401, body);
                                body = JSON.parse(body);
                                assert.deepEqual(body, {"err": "verify_phone_error", "des": "PIN used is not valid."});

                                //Get the correct PIN
                                redisMng.getKeyValue(redisKey + '.pin', function (err, redisPhonePin) {
                                    assert.equal(err, null);

                                    options.headers['x-otp-pin'] = redisPhonePin;

                                    nock(notifServiceURL)
                                        .post('/notification/email')
                                        .reply(204);

                                    var expectedUserId = 'a1b2c3d4e5f6';

                                    nock('http://' + config.private_host + ':' + config.private_port)
                                        .post(config.passThroughEndpoint.path)
                                        .reply(201, {id: expectedUserId});

                                    //5th call actualized correct pin
                                    request(options, function (err, res, body) {
                                        assert.equal(err, null, body);
                                        assert.equal(res.statusCode, 201, body);
                                        body = JSON.parse(body);
                                        assert.notEqual(body.accessToken, null, body);
                                        assert.notEqual(body.refreshToken, null, body);
                                        assert.notEqual(body.expiresIn, null, body);
                                        done();
                                    });

                                });
                            });
                        });
                    });
                });

            });
        });
    });

    it.skip('POST user already exists', function(done){
        this.timeout(10000);

        var user = clone(baseUser);

        var options = {
            url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
            headers: clone(HEADERS_WITHOUT_AUTHORIZATION_BASIC),
            method:'POST',
            body : JSON.stringify(user)
        };
        options.headers[config.version.header] = "test/1";

        nock(notifServiceURL)
            .post('/notification/sms')
            .reply(204);

        //1st call must create the pin
        request(options, function(err, res, body){
            assert.equal(err, null, body);
            assert.equal(res.statusCode, 403, body);

            var redisKey = config.redisKeys.user_phone_verify.key;
            redisKey = redisKey.replace('{userId}',user.email).replace('{phone}','+1' + user.phone);

            redisMng.getKeyValue(redisKey + '.pin', function(err, redisPhonePin) {
                assert.equal(err, null);

                options.headers['x-otp-pin'] = redisPhonePin;

                nock(notifServiceURL)
                    .post('/notification/sms')
                    .reply(204);

                var expectedUserId = 'a1b2c3d4e5f6';

                nock('http://' + config.private_host + ':' + config.private_port)
                    .post(config.passThroughEndpoint.path)
                    .reply(201, {id: expectedUserId});

                nock(notifServiceURL)
                    .post('/notification/email')
                    .reply(204);

                //2nd call correct pin
                request(options, function(err, res, body) {
                    assert.equal(err, null, body);
                    assert.equal(res.statusCode, 201, body);
                    body = JSON.parse(body);
                    assert.notEqual(body.accessToken, null, body);
                    assert.notEqual(body.refreshToken, null, body);
                    assert.notEqual(body.expiresIn, null, body);

                    request(options, function (err, res, body) {
                        assert.equal(err, null, body);
                        assert.equal(res.statusCode, 403, body);
                        body = JSON.parse(body);
                        assert.deepEqual(body, {"err":"auth_proxy_error","des":"user already exists"});
                        done();
                    });
                });

            });

        });
    });


});