'use strict';

const async = require('async');

const daoMng = require('../../managers/dao');
const config = require('../../../config');
const crypto = require('../../managers/crypto');
const cryptoMng = crypto(config.password);
const emailMng = require('../../managers/email');
const tokenMng = require('../../managers/token');

const log = require('../../logger/service');

module.exports = function (req, res, next) {
	if (!req.params.email) {
		res.send(400, {
			err: 'auth_proxy_error',
			des: 'empty email'
		});
		return next();  // TODO: return error
	}

	daoMng.getAllUserFields(req.params.email, function (err, foundUser) {
		if (!foundUser) {
			res.send(404, {
				err: 'user_not_found',
				des: 'email does not exists'
			});
			return next(); // TODO: return error
		}
		const passwd = cryptoMng.randomPassword(config.password.generatedRegex);

		cryptoMng.encrypt(passwd, function (encryptedPassword) {
			let fieldValue = [];

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

					return next();

				}
				const data = {};
				if (foundUser.roles) {
					data.roles = foundUser.roles;
				}

				async.series([
					function (done) {
						//Add "realms" & "capabilities"
						daoMng.getRealms(function (err, realms) {
							if (err) {
								log.error({ err , des: 'error obtaining user realms' });
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
									const check = domain.replace(/\*/g, '.*');
									const match = foundUser.username.match(check);
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
						const link = `${config.emailVerification.redirectProtocol}://user/refreshToken/${tokens.refreshToken}`;
						emailMng().sendEmailForgotPassword(req.params.email, passwd, link, function (err) {
							if (err) {
								res.send(500, {err: 'internalError', des: 'Internal server error'});
								return next();
							}

							res.send(204);
							return next();
						});
					});
				});

			});
		});
	});
};
