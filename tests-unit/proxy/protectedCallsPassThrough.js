'use strict';

const _ = require('lodash');
const nock = require('nock');
const request = require('request');
const ciphertoken = require('ciphertoken');
const assert = require('assert');
const redisMng = require('../../src/managers/redis');

const dao = require('../../src/managers/dao');
const config = require('../../config');

const notificationsServiceURL = config.externalServices.notifications.base;

const versionHeader = 'test/1';

const accessTokenSettings = require('../token_settings').accessTokenSettings;
const refreshTokenSettings = require('../token_settings').refreshTokenSettings;


describe('Protected calls passThrough', () => {

	it.skip('201 Created', function (done) {
		const expectedUsername = `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`;
		const expectedUserId = 'a1b2c3d4e5f6';
		const expectedUserPhone = '111111111';
		const expectedUserCountry = 'US';
		const expectedPublicRequest = {};
		expectedPublicRequest[config.passThroughEndpoint.username] = expectedUsername;
		expectedPublicRequest[config.passThroughEndpoint.password] = '12345678';
		expectedPublicRequest.phone = expectedUserPhone;
		expectedPublicRequest.country = expectedUserCountry;

		const expectedPrivateResponse = _.clone(expectedPublicRequest);
		delete(expectedPrivateResponse[config.passThroughEndpoint.password]);

		nock(`http://${config.private_host}:${config.private_port}`)
			.post(config.passThroughEndpoint.path, expectedPrivateResponse)
			.reply(201, {id: expectedUserId});

		const redisKey = config.redisKeys.user_phone_verify.key.replace('{userId}', expectedUsername).replace('{phone}', `+1${expectedUserPhone}`);

		const pin = 'xxxx';

		redisMng.insertKeyValue(`${redisKey}.pin`, pin, config.redisKeys.user_phone_verify.expireInSec, function (err) {
			assert.equal(err, null);
			redisMng.insertKeyValue(`${redisKey}.attempts`, config.userPIN.attempts, config.redisKeys.user_phone_verify.expireInSec, function (err) {
				assert.equal(err, null);

				nock(`http://${config.private_host}:${config.private_port}`)
					.post(config.passThroughEndpoint.path, expectedPrivateResponse)
					.reply(201, {id: expectedUserId});

				const options = {
					url: `http://${config.private_host}:${config.public_port}${config.passThroughEndpoint.path}`,
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'x-otp-pin': pin,
						[config.version.header]: versionHeader
					},
					method: 'POST',
					body: JSON.stringify(expectedPublicRequest)
				};

				request(options, function (err, res, rawBody) {
					assert.equal(err, null);
					assert.equal(res.statusCode, 201, rawBody);
					const body = JSON.parse(rawBody);

					assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
					assert.notEqual(body.accessToken, undefined);
					ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function (err, accessTokenInfo) {
						assert.equal(err, null);
						assert.equal(accessTokenInfo.userId, expectedUserId);

						assert.notEqual(body.refreshToken, undefined);
						ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function (err, refreshTokenInfo) {
							assert.equal(err, null);
							assert.equal(refreshTokenInfo.userId, expectedUserId);

							dao.getFromUsername(expectedUsername, function (err, foundUser) {
								assert.equal(err, null);
								assert.equal(foundUser.platforms, undefined);
								return done();
							});
						});
					});
				});

			});
		});

	});

	it.skip('203 Platform Info', function (done) {
		const expectedUsername = `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`;
		const expectedUserId = 'a1b2c3d4e5f6';
		const expectedUserPhone = '222222222';
		const expectedUserCountry = 'US';
		const expectedPublicRequest = {};
		expectedPublicRequest[config.passThroughEndpoint.username] = expectedUsername;
		expectedPublicRequest.phone = expectedUserPhone;
		expectedPublicRequest.country = expectedUserCountry;

		ciphertoken.createToken(accessTokenSettings, expectedUserId, null, {
			accessToken: 'acc',
			refreshToken: 'ref',
			expiresIn: accessTokenSettings.tokenExpirationMinutes * 60
		}, function (err, sfToken) {
			expectedPublicRequest.sf = sfToken;

			const expectedPrivateResponse = _.clone(expectedPublicRequest);
			delete(expectedPrivateResponse[config.passThroughEndpoint.password]);

			nock(`http://${config.private_host}:${config.private_port}`)
				.post(config.passThroughEndpoint.path, expectedPrivateResponse)
				.reply(203, {id: expectedUserId});

			const redisKey = config.redisKeys.user_phone_verify.key.replace('{userId}', expectedUsername).replace('{phone}', `+1${expectedUserPhone}`);

			const pin = 'xxxx';

			redisMng.insertKeyValue(`${redisKey}.pin`, pin, config.redisKeys.user_phone_verify.expireInSec, function (err) {
				assert.equal(err, null);
				redisMng.insertKeyValue(`${redisKey}.attempts`, config.userPIN.attempts, config.redisKeys.user_phone_verify.expireInSec, function (err) {
					assert.equal(err, null);

					const options = {
						url: `http://${config.private_host}:${config.public_port}${config.passThroughEndpoint.path}`,
						headers: {
							'Content-Type': 'application/json; charset=utf-8',
							'x-otp-pin': pin,
							[config.version.header]: versionHeader
						},
						method: 'POST',
						body: JSON.stringify(expectedPublicRequest)
					};

					nock(notificationsServiceURL)
						.post('/notification/email')
						.reply(204);

					request(options, function (err, res, rawBody) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 201);
						const body = JSON.parse(rawBody);

						assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
						assert.notEqual(body.accessToken, undefined);
						ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function (err, accessTokenInfo) {
							assert.equal(err, null);
							assert.equal(accessTokenInfo.userId, expectedUserId);

							assert.notEqual(body.refreshToken, undefined);
							ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function (err, refreshTokenInfo) {
								assert.equal(err, null);
								assert.equal(refreshTokenInfo.userId, expectedUserId);

								dao.getFromUsername(expectedUsername, function (err, foundUser) {
									assert.equal(err, null);
									assert.notEqual(foundUser.platforms, undefined);
									assert.equal(foundUser.platforms.length, 1);
									assert.equal(foundUser.platforms[0].platform, 'sf');
									assert.equal(foundUser.platforms[0].accessToken, 'acc');
									assert.equal(foundUser.platforms[0].refreshToken, 'ref');
									assert.notEqual(foundUser.platforms[0].expiry, undefined);
									return done();
								});
							});
						});
					});
				});
			});

		});
	});

	it.skip('409 already exists', function (done) {
		const expectedUsername = `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`;
		const expectedUserId = 'a1b2c3d4e5f6';
		const expectedPublicRequest = {};
		const expectedUserPhone = '222222222';
		const expectedUserCountry = 'US';
		expectedPublicRequest[config.passThroughEndpoint.username] = `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`;
		expectedPublicRequest[config.passThroughEndpoint.password] = '12345678';
		expectedPublicRequest.phone = expectedUserPhone;
		expectedPublicRequest.country = expectedUserCountry;

		const expectedPrivateResponse = _.clone(expectedPublicRequest);
		delete(expectedPrivateResponse[config.passThroughEndpoint.password]);

		nock(`http://${config.private_host}:${config.private_port}`)
			.post(config.passThroughEndpoint.path, expectedPrivateResponse)
			.reply(201, {id: expectedUserId});

		const redisKey = config.redisKeys.user_phone_verify.key.replace('{userId}', expectedUsername).replace('{phone}', `+1${expectedUserPhone}`);

		const pin = 'xxxx';

		redisMng.insertKeyValue(`${redisKey}.pin`, pin, config.redisKeys.user_phone_verify.expireInSec, function (err) {
			assert.equal(err, null);
			redisMng.insertKeyValue(`${redisKey}.attempts`, config.userPIN.attempts, config.redisKeys.user_phone_verify.expireInSec, function (err) {
				assert.equal(err, null);

				const options = {
					url: `http://${config.private_host}:${config.public_port}${config.passThroughEndpoint.path}`,
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'x-otp-pin': pin,
						[config.version.header]: versionHeader
					},
					method: 'POST',
					body: JSON.stringify(expectedPublicRequest)
				};

				nock(notificationsServiceURL)
					.post('/notification/email')
					.reply(204);

				request(options, function (err, res, rawBody) {
					assert.equal(err, null);
					assert.equal(res.statusCode, 201, rawBody);
					const body = JSON.parse(rawBody);

					assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
					assert.notEqual(body.accessToken, undefined);
					ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function (err, accessTokenInfo) {
						assert.equal(err, null);
						assert.equal(accessTokenInfo.userId, expectedUserId);

						assert.notEqual(body.refreshToken, undefined);
						ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function (err, refreshTokenInfo) {
							assert.equal(err, null);
							assert.equal(refreshTokenInfo.userId, expectedUserId);
							return done();
						});
					});
				});
			});
		});
	});

	it('400 not security token', function (done) {
		const expectedPublicRequest = {};
		expectedPublicRequest[config.passThroughEndpoint.username] = `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`;

		const options = {
			url: `http://${config.private_host}:${config.public_port}${config.passThroughEndpoint.path}`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: versionHeader
			},
			method: 'POST',
			body: JSON.stringify(expectedPublicRequest)
		};

		request(options, function (err, res, rawBody) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 400);
			const body = JSON.parse(rawBody);
			assert.equal(body.err, 'invalid_security_token');
			assert.equal(body.des, 'you must provide a password or a salesforce token to create the user');
			return done();
		});
	});

	it.skip('201 Created (Verify email)', function (done) {
		const expectedUsername = `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`;
		const expectedUserId = 'a1b2c3d4e5f6';
		const expectedUserPhone = '111111111';
		const expectedUserCountry = 'US';
		const expectedPublicRequest = {};
		expectedPublicRequest[config.passThroughEndpoint.username] = expectedUsername;
		expectedPublicRequest[config.passThroughEndpoint.password] = '12345678';
		expectedPublicRequest.phone = expectedUserPhone;
		expectedPublicRequest.country = expectedUserCountry;

		const expectedPrivateResponse = _.clone(expectedPublicRequest);
		delete(expectedPrivateResponse[config.passThroughEndpoint.password]);

		nock(`http://${config.private_host}:${config.private_port}`)
			.post(config.passThroughEndpoint.path, expectedPrivateResponse)
			.times(2)
			.reply(201, {id: expectedUserId});

		nock(notificationsServiceURL)
			.post('/notification/email')
			.reply(204);

		const redisKey = config.redisKeys.user_phone_verify.key.replace('{userId}', expectedUsername).replace('{phone}', `+1${expectedUserPhone}`);

		const pin = 'xxxx';

		redisMng.insertKeyValue(`${redisKey}.pin`, pin, config.redisKeys.user_phone_verify.expireInSec, function (err) {
			assert.equal(err, null);
			redisMng.insertKeyValue(`${redisKey}.attempts`, config.userPIN.attempts, config.redisKeys.user_phone_verify.expireInSec, function (err) {
				assert.equal(err, null);

				const options = {
					url: `http://${config.private_host}:${config.public_port}${config.passThroughEndpoint.path}`,
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'x-otp-pin': pin,
						[config.version.header]: versionHeader
					},
					method: 'POST',
					body: JSON.stringify(expectedPublicRequest)
				};

				request(options, function (err, res, rawBody) {
					assert.equal(err, null);
					assert.equal(res.statusCode, 200, rawBody);
					const body = JSON.parse(rawBody);
					assert.deepEqual(body, {des: expectedUsername}, body);

					//Check the redis transactionId for the user
					const redisKey = config.redisKeys.direct_login_transaction.key.replace('{username}', expectedUsername);

					redisMng.getKeyValue(redisKey, function (err, transactionId) {
						assert.equal(err, null);
						assert.notEqual(transactionId, null);
						assert.equal(transactionId.length, 24);
						return done();
					});
				});

			});
		});

	});

});
