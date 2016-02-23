var assert = require('assert');
var _ = require('lodash');
var request = require('request');
var ciphertoken = require('ciphertoken');
var nock = require('nock');
var fs = require('fs');
var _ = require('lodash');
var cipherlayer = require('../src/cipherlayer.js');

var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var dao = require('../src/managers/dao.js');

var crypto = require('../src/managers/crypto');
var cryptoMng = crypto(config.password);

var accessTokenSettings = {
	cipherKey: config.accessToken.cipherKey,
	firmKey: config.accessToken.signKey,
	tokenExpirationMinutes: config.accessToken.expiration
};

var AUTHORIZATION;
var NOTIFICATION_SERVICE_URL = config.externalServices.notifications.base;
var NOTIFICATION_EMAIL_SERVICE_PATH = config.externalServices.notifications.pathEmail;

var createdUserId;

var versionHeader = 'test/1';

describe('user', function () {

	var baseUser = {
		id: 'a1b2c3d4e5f6',
		username: 'jie.lee' + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''),
		password: 'validpassword'
	};

	function validatePwd(clear, crypted, cbk) {
		var cryptoMng = crypto(config.password);
		cryptoMng.verify(clear, crypted, function (err) {
			assert.equal(err, null);
			return cbk();
		});
	}

	beforeEach(function (done) {
		cipherlayer.start(config.public_port, config.internal_port, function (err) {
			assert.equal(err, null);
			dao.deleteAllUsers(function (err) {
				assert.equal(err, null);
				var userToCreate = _.clone(baseUser);

				cryptoMng.encrypt(userToCreate.password, function (encryptedPwd) {
					userToCreate.password = encryptedPwd;
					dao.addUser()(userToCreate, function (err, createdUser) {
						assert.equal(err, null);
						assert.notEqual(createdUser, undefined);
						createdUserId = createdUser._id;
						ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {
							AUTHORIZATION = config.authHeaderKey + loginToken;
							done();
						});
					});
				});
			});
		});
	});

	afterEach(function (done) {
		cipherlayer.stop(done);
	});

	describe('Forgot Password', function () {

		it('Send new Password', function (done) {
			var options = {
				url: 'http://localhost:' + config.public_port + '/user/' + baseUser.username + '/password',
				headers: {
					'Content-Type': 'application/json; charset=utf-8'
				},
				method: 'GET'
			};
			options.headers[config.version.header] = versionHeader;

			nock(NOTIFICATION_SERVICE_URL)
				.post(NOTIFICATION_EMAIL_SERVICE_PATH)
				.reply(201);

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 204, body);
				dao.getAllUserFields(baseUser.username, function (err, result) {
					assert.equal(err, null);
					assert.equal(result.password.length, 2);
					dao.getAllUserFields(baseUser.username, function (err, foundUser) {
						assert.equal(err, null);
						assert.notEqual(foundUser, null);
						assert.equal(result.password.length, 2);
						assert.notEqual(result.password[0], result.password[1]);
						done();
					});
				});
			});
		});

		it('Send 2 times new Password', function (done) {
			var options = {
				url: 'http://localhost:' + config.public_port + '/user/' + baseUser.username + '/password',
				headers: {
					'Content-Type': 'application/json; charset=utf-8'
				},
				method: 'GET'
			};
			options.headers[config.version.header] = versionHeader;

			nock(NOTIFICATION_SERVICE_URL)
				.post(NOTIFICATION_EMAIL_SERVICE_PATH)
				.times(2)
				.reply(204);

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 204, body);
				dao.getAllUserFields(baseUser.username, function (err, result) {
					assert.equal(err, null);
					assert.equal(result.password.length, 2);

					request(options, function (err2, res2, body) {
						assert.equal(err2, null);
						assert.equal(res2.statusCode, 204, body);
						dao.getAllUserFields(baseUser.username, function (err, result) {
							assert.equal(err, null);
							assert.equal(result.password.length, 2);
							done();
						});
					});
				});
			});
		});
	});

	describe('Update Password', function () {
		it('204 Ok', function (done) {
			var newPassword = {
				password: 'n3wPas5W0rd'
			};

			var options = {
				url: 'http://localhost:' + config.public_port + '/user/me/password',
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Authorization': AUTHORIZATION
				},
				method: 'PUT',
				body: JSON.stringify(newPassword)
			};
			options.headers[config.version.header] = versionHeader;

			var clonedUser = _.clone(baseUser);
			clonedUser.password = newPassword.password;

			request(options, function (err, res, body) {
				assert.equal(err, null, body);
				assert.equal(res.statusCode, 204, body);
				dao.getAllUserFields(baseUser.username, function (err, foundUser) {
					assert.equal(err, null);
					assert.notEqual(foundUser, null);
					validatePwd(clonedUser.password, foundUser.password, done);
				});
			});
		});

		it('400 (no body)', function (done) {
			var options = {
				url: 'http://localhost:' + config.public_port + '/user/me/password',
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Authorization': AUTHORIZATION
				},
				method: 'PUT'
			};
			options.headers[config.version.header] = versionHeader;

			var expectedResult = {
				err: "invalid_body",
				des: "The call to this url must have body."
			};

			request(options, function (err, res, body) {
				assert.equal(err, null, body);
				assert.equal(res.statusCode, 400, body);
				body = JSON.parse(body);
				assert.deepEqual(body, expectedResult);
				done();
			});
		});

		it('400 (no password)', function (done) {
			var newPassword = {};

			var options = {
				url: 'http://localhost:' + config.public_port + '/user/me/password',
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Authorization': AUTHORIZATION
				},
				method: 'PUT',
				body: JSON.stringify(newPassword)
			};
			options.headers[config.version.header] = versionHeader;

			var expectedResult = {
				err: "auth_proxy_error",
				des: "invalid body request"
			};

			request(options, function (err, res, body) {
				assert.equal(err, null, body);
				assert.equal(res.statusCode, 400, body);
				body = JSON.parse(body);
				assert.deepEqual(body, expectedResult);
				done();
			});
		});

		it('400 (no authorization)', function (done) {
			var newPassword = {};

			var options = {
				url: 'http://localhost:' + config.public_port + '/user/me/password',
				headers: {
					'Content-Type': 'application/json; charset=utf-8'
				},
				method: 'PUT',
				body: JSON.stringify(newPassword)
			};
			options.headers[config.version.header] = versionHeader;

			var expectedResult = {
				err: 'invalid_authorization',
				des: 'required authorization header'
			};

			request(options, function (err, res, body) {
				assert.equal(err, null, body);
				assert.equal(res.statusCode, 401, body);
				body = JSON.parse(body);
				assert.deepEqual(body, expectedResult);
				done();
			});
		});

		it('403 (invalid authorization)', function (done) {
			var newPassword = {
				password: 'n3wPas5W0rd'
			};

			var options = {
				url: 'http://localhost:' + config.public_port + '/user/me/password',
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Authorization': 'bearer INVALID TOKEN'
				},
				method: 'PUT',
				body: JSON.stringify(newPassword)
			};
			options.headers[config.version.header] = versionHeader;

			var expectedResult = {
				err: "invalid_access_token",
				des: "unable to read token info"
			};

			request(options, function (err, res, body) {
				assert.equal(err, null, body);
				assert.equal(res.statusCode, 401, body);
				body = JSON.parse(body);
				assert.deepEqual(body, expectedResult);
				done();
			});
		});

	});

});
