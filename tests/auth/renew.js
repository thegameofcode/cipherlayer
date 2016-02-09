var assert = require('assert');
var request = require('request');
var clone = require('clone');
var ciphertoken = require('ciphertoken');

var dao = require('../../src/managers/dao.js');
var config = require('../../config.json');

var crypto = require('../../src/managers/crypto');
var cryptoMng = crypto(config.password);

module.exports = {
    describe: function(){
        describe('/renew', function(){

            beforeEach(function (done){
                dao.deleteAllUsers(function (err){
                    assert.equal(err, null);
                    var userToCreate = clone(USER);
                    cryptoMng.encrypt(userToCreate.password, function(encryptedPwd) {
                        userToCreate.password = encryptedPwd;
                        dao.addUser()(userToCreate, function (err, createdUser) {
                            assert.equal(err, null);
                            assert.notEqual(createdUser, undefined);
                            done();
                        });
                    });
                });
            });

            it('POST - 200', function(done){
                getLoginTokens(USER, function (err, tokens){
                    var refreshToken = tokens.refreshToken;
                    assert.equal(err, null);
                    assert.notEqual(refreshToken, null);

                    var options = clone(OPTIONS_FOR_RENEW);
                    options.headers[config.version.header] = "test/1";
                    options.body = JSON.stringify({refreshToken: refreshToken});

                    request(options, function (err, res, body){
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 200, body);
                        body = JSON.parse(body);
                        assert.notEqual(body.accessToken, null);
                        done();
                    });
                });
            });

            it('POST - 401 invalid token', function(done){
                var invalidToken = 'not a valid token :( sorry';
                var options = clone(OPTIONS_FOR_RENEW);
                options.headers[config.version.header] = "test/1";
                options.body = JSON.stringify({refreshToken: invalidToken});

                request(options, function (err, res, body){
                    assert.equal(err, null);
                    assert.equal(res.statusCode, 401, body);

                    body = JSON.parse(body);
                    assert.equal(body.err, 'invalid_token');
                    assert.equal(body.des, 'Invalid token');
                    done();
                });
            });

            it('POST - 401 expired token', function(done){
                var refreshTokenSettings = {
                    cipherKey: config.refreshToken.cipherKey,
                    firmKey: config.refreshToken.signKey,
                    tokenExpirationMinutes: 0
                };
                ciphertoken.createToken(refreshTokenSettings, 'id123', null, {}, function(err, token){
                    assert.equal(err, null);

                    var options = clone(OPTIONS_FOR_RENEW);
                    options.headers[config.version.header] = "test/1";
                    options.body = JSON.stringify({refreshToken: token});

                    request(options, function(err, res, body){
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 401, body);

                        body = JSON.parse(body);
                        assert.equal(body.err, 'expired_token');
                        assert.equal(body.des, 'Expired token');
                        done();
                    });
                });
            });

            it('Complete process', function(done){
                var options = {
                    url: 'http://localhost:' + config.public_port + '/auth/login',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method: 'POST',
                    body: JSON.stringify({username:USER.username, password:USER.password, deviceId: USER.deviceId})
                };
                options.headers[config.version.header] = "test/1";

                request(options, function(err, res, body){
                    assert.equal(err, null);
                    assert.equal(res.statusCode, 200, body);
                    body = JSON.parse(body);
                    var options = clone(OPTIONS_FOR_RENEW);
                    options.headers[config.version.header] = "test/1";
                    options.body = JSON.stringify({refreshToken:body.refreshToken});

                    request(options, function(err, res, body) {
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 200, body);
                        body = JSON.parse(body);
                        assert.notEqual(body.accessToken, null);
                        done();
                    });
                });
            });
        });
    }
};

function getLoginTokens(user, cbk){
    var options = clone(OPTIONS_FOR_LOGIN);
    options.headers[config.version.header] = "test/1";
    options.body = JSON.stringify(user);

    request(options, function (err, res, body) {
        if (err){
            return cbk(err);
        }
        body = JSON.parse(body);
        cbk(null, body);
    });
}


var USER = {
    id: 'a1b2c3d4e5f6',
    username: 'validUser'+ (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*','') : '') ,
    password: 'validPassword123',
    deviceId: 1234567890
};

var OPTIONS_FOR_RENEW = {
    url: 'http://localhost:' + config.public_port + '/auth/renew',
    headers: {
        'Content-Type': 'application/json; charset=utf-8'
    },
    method: 'POST'
};

var OPTIONS_FOR_LOGIN = clone(OPTIONS_FOR_RENEW);
OPTIONS_FOR_LOGIN.url = 'http://localhost:' + config.public_port + '/auth/login';
