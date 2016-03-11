'use strict';

const assert = require('assert');
const pinValidation = require('../src/middlewares/pinValidation');
const nock = require('nock');
const config = require('../config');
const redisMng = require('../src/managers/redis');
const countries = require('countries-info');
const _ = require('lodash');

const notifServiceURL = config.externalServices.notifications.base;

describe('middleware pinValidation', function () {

	const settings = {
		phoneVerification: {
			pinSize: 4,
			attempts: 3,
			redis: {
				key: 'user.{userId}.phone.{phone}',
				expireInSec: 300
			},
			pinValidationEndpoints: [
				{
					path: '/api/me/phones',
					method: 'post',
					fields: {
						phoneNumber: 'phone'
					}
				},
				{
					path: '/api/me/phones',
					method: 'post',
					fields: {
						countryISO: 'country',
						phoneNumber: 'phone'
					}
				},
				{
					path: '/api/me/phones',
					method: 'post',
					fields: {
						countryISO: 'country'
					}
				}
			]
		}
	};

	function getPinNumber (userId, inPhone, country, cbk) {
		countries.countryFromIso(country, function (err, returnedCountry) {
			assert.equal(err, null);
			const phone = `+${returnedCountry.Dial}${inPhone}`;
			const redisKey = settings.phoneVerification.redis.key.replace('{userId}', userId).replace('{phone}', phone);

			redisMng.getKeyValue(`${redisKey}.pin`, cbk);
		});
	}

	beforeEach(function (done) {
		redisMng.connect(function () {
			redisMng.deleteAllKeys(done);
		});
	});

	afterEach(redisMng.disconnect);

	it('no pin validation', function (done) {
		const req = {
			url: 'http://www.google.es'
		};
		const res = {};
		const next = function (canContinue) {
			if (canContinue === undefined || canContinue === true) {
				return done();
			}
		};

		const noPhone = _.cloneDeep(settings);
		noPhone.phoneVerification = false;
		pinValidation(noPhone)(req, res, next);
	});

	it('continue if the url does not need pin validation', function (done) {
		const req = {
			url: 'http://www.google.es'
		};
		const res = {};
		const next = function (canContinue) {
			if (canContinue === undefined || canContinue === true) {
				return done();
			}
		};

		pinValidation(settings)(req, res, next);
	});

	it('error if no user', function (done) {
		const expectedCode = 401;
		const expectedError = {
			err: 'invalid_headers',
			des: 'no user in headers'
		};
		let validResponse = false;

		const req = {
			url: '/api/me/phones',
			body: {
				country: 'ES'
			},
			method: 'POST'
		};

		const res = {
			send: (code, body) => {
				assert.equal(code, expectedCode, 'invalid response code');
				assert.deepEqual(body, expectedError, 'invalid response body');
				validResponse = true;
			}
		};

		const next = function (err) {
			if (err && validResponse) {
				return done();
			}
		};

		pinValidation(settings)(req, res, next);
	});

	it('error if body does not match the schema', function (done) {
		const expectedCode = 400;
		const expectedError = {
			err: 'auth_proxy_error',
			des: 'Invalid JSON fields'
		};
		let validResponse = false;

		const req = {
			url: '/api/me/phones',
			body: {
				country: 'ES'
			},
			user: {
				id: '1a2b3c4d5e6f'
			},
			method: 'POST'
		};

		const res = {
			send: (code, body) => {
				assert.equal(code, expectedCode, 'invalid response code');
				assert.deepEqual(body, expectedError, 'invalid response body');
				validResponse = true;
			}
		};

		const next = function (err) {
			if (err && validResponse) {
				return done();
			}
		};

		pinValidation(settings)(req, res, next);
	});

	it('error if country does not found', function (done) {
		const expectedCode = 500;
		const expectedError = {
			err: 'country_not_found',
			des: 'given phone does not match any country dial code'
		};
		let validResponse = false;

		const req = {
			url: '/api/me/phones',
			body: {
				country: '--',
				phone: '666666666'
			},
			user: {
				id: '1a2b3c4d5e6f'
			},
			method: 'POST'
		};

		const res = {
			send: (code, body) => {
				assert.equal(code, expectedCode, 'invalid response code');
				assert.deepEqual(body, expectedError, 'invalid response body');
				validResponse = true;
			}
		};

		const next = function (err) {
			if (err && validResponse) {
				return done();
			}
		};

		pinValidation(settings)(req, res, next);
	});

	it('error if phone does not send the pin', function (done) {
		const expectedCode = 403;
		const expectedError = {
			err: 'auth_proxy_verified_error',
			des: 'User phone not verified'
		};
		let validResponse = false;

		const req = {
			url: '/api/me/phones',
			body: {
				country: 'ES',
				phone: '666666666'
			},
			method: 'POST',
			user: {
				id: 'mc_1a2b3c4d5e6f'
			}
		};

		nock(notifServiceURL)
			.post('/notification/sms')
			.reply(204);

		const res = {
			send: (code, body) => {
				assert.equal(code, expectedCode, 'invalid response code');
				assert.deepEqual(body, expectedError, 'invalid response body');
				validResponse = true;
			}
		};

		const next = function (err) {
			if (err && validResponse) {
				getPinNumber(req.user.id, req.body.phone, req.body.country, function (err, returnedPin) {
					assert.equal(err, null);
					assert.notEqual(returnedPin, null, 'invalid or not created pin');
					return done();
				});
			}
		};

		pinValidation(settings)(req, res, next);
	});

	it('error if pin does not match with the stored one', function (done) {
		let expectedCode = 403;
		let expectedError = {
			err: 'auth_proxy_verified_error',
			des: 'User phone not verified'
		};
		let validResponse = false;

		const req = {
			headers: {},
			url: '/api/me/phones',
			body: {
				country: 'ES',
				phone: '666666666'
			},
			method: 'POST',
			user: {
				id: 'default@user.com'
			}
		};

		nock(notifServiceURL)
			.post('/notification/sms')
			.times(2)
			.reply(204);

		const res = {
			send: (code, body) => {
				assert.equal(code, expectedCode, 'invalid response code');
				assert.deepEqual(body, expectedError, 'invalid response body');
			}
		};

		const next = function (err) {
			if (err && validResponse) {
				return done();
			}
			req.headers['x-otp-pin'] = 'zzzz';

			expectedCode = 401;
			expectedError = {
				err: 'verify_phone_error',
				des: 'PIN used is not valid.'
			};

			validResponse = true;

			pinValidation(settings)(req, res, next);
		};

		pinValidation(settings)(req, res, next);
	});

	it('continue if pin match with the stored one', function (done) {
		const expectedCode = 403;
		const expectedError = {
			err: 'auth_proxy_verified_error',
			des: 'User phone not verified'
		};
		let validResponse = false;

		const req = {
			headers: {},
			url: '/api/me/phones',
			body: {
				country: 'ES',
				phone: '666666666'
			},
			method: 'POST',
			user: {
				id: 'default@user.com'
			}
		};

		nock(notifServiceURL)
			.post('/notification/sms')
			.reply(204);

		const res = {
			send: (code, body) => {
				assert.equal(code, expectedCode, 'invalid response code');
				assert.deepEqual(body, expectedError, 'invalid response body');
			}
		};

		const next = function (canContinue) {
			if (!canContinue && validResponse) {
				return done();
			}
			getPinNumber(req.user.id, req.body.phone, req.body.country, function (err, returnedPin) {
				assert.equal(err, null);
				assert.notEqual(returnedPin, null, 'invalid or not created pin');
				req.headers['x-otp-pin'] = returnedPin;

				validResponse = true;

				pinValidation(settings)(req, res, next);
			});
		};

		pinValidation(settings)(req, res, next);
	});

	it(' max number of incorrect pin attemps (creates a new pin)', function (done) {
		let expectedCode = 403;
		let expectedError = {
			err: 'auth_proxy_verified_error',
			des: 'User phone not verified'
		};
		let invalidResponseAttemps = 0;
		let validResponse = false;
		let firstValidPin;

		const req = {
			headers: {},
			url: '/api/me/phones',
			body: {
				country: 'ES',
				phone: '666666666'
			},
			method: 'POST',
			user: {
				id: 'default@user.com'
			}
		};

		nock(notifServiceURL)
			.post('/notification/sms')
			.times(2)
			.reply(204);

		const res = {
			send: (code, body) => {
				assert.equal(code, expectedCode, 'invalid response code');
				assert.deepEqual(body, expectedError, 'invalid response body');
			}
		};

		const next = function (canContinue) {
			invalidResponseAttemps++;
			if (!canContinue && validResponse) {
				return done();
			}
			expectedCode = 401;
			expectedError = {
				err: 'verify_phone_error',
				des: 'PIN used is not valid.'
			};

			req.headers['x-otp-pin'] = 'zzzz';

			//1st attempt store the pin to check expiration at 3 attempts
			if (invalidResponseAttemps === 1) {
				getPinNumber(req.user.id, req.body.phone, req.body.country, function (err, returnedPin) {
					assert.equal(err, null);
					assert.notEqual(returnedPin, null, 'invalid or not created pin');
					firstValidPin = returnedPin;

					pinValidation(settings)(req, res, next);
				});
			}
			//At this attempt pin must EXPIRE
			else if (invalidResponseAttemps === settings.phoneVerification.attempts) {
				expectedError.des = 'PIN used has expired.';

				pinValidation(settings)(req, res, next);
			}
			//This attempt is to check the expiration of the 1st pin
			else if (invalidResponseAttemps === settings.phoneVerification.attempts + 1) {
				req.headers['x-otp-pin'] = firstValidPin;

				pinValidation(settings)(req, res, next);
			}
			//This attempt is to check that the new generated pin is correct
			else if (invalidResponseAttemps > settings.phoneVerification.attempts + 1) {
				getPinNumber(req.user.id, req.body.phone, req.body.country, function (err, returnedPin) {
					assert.notEqual(returnedPin, null, 'invalid or not created pin');

					req.headers['x-otp-pin'] = returnedPin;
					validResponse = true;

					pinValidation(settings)(req, res, next);
				});
			}
			else {
				pinValidation(settings)(req, res, next);
			}
		};

		pinValidation(settings)(req, res, next);
	});

});
