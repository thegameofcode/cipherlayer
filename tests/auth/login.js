var assert = require('assert');
var request = require('request');
var ciphertoken = require('ciphertoken');
var config = require('../../config.json');
var dao = require('../../src/managers/dao.js');
var nock = require('nock');
var _ = require('lodash');

var crypto = require('../../src/managers/crypto');
var cryptoMng = crypto(config.password);

module.exports = {
    describe: function(accessTokenSettings, refreshTokenSettings){
        describe('/login', function () {
            var baseUser = {
                id: 'a1b2c3d4e5f6',
                username: 'validuser' + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*','') : ''),
                password: 'validpassword',
                deviceId: '1234567890'
            };

            beforeEach(function (done) {
                dao.deleteAllUsers(function (err) {
                    assert.equal(err, null);
                    var userToCreate = _.clone(baseUser);
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
            it('POST 200', function (done) {
                var user = _.clone(baseUser);
                var options = {
                    url: 'http://localhost:' + config.public_port + '/auth/login',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method: 'POST',
                    body: JSON.stringify(user)
                };
                options.headers[config.version.header] = "test/1";

                nock('http://localhost:'+ config.private_port)
                    .post('/api/me/session')
                    .reply(204);

                request(options, function (err, res, body) {
                    assert.equal(err, null);
                    assert.equal(res.statusCode, 200, body);
                    body = JSON.parse(body);
                    assert.notEqual(body.accessToken, undefined);
                    assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
                    ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function (err, accessTokenInfo) {
                        assert.equal(err, null);
                        assert.equal(accessTokenInfo.userId, user.id);
                        assert.equal(accessTokenInfo.data.deviceId, user.deviceId);
                        assert.notEqual(body.refreshToken, undefined);
                        ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function (err, refreshTokenInfo) {
                            assert.equal(err, null);
                            assert.equal(refreshTokenInfo.userId, user.id);
                            assert.equal(accessTokenInfo.data.deviceId, user.deviceId);
                            done();
                        });
                    });
                });
            });
            it('POST 409 invalid credentials', function (done) {
                var user = _.clone(baseUser);
                user.password = 'invalidpassword';
                var options = {
                    url: 'http://localhost:' + config.public_port + '/auth/login',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method: 'POST',
                    body: JSON.stringify(user)
                };
                options.headers[config.version.header] = "test/1";

                request(options, function (err, res, body) {
                    assert.equal(err, null);
                    assert.equal(res.statusCode, 409);
                    body = JSON.parse(body);
                    assert.notEqual(body.err, 'invalid_credentials');
                    done();
                });
            });

            it('POST 409 username substring', function (done) {
                var user = _.clone(baseUser);
                var username = user.username;
                user.username = username.slice(0, username.length / 2);
                var options = {
                    url: 'http://localhost:' + config.public_port + '/auth/login',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method: 'POST',
                    body: JSON.stringify(user)
                };
                options.headers[config.version.header] = "test/1";

                request(options, function (err, res, body) {
                    assert.equal(err, null);
                    assert.equal(res.statusCode, 409);
                    body = JSON.parse(body);
                    assert.notEqual(body.err, 'invalid_credentials');
                    done();
                });
            });
        });

        describe('Admin /login', function () {
            var baseUser = {
                id: 'a1b2c3d4e5f6',
                username: 'validuser' + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*','') : ''),
                password: 'validpassword',
                roles : ["admin"],
                deviceId: "0987654321"
            };

            beforeEach(function (done) {
                dao.deleteAllUsers(function (err) {
                    assert.equal(err, null);
                    var userToCreate = _.clone(baseUser);
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
            it('POST 200', function (done) {
                var user = _.clone(baseUser);
                var options = {
                    url: 'http://localhost:' + config.public_port + '/auth/login',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method: 'POST',
                    body: JSON.stringify(user)
                };
                options.headers[config.version.header] = "test/1";

                nock('http://localhost:'+ config.private_port)
                    .post('/api/me/session')
                    .reply(204);

                request(options, function (err, res, body) {
                    assert.equal(err, null);
                    assert.equal(res.statusCode, 200, body);
                    body = JSON.parse(body);
                    assert.notEqual(body.accessToken, undefined);
                    assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
                    ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function (err, accessTokenInfo) {
                        assert.equal(err, null);
                        assert.equal(accessTokenInfo.userId, user.id);
                        assert.deepEqual(accessTokenInfo.data.roles, user.roles);
                        assert.equal(accessTokenInfo.data.deviceId, user.deviceId);
                        assert.notEqual(body.refreshToken, undefined);
                        ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function (err, refreshTokenInfo) {
                            assert.equal(err, null);
                            assert.equal(refreshTokenInfo.userId, user.id);
                            assert.equal(accessTokenInfo.data.deviceId, user.deviceId);
                            done();
                        });
                    });
                });
            });
        });
    }
};
