var async = require('async');

var daoMng = require('../managers/dao');
var config = require(process.cwd() + '/config.json');
var crypto = require('../managers/crypto');
var cryptoMng = crypto(config.password);
var emailMng = require('../managers/email');
var tokenMng = require('../managers/token');
var userMng = require('../managers/user');

var checkAccessTokenParam = require('../middlewares/accessTokenParam.js');
var checkAuthHeader = require('../middlewares/authHeader.js');
var decodeToken = require('../middlewares/decodeToken.js');
var findUser = require('../middlewares/findUser.js');
var _ = require('lodash');
var log = require('../logger/service.js');

function sendNewPassword(req, res, next) {
	if (!req.params.email) {
		res.send(400, {
			err: 'auth_proxy_error',
			des: 'empty email'
		});
		return next(false);
	}

	daoMng.getAllUserFields(req.params.email, function (err, foundUser) {
		if (!foundUser) {
			res.send(404, {
				err: 'user_not_found',
				des: 'email does not exists'
			});
			return next(false);
		}
		var passwd = cryptoMng.randomPassword(config.password.regexValidation);

		cryptoMng.encrypt(passwd, function (encryptedPassword) {
			var fieldValue = [];

			if (Array.isArray(foundUser.password)) {
				fieldValue = [foundUser.password[0], encryptedPassword];
			} else {
				fieldValue = [foundUser.password, encryptedPassword];
			}

			daoMng.updateField(foundUser._id, 'password', fieldValue, function (err) {
				if (err) {
					res.send(500, {
						err: 'auth_proxy_error',
						des: 'internal error setting a new password'
					});

					return next(false);

				} else {
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

								if (!realms) {
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
							var link = config.emailVerification.redirectProtocol + '://user/refreshToken/' + tokens.refreshToken;
							emailMng().sendEmailForgotPassword(req.params.email, passwd, link, function (err) {
								if (err) {
									res.send(500, {err: 'internalError', des: 'Internal server error'});
								} else {
									res.send(204);
								}
								return next(false);
							});
						});
					});
				}
			});
		});
	});
}

function createUserEndpoint(req, res, next) {
	userMng().createUser(req.body, req.headers['x-otp-pin'], function (err, tokens) {
		if (err) {
			if (!err.code) {
				res.send(500, err);
				return next(false);
			}
			var errCode = err.code;
			delete(err.code);
			res.send(errCode, err);
			return next(false);
		}

		tokenMng.getRefreshTokenInfo(tokens.refreshToken, function (err, tokenSet) {
			if (err) {
				res.send(500, {err: 'internal_error', des: 'error creating user tokens'});
				return next(false);
			}

			var userId = tokenSet.userId;
			var tokenData = tokenSet.data;

			if (config.version) {
				tokenData.deviceVersion = req.headers[config.version.header];
			}

			tokenMng.createBothTokens(userId, tokenData, function (err, tokens) {
				res.send(201, tokens);
				return next();
			});
		});

	});
}

function createUserByToken(req, res, next) {
	if (!req.params) {
		res.send(400, {
			err: 'invalid_url_params',
			des: 'The call to this url must have params.'
		});
		return next();
	}

	userMng().createUserByToken(req.params.verifyToken, function (err, tokens) {
		if (err) {
			if (!err.code) {
				res.send(500, err);
			} else {
				var errCode = err.code;
				delete(err.code);
				res.send(errCode, err);
			}
			return next(false);
		} else {

			if (req.method === 'POST') {
				res.send(200, tokens);
				return next();
			}

			var compatibleDevices = config.emailVerification.compatibleEmailDevices;
			var userAgent = String(req.headers['user-agent']);

			for (var i = 0; i < compatibleDevices.length; i++) {
				var exp = compatibleDevices[i];
				var check = exp.replace(/\*/g, '.*');
				var match = userAgent.match(check);
				var isCompatible = (match !== null && userAgent === match[0]);
				if (isCompatible) {
					match = userAgent.match(/.*Android.*/i);
					var isAndroid = (match !== null && userAgent === match[0]);
					var location = config.emailVerification.scheme + '://user/refreshToken/' + tokens.refreshToken;

					if (isAndroid) {
						location = 'intent://user/refreshToken/' + tokens.refreshToken + '/#Intent;scheme=' + config.emailVerification.scheme + ';end';
					}
					res.header('Location', location);
					res.send(302);
					return next(false);
				}
			}

			if (config.emailVerification.redirectUrl) {
				var refreshToken = config.emailVerification.redirectRefreshToken ? '?refreshToken=' + tokens.refreshToken : '';
				res.setHeader('Location', config.emailVerification.redirectUrl + refreshToken);
				res.send(301);
				return next();
			}

			res.send(200, {msg: config.emailVerification.nonCompatibleEmailMsg});
			return next();
		}
	});
}

function checkBody(req, res, next) {
	var err;
	if (!req.body) {
		err = {
			err: 'invalid_body',
			des: 'The call to this url must have body.'
		};
		res.send(400, err);
		return next(false);
	}

	return next();
}

function validateOldPassword(req, res, next) {
	var err;
	if (!config.password.validateOldPassword) {
		return next();
	}

	if (!req.body.oldPassword) {
		err = {
			err: 'missing_password',
			des: 'Missing old password validation'
		};
		res.send(400, err);
		return next(false);
	}

	userMng().validateOldPassword(req.user.username, req.body.oldPassword, function (err) {
		if (err) {
			res.send(401, err);
			return next(false);
		}
		return next();
	});

}
function setPassword(req, res, next) {
	if (!req.body) {
		res.send(400, {
			err: 'invalid_body',
			des: 'The call to this url must have body.'
		});
		return next();
	}

	userMng().setPassword(req.user._id, req.body, function (err) {
		if (err) {
			if (!err.code) {
				res.send(500, err);
			} else {
				var errCode = err.code;
				delete(err.code);
				res.send(errCode, err);
			}
			return next(false);
		} else {
			res.send(204);
			return next();
		}
	});
}

function checkEmailAvailable(req, res, next) {
	var email = req.body.email;

	if (_.isEmpty(email)) {
		res.send(400, {
			err: 'BadRequestError',
			des: 'Missing email in request body'
		});
		return next();
	}

	daoMng.findByEmail(email, function (error, output) {
		if (error) {
			res.send(error.statusCode, error.body);
			return next();
		}

		res.send(200, output);
		return next();
	});
}

function addRoutes(service) {
	service.get('/user/:email/password', sendNewPassword);

	service.post(config.passThroughEndpoint.path, createUserEndpoint);
	service.get('/user/activate', createUserByToken);
	service.post('/user/activate', createUserByToken);
	service.post('/user/email/available', checkEmailAvailable);
	service.put('/user/me/password', checkAccessTokenParam, checkAuthHeader, decodeToken, checkBody, findUser, validateOldPassword, setPassword);
}

module.exports = addRoutes;
