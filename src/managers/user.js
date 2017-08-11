'use strict';

const request = require('request');
const _ = require('lodash');
const ciphertoken = require('ciphertoken');
const async = require('async');

const config = require('../../config');
const log = require('../logger/service');
const daoMng = require('./dao');
const tokenMng = require('./token');
const redisMng = require('./redis');
const crypto = require('./crypto');
const cryptoMng = crypto(config.password);
const phoneMng = require('./phone');
const emailMng = require('./email');

const isValidJSON = require('./json_validator');

const ERR_INVALID_PWD = {
	err: 'invalid_password_format',
	code: 400
};

let _settings = {};

// This is Chris's contribution to the coding of this project!!!
const ERR_INVALID_USER_DOMAIN = 'Sorry your email domain is not authorised for this service';

function setPlatformData(userId, platform, data, cbk) {
	daoMng.updateArrayItem(userId, 'platforms', 'platform', data, function (err, updates) {
		if (err) {
			return cbk(err);
		}

		if (updates < 1) {
			return cbk({err: 'platform_not_updated', des: 'updated command worked but no platform were updated'});
		}

		return cbk();
	});
}

function createUser(body, pin, cbk) {
	if (!body[_settings.passThroughEndpoint.username]) {
		return cbk({
			err: 'auth_proxy_error',
			des: 'invalid userinfo',
			code: 400
		});
	}
	body[_settings.passThroughEndpoint.username] = body[_settings.passThroughEndpoint.username].toLowerCase();

	isValidDomain(body[_settings.passThroughEndpoint.username], function (isValid) {
		if (!isValid) {
			const err = {
				err: 'user_domain_not_allowed',
				des: ERR_INVALID_USER_DOMAIN,
				code: 400
			};
			log.warn(err);
			return cbk(err, null);
		}

		if (!body[_settings.passThroughEndpoint.password]) {
			if (!body.sf) {
				return cbk({
					err: 'invalid_security_token',
					des: 'you must provide a password or a salesforce token to create the user',
					code: 400
				});
			}
		} else {
			if (!validatePwd(body.password, _settings.password.regexValidation)) {
				const invalidPasswordError = ERR_INVALID_PWD;
				invalidPasswordError.des = _settings.password.message;
				return cbk(invalidPasswordError);
			}
		}

		const user = {
			username: body[_settings.passThroughEndpoint.username],
			password: body[_settings.passThroughEndpoint.password]
		};

		daoMng.getFromUsername(user.username, function (err, foundUser) {
			if (err && err.message !== daoMng.ERROR_USER_NOT_FOUND) {
				return cbk(err);
			}

			if (foundUser) {
				return cbk({
					err: 'auth_proxy_user_error',
					des: 'user already exists',
					code: 403
				});
			}

			if (body.fb) {
				user.platforms = [{
					platform: 'fb',
					accessToken: body.fb.accessToken
				}];
				delete body.fb;
				createUserPrivateCall(body, user, cbk);
				return;
			}

			const phone = body.phone;
			const countryISO = body.country;
			phoneMng(_settings).verifyPhone(user.username, phone, countryISO, pin, function (err) {
				if (err) {
					return cbk(err);
				}

				if (body.sf) {
					delete(body[_settings.passThroughEndpoint.password]);
					tokenMng.getAccessTokenInfo(body.sf, function (err, tokenInfo) {
						if (err) {
							return cbk({
								err: 'invalid_platform_token',
								des: 'you must provide a valid salesforce token',
								code: 400
							});
						}

						user.platforms = [{
							platform: 'sf',
							accessToken: tokenInfo.data.accessToken,
							refreshToken: tokenInfo.data.refreshToken,
							expiry: new Date().getTime() + _settings.salesforce.expiration * 60 * 1000
						}];
						return createUserPrivateCall(body, user, cbk);
					});
				} else {
					emailMng(_settings).emailVerification(body[_settings.passThroughEndpoint.email || 'email'], body, function (err, destinationEmail) {
						if (err) {
							return cbk(err);
						}
						if (destinationEmail) {
							return cbk({
								des: destinationEmail,
								code: 200
							});
						}
						return createUserPrivateCall(body, user, cbk);
					});
				}
			});
		});
	});
}

function createUserByToken(token, cbk) {
	if (!token) {
		return cbk({
			err: 'auth_proxy_error',
			des: 'empty param verifyToken',
			code: 400
		});
	}

	// Decipher the body
	const tokenSettings = {
		cipherKey: _settings.accessToken.cipherKey,
		firmKey: _settings.accessToken.signKey,
		// Same expiration as the redisKey
		tokenExpirationMinutes: _settings.emailVerification.redis.expireInSec
	};

	ciphertoken.getTokenSet(tokenSettings, token, function (err, bodyData) {
		if (err) {
			return cbk(err);
		}
		const body = bodyData.data;
		let profileSchema;

		if (!config.validators) {
			profileSchema = require('./json_formats/profile_create.json');
		} else {
			profileSchema = require((config.validators.profile.path ? config.validators.profile.path : './json_formats/') + config.validators.profile.filename);
		}

		// Validate the current bodyData with the schema profile_create.json
		if (!isValidJSON(body, profileSchema) || !body.transactionId) {
			return cbk({
				err: 'invalid_profile_data',
				des: 'The data format provided is not valid.',
				code: 400
			});
		}
		// Verify the transactionId
		const redisKey = _settings.emailVerification.redis.key.replace('{username}', body[config.passThroughEndpoint.email || 'email']);

		redisMng.getKeyValue(redisKey, function (err, transactionId) {
			if (err) {
				return cbk({
					err: 'auth_proxy_error',
					des: 'error getting redis key',
					code: 403
				});
			}

			if (body.transactionId !== transactionId) {
				return cbk({
					err: 'invalid_profile_data',
					des: 'Incorrect or expired transaction.',
					code: 400
				});
			}

			const user = {
				username: body[_settings.passThroughEndpoint.username],
				password: body[_settings.passThroughEndpoint.password]
			};
			delete(body[_settings.passThroughEndpoint.password]);

			isValidDomain(user.username, function (isValid) {
				if (!isValid) {
					const domainNotAllowedError = {
						err: 'user_domain_not_allowed',
						des: ERR_INVALID_USER_DOMAIN,
						code: 400
					};
					log.warn({err: domainNotAllowedError});
					return cbk(domainNotAllowedError, null);
				}

				daoMng.getFromUsername(user.username, function (err, foundUser) {
					if (err && err.message !== daoMng.ERROR_USER_NOT_FOUND) {
						return cbk({
							err: 'auth_proxy_error',
							des: 'error checking user from db',
							code: 403
						});
					}

					if (foundUser) {
						if (_settings.emailVerification.errOnUserExists === false) {
							//do not return an error when the user already exists
							//this allow the redirect flow for user activation to continue properly
							//insted of returning a JSON error
							const data = {};
							if (foundUser.roles) {
								data.roles = foundUser.roles;
							}

							tokenMng.createBothTokens(foundUser._id, data, function (err, tokens) {
								if (err) {
									log.error({err}, 'error creating tokens');
									return cbk({
										err: err.message,
										code: 409
									});
								}
								tokens.expiresIn = _settings.accessToken.expiration * 60;
								return cbk(null, tokens);
							});
						} else {
							return cbk({
								err: 'auth_proxy_error',
								des: 'user already exists',
								code: 403
							});
						}
					} else {
						delete(body[_settings.passThroughEndpoint.password]);
						createUserPrivateCall(body, user, cbk);
					}
				});
			});
		});
	});
}

function createUserPrivateCall(body, user, cbk) {
	const clonedBody = _.clone(body);
	delete clonedBody.password;
	const options = {
		url: `http://${_settings.private_host}:${_settings.private_port}${_settings.passThroughEndpoint.path}`,
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		},
		method: 'POST',
		body: clonedBody,
		json: true
	};

	log.info({url: options.url}, '=> POST');
	request(options, function (err, private_res, body) {
		if (err) {
			log.error(`<= error: ${err}`);
			return cbk({
				err: 'auth_proxy_error',
				des: 'there was an internal error when redirecting the call to protected service',
				code: 500
			});
		}

		if (private_res.statusCode !== 201) {
			log.warn({request_body: options.body, response_body: body}, 'user creation attempt failed');
			if (body.err && body.des) {
				return cbk({
					err: body.err,
					des: body.des,
					code: private_res.statusCode
				});
			}
			return cbk({
				err: 'user_creation_failed',
				des: body,
				code: 400
			});
		}

		log.info(`<= ${private_res.statusCode}`);
		user.id = body.id;
		user.roles = body.roles || [];

		if (!user.password) {
			user.password = cryptoMng.randomPassword(config.password.generatedRegex);
		}

		cryptoMng.encrypt(user.password, function (encrypted) {
			user.password = encrypted;

			daoMng.addUser(user, function (err, createdUser) {
				if (err) {
					log.error({err}, 'error adding user to DB');
					return cbk({
						err: err.err,
						des: 'error adding user to DB',
						code: 409
					});
				}

				daoMng.getFromUsernamePassword(createdUser.username, createdUser.password, function (err, foundUser) {
					if (err) {
						log.error({err}, 'error obtaining user');
						return cbk({
							err: err.message,
							code: 409
						});
					}

					const data = {};
					if (foundUser.roles) {
						data.roles = foundUser.roles;
					}

					async.series([
						function (done) {
							// Add "realms" & "capabilities"
							daoMng.getRealms(function (err, realms) {
								if (err) {
									log.error({err}, 'error obtaining user realms');
									return done();
								}

								if (!realms || !realms.length) {
									log.info({des: 'there are no REALMS in DB'});
									return done();
								}

								async.eachSeries(realms, function (realm, next) {
									if (!realm.allowedDomains || !realm.allowedDomains.length) {
										return next();
									}
									async.eachSeries(realm.allowedDomains, function (domain, more) {
										// wildcard
										const check = domain.replace(/\*/g, '.*');
										const match = foundUser.username.match(check);
										if (!match || foundUser.username !== match[0]) {
											return more();
										}

										if (!data.realms) {
											data.realms = [];
										}
										data.realms.push(realm.name);

										async.each(Object.keys(realm.capabilities), function (capName, added) {
											if (!data.capabilities) {
												data.capabilities = {};
											}

											data.capabilities[capName] = realm.capabilities[capName];
											added();
										}, more);
									}, next);
								}, done);
							});
						}
					], function () {
						tokenMng.createBothTokens(foundUser._id, data, function (err, tokens) {
							if (err) {
								log.error({err}, 'error creating tokens');
								return cbk({
									err: err.message,
									code: 409
								});
							}
							tokens.expiresIn = _settings.accessToken.expiration * 60;
							return cbk(null, tokens);
						});
					});

				});
			});
		});

	});
}

function setPassword(id, body, cbk) {
	if (!body.password) {
		return cbk({
			err: 'auth_proxy_error',
			des: 'invalid body request',
			code: 400
		});
	}

	if (!validatePwd(body.password, _settings.password.regexValidation)) {
		const err = ERR_INVALID_PWD;
		err.des = _settings.password.message;
		return cbk(err);
	}
	cryptoMng.encrypt(body.password, function (encryptedPwd) {
		daoMng.updateField(id, 'password', encryptedPwd, function (err) {
			return cbk(err, 1);
		});
	});
}

function validateOldPassword(username, oldPassword, cbk) {

	daoMng.getAllUserFields(username, function (err, user) {
		if (err) {
			return cbk(err);
		}

		cryptoMng.encrypt(oldPassword, function (encrypted) {
			if (user.password !== encrypted) {
				return cbk({
					err: 'invalid_old_password',
					des: 'invalid password',
					code: 401
				});
			}

			return cbk();
		});
	});
}

function isValidDomain(email, cbk) {
	// settings overrides realms configuration
	if (_settings.allowedDomains) {
		for (let i = 0; i < _settings.allowedDomains.length; i++) {
			const domain = _settings.allowedDomains[i];

			// wildcard
			const check = domain.replace(/\*/g, '.*');
			const match = email.match(check);
			if ((match !== null && email === match[0])) {
				return cbk(true);
			}
		}
	}

	// if domain is not override on settings, we look for db realms
	daoMng.getRealms(function (err, realms) {
		if (err) {
			log.error({err}, 'error finding realms in db');
			return cbk(false);
		}

		if ((!realms || !realms.length)) {
			return cbk(false);
		}

		for (let i in realms) {
			const realm = realms[i];
			if (!realm.allowedDomains || !realm.allowedDomains.length) {
				continue;
			}

			for (let j in realm.allowedDomains) {
				// wildcard
				const domain = realm.allowedDomains[j];
				const check = domain.replace(/\*/g, '.*');
				const match = email.match(check);

				if (match !== null && email === match[0]) {
					return cbk(true);
				}
			}
		}
		return cbk(false);
	});
}

function removeRealmFromUser(userId, name, cbk) {
	daoMng.removeFromArrayFieldById(userId, 'realms', name, function (err) {
		if (err) {
			return cbk(err);
		}
		return cbk();
	});
}

function addRealmToUser(userId, name, cbk) {
	async.waterfall([
		function (done) {
			daoMng.getRealmFromName(name, function (err, realm) {
				if (err) {
					return done(err);
				}
				return done(null, realm);
			});
		},
		function (realm, done) {
			daoMng.addToArrayFieldById(userId, 'realms', realm.name, function (err, added) {
				if (err) {
					return done(err);
				}
				if (added !== 1) {
					return done({
						err: 'realm not added to user',
						code: 400
					});
				}
				return done();
			});
		}
	], function (err) {
		if (err) {
			log.error({err});
			return cbk(err);
		}
		return cbk();
	});
}

function validatePwd(pwd, regexp) {
	return (new RegExp(regexp)).test(pwd);
}

module.exports = function (settings) {
	_settings = _.assign({}, config, settings);

	return {
		setPlatformData,
		createUser,
		createUserByToken,
		setPassword,
		validateOldPassword,
		removeRealmFromUser,
		addRealmToUser
	};
};
