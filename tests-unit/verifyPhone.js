const assert = require('assert');
const async = require('async');
const request = require('request');
const nock = require('nock');
const _ = require('lodash');
const config = require('../config.json');

const dao = require('../src/managers/dao');
const redisMng = require('../src/managers/redis');

const versionHeader = 'test/1';

describe.skip('/api/profile (verify phone)', function () {

	this.timeout(10000);

	const notifServiceURL = config.externalServices.notifications.base;

	const baseUser = {
		email: `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
		password: 'n3wPas5W0rd',
		phone: '444444444',
		country: 'US'
	};

	beforeEach(function (done) {
		async.series([
			redisMng.deleteAllKeys,
			dao.deleteAllUsers
		], done);
	});

	it('POST empty phone', function (done) {
		const user = _.clone(baseUser);
		user.phone = null;

		const options = {
			url: `http://localhost:${config.public_port}${config.passThroughEndpoint.path}`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: versionHeader
			},
			method: 'POST',
			body: JSON.stringify(user)
		};

		nock(notifServiceURL)
			.post('/notification/sms')
			.reply(204);

		request(options, function (err, res, rawBody) {
			assert.equal(err, null, rawBody);
			assert.equal(res.statusCode, 400, rawBody);
			const body = JSON.parse(rawBody);
			assert.deepEqual(body, {err: 'auth_proxy_error', des: 'empty phone or country'});
			return done();
		});
	});

	it('POST empty country', function (done) {
		const user = _.clone(baseUser);
		user.country = '';

		const options = {
			url: `http://localhost:${config.public_port}${config.passThroughEndpoint.path}`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: versionHeader
			},
			method: 'POST',
			body: JSON.stringify(user)
		};

		nock(notifServiceURL)
			.post('/notification/sms')
			.reply(204);

		request(options, function (err, res, rawBody) {
			assert.equal(err, null, rawBody);
			assert.equal(res.statusCode, 400, rawBody);
			const body = JSON.parse(rawBody);
			assert.deepEqual(body, {err: 'auth_proxy_error', des: 'empty phone or country'});
			return done();
		});
	});

	it('POST phone not verified', function (done) {
		const user = _.clone(baseUser);

		const options = {
			url: `http://localhost:${config.public_port}${config.passThroughEndpoint.path}`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: versionHeader
			},
			method: 'POST',
			body: JSON.stringify(user)
		};

		nock(notifServiceURL)
			.post('/notification/sms')
			.reply(204);

		request(options, function (err, res, rawBody) {
			assert.equal(err, null, rawBody);
			assert.equal(res.statusCode, 403, rawBody);
			const body = JSON.parse(rawBody);
			assert.deepEqual(body, { err: 'auth_proxy_verified_error', des: 'User phone not verified' });
			return done();
		});
	});

	it('POST incorrect PIN sent (1 attempt)', function (done) {
		const user = _.clone(baseUser);

		const options = {
			url: `http://localhost:${config.public_port}${config.passThroughEndpoint.path}`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: versionHeader
			},
			method: 'POST',
			body: JSON.stringify(user)
		};

		nock(notifServiceURL)
			.post('/notification/sms')
			.times(2)
			.reply(204);

		//1st call must create the pin
		request(options, function (err, res, rawBody) {
			assert.equal(err, null, rawBody);
			assert.equal(res.statusCode, 403, rawBody);

			options.headers['x-otp-pin'] = 'zzzz';

			//2nd call incorrect pin
			request(options, function (err, res, rawBody) {
				assert.equal(err, null, rawBody);
				assert.equal(res.statusCode, 401, rawBody);
				const body = JSON.parse(rawBody);
				assert.deepEqual(body, { err: 'verify_phone_error', des: 'PIN used is not valid.'});
				return done();
			});
		});
	});

	it('POST correct PIN sent', function (done) {

		const user = _.clone(baseUser);

		const options = {
			url: `http://localhost:${config.public_port}${config.passThroughEndpoint.path}`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: versionHeader
			},
			method: 'POST',
			body: JSON.stringify(user)
		};

		nock(notifServiceURL)
			.post('/notification/sms')
			.reply(204);

		//1st call must create the pin
		request(options, function (err, res, rawBody) {
			assert.equal(err, null, rawBody);
			assert.equal(res.statusCode, 403, rawBody);

			const redisKey = config.redisKeys.user_phone_verify.key.replace('{userId}', user.email).replace('{phone}', `+1${user.phone}`);

			redisMng.getKeyValue(`${redisKey}.pin`, function (err, redisPhonePin) {
				assert.equal(err, null);

				options.headers['x-otp-pin'] = redisPhonePin;

				const expectedUserId = 'a1b2c3d4e5f6';

				nock(`http://${config.private_host}:${config.private_port}`)
					.post(config.passThroughEndpoint.path)
					.reply(201, {id: expectedUserId});

				nock(notifServiceURL)
					.post('/notification/email')
					.reply(204);

				//2nd call correct pin
				request(options, function (err, res, rawBody) {
					assert.equal(err, null, rawBody);
					assert.equal(res.statusCode, 201, rawBody);
					const body = JSON.parse(body);
					assert.notEqual(body.accessToken, null, rawBody);
					assert.notEqual(body.refreshToken, null, rawBody);
					assert.notEqual(body.expiresIn, null, rawBody);
					return done();
				});

			});

		});
	});

	it('POST incorrect PIN sent (3 attempts)', function (done) {
		const user = _.clone(baseUser);

		const options = {
			url: `http://localhost:${config.public_port}${config.passThroughEndpoint.path}`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: versionHeader
			},
			method: 'POST',
			body: JSON.stringify(user)
		};

		nock(notifServiceURL)
			.post('/notification/sms')
			.times(3)
			.reply(204);

		//1st call must create the pin
		request(options, function (err, res, rawBody) {
			assert.equal(err, null, rawBody);
			assert.equal(res.statusCode, 403, rawBody);

			const redisKey = config.redisKeys.user_phone_verify.key.replace('{userId}', user.email).replace('{phone}', `+1${user.phone}`);

			//Get the correct PIN
			redisMng.getKeyValue(`${redisKey}.pin`, function (err, redisPhonePin) {
				assert.equal(err, null);

				options.headers['x-otp-pin'] = 'zzzz';

				//1st call incorrect pin
				request(options, function (err, res, rawBody) {
					assert.equal(err, null, rawBody);
					assert.equal(res.statusCode, 401, rawBody);
					const body = JSON.parse(rawBody);
					assert.deepEqual(body, {err: 'verify_phone_error', des: 'PIN used is not valid.'});

					//2nd call incorrect pin
					request(options, function (err, res, rawBody) {
						assert.equal(err, null, rawBody);
						assert.equal(res.statusCode, 401, rawBody);
						const body = JSON.parse(rawBody);
						assert.deepEqual(body, {err: 'verify_phone_error', des: 'PIN used is not valid.'});

						//3rd call incorrect pin
						request(options, function (err, res, rawBody) {
							assert.equal(err, null, rawBody);
							assert.equal(res.statusCode, 401, rawBody);
							const body = JSON.parse(rawBody);
							assert.deepEqual(body, {err: 'verify_phone_error', des: 'PIN used has expired.'});

							options.headers['x-otp-pin'] = redisPhonePin;

							//4th call incorrect (expired pin)
							request(options, function (err, res, rawBody) {
								assert.equal(err, null, rawBody);
								assert.equal(res.statusCode, 401, rawBody);
								const body = JSON.parse(body);
								assert.deepEqual(body, {err: 'verify_phone_error', des: 'PIN used is not valid.'});

								//Get the correct PIN
								redisMng.getKeyValue(`${redisKey}.pin`, function (err, redisPhonePin) {
									assert.equal(err, null);

									options.headers['x-otp-pin'] = redisPhonePin;

									nock(notifServiceURL)
										.post('/notification/email')
										.reply(204);

									const expectedUserId = 'a1b2c3d4e5f6';

									nock(`http://${config.private_host}:${config.private_port}`)
										.post(config.passThroughEndpoint.path)
										.reply(201, {id: expectedUserId});

									//5th call actualized correct pin
									request(options, function (err, res, rawBody) {
										assert.equal(err, null, rawBody);
										assert.equal(res.statusCode, 201, rawBody);
										const body = JSON.parse(rawBody);
										assert.notEqual(body.accessToken, null, rawBody);
										assert.notEqual(body.refreshToken, null, rawBody);
										assert.notEqual(body.expiresIn, null, rawBody);
										return done();
									});

								});
							});
						});
					});
				});

			});
		});
	});

	it('POST user already exists', function (done) {

		const user = _.clone(baseUser);

		const options = {
			url: `http://localhost:${config.public_port}${config.passThroughEndpoint.path}`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: versionHeader
			},
			method: 'POST',
			body: JSON.stringify(user)
		};

		nock(notifServiceURL)
			.post('/notification/sms')
			.reply(204);

		//1st call must create the pin
		request(options, function (err, res, rawBody) {
			assert.equal(err, null, rawBody);
			assert.equal(res.statusCode, 403, rawBody);

			const redisKey = config.redisKeys.user_phone_verify.key.replace('{userId}', user.email).replace('{phone}', `+1${user.phone}`);

			redisMng.getKeyValue(`${redisKey}.pin`, function (err, redisPhonePin) {
				assert.equal(err, null);

				options.headers['x-otp-pin'] = redisPhonePin;

				nock(notifServiceURL)
					.post('/notification/sms')
					.reply(204);

				const expectedUserId = 'a1b2c3d4e5f6';

				nock(`http://${config.private_host}:${config.private_port}`)
					.post(config.passThroughEndpoint.path)
					.reply(201, {id: expectedUserId});

				nock(notifServiceURL)
					.post('/notification/email')
					.reply(204);

				//2nd call correct pin
				request(options, function (err, res, rawBody) {
					assert.equal(err, null, rawBody);
					assert.equal(res.statusCode, 201, rawBody);
					const body = JSON.parse(rawBody);
					assert.notEqual(body.accessToken, null, rawBody);
					assert.notEqual(body.refreshToken, null, rawBody);
					assert.notEqual(body.expiresIn, null, rawBody);

					request(options, function (err, res, rawBody) {
						assert.equal(err, null, rawBody);
						assert.equal(res.statusCode, 403, rawBody);
						const body = JSON.parse(rawBody);
						assert.deepEqual(body, { err: 'auth_proxy_error', des: 'user already exists' });
						return done();
					});
				});

			});

		});
	});

});
