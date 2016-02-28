'use strict';

const assert = require('assert');
const request = require('request');
const ciphertoken = require('ciphertoken');
const async = require('async');
const crypto = require('crypto');
const nock = require('nock');
const _ = require('lodash');

const config = require('../../config.json');
const dao = require('../../src/managers/dao');

const redisMng = require('../../src/managers/redis');

const versionHeader = 'test/1';

// TODO: if config.management does not exist or is incorrect POST and DELETE to /auth/user must return 404
// for this test config should be edited, doing so a white box unit test or either change way of loading config file

const username = `validuser${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`;
const password = 'validpassword';
const phone = '111111111';

const USER = {
	id: 'a1b2c3d4e5f6',
	username,
	password,
	phone
};

const HEADERS_WITHOUT_AUTHORIZATION_BASIC = {
	'Content-Type': 'application/json; charset=utf-8',
	'x-example-version': versionHeader
};

const HEADERS_WITH_AUTHORIZATION_BASIC = {
	'Content-Type': 'application/json; charset=utf-8',
	Authorization: `basic ${new Buffer(`${config.management.clientId}:${config.management.clientSecret}`).toString('base64')}`,
	[config.version.header]: versionHeader
};

describe('Auth /user', function () {

	beforeEach(dao.deleteAllUsers);

	it('POST 201 created', function (done) {
		const options = {
			url: `http://${config.private_host}:${config.internal_port}/auth/user`,
			headers: _.clone(HEADERS_WITH_AUTHORIZATION_BASIC),
			method: 'POST',
			body: JSON.stringify({ username, password, phone })
		};

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 201, body);
			const parsedBody = JSON.parse(body);
			assert.equal(parsedBody.username, username);
			assert.equal(parsedBody.password, undefined);
			return done();
		});
	});

	it('401 Not authorized when trying to POST to /auth/user without basic authorization', function (done) {
		const options = {
			url: `http://${config.private_host}:${config.internal_port}/auth/user`,
			headers: _.clone(HEADERS_WITHOUT_AUTHORIZATION_BASIC),
			method: 'POST',
			body: JSON.stringify({ username, password })
		};

		request(options, function (err, res) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 401);
			return done();
		});
	});

	it('POST 409 already exists', function (done) {
		dao.addUser(USER, function (err, createdUser) {
			assert.equal(err, null);
			assert.notEqual(createdUser, null);

			const options = {
				url: `http://${config.private_host}:${config.internal_port}/auth/user`,
				headers: _.clone(HEADERS_WITH_AUTHORIZATION_BASIC),
				method: 'POST',
				body: JSON.stringify({username: USER.username, password: USER.password})
			};

			request(options, function (err, res, rawBody) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 409);
				const body = JSON.parse(rawBody);
				assert.equal(body.err, 'username_already_exists');
				return done();
			});
		});
	});

	it('401 Not authorized when trying to POST an existing user without basic auth', function (done) {
		dao.addUser(USER, function (err, createdUser) {
			assert.equal(err, null);
			assert.notEqual(createdUser, null);

			const options = {
				url: `http://${config.private_host}:${config.internal_port}/auth/user`,
				headers: _.clone(HEADERS_WITHOUT_AUTHORIZATION_BASIC),
				method: 'POST',
				body: JSON.stringify({username: USER.username, password: USER.password})
			};

			request(options, function (err, res) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 401);
				return done();
			});
		});
	});

	it('DELETE 204', function (done) {
		dao.addUser(USER, function (err, createdUser) {
			assert.equal(err, null);
			assert.notEqual(createdUser, null);

			const options = {
				url: `http://${config.private_host}:${config.internal_port}/auth/user`,
				headers: _.clone(HEADERS_WITH_AUTHORIZATION_BASIC),
				method: 'DELETE'
			};

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 204);
				assert.equal(body, '');

				dao.countUsers(function (err, count) {
					assert.equal(err, null);
					assert.equal(count, 0);
					return done();
				});
			});
		});
	});

	it('401 Not authorized when trying to delete without basic authorization', function (done) {
		dao.addUser(USER, function (err, createdUser) {
			assert.equal(err, null);
			assert.notEqual(createdUser, null);

			const options = {
				url: `http://${config.private_host}:${config.internal_port}/auth/user`,
				headers: _.clone(HEADERS_WITHOUT_AUTHORIZATION_BASIC),
				method: 'DELETE'
			};

			request(options, function (err, res) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 401);

				dao.countUsers(function (err, count) {
					assert.equal(err, null);
					assert.equal(count, 1);
				});

				const nextOptions = _.clone(options);
				nextOptions.headers = HEADERS_WITH_AUTHORIZATION_BASIC;
				request(nextOptions, function (err) {
					assert.equal(err, null);
					dao.countUsers(function (err, count) {
						assert.equal(err, null);
						assert.equal(count, 0);
						done();
					});
				});
			});
		});
	});

	const tokenSettings = {
		cipherKey: config.accessToken.cipherKey,
		firmKey: config.accessToken.signKey,
		tokenExpirationMinutes: config.accessToken.expiration * 60
	};

	describe('/user/activate', function () {

		beforeEach(function (done) {
			async.series([
				redisMng.connect,
				redisMng.deleteAllKeys
			], done);
		});

		it('Create OK (iOS device) ', function (done) {
			const transactionId = crypto.pseudoRandomBytes(12).toString('hex');

			const bodyData = {
				firstName: 'Firstname',
				lastName: 'Lastname',
				country: 'US',
				email: username,
				password,
				phone,
				transactionId
			};

			const redisKey = config.emailVerification.redis.key.replace('{username}', bodyData.email);
			const redisExp = config.emailVerification.redis.expireInSec;

			redisMng.insertKeyValue(redisKey, transactionId, redisExp, function (err) {
				assert.equal(err, null);

				ciphertoken.createToken(tokenSettings, username, null, bodyData, function (err, token) {
					assert.equal(err, null);

					const options = {
						url: `http://${config.private_host}:${config.public_port}/user/activate?verifyToken=${token}`,
						method: 'GET',
						headers: {},
						followRedirect: false
					};
					options.headers['user-agent'] = 'Apple-iPhone5C2/1001.525';

					nock(`http://${config.private_host}:${config.private_port}`)
						.post(config.passThroughEndpoint.path)
						.reply(201, {id: USER.id});

					request(options, function (err, res, body) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 302, body);
						assert.notEqual(res.headers.location.indexOf(`${config.emailVerification.scheme}://user/refreshToken/`), -1);
						return done();
					});
				});

			});
		});

		it('Create OK (Android device) ', function (done) {
			const transactionId = crypto.pseudoRandomBytes(12).toString('hex');

			const bodyData = {
				firstName: 'Firstname',
				lastName: 'Lastname',
				country: 'US',
				email: username,
				password,
				phone,
				transactionId
			};

			const redisKey = config.emailVerification.redis.key.replace('{username}', bodyData.email);
			const redisExp = config.emailVerification.redis.expireInSec;

			redisMng.insertKeyValue(redisKey, transactionId, redisExp, function (err) {
				assert.equal(err, null);

				ciphertoken.createToken(tokenSettings, username, null, bodyData, function (err, token) {
					assert.equal(err, null);

					const options = {
						url: `http://${config.private_host}:${config.public_port}/user/activate?verifyToken=${token}`,
						method: 'GET',
						headers: {},
						followRedirect: false
					};
					options.headers['user-agent'] = 'Mozilla/5.0 (Linux; U; Android 2.2; nb-no; HTC Desire Build/FRF91)';

					nock(`http://${config.private_host}:${config.private_port}`)
						.post(config.passThroughEndpoint.path)
						.reply(201, {id: USER.id});

					request(options, function (err, res, body) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 302, body);
						assert.notEqual(res.headers.location.indexOf('intent://user/refreshToken/'), -1);
						return done();
					});
				});

			});
		});

		it('Create OK (not an iOS or Android device) without redirect option ', function (done) {
			const transactionId = crypto.pseudoRandomBytes(12).toString('hex');
			const thisConfig = _.clone(config);
			thisConfig.emailVerification.redirectUrl = null;

			const bodyData = {
				firstName: 'Firstname',
				lastName: 'Lastname',
				country: 'US',
				email: username,
				password,
				phone,
				transactionId
			};

			const redisKey = thisConfig.emailVerification.redis.key.replace('{username}', bodyData.email);
			const redisExp = thisConfig.emailVerification.redis.expireInSec;

			redisMng.insertKeyValue(redisKey, transactionId, redisExp, function (err) {
				assert.equal(err, null);

				ciphertoken.createToken(tokenSettings, username, null, bodyData, function (err, token) {
					assert.equal(err, null);

					const options = {
						url: `http://${thisConfig.private_host}:${thisConfig.public_port}/user/activate?verifyToken=${token}`,
						method: 'GET',
						headers: {
							'user-agent': 'Mozilla/5.0'
						},
						followRedirect: false
					};

					nock(`http://${thisConfig.private_host}:${thisConfig.private_port}`)
						.post(thisConfig.passThroughEndpoint.path)
						.reply(201, {id: USER.id});

					request(options, function (err, res, body) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 200, body);
						const parsedBody = JSON.parse(body);
						assert.deepEqual(parsedBody, {msg: thisConfig.emailVerification.nonCompatibleEmailMsg});
						return done();
					});
				});

			});
		});

		it('Create OK (not an iOS or Android device) with redirect option', function (done) {
			const transactionId = crypto.pseudoRandomBytes(12).toString('hex');
			const thisConfig = _.clone(config);
			thisConfig.emailVerification.redirectUrl = 'http://www.google.com';

			const bodyData = {
				firstName: 'Firstname',
				lastName: 'Lastname',
				country: 'US',
				email: username,
				password,
				phone,
				transactionId
			};

			const redisKey = thisConfig.emailVerification.redis.key.replace('{username}', bodyData.email);
			const redisExp = thisConfig.emailVerification.redis.expireInSec;

			redisMng.insertKeyValue(redisKey, transactionId, redisExp, function (err) {
				assert.equal(err, null);

				ciphertoken.createToken(tokenSettings, username, null, bodyData, function (err, token) {
					assert.equal(err, null);

					const options = {
						url: `http://${thisConfig.private_host}:${thisConfig.public_port}/user/activate?verifyToken=${token}`,
						method: 'GET',
						headers: {
							'user-agent': 'Mozilla/5.0'
						},
						followRedirect: false
					};

					nock(`http://${thisConfig.private_host}:${thisConfig.private_port}`)
						.post(thisConfig.passThroughEndpoint.path)
						.reply(201, {id: USER.id});

					request(options, function (err, res, body) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 301, body);
						assert.equal(res.headers.location, thisConfig.emailVerification.redirectUrl);
						return done();
					});
				});

			});
		});

		it('No verify token param', function (done) {
			const expectedResponseBody = {
				err: 'auth_proxy_error',
				des: 'empty param verifyToken'
			};

			const options = {
				url: `http://${config.private_host}:${config.public_port}/user/activate`,
				method: 'GET'
			};

			request(options, function (err, res, rawBody) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 400, rawBody);
				const body = JSON.parse(rawBody);
				assert.deepEqual(body, expectedResponseBody);
				return done();
			});
		});

	});

});
