'use strict';

const assert = require('assert');
const request = require('request');
const ciphertoken = require('ciphertoken');
const nock = require('nock');
const fs = require('fs');
const _ = require('lodash');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const dao = require('../src/managers/dao');

const crypto = require('../src/managers/crypto');
const cryptoMng = crypto(config.password);

const accessTokenSettings = {
	cipherKey: config.accessToken.cipherKey,
	firmKey: config.accessToken.signKey,
	tokenExpirationMinutes: config.accessToken.expiration
};

let AUTHORIZATION;
const NOTIFICATION_SERVICE_URL = config.externalServices.notifications.base;
const NOTIFICATION_EMAIL_SERVICE_PATH = config.externalServices.notifications.pathEmail;


const versionHeader = 'test/1';

describe('user', function () {

	const baseUser = {
		id: 'a1b2c3d4e5f6',
		username: `jie.lee${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
		password: 'validpassword'
	};

	function validatePwd (clear, crypted, cbk) {
		const cryptoMng = crypto(config.password);
		cryptoMng.verify(clear, crypted, function (err) {
			assert.equal(err, null);
			return cbk();
		});
	}

	beforeEach(function (done) {
		dao.deleteAllUsers(function (err) {
			assert.equal(err, null);
			const userToCreate = _.clone(baseUser);

			cryptoMng.encrypt(userToCreate.password, function (encryptedPwd) {
				userToCreate.password = encryptedPwd;
				dao.addUser(userToCreate, function (err, createdUser) {
					assert.equal(err, null);
					assert.notEqual(createdUser, undefined);
					ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {
						AUTHORIZATION = config.authHeaderKey + loginToken;
						return done();
					});
				});
			});
		});
	});

	describe('Forgot Password', function () {

		it('Send new Password', function (done) {
			const options = {
				url: `http://localhost:${config.public_port}/user/${baseUser.username}/password`,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					[config.version.header]: versionHeader

				},
				method: 'GET'
			};

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
						return done();
					});
				});
			});
		});

		it('Send 2 times new Password', function (done) {
			const options = {
				url: `http://localhost:${config.public_port}/user/${baseUser.username}/password`,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					[config.version.header]: versionHeader
				},
				method: 'GET'
			};

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
							return done();
						});
					});
				});
			});
		});
	});

	describe('Update Password', function () {
		it('204 Ok', function (done) {
			const newPassword = {
				password: 'n3wPas5W0rd'
			};

			const options = {
				url: `http://localhost:${config.public_port}/user/me/password`,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					Authorization: AUTHORIZATION,
					[config.version.header]: versionHeader
				},
				method: 'PUT',
				body: JSON.stringify(newPassword)
			};

			const clonedUser = _.clone(baseUser);
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
			const options = {
				url: `http://localhost:${config.public_port}/user/me/password`,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					Authorization: AUTHORIZATION,
					[config.version.header]: versionHeader
				},
				method: 'PUT'
			};

			const expectedResult = {
				err: 'invalid_body',
				des: 'The call to this url must have body.'
			};

			request(options, function (err, res, rawBody) {
				assert.equal(err, null, rawBody);
				assert.equal(res.statusCode, 400, rawBody);
				const body = JSON.parse(rawBody);
				assert.deepEqual(body, expectedResult);
				return done();
			});
		});

		it('400 (no password)', function (done) {
			const newPassword = {};

			const options = {
				url: `http://localhost:${config.public_port}/user/me/password`,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					Authorization: AUTHORIZATION,
					[config.version.header]: versionHeader
				},
				method: 'PUT',
				body: JSON.stringify(newPassword)
			};

			const expectedResult = {
				err: 'auth_proxy_error',
				des: 'invalid body request'
			};

			request(options, function (err, res, rawBody) {
				assert.equal(err, null, rawBody);
				assert.equal(res.statusCode, 400, rawBody);
				const body = JSON.parse(rawBody);
				assert.deepEqual(body, expectedResult);
				return done();
			});
		});

		it('400 (no authorization)', function (done) {
			const newPassword = {};

			const options = {
				url: `http://localhost:${config.public_port}/user/me/password`,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					[config.version.header]: versionHeader
				},
				method: 'PUT',
				body: JSON.stringify(newPassword)
			};

			const expectedResult = {
				err: 'invalid_authorization',
				des: 'required authorization header'
			};

			request(options, function (err, res, rawBody) {
				assert.equal(err, null, rawBody);
				assert.equal(res.statusCode, 401, rawBody);
				const body = JSON.parse(rawBody);
				assert.deepEqual(body, expectedResult);
				return done();
			});
		});

		it('403 (invalid authorization)', function (done) {
			const newPassword = {
				password: 'n3wPas5W0rd'
			};

			const options = {
				url: `http://localhost:${config.public_port}/user/me/password`,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					Authorization: 'bearer INVALID TOKEN',
					[config.version.header]: versionHeader
				},
				method: 'PUT',
				body: JSON.stringify(newPassword)
			};

			const expectedResult = {
				err: 'invalid_access_token',
				des: 'unable to read token info'
			};

			request(options, function (err, res, rawBody) {
				assert.equal(err, null, rawBody);
				assert.equal(res.statusCode, 401, rawBody);
				const body = JSON.parse(rawBody);
				assert.deepEqual(body, expectedResult);
				return done();
			});
		});

	});

});
