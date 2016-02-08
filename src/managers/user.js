var log = require('../logger/service.js');
var request = require('request');
var crypto = require('crypto');
var _ = require('lodash');
var ciphertoken = require('ciphertoken');
var async = require('async');

var daoMng = require('./dao');
var tokenMng = require('./token');
var redisMng = require('./redis');
var cryptoMng = require('./crypto')({password: 'password'});
var phoneMng = require('./phone');
var emailMng = require('./email');

var jsonValidator = require('./json_validator');

var ERR_INVALID_PWD = {
	err: 'invalid_password_format',
	code: 400
};

var _settings = {};

//This is Chris's contribution to the coding of this project!!!
var ERR_INVALID_USER_DOMAIN = 'Sorry your email domain is not authorised for this service';

function setPlatformData(userId, platform, data, cbk) {
	daoMng.updateArrayItem(userId, 'platforms', 'platform', data, function (err, updates) {
		if (err) {
			return cbk(err);
		}

		if (updates < 1) {
			return cbk({err: 'platform_not_updated', des: 'updated command worked but no platform were updated'});
		}

		cbk(null);
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
			var err = {
				err: 'user_domain_not_allowed',
				des: ERR_INVALID_USER_DOMAIN,
				code: 400
			};
			log.warn({err: err});
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
				ERR_INVALID_PWD.des = _settings.password.message;
				var invalidPasswordError = ERR_INVALID_PWD;
				return cbk(invalidPasswordError);
			}
		}

		var user = {
			username: body[_settings.passThroughEndpoint.username],
			password: body[_settings.passThroughEndpoint.password]
		};

		daoMng.getFromUsername(user.username, function (err, foundUser) {
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

			var phone = body.phone;
			var countryISO = body.country;
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
						createUserPrivateCall(body, user, cbk);
					});
				} else {
					emailMng(_settings).emailVerification(body.email, body, function (err, destinationEmail) {
						if (err) {
							return cbk(err);
						}
						if (destinationEmail) {
							return cbk({
								des: destinationEmail,
								code: 200
							});
						}
						createUserPrivateCall(body, user, cbk);
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

	//Decipher the body
	var tokenSettings = {
		cipherKey: _settings.accessToken.cipherKey,
		firmKey: _settings.accessToken.signKey,
		//Same expiration as the redisKey
		tokenExpirationMinutes: _settings.emailVerification.redis.expireInSec
	};

	ciphertoken.getTokenSet(tokenSettings, token, function (err, bodyData) {
		if (err) {
			return cbk(err);
		}
		var body = bodyData.data;

		var profileSchema = require('./json_formats/profile_create.json');
		//Validate the current bodyData with the schema profile_create.json
		if (!jsonValidator.isValidJSON(body, profileSchema) || !body.transactionId) {
			return cbk({
				err: 'invalid_profile_data',
				des: 'The data format provided is not valid.',
				code: 400
			});
		}
		//Verify the transactionId
		var redisKey = _settings.emailVerification.redis.key;
		redisKey = redisKey.replace('{username}', body.email);

		redisMng.getKeyValue(redisKey, function (err, transactionId) {
			if (err) {
				return cbk(err);
			}

			if (body.transactionId !== transactionId) {
				return cbk({
					err: 'invalid_profile_data',
					des: 'Incorrect or expired transaction.',
					code: 400
				});
			}

			var user = {
				username: body[_settings.passThroughEndpoint.username],
				password: body[_settings.passThroughEndpoint.password]
			};
			delete(body[_settings.passThroughEndpoint.password]);

			isValidDomain(user.username, function (isValid) {
				if (!isValid) {
					var domainNotAllowedError = {
						err: 'user_domain_not_allowed',
						des: ERR_INVALID_USER_DOMAIN,
						code: 400
					};
					log.warn({err: domainNotAllowedError});
					return cbk(domainNotAllowedError, null);
				}

				daoMng.getFromUsername(user.username, function (err, foundUser) {
					if (foundUser) {
						return cbk({
							err: 'auth_proxy_error',
							des: 'user already exists',
							code: 403
						});
					}

					delete(body[_settings.passThroughEndpoint.password]);
					createUserPrivateCall(body, user, cbk);
				});
			});
		});
	});
}

function createUserPrivateCall(body, user, cbk) {
	var clonedBody = _.clone(body);
	delete clonedBody.password;
	var options = {
		url: 'http://' + _settings.private_host + ':' + _settings.private_port + _settings.passThroughEndpoint.path,
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		},
		method: 'POST',
		body: clonedBody,
		json: true
	};

	log.info('=> POST ' + options.url);
	request(options, function (err, private_res, body) {
		if (err) {
			log.error('<= error: ' + err);
			return cbk({
				err: 'auth_proxy_error',
				des: 'there was an internal error when redirecting the call to protected service',
				code: 500
			});
		}

		log.info('<= ' + private_res.statusCode);
		user.id = body.id;

		if (!user.password) {
			user.password = random(12);
		}

		cryptoMng.encrypt(user.password, function (encrypted) {
			user.password = encrypted;

			daoMng.addUser()(user, function (err, createdUser) {
				if (err) {
					log.error({err: err, des: 'error adding user to DB'});
					return cbk({
						err: err.err,
						des: 'error adding user to DB',
						code: 409
					});
				}

				daoMng.getFromUsernamePassword(createdUser.username, createdUser.password, function (err, foundUser) {
					if (err) {
						log.error({err: err, des: 'error obtaining user'});
						return cbk({
							err: err.message,
							code: 409
						});
					}

					var data = {};
					if (foundUser.roles) {
						data.roles = foundUser.roles;
					}

					async.series([
						function (done) {
							//Add "realms" & "capabilities"
							daoMng.getRealms(function (err, realms) {
								if (err) {
									log.error({err: err, des: 'error obtaining user realms'});
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
										//wildcard
										var check = domain.replace(/\*/g, '.*');
										var match = foundUser.username.match(check);
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
								log.error({err: err, des: 'error creating tokens'});
								return cbk({
									err: err.message,
									code: 409
								});
							}
							tokens.expiresIn = _settings.accessToken.expiration * 60;
							cbk(null, tokens);
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
		ERR_INVALID_PWD.des = _settings.password.message;
		var err = ERR_INVALID_PWD;
		return cbk(err);
	} else {
		cryptoMng.encrypt(body.password, function (encryptedPwd) {
			daoMng.updateField(id, 'password', encryptedPwd, function (err, result) {
				return cbk(err, result);
			});
		});
	}
}

function validateOldPassword(username, oldPassword, cbk) {

	daoMng.getAllUserFields(username, function (err, user) {
		if (err) {
			res.send(401, err);
			return next();
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

//Aux functions
function random(howMany, chars) {
	chars = chars || "abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789";
	var rnd = crypto.randomBytes(howMany),
		value = new Array(howMany),
		len = chars.length;

	for (var i = 0; i < howMany; i++) {
		value[i] = chars[rnd[i] % len];
	}
	return value.join('');
}

function isValidDomain(email, cbk) {
	var validDomain = false;

	var domainsInConfig = (_settings.allowedDomains && _settings.allowedDomains.length);

	daoMng.getRealms(function (err, realms) {
		if (err) {
			return cbk(false);
		}

		if ((!realms || !realms.length) && !domainsInConfig) {
			return cbk(true);
		}

		async.eachSeries(realms, function (realm, next) {
			if (validDomain || !realm.allowedDomains || !realm.allowedDomains.length) {
				return next();
			}

			async.eachSeries(realm.allowedDomains, function (domain, more) {
				if (validDomain) {
					return more();
				}

				//wildcard
				var check = domain.replace(/\*/g, '.*');
				var match = email.match(check);
				validDomain = (match !== null && email === match[0]);
				more();
			}, next);
		}, function () {
			if (!validDomain) {
				//Check domains in config file
				for (var i = 0; i < _settings.allowedDomains.length; i++) {
					var domain = _settings.allowedDomains[i];

					//wildcard
					var check = domain.replace(/\*/g, '.*');
					var match = email.match(check);
					validDomain = (match !== null && email === match[0]);
					if (validDomain) break;
				}
			}
			return cbk(validDomain);
		});
	});
}

function validatePwd(pwd, regexp) {
	var regex = new RegExp(regexp);
	return regex.test(pwd);
}

module.exports = function (settings) {
	var config = require(process.cwd() + '/config.json');
	_settings = _.assign({}, config, settings);

	return {
		setPlatformData: setPlatformData,
		createUser: createUser,
		createUserByToken: createUserByToken,
		setPassword: setPassword,
		validateOldPassword: validateOldPassword
	};
};
