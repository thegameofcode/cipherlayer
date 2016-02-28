'use strict';

const assert = require('assert');
const async = require('async');
const nock = require('nock');

const phoneMng = require('../src/managers/phone');
const redisMng = require('../src/managers/redis');

const config = require('../config.json');

const phoneSettings = {
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
					countryISO: 'country',
					phoneNumber: 'phone'
				}
			}
		]
	}
};

describe('phone', function () {
	const baseUser = {
		id: 'a1b2c3d4e5f6',
		username: 'validuser',
		password: 'validpassword'
	};

	const notifServiceURL = config.externalServices.notifications.base;
	beforeEach(function (done) {
		async.series([
				redisMng.connect,
				redisMng.deleteAllKeys
		], done);
	});

	afterEach(redisMng.disconnect);

	it('create pin', function (done) {

		nock(notifServiceURL)
			.post('/notification/sms')
			.reply(204);

		const basePhone = '111111111';

		phoneMng(phoneSettings).createPIN(baseUser.username, basePhone, function (err, createdPin) {
			assert.equal(err, null);
			assert.notEqual(createdPin, null);
			return done();
		});
	});

	describe('verify phone', function () {
		it('valid PIN', function (done) {
			nock(notifServiceURL)
				.post('/notification/sms')
				.reply(204);

			const basePhone = '222222222';
			const baseCountry = 'US';

			phoneMng(phoneSettings).createPIN(baseUser.username, `+1${basePhone}`, function (err, createdPIN) {
				assert.equal(err, null);
				assert.notEqual(createdPIN, null);

				phoneMng(phoneSettings).verifyPhone(baseUser.username, basePhone, baseCountry, createdPIN, function (err, verified) {
					assert.equal(err, null);
					assert.equal(verified, true);
					return done();
				});
			});
		});

		it('invalid PIN', function (done) {
			nock(notifServiceURL)
				.post('/notification/sms')
				.reply(204);

			const basePhone = '333333333';
			const baseCountry = 'US';

			phoneMng(phoneSettings).createPIN(baseUser.username, `+1${basePhone}`, function (err, createdPIN) {
				assert.equal(err, null);
				assert.notEqual(createdPIN, null);

				phoneMng(phoneSettings).verifyPhone(baseUser.username, basePhone, baseCountry, 'zzzzz', function (err, verified) {
					assert.notEqual(err, null);
					assert.equal(err.err, 'verify_phone_error');
					assert.equal(verified, false);
					return done();
				});
			});
		});

		it('invalid phone', function (done) {
			nock(notifServiceURL)
				.post('/notification/sms')
				.reply(204);

			const basePhone = '444444444';
			const baseCountry = 'US';

			phoneMng(phoneSettings).createPIN(baseUser.username, `+1${basePhone}`, function (err, createdPIN) {
				assert.equal(err, null);

				nock(notifServiceURL)
					.post('/notification/sms')
					.reply(204);

				phoneMng(phoneSettings).verifyPhone(baseUser.username, '6666666', baseCountry, createdPIN, function (err, verified) {
					assert.notEqual(err, null);
					assert.equal(err.err, 'verify_phone_error');
					assert.equal(verified, false);
					return done();
				});
			});
		});

		it('3 invalid PIN attempts', function (done) {
			nock(notifServiceURL)
				.post('/notification/sms')
				.reply(204);

			const basePhone = '555555555';
			const baseCountry = 'US';

			phoneMng(phoneSettings).createPIN(baseUser.username, `+1${basePhone}`, function (err, createdPIN) {
				assert.equal(err, null);

				//1st attempt
				phoneMng(phoneSettings).verifyPhone(baseUser.username, basePhone, baseCountry, 'zzzzz', function (err, verified) {
					assert.notEqual(err, null);
					assert.equal(err.err, 'verify_phone_error');
					assert.equal(verified, false);

					//2nd attempt
					phoneMng(phoneSettings).verifyPhone(baseUser.username, basePhone, baseCountry, 'yyyyy', function (err, verified) {
						assert.notEqual(err, null);
						assert.equal(err.err, 'verify_phone_error');
						assert.equal(verified, false);

						//3rd attempt
						nock(notifServiceURL)
							.post('/notification/sms')
							.reply(204);

						phoneMng(phoneSettings).verifyPhone(baseUser.username, basePhone, baseCountry, 'jjjjj', function (err, verified) {
							assert.notEqual(err, null);
							assert.equal(err.err, 'verify_phone_error');
							assert.equal(verified, false);

							//4th attempt, expired PIN
							phoneMng(phoneSettings).verifyPhone(baseUser.username, basePhone, baseCountry, createdPIN, function (err, verified) {
								assert.notEqual(err, null);
								assert.equal(err.err, 'verify_phone_error');
								assert.equal(verified, false);

								const redisKey = config.phoneVerification.redis.key.replace('{userId}', baseUser.username).replace('{phone}', `+1${basePhone}`);

								//5th attempt, new correct PIN
								redisMng.getKeyValue(`${redisKey}.pin`, function (err, redisPhonePin) {
									assert.equal(err, null);
									assert.notEqual(createdPIN, redisPhonePin);

									phoneMng(phoneSettings).verifyPhone(baseUser.username, basePhone, baseCountry, redisPhonePin, function (err, verified) {
										assert.equal(err, null);
										assert.equal(verified, true);
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
});
