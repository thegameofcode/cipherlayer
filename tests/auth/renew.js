var assert = require('assert');
var request = require('request');
var _ = require('lodash');
var ciphertoken = require('ciphertoken');

var dao = require('../../src/managers/dao.js');
var config = require('../../config.json');

var crypto = require('../../src/managers/crypto');
var cryptoMng = crypto(config.password);

var versionHeader = 'test/1';

module.exports = {
	describe: function () {
		describe('/renew', function () {

			beforeEach(function (done) {
				dao.deleteAllUsers(function (err) {
					assert.equal(err, null);
					var userToCreate = _.cloneDeep(USER);
					cryptoMng.encrypt(userToCreate.password, function (encryptedPwd) {
						userToCreate.password = encryptedPwd;
						dao.addUser()(userToCreate, function (err, createdUser) {
							assert.equal(err, null);
							assert.notEqual(createdUser, undefined);
							done();
						});
					});
				});
			});

			it('POST - 200', function (done) {
				var options = {
					url: 'http://localhost:' + config.public_port + '/auth/login',
					headers: {},
					method: 'POST',
					json: true,
					body: _.cloneDeep(USER)
				};
				options.headers[config.version.header] = versionHeader;

				request(options, function (err, res, body) {
					assert.equal(err, null);
					assert.equal(res.statusCode, 200);
					assert.notEqual(body, null);
					var refreshToken = body.refreshToken;

					var options = _.cloneDeep(OPTIONS_FOR_RENEW);
					options.headers[config.version.header] = versionHeader;
					options.body = {refreshToken: refreshToken};

					request(options, function (err, res, body) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 200, body);
						assert.notEqual(body.accessToken, null);
						done();
					});
				});
			});

			it('POST - 401 invalid token', function (done) {
				var invalidToken = 'not a valid token :( sorry';
				var options = _.cloneDeep(OPTIONS_FOR_RENEW);
				options.headers[config.version.header] = versionHeader;
				options.body = {refreshToken: invalidToken};

				request(options, function (err, res, body) {
					assert.equal(err, null);
					assert.equal(res.statusCode, 401);

					assert.equal(body.err, 'invalid_token');
					assert.equal(body.des, 'Invalid token');
					done();
				});
			});

			it('POST - 401 expired token', function (done) {
				var refreshTokenSettings = {
					cipherKey: config.refreshToken.cipherKey,
					firmKey: config.refreshToken.signKey,
					tokenExpirationMinutes: 0
				};
				ciphertoken.createToken(refreshTokenSettings, 'id123', null, {}, function (err, token) {
					assert.equal(err, null);

					var options = _.cloneDeep(OPTIONS_FOR_RENEW);
					options.headers[config.version.header] = versionHeader;
					options.body = {refreshToken: token};

					request(options, function (err, res, body) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 401, body);

						assert.equal(body.err, 'expired_token');
						assert.equal(body.des, 'Expired token');
						done();
					});
				});
			});

			it('Complete process', function (done) {
				var options = {
					url: 'http://localhost:' + config.public_port + '/auth/login',
					headers: {
						'Content-Type': 'application/json; charset=utf-8'
					},
					method: 'POST',
					body: {username: USER.username, password: USER.password, deviceId: USER.deviceId},
					json: true
				};
				options.headers[config.version.header] = versionHeader;

				request(options, function (err, res, body) {
					assert.equal(err, null);
					assert.equal(res.statusCode, 200, body);

					var options = _.cloneDeep(OPTIONS_FOR_RENEW);
					options.headers[config.version.header] = versionHeader;
					options.body = {refreshToken: body.refreshToken};

					request(options, function (err, res, body) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 200, body);

						assert.notEqual(body.accessToken, null);
						done();
					});
				});
			});
		});
	}
};

var USER = {
	id: 'a1b2c3d4e5f6',
	username: 'validUser' + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''),
	password: 'validPassword123',
	deviceId: 1234567890
};

var OPTIONS_FOR_RENEW = {
	url: 'http://localhost:' + config.public_port + '/auth/renew',
	headers: {},
	method: 'POST',
	json: true
};
