'use strict';

var async = require('async');
var log = require('../../logger/service.js');
var daoMng = require('../../managers/dao');
var crypto = require('../../managers/crypto');
var config = require(process.cwd() + '/config.json');
var cryptoMng = crypto(config.password);
var sessionRequest = require('./session');
var tokenMng = require('../../managers/token');

module.exports = function (req, res, next) {
	var userAgent = String(req.headers['user-agent']);

	cryptoMng.encrypt(req.body.password, function (encryptedPwd) {
		daoMng.getFromUsernamePassword(req.body.username, encryptedPwd, function (err, foundUser) {
			if (err) {
				res.send(409, {err: err.message});
				return next(false);
			}

			daoMng.getAllUserFields(foundUser.username, function (err, result) {
				if (Array.isArray(result.password)) {
					daoMng.updateField(foundUser._id, "password", encryptedPwd, function (err, result) {
						log.info({err: err, result: result}, 'UpdatePasswordField');
					});
				}
			});

			var data = {};
			if (foundUser.signUpDate) {
				data.signUpDate = foundUser.signUpDate;
			}

			if (foundUser.roles) {
				data.roles = foundUser.roles;
			}

			if (req.body.deviceId) {
				data.deviceId = req.body.deviceId;
			}

			if (config.version) {
				data.deviceVersion = req.headers[config.version.header];
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
				sessionRequest(data.deviceId, foundUser._id, 'POST', userAgent, function (err) {
					if (err) {
						log.error({err: err});
					}
					tokenMng.createBothTokens(foundUser._id, data, function (err, tokens) {
						if (err) {
							res.send(409, {err: err.message});
						} else {
							tokens.expiresIn = config.accessToken.expiration;
							res.send(200, tokens);
						}
						next(false);
					});
				});
			});

		});
	});
};
