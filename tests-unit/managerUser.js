'use strict';

const assert = require('assert');
const ciphertoken = require('ciphertoken');
const async = require('async');
const nock = require('nock');
const _ = require('lodash');
const userDao = require('../src/managers/dao');
const redisMng = require('../src/managers/redis');
const userMng = require('../src/managers/user');
const crypto = require('../src/managers/crypto');

const config = require('../config');

const notifServiceURL = config.externalServices.notifications.base;
const notifServicePath = config.externalServices.notifications.pathEmail;

const accessTokenSettings = {
	cipherKey: config.accessToken.cipherKey,
	firmKey: config.accessToken.signKey,
	tokenExpirationMinutes: config.accessToken.expiration * 60
};

const expectedUserId = 'a1b2c3d4e5f6';

const configSettings = {
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
	},
	emailVerification: {
		subject: 'MyContacts email verification',
		body: '<p>Thanks for register into MyContacts, here is a link to activate your account click</p> <p><a href="{link}">here</a></p> <p>If you have any problems on this process, please contact <a href="mailto:support@my-comms.com">support@my-comms.com</a> and we will be pleased to help you.</p>',
		compatibleEmailDevices: ['*iPhone*', '*iPad*', '*iPod*'],
		nonCompatibleEmailMsg: 'Your user has been created correctly, try to access to MyContacts app in your device.',
		redis: {
			key: 'user.{username}.transaction',
			expireInSec: 86400
		}
	}
};

function validatePwd (clear, crypted, cbk) {
	const cryptoMng = crypto(config.password);
	cryptoMng.verify(clear, crypted, function (err) {
		assert.equal(err, undefined);
		return cbk();
	});
}

describe('user Manager', function () {

	beforeEach(function (done) {
		async.series([
			userDao.connect,
			userDao.deleteAllUsers,
			redisMng.connect,
			redisMng.deleteAllKeys
		], done);

	});

	afterEach(function (done) {
		async.series([
			userDao.disconnect,
			redisMng.deleteAllKeys,
			redisMng.disconnect
		], done);

	});

	it('Update Platform Data', function (done) {
		const expectedPlatformData = {
			platform: 'sf',
			accessToken: 'a1b2c3...d4e5f6',
			refreshToken: 'a1b2c3...d4e5f6',
			expiresIn: 0
		};

		const expectedUser = {
			id: 'a1b2c3d4e5f6',
			username: `username${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
			password: '12345678'
		};

		userDao.addUser(expectedUser, function (err, createdUser) {
			assert.equal(err, null);
			assert.notEqual(createdUser, null);

			userMng().setPlatformData(expectedUser.id, 'sf', expectedPlatformData, function (err) {
				assert.equal(err, null);
				userDao.getFromId(expectedUser.id, function (err, foundUser) {
					assert.equal(err, null);
					assert.notEqual(foundUser, null);
					assert.notEqual(foundUser.platforms, null, 'must create an array of platforms');
					assert.equal(foundUser.platforms.length, 1, 'invalid number of platforms');
					assert.deepEqual(foundUser.platforms[0], expectedPlatformData, 'invalid platform data');
					return done();
				});
			});
		});
	});

	describe('Create user', function () {
		const profileBody = {
			email: `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
			password: 'n3wPas5W0rd',
			phone: '111111111',
			country: 'US'
		};

		it('usePinVerification = true & useEmailVerification = false', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.emailVerification = null;

			const pin = 'xxxx';

			const thisRedisKey = config.phoneVerification.redis.key.replace('{userId}', profileBody.email).replace('{phone}', `+1${profileBody.phone}`);
			const expiration = config.phoneVerification.redis.expireInSec;

			redisMng.insertKeyValue(`${thisRedisKey}.pin`, pin, expiration, function (err) {
				assert.equal(err, null);
				redisMng.insertKeyValue(`${thisRedisKey}.attempts`, configSettings.phoneVerification.attempts, expiration, function (err) {
					assert.equal(err, null);

					nock(`http://${config.private_host}:${config.private_port}`)
						.post(config.passThroughEndpoint.path)
						.reply(201, {id: expectedUserId});

					userMng(testsConfigSettings).createUser(profileBody, pin, function (err, tokens) {
						assert.equal(err, null);
						assert.equal(tokens.expiresIn, accessTokenSettings.tokenExpirationMinutes);
						assert.notEqual(tokens.accessToken, undefined);
						ciphertoken.getTokenSet(accessTokenSettings, tokens.accessToken, function (err, accessTokenInfo) {
							assert.equal(err, null);
							assert.equal(accessTokenInfo.userId, expectedUserId);
							return done();
						});
					});

				});
			});
		});

		it('usePinVerification = true & useEmailVerification = true', function (done) {
			const testsConfigSettings = _.clone(configSettings);

			const pin = 'xxxx';

			const expectedError = {
				des: profileBody.email,
				code: 200
			};

			const thisRedisKey = config.phoneVerification.redis.key.replace('{userId}', profileBody.email).replace('{phone}', `+1${profileBody.phone}`);
			const expiration = config.phoneVerification.redis.expireInSec;

			redisMng.insertKeyValue(`${thisRedisKey}.pin`, pin, expiration, function (err) {
				assert.equal(err, null);
				redisMng.insertKeyValue(`${thisRedisKey}.attempts`, configSettings.phoneVerification.attempts, expiration, function (err) {
					assert.equal(err, null);

					nock(`http://${config.private_host}:${config.private_port}`)
						.post(config.passThroughEndpoint.path)
						.reply(201, {id: expectedUserId});

					nock(notifServiceURL)
						.post(notifServicePath)
						.reply(204);

					userMng(testsConfigSettings).createUser(profileBody, pin, function (err, tokens) {
						assert.notEqual(err, null);
						assert.deepEqual(err, expectedError);
						assert.equal(tokens, undefined);
						return done();
					});

				});
			});
		});

		it('usePinVerification = false & useEmailVerification = true', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.phoneVerification = null;

			const pin = null;

			const expectedError = {
				des: profileBody.email,
				code: 200
			};

			nock(`http://${config.private_host}:${config.private_port}`)
				.post(config.passThroughEndpoint.path)
				.reply(201, {id: expectedUserId});

			nock(notifServiceURL)
				.post(notifServicePath)
				.reply(204);

			userMng(testsConfigSettings).createUser(profileBody, pin, function (err, tokens) {
				assert.notEqual(err, null);
				assert.deepEqual(err, expectedError);
				assert.equal(tokens, undefined);
				return done();
			});
		});

		it('usePinVerification = false & useEmailVerification = false', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.phoneVerification = null;
			testsConfigSettings.emailVerification = null;

			const pin = null;

			nock(`http://${config.private_host}:${config.private_port}`)
				.post(config.passThroughEndpoint.path)
				.reply(201, {id: expectedUserId});

			nock(notifServiceURL)
				.post('/notification/email')
				.reply(204);

			userMng(testsConfigSettings).createUser(profileBody, pin, function (err, tokens) {
				assert.equal(err, null);
				assert.equal(tokens.expiresIn, accessTokenSettings.tokenExpirationMinutes);
				assert.notEqual(tokens.accessToken, undefined);
				ciphertoken.getTokenSet(accessTokenSettings, tokens.accessToken, function (err, accessTokenInfo) {
					assert.equal(err, null);
					assert.equal(accessTokenInfo.userId, expectedUserId);
					return done();
				});
			});
		});

		it('No username', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.phoneVerification = null;
			testsConfigSettings.emailVerification = null;

			const pin = null;

			const profile = _.clone(profileBody);
			profile.email = null;

			const expectedError = {
				err: 'auth_proxy_error',
				des: 'invalid userinfo',
				code: 400
			};

			userMng(testsConfigSettings).createUser(profile, pin, function (err, tokens) {
				assert.notEqual(err, null);
				assert.deepEqual(err, expectedError);
				assert.equal(tokens, undefined);
				return done();
			});
		});

		it('No password', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.phoneVerification = null;
			testsConfigSettings.emailVerification = null;

			const pin = null;

			const profile = _.clone(profileBody);
			profile.password = null;

			const expectedError = {
				err: 'invalid_security_token',
				des: 'you must provide a password or a salesforce token to create the user',
				code: 400
			};

			userMng(testsConfigSettings).createUser(profile, pin, function (err, tokens) {
				assert.notEqual(err, null);
				assert.deepEqual(err, expectedError);
				assert.equal(tokens, undefined);
				return done();
			});
		});

		it('No phone', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.emailVerification = null;

			const pin = null;

			const profile = _.clone(profileBody);
			profile.phone = null;

			const expectedError = {
				err: 'auth_proxy_error',
				des: 'empty phone or country',
				code: 400
			};

			userMng(testsConfigSettings).createUser(profile, pin, function (err, tokens) {
				assert.notEqual(err, null);
				assert.deepEqual(err, expectedError);
				assert.equal(tokens, undefined);
				return done();
			});
		});

		it('No country', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.emailVerification = null;

			const pin = null;

			const profile = _.clone(profileBody);
			profile.country = null;

			const expectedError = {
				err: 'auth_proxy_error',
				des: 'empty phone or country',
				code: 400
			};

			userMng(testsConfigSettings).createUser(profile, pin, function (err, tokens) {
				assert.notEqual(err, null);
				assert.deepEqual(err, expectedError);
				assert.equal(tokens, undefined);
				return done();
			});
		});

		it('Invalid country code', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.emailVerification = null;

			const pin = null;

			const profile = _.clone(profileBody);
			profile.country = '--';

			const expectedError = {
				err: 'country_not_found',
				des: 'given phone does not match any country dial code'
			};

			userMng(testsConfigSettings).createUser(profile, pin, function (err, tokens) {
				assert.notEqual(err, null);
				assert.deepEqual(err, expectedError);
				assert.equal(tokens, undefined);
				return done();
			});
		});

		it('no phone & no country & NO PIN verification', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.phoneVerification = null;
			testsConfigSettings.emailVerification = null;

			const pin = null;

			const profile = _.clone(profileBody);
			profile.country = null;
			profile.phone = null;

			nock(`http://${config.private_host}:${config.private_port}`)
				.post(config.passThroughEndpoint.path)
				.reply(201, {id: expectedUserId});

			userMng(testsConfigSettings).createUser(profile, pin, function (err, tokens) {
				assert.equal(err, null);
				assert.equal(tokens.expiresIn, accessTokenSettings.tokenExpirationMinutes);
				assert.notEqual(tokens.accessToken, undefined);
				ciphertoken.getTokenSet(accessTokenSettings, tokens.accessToken, function (err, accessTokenInfo) {
					assert.equal(err, null);
					assert.equal(accessTokenInfo.userId, expectedUserId);
					return done();
				});
			});
		});

		it('user exists (same username with capital letters)', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.phoneVerification = null;
			testsConfigSettings.emailVerification = null;

			const pin = null;

			const expectedError = {
				err: 'auth_proxy_user_error',
				des: 'user already exists',
				code: 403
			};

			nock(`http://${config.private_host}:${config.private_port}`)
				.post(config.passThroughEndpoint.path)
				.reply(201, {id: expectedUserId});

			//1st call create the user
			userMng(testsConfigSettings).createUser(profileBody, pin, function (err, tokens) {
				assert.equal(err, null);
				assert.notEqual(tokens, null);

				//2nd call must fail
				userMng(configSettings).createUser(profileBody, pin, function (err, tokens) {
					assert.notEqual(err, null);
					assert.deepEqual(err, expectedError);
					assert.equal(tokens, undefined);

					//3rd call must fail (same username with capital letters)
					profileBody.email = `VALID${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`;
					userMng(configSettings).createUser(profileBody, pin, function (err, tokens) {
						assert.notEqual(err, null);
						assert.deepEqual(err, expectedError);
						assert.equal(tokens, undefined);
						return done();
					});
				});
			});
		});

		it('Invalid domain', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.phoneVerification = null;
			testsConfigSettings.emailVerification = null;
			testsConfigSettings.allowedDomains = ['*@valid.com'];

			const pin = null;

			profileBody.email = 'invalid@invaliddomain.com';

			const expectedError = {
				err: 'user_domain_not_allowed',
				des: 'Sorry your email domain is not authorised for this service',
				code: 400
			};

			nock(`http://${config.private_host}:${config.private_port}`)
				.post(config.passThroughEndpoint.path)
				.reply(201, {id: expectedUserId});

			userMng(testsConfigSettings).createUser(profileBody, pin, function (err, tokens) {
				assert.notEqual(err, null);
				assert.deepEqual(err, expectedError);
				assert.equal(tokens, undefined);
				return done();
			});
		});
	});

	describe('Create user DIRECT LOGIN', function () {
		const redisKey = config.emailVerification.redis.key;
		const redisExp = config.emailVerification.redis.expireInSec;

		const tokenSettings = _.clone(accessTokenSettings);
		tokenSettings.tokenExpirationMinutes = redisExp;

		it('OK', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.phoneVerification = null;

			const transactionId = '1a2b3c4d5e6f';

			const bodyData = {
				officeLocation: '',
				country: 'US',
				lastName: 'lastName',
				phone: '111111111',
				company: '',
				password: 'valid_password',
				firstName: 'firstName',
				email: `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
				position: '',
				transactionId
			};

			redisMng.insertKeyValue(redisKey.replace('{username}', bodyData.email), transactionId, redisExp, function (err, value) {
				assert.equal(err, null);
				assert.equal(value, transactionId);

				ciphertoken.createToken(tokenSettings, bodyData.email, null, bodyData, function (err, token) {
					if (err) {
						return done(err);
					}

					nock(`http://${config.private_host}:${config.private_port}`)
						.post(config.passThroughEndpoint.path)
						.reply(201, {id: expectedUserId});

					userMng(testsConfigSettings).createUserByToken(token, function (err, tokens) {
						assert.equal(err, null);
						assert.notEqual(tokens.accessToken, undefined);
						ciphertoken.getTokenSet(accessTokenSettings, tokens.accessToken, function (err, accessTokenInfo) {
							assert.equal(err, null);
							assert.equal(accessTokenInfo.userId, expectedUserId);
							return done();
						});
					});
				});
			});
		});

		it('Invalid data', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.phoneVerification = null;

			const transactionId = '1a2b3c4d5e6f';

			const bodyData = {
				company: '',
				password: 'valid_password',
				firstName: 'firstName',
				email: `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
				position: '',
				transactionId
			};

			const expectedError = {
				err: 'invalid_profile_data',
				des: 'The data format provided is not valid.',
				code: 400
			};

			ciphertoken.createToken(tokenSettings, bodyData.email, null, bodyData, function (err, token) {
				if (err) {
					return done(err);
				}

				nock(`http://${config.private_host}:${config.private_port}`)
					.post(config.passThroughEndpoint.path)
					.reply(201, {id: expectedUserId});

				userMng(testsConfigSettings).createUserByToken(token, function (err, tokens) {
					assert.notEqual(err, null);
					assert.deepEqual(err, expectedError);
					assert.equal(tokens, undefined);
					return done();
				});
			});
		});

		it('Incorrect transactionId', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.phoneVerification = null;

			const transactionId = '1a2b3c4d5e6f';

			const bodyData = {
				country: 'US',
				lastName: 'lastName',
				phone: '111111111',
				company: '',
				password: 'valid_password',
				firstName: 'firstName',
				email: `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
				transactionId: 'abcde'
			};

			const expectedError = {
				err: 'invalid_profile_data',
				des: 'Incorrect or expired transaction.',
				code: 400
			};

			redisMng.insertKeyValue(redisKey.replace('{username}', bodyData.email), transactionId, redisExp, function (err, value) {
				assert.equal(err, null);
				assert.equal(value, transactionId);

				ciphertoken.createToken(tokenSettings, bodyData.email, null, bodyData, function (err, token) {
					if (err) {
						return done(err);
					}

					nock(`http://${config.private_host}:${config.private_port}`)
						.post(config.passThroughEndpoint.path)
						.reply(201, {id: expectedUserId});

					userMng(testsConfigSettings).createUserByToken(token, function (err, tokens) {
						assert.notEqual(err, null);
						assert.deepEqual(err, expectedError);
						assert.equal(tokens, undefined);
						return done();
					});
				});
			});
		});

		it('Call sent 2 times', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.phoneVerification = null;

			const transactionId = '1a2b3c4d5e6f';

			const bodyData = {
				country: 'US',
				lastName: 'lastName',
				phone: '111111111',
				company: '',
				password: 'valid_password',
				firstName: 'firstName',
				email: `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
				transactionId
			};

			const expectedError = {
				err: 'auth_proxy_error',
				des: 'user already exists',
				code: 403
			};

			redisMng.insertKeyValue(redisKey.replace('{username}', bodyData.email), transactionId, redisExp, function (err, value) {
				assert.equal(err, null);
				assert.equal(value, transactionId);

				ciphertoken.createToken(tokenSettings, bodyData.email, null, bodyData, function (err, token) {
					if (err) {
						return done(err);
					}

					nock(`http://${config.private_host}:${config.private_port}`)
						.post(config.passThroughEndpoint.path)
						.reply(201, {id: expectedUserId});

					userMng(testsConfigSettings).createUserByToken(token, function (err, tokens) {
						assert.equal(err, null);
						assert.notEqual(tokens, null);

						userMng(testsConfigSettings).createUserByToken(token, function (err, tokens) {
							assert.notEqual(err, null);
							assert.deepEqual(err, expectedError);
							assert.equal(tokens, undefined);
							return done();
						});
					});
				});
			});
		});

		it('Call sent 2 times with error on user exists deactivated', function (done) {
			const testsConfigSettings = _.clone(configSettings);
			testsConfigSettings.phoneVerification = null;
			testsConfigSettings.emailVerification.errOnUserExists = false;

			const transactionId = '1a2b3c4d5e6f';

			const bodyData = {
				country: 'US',
				lastName: 'lastName',
				phone: '111111111',
				company: '',
				password: 'valid_password',
				firstName: 'firstName',
				email: `valid${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
				transactionId
			};

			redisMng.insertKeyValue(redisKey.replace('{username}', bodyData.email), transactionId, redisExp, function (err, value) {
				assert.equal(err, null);
				assert.equal(value, transactionId);

				ciphertoken.createToken(tokenSettings, bodyData.email, null, bodyData, function (err, token) {
					if (err) {
						return done(err);
					}

					nock(`http://${config.private_host}:${config.private_port}`)
						.post(config.passThroughEndpoint.path)
						.reply(201, {id: expectedUserId});

					userMng(testsConfigSettings).createUserByToken(token, function (err, tokens) {
						assert.equal(err, null);
						assert.notEqual(tokens, null);

						userMng(testsConfigSettings).createUserByToken(token, function (err, tokens) {
							assert.equal(err, null);
							assert.notEqual(tokens, null);
							return done();
						});
					});
				});
			});
		});
	});

	describe('Set user password', function () {

		const expectedUser = {
			id: 'a1b2c3d4e5f6',
			username: `username${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
			password: '12345678'
		};

		it('200 ok', function (done) {
			const newPassword = {
				password: 'n3wPas5W0rd'
			};

			userDao.addUser(expectedUser, function (err, createdUser) {
				userMng().setPassword(createdUser._id, newPassword, function (err, result) {
					const clonedUser = _.clone(expectedUser);
					clonedUser.password = newPassword.password;
					assert.equal(err, null);
					assert.equal(result, 1);
					userDao.getAllUserFields(createdUser.username, function (err, foundUser) {
						assert.equal(err, null);
						assert.notEqual(foundUser, null);
						validatePwd(clonedUser.password, foundUser.password, done);
					});
				});
			});

		});

		it('400 invalid passwords', function (done) {
			const expectedError = {
				err: 'invalid_password_format',
				des: 'Your password must be at least 8 characters and must contain at least one capital, one lower and one number.',
				code: 400
			};

			userDao.addUser(expectedUser, function (err, createdUser) {
				async.series([
						function (next) {
							const newPassword = {
								password: 'newpassword'
							};

							userMng().setPassword(createdUser._id, newPassword, function (err, result) {
								assert.notEqual(err, null);
								assert.deepEqual(err, expectedError);
								assert.equal(result, undefined);
								return next();
							});
						},
						function (next) {
							const newPassword = {
								password: 'newPASSWORD'
							};

							userMng().setPassword(createdUser._id, newPassword, function (err, result) {
								assert.notEqual(err, null);
								assert.deepEqual(err, expectedError);
								assert.equal(result, undefined);
								return next();
							});
						},
						function (next) {
							const newPassword = {
								password: 'new111111'
							};

							userMng().setPassword(createdUser._id, newPassword, function (err, result) {
								assert.notEqual(err, null);
								assert.deepEqual(err, expectedError);
								assert.equal(result, undefined);
								return next();
							});
						},
						function (next) {
							const newPassword = {
								password: 'NEWPA55W0RD'
							};

							userMng().setPassword(createdUser._id, newPassword, function (err, result) {
								assert.notEqual(err, null);
								assert.deepEqual(err, expectedError);
								assert.equal(result, undefined);
								return next();
							});
						},
						function (next) {
							const newPassword = {
								password: 'n3wPas5W0rd'
							};

							userMng().setPassword(createdUser._id, newPassword, function (err, result) {
								assert.equal(err, null);
								assert.equal(result, 1);
								return next();
							});
						}
					], done);
			});
		});
	});

});
