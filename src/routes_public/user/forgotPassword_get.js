'use strict';

var async = require('async');

var daoMng = require('../../managers/dao');
var config = require(process.cwd() + '/config.json');
var crypto = require('../../managers/crypto');
var cryptoMng = crypto(config.password);
var emailMng = require('../../managers/email');
var tokenMng = require('../../managers/token');

var log = require('../../logger/service.js');

module.exports = function (req, res, next) {
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
		var passwd = cryptoMng.randomPassword(config.password.generatedRegex);

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
								async.eachSeries(realms, function (realm, nextRealm) {
									if (!realm.allowedDomains || !realm.allowedDomains.length) {
										return nextRealm();
									}
									async.eachSeries(realm.allowedDomains, function (domain, nextAllowedDomains) {
										//wildcard
										var check = domain.replace(/\*/g, '.*');
										var match = foundUser.username.match(check);
										if (!match || foundUser.username !== match[0]) {
											return nextAllowedDomains();
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
										}, nextAllowedDomains);
									}, nextRealm);
								}, done);
							});
						}
					], function () {
						tokenMng.createBothTokens(foundUser._id, data, function (err, tokens) {
							var link = config.emailVerification.redirectProtocol + '://user/refreshToken/' + tokens.refreshToken;
							emailMng().sendEmailForgotPassword(req.params.email, passwd, link, function (err) {
								if (err) {
									res.send(500, {err: 'internalError', des: 'Internal server error'});
									return next(false);
								}

								res.send(204);
								next();
							});
						});
					});
				}
			});
		});
	});
};
