'use strict';

const assert = require('assert');
const request = require('request');
const ciphertoken = require('ciphertoken');
const nock = require('nock');
const fs = require('fs');
const _ = require('lodash');
const async = require('async');

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
let authorizedUserId;

describe('user', function () {

	const baseUser = {
		id: 'a1b2c3d4e5f6',
		username: `jie.lee${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
		password: 'validpassword'
	};

	const realm = {
		name: 'default'
	};

	function validatePwd(clear, crypted, cbk) {
		const cryptoMng = crypto(config.password);
		cryptoMng.verify(clear, crypted, function (err) {
			assert.equal(err, null);
			return cbk();
		});
	}

	function configOptions(port, path, method, body, auth, version) {
		const options = {
			url: `http://localhost:${port}${path}`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method
		};
		if (auth === true) {
			options.headers['Authorization'] = AUTHORIZATION;
		}
		if (version === true) {
			options.headers[config.version.header] = versionHeader;
		}
		if (body) {
			options.body = JSON.stringify(body);
		}
		return options;
	}

	function makeRequestAndAssertUserField(options, status, userField, actual, next) {
		request(options, function (err, res, body) {
			assert.equal(err, null, body);
			assert.equal(res.statusCode, status, body);
			dao.getAllUserFields(baseUser.username, function (err, foundUser) {
				assert.equal(err, null);
				assert.notEqual(foundUser, null);
				assert.deepEqual(foundUser[userField], actual);
				return next();
			});
		});
	}

	function addRealmAndAssert(realm, next){
		dao.addRealm(realm, function (err, createdRealm) {
			assert.equal(err, null);
			assert.notEqual(createdRealm, undefined);
			return next();
		});
	}

	function requestAndAssertBody(options, status, expectedBody, done){
		request(options, function (err, res, rawBody) {
			assert.equal(err, null, rawBody);
			assert.equal(res.statusCode, status, rawBody);
			const body = JSON.parse(rawBody);
			assert.deepEqual(body, expectedBody);
			return done();
		});
	}

	function addToArrayFieldByIdAndAssert(authorizedUserId, field, fieldValue, next){
		dao.addToArrayFieldById(authorizedUserId, field, fieldValue, function (err, added) {
			assert.equal(err, null);
			assert.ok(added === 1);
			return next();
		});
	}

	beforeEach(function (done) {
		async.parallel([
			function (done) {
				dao.deleteAllUsers(function (err) {
					assert.equal(err, null);
					const userToCreate = _.clone(baseUser);
					cryptoMng.encrypt(userToCreate.password, function (encryptedPwd) {
						userToCreate.password = encryptedPwd;
						dao.addUser(userToCreate, function (err, createdUser) {
							assert.equal(err, null);
							assert.notEqual(createdUser, undefined);
							authorizedUserId = createdUser._id;
							ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {
								AUTHORIZATION = config.authHeaderKey + loginToken;
								return done();
							});
						});
					});
				});
			},
			function (done) {
				dao.deleteAllRealms(function (err) {
					assert.equal(err, null);
					addRealmAndAssert(realm, done);
				});
			}
		], done);
	});

	describe('Forgot Password', function () {

		it('Send new Password', function (done) {
			const options = configOptions(config.public_port, `/user/${baseUser.username}/password`, 'GET', null, false, true);

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
			const options = configOptions(config.public_port, `/user/${baseUser.username}/password`, 'GET', null, false, true);

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

	function requestAndAssertStatus(options, status, done){
		request(options, function (err, res, body) {
			assert.equal(err, null, body);
			assert.equal(res.statusCode, status, body);
			return done();
		});
	}

	describe.only('User internal services realm', function () {
		it('gives error on invalid realm name', function (done) {
			const newRealm = {
				name: 'notvalid'
			};

			const options = configOptions(config.internal_port, `/user/${baseUser.id}/realms`, 'POST', newRealm);
			requestAndAssertStatus(options, 400, done);
		});

		it('adds valid realms to users', function (done) {
			const userRealm = {
				name: 'default'
			};
			const options = configOptions(config.internal_port, `/user/${baseUser.id}/realms`, 'POST', userRealm);
			makeRequestAndAssertUserField(options, 204, 'realms', [userRealm.name], done);
		});

		it('can add multiple realms', function (done) {
			const firstRealm = {
				name: 'default'
			};
			const secondRealm = {
				name: 'default2'
			};

			async.series([
				function (next) {
					addRealmAndAssert(secondRealm, next);
				},
				function (next) {
					addToArrayFieldByIdAndAssert(authorizedUserId, 'realms', firstRealm.name, next);
				},
				function (next) {
					const options = configOptions(config.internal_port, `/user/${baseUser.id}/realms`, 'POST', secondRealm);
					makeRequestAndAssertUserField(options, 204, 'realms', [firstRealm.name, secondRealm.name], next);
				}
			], done);
		});

		it('can delete realms', function (done) {
			const firstRealm = {
				name: 'default'
			};

			async.series([
				function (next) {
					addToArrayFieldByIdAndAssert(authorizedUserId, 'realms', firstRealm.name, next);
				},
				function (next) {
					const options = configOptions(config.internal_port, `/user/${baseUser.id}/realms`, 'DELETE', firstRealm);
					makeRequestAndAssertUserField(options, 200, 'realms', [], next);
				}
			], done);
		});
	});

	describe('User public services realm', function () {
		it('gives error on invalid realm name', function (done) {
			const newRealm = {
				name: 'notvalid'
			};

			const options = configOptions(config.public_port, '/user/me/realms', 'POST', newRealm, true, true);
			requestAndAssertStatus(options, 400, done);
		});

		it('adds valid realms to users', function (done) {
			const userRealm = {
				name: 'default'
			};

			const options = configOptions(config.public_port, '/user/me/realms', 'POST', userRealm, true, true);
			makeRequestAndAssertUserField(options, 204, 'realms', [userRealm.name], done);
		});

		it('can add multiple realms', function (done) {
			const firstRealm = {
				name: 'default'
			};

			const secondRealm = {
				name: 'default2'
			};

			async.series([
				function (next) {
					dao.addRealm(secondRealm, function (err, createdRealm) {
						assert.equal(err, null);
						assert.notEqual(createdRealm, undefined);
						return next();
					});
				},
				function (next) {
					addToArrayFieldByIdAndAssert(authorizedUserId, 'realms', firstRealm.name, next);
				},
				function (next) {
					const options = configOptions(config.public_port, '/user/me/realms', 'POST', secondRealm, true, true);
					makeRequestAndAssertUserField(options, 204, 'realms', [firstRealm.name, secondRealm.name], next);
				}
			], done);
		});

		it('can delete realms', function (done) {
			const firstRealm = {
				name: 'default'
			};

			async.series([
				function (next) {
					addToArrayFieldByIdAndAssert(authorizedUserId, 'realms', firstRealm.name, next);
				},
				function (next) {
					const options = configOptions(config.public_port, '/user/me/realms', 'DELETE', firstRealm, true, true);
					makeRequestAndAssertUserField(options, 200, 'realms', [], next);
				}
			], done);
		});
	});

	describe('Update Password', function () {
		it('204 Ok', function (done) {
			const newPassword = {
				password: 'n3wPas5W0rd'
			};

			const options = configOptions(config.public_port, '/user/me/password', 'PUT', newPassword, true, true);

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
			const options = configOptions(config.public_port, '/user/me/password', 'PUT', null, true, true);

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
			const options = configOptions(config.public_port, '/user/me/password', 'PUT', newPassword, true, true);

			const expectedResult = {
				err: 'auth_proxy_error',
				des: 'invalid body request'
			};

			requestAndAssertBody(options, 400, expectedResult, done);
		});

		it('400 (no authorization)', function (done) {
			const newPassword = {};
			const options = configOptions(config.public_port, '/user/me/password', 'PUT', newPassword, false, true);

			const expectedResult = {
				err: 'invalid_authorization',
				des: 'required authorization header'
			};

			requestAndAssertBody(options, 401, expectedResult, done);
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
