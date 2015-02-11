var assert = require('assert');
var ciphertoken = require('ciphertoken');
var async = require('async');
var nock = require('nock');
var clone = require('clone');
var userDao = require('../src/dao');
var redisMng = require('../src/managers/redis');
var userMng = require('../src/managers/user');

var config = require('../config.json');

var notifServiceURL = config.services.notifications;

var accesTokenSettings = {
    cipherKey: config.accessToken.cipherKey,
    firmKey: config.accessToken.signKey,
    tokenExpirationMinutes: config.accessToken.expiration * 60
};

describe('User Manager', function(){
    beforeEach(function(done){
        async.series([
            function(done){
                userDao.connect(function(err){
                    assert.equal(err,null);
                    userDao.deleteAllUsers(done);
                });
            },
            function(done){
                redisMng.connect(done);
            },
            function(done){
                redisMng.deleteAllKeys(done);
            }
        ], done);

    });

    afterEach(function(done){
        async.series([
            function(done){
                userDao.disconnect(function(err){
                    assert.equal(err,null);
                    done();
                });
            },
            function(done){
                redisMng.deleteAllKeys(done);
            },
            function(done){
                redisMng.disconnect(done);
            }
        ], done);

    });

    it('Update Platform Data', function(done){
        var expectedPlatformData = {
            platform: 'sf',
            accessToken: 'a1b2c3...d4e5f6',
            refreshToken: 'a1b2c3...d4e5f6',
            expiresIn: 0
        };

        var expectedUser = {
            id:'a1b2c3d4e5f6',
            username: 'username' + (config.allowedDomains[0] ? config.allowedDomains[0] : ''),
            password: '12345678'
        };

        userDao.addUser()(expectedUser, function(err, createdUser){
            assert.equal(err, null);
            assert.notEqual(createdUser, null);

            userMng().setPlatformData(expectedUser.id, 'sf', expectedPlatformData, function(err){
                assert.equal(err, null);
                userDao.getFromId(expectedUser.id, function(err, foundUser){
                    assert.equal(err, null);
                    assert.notEqual(foundUser, null);
                    assert.notEqual(foundUser.platforms, null, 'must create an array of platforms');
                    assert.equal(foundUser.platforms.length, 1, 'invalid number of platforms');
                    assert.deepEqual(foundUser.platforms[0], expectedPlatformData, 'invalid platform data');
                    done();
                });
            });
        });
    });

    describe('Create user', function(){

        var profileBody = {
            email: 'valid' + (config.allowedDomains[0] ? config.allowedDomains[0] : ''),
            password: '12345678',
            phone: '111111111',
            country: 'US'
        };

        var expectedUserId = 'a1b2c3d4e5f6';

        it('usePinVerification = true & useEmailVerification = false', function(done){
            var configSettings = {
                usePinVerification: true,
                useEmailVerification: false
            };
            var pin = 'xxxx';

            var redisKey = config.redisKeys.user_phone_verify.key;
            redisKey = redisKey.replace('{userId}', profileBody.email).replace('{phone}','+1' + profileBody.phone);
            redisMng.insertKeyValue(redisKey + '.pin', pin, config.redisKeys.user_phone_verify.expireInSec, function(err){
                assert.equal(err, null);
                redisMng.insertKeyValue(redisKey + '.attempts', config.userPIN.attempts , config.redisKeys.user_phone_verify.expireInSec, function(err){
                    assert.equal(err, null);

                    nock('http://' + config.private_host + ':' + config.private_port)
                        .post(config.passThroughEndpoint.path)
                        .reply(201, {id: expectedUserId});

                    userMng(configSettings).createUser( profileBody, pin, function(err, tokens){
                        assert.equal(err, null);
                        assert.equal(tokens.expiresIn, accesTokenSettings.tokenExpirationMinutes);
                        assert.notEqual(tokens.accessToken, undefined);
                        ciphertoken.getTokenSet(accesTokenSettings, tokens.accessToken, function (err, accessTokenInfo) {
                            assert.equal(err, null);
                            assert.equal(accessTokenInfo.userId, expectedUserId);
                            done();
                        });
                    } );

                });
            });
        });

        it('usePinVerification = true & useEmailVerification = true', function(done){
            var configSettings = {
                usePinVerification: true,
                useEmailVerification: true
            };
            var pin = 'xxxx';

            var expectedResult = {
                des: profileBody.email,
                code: 200
            };

            var redisKey = config.redisKeys.user_phone_verify.key;
            redisKey = redisKey.replace('{userId}', profileBody.email).replace('{phone}','+1' + profileBody.phone);
            redisMng.insertKeyValue(redisKey + '.pin', pin, config.redisKeys.user_phone_verify.expireInSec, function(err){
                assert.equal(err, null);
                redisMng.insertKeyValue(redisKey + '.attempts', config.userPIN.attempts , config.redisKeys.user_phone_verify.expireInSec, function(err){
                    assert.equal(err, null);

                    nock('http://' + config.private_host + ':' + config.private_port)
                        .post(config.passThroughEndpoint.path)
                        .reply(201, {id: expectedUserId});

                    nock(notifServiceURL)
                        .post('/notification/email')
                        .reply(204);

                    userMng(configSettings).createUser( profileBody, pin, function(err, tokens){
                        assert.notEqual(err, null);
                        assert.deepEqual(err, expectedResult );
                        done();
                    } );

                });
            });
        });

        it('usePinVerification = false & useEmailVerification = true', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: true
            };
            var pin = null;

            var expectedResult = {
                des: profileBody.email,
                code: 200
            };

            nock('http://' + config.private_host + ':' + config.private_port)
                .post(config.passThroughEndpoint.path)
                .reply(201, {id: expectedUserId});

            nock(notifServiceURL)
                .post('/notification/email')
                .reply(204);

            userMng(configSettings).createUser( profileBody, pin, function(err, tokens){
                assert.notEqual(err, null);
                assert.deepEqual(err, expectedResult );
                done();
            } );
        });

        it('usePinVerification = false & useEmailVerification = false', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: false
            };
            var pin = null;

            nock('http://' + config.private_host + ':' + config.private_port)
                .post(config.passThroughEndpoint.path)
                .reply(201, {id: expectedUserId});

            nock(notifServiceURL)
                .post('/notification/email')
                .reply(204);

            userMng(configSettings).createUser( profileBody, pin, function(err, tokens){
                assert.equal(err, null);
                assert.equal(tokens.expiresIn, accesTokenSettings.tokenExpirationMinutes);
                assert.notEqual(tokens.accessToken, undefined);
                ciphertoken.getTokenSet(accesTokenSettings, tokens.accessToken, function (err, accessTokenInfo) {
                    assert.equal(err, null);
                    assert.equal(accessTokenInfo.userId, expectedUserId);
                    done();
                });
            } );
        });

        it('Invalid domain', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: false,
                allowedDomains: ["*@valid.com"]
            };
            var pin = null;

            profileBody.email  = "invalid@invaliddomain.com";

            var expectedResult = {
                err:"user_domain_not_allowed",
                des:"username domain not included in the whitelist",
                code:400
            };

            nock('http://' + config.private_host + ':' + config.private_port)
                .post(config.passThroughEndpoint.path)
                .reply(201, {id: expectedUserId});

            userMng(configSettings).createUser( profileBody, pin, function(err, tokens){
                assert.notEqual(err, null);
                assert.deepEqual(err, expectedResult );
                done();
            } );
        });

        it('No username', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: false
            };
            var pin = null;

            var profile = clone(profileBody);
            profile.email  = null;

            var expectedResult = {
                err:"auth_proxy_error",
                des:"invalid userinfo",
                code:400
            };

            userMng(configSettings).createUser( profile, pin, function(err, tokens){
                assert.notEqual(err, null);
                assert.deepEqual(err, expectedResult );
                done();
            } );
        });

        it('No password', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: false
            };
            var pin = null;

            var profile = clone(profileBody);
            profile.password  = null;

            var expectedResult = {
                err:"invalid_security_token",
                des:"you must provide a password or a salesforce token to create the user",
                code:400
            };

            userMng(configSettings).createUser( profile, pin, function(err, tokens){
                assert.notEqual(err, null);
                assert.deepEqual(err, expectedResult );
                done();
            } );
        });

        it('No phone', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: false
            };
            var pin = null;

            var profile = clone(profileBody);
            profile.phone  = null;

            var expectedResult = {
                err:"auth_proxy_error",
                des:"empty phone or country",
                code:400
            };

            userMng(configSettings).createUser( profile, pin, function(err, tokens){
                assert.notEqual(err, null);
                assert.deepEqual(err, expectedResult );
                done();
            } );
        });

        it('No country', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: false
            };
            var pin = null;

            var profile = clone(profileBody);
            profile.country  = null;

            var expectedResult = {
                err:"auth_proxy_error",
                des:"empty phone or country",
                code:400
            };

            userMng(configSettings).createUser( profile, pin, function(err, tokens){
                assert.notEqual(err, null);
                assert.deepEqual(err, expectedResult );
                done();
            } );
        });

        it('Invalid country code', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: false
            };
            var pin = null;

            var profile = clone(profileBody);
            profile.country  = '--';

            var expectedResult = {
                err:"country_not_found",
                des:"given phone does not match any country dial code"
            };

            userMng(configSettings).createUser( profile, pin, function(err, tokens){
                assert.notEqual(err, null);
                assert.deepEqual(err, expectedResult );
                done();
            } );
        });

        it('user exists', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: false
            };
            var pin = null;

            var expectedResult = {
                err:"auth_proxy_error",
                des:"user already exists",
                code: 403
            };

            nock('http://' + config.private_host + ':' + config.private_port)
                .post(config.passThroughEndpoint.path)
                .reply(201, {id: expectedUserId});

            //1st call create the user
            userMng(configSettings).createUser( profileBody, pin, function(err, tokens){
                assert.equal(err, null);

                //2nd call must fail
                userMng(configSettings).createUser( profileBody, pin, function(err, tokens){
                    assert.notEqual(err, null);
                    assert.deepEqual(err, expectedResult );
                    done();
                });
            });
        });
    });

    //describe('Create user DIRECT LOGIN', function() {
    //
    //});

});