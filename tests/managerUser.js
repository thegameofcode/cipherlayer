var assert = require('assert');
var ciphertoken = require('ciphertoken');
var async = require('async');
var nock = require('nock');
var clone = require('clone');
var ciphertoken = require('ciphertoken');
var userDao = require('../src/dao');
var redisMng = require('../src/managers/redis');
var userMng = require('../src/managers/user');

var config = require('../config.json');

var notifServiceURL = config.services.notifications;

var accessTokenSettings = {
    cipherKey: config.accessToken.cipherKey,
    firmKey: config.accessToken.signKey,
    tokenExpirationMinutes: config.accessToken.expiration * 60
};

var expectedUserId = 'a1b2c3d4e5f6';

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
            password: 'n3wPas5W0rd',
            phone: '111111111',
            country: 'US'
        };

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
                        assert.equal(tokens.expiresIn, accessTokenSettings.tokenExpirationMinutes);
                        assert.notEqual(tokens.accessToken, undefined);
                        ciphertoken.getTokenSet(accessTokenSettings, tokens.accessToken, function (err, accessTokenInfo) {
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
                assert.equal(tokens.expiresIn, accessTokenSettings.tokenExpirationMinutes);
                assert.notEqual(tokens.accessToken, undefined);
                ciphertoken.getTokenSet(accessTokenSettings, tokens.accessToken, function (err, accessTokenInfo) {
                    assert.equal(err, null);
                    assert.equal(accessTokenInfo.userId, expectedUserId);
                    done();
                });
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
                err:"auth_proxy_user_error",
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
                des: "Sorry your email domain is not authorised for this service",
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
    });

    describe('Create user DIRECT LOGIN', function() {
        var redisKey = config.redisKeys.direct_login_transaction.key;
        var redisExp = config.redisKeys.direct_login_transaction.expireInSec;

        var tokenSettings = clone(accessTokenSettings);
        tokenSettings.tokenExpirationMinutes = redisExp;

        it('OK', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: false
            };

            var transactionId = '1a2b3c4d5e6f';

            var bodyData = {
                officeLocation: "",
                country: "US",
                lastName: "lastName",
                phone: "111111111",
                company: "",
                password: "valid_password",
                firstName: "firstName",
                email: "valid" + (config.allowedDomains[0] ? config.allowedDomains[0] : ''),
                position: "",
                transactionId: transactionId
            };

            redisKey = redisKey.replace('{username}', bodyData.email);
            redisMng.insertKeyValue(redisKey, transactionId, redisExp, function(err, value){
                assert.equal(err, null);
                assert.equal(value, transactionId);

                ciphertoken.createToken(tokenSettings, bodyData.email, null, bodyData, function(err, token){
                    if(err){
                        return cbk(err);
                    }

                    nock('http://' + config.private_host + ':' + config.private_port)
                        .post(config.passThroughEndpoint.path)
                        .reply(201, {id: expectedUserId});

                    userMng(configSettings).createUserByToken( token, function(err, tokens){
                        assert.equal(err, null);
                        assert.notEqual(tokens.accessToken, undefined);
                        ciphertoken.getTokenSet(accessTokenSettings, tokens.accessToken, function (err, accessTokenInfo) {
                            assert.equal(err, null);
                            assert.equal(accessTokenInfo.userId, expectedUserId);
                            done();
                        });
                    });
                });
            });
        });

        it('Invalid data', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: false
            };

            var transactionId = '1a2b3c4d5e6f';

            var bodyData = {
                company: "",
                password: "valid_password",
                firstName: "firstName",
                email: "valid" + (config.allowedDomains[0] ? config.allowedDomains[0] : ''),
                position: "",
                transactionId: transactionId
            };

            var expectedResult = {
                err:"invalid_profile_data",
                des:"The data format provided is nor valid.",
                code:400
            };

            ciphertoken.createToken(tokenSettings, bodyData.email, null, bodyData, function(err, token){
                if(err){
                    return cbk(err);
                }

                nock('http://' + config.private_host + ':' + config.private_port)
                    .post(config.passThroughEndpoint.path)
                    .reply(201, {id: expectedUserId});

                userMng(configSettings).createUserByToken( token, function(err, tokens){
                    assert.notEqual(err, null);
                    assert.deepEqual(err, expectedResult);
                    done();
                });
            });
        });

        it('Incorrect transactionId', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: false
            };

            var transactionId = '1a2b3c4d5e6f';

            var bodyData = {
                country: "US",
                lastName: "lastName",
                phone: "111111111",
                company: "",
                password: "valid_password",
                firstName: "firstName",
                email: "valid" + (config.allowedDomains[0] ? config.allowedDomains[0] : ''),
                transactionId: 'abcde'
            };

            var expectedResult = {
                err:'invalid_profile_data',
                des:'Incorrect or expired transaction.',
                code: 400
            };

            redisKey = redisKey.replace('{username}', bodyData.email);
            redisMng.insertKeyValue(redisKey, transactionId, redisExp, function(err, value){
                assert.equal(err, null);
                assert.equal(value, transactionId);

                ciphertoken.createToken(tokenSettings, bodyData.email, null, bodyData, function(err, token){
                    if(err){
                        return cbk(err);
                    }

                    nock('http://' + config.private_host + ':' + config.private_port)
                        .post(config.passThroughEndpoint.path)
                        .reply(201, {id: expectedUserId});

                    userMng(configSettings).createUserByToken( token, function(err, tokens){
                        assert.notEqual(err, null);
                        assert.deepEqual(err, expectedResult);
                        done();
                    });
                });
            });
        });

        it('Call sent 2 times', function(done){
            var configSettings = {
                usePinVerification: false,
                useEmailVerification: false
            };

            var transactionId = '1a2b3c4d5e6f';

            var bodyData = {
                country: "US",
                lastName: "lastName",
                phone: "111111111",
                company: "",
                password: "valid_password",
                firstName: "firstName",
                email: "valid" + (config.allowedDomains[0] ? config.allowedDomains[0] : ''),
                transactionId: transactionId
            };

            var expectedResult = {
                err: "auth_proxy_error",
                des: "user already exists",
                code: 403
            };

            redisKey = redisKey.replace('{username}', bodyData.email);
            redisMng.insertKeyValue(redisKey, transactionId, redisExp, function(err, value){
                assert.equal(err, null);
                assert.equal(value, transactionId);

                ciphertoken.createToken(tokenSettings, bodyData.email, null, bodyData, function(err, token){
                    if(err){
                        return cbk(err);
                    }

                    nock('http://' + config.private_host + ':' + config.private_port)
                        .post(config.passThroughEndpoint.path)
                        .reply(201, {id: expectedUserId});

                    userMng(configSettings).createUserByToken( token, function(err, tokens){
                        assert.equal(err, null);

                        userMng(configSettings).createUserByToken( token, function(err, tokens) {
                            assert.notEqual(err, null);
                            assert.deepEqual(err, expectedResult);
                            done();
                        });
                    });
                });
            });
        });
    });

    describe('Set user password', function() {

        var expectedUser = {
            id:'a1b2c3d4e5f6',
            username: 'username' + (config.allowedDomains[0] ? config.allowedDomains[0] : ''),
            password: '12345678'
        };

        it('200 ok', function(done){
            var newPassword = {
                password: 'n3wPas5W0rd'
            };

            userDao.addUser()(expectedUser, function(err, createdUser) {
                userMng().setPassword(createdUser._id, newPassword, function(err, result){
                    assert.equal(err, null);
                    assert.equal(result, 1);
                    //TODO verify the password stored in DB (cant use dao.getById - it does not return password)
                    done();
                });
            });

        });

        it('400 invalid passwords', function(done){
            var newPassword = {
                password: 'newpassword'
            };

            var expectedResult = {
                err: 'invalid_password_format',
                des: 'Your password must be at least 8 characters and must contain at least one capital, one lower and one number.',
                code: 400
            };

            userDao.addUser()(expectedUser, function(err, createdUser) {
                userMng().setPassword(createdUser._id, newPassword, function(err, result){
                    assert.notEqual(err, null);
                    assert.deepEqual(err,expectedResult);

                    newPassword = {
                        password: 'newPASSWORD'
                    };

                    userMng().setPassword(createdUser._id, newPassword, function(err, result){
                        assert.notEqual(err, null);
                        assert.deepEqual(err,expectedResult);

                        newPassword = {
                            password: 'new111111'
                        };

                        userMng().setPassword(createdUser._id, newPassword, function(err, result){
                            assert.notEqual(err, null);
                            assert.deepEqual(err,expectedResult);

                            newPassword = {
                                password: 'NEWPA55W0RD'
                            };

                            userMng().setPassword(createdUser._id, newPassword, function(err, result){
                                assert.notEqual(err, null);
                                assert.deepEqual(err,expectedResult);

                                newPassword = {
                                    password: 'n3wPas5W0rd'
                                };

                                userMng().setPassword(createdUser._id, newPassword, function(err, result){
                                    assert.equal(err, null);
                                    assert.equal(result, 1);
                                    done();
                                });
                            });
                        });
                    });
                });
            });

        });
    });

    //This method is turned to private
    //it.only('Validate Password', function(done){
    //    var pwds = [
    //        ['password', false],
    //        ['PASSWORD', false],
    //        ['12345678', false],
    //        ['aaAAbbBB', false],
    //        ['aa11bb22', false],
    //        ['aa11AA', false],
    //        ['AA11BB22', false],
    //        ['Pas5W0rd', true]
    //    ];
    //
    //    async.map(pwds, function(pwd, cbk){
    //        var result = userMng().validatePwd(pwd[0]);
    //        assert.equal(result, pwd[1], pwd[0]);
    //        cbk();
    //    }, done);
    //});

});