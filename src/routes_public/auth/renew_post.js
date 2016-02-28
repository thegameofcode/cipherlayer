'use strict';

const async = require('async');
const log = require('../../logger/service');
const daoMng = require('../../managers/dao');
const tokenMng = require('../../managers/token');
const config = require('../../../config.json');
const sessionRequest = require('./../auth/session');

module.exports = function (req, res, next) {
	const refreshToken = req.body.refreshToken;
	const data = {};

	if (req.body.deviceId) {
		data.deviceId = req.body.deviceId;
	}

	if (config.version) {
		data.deviceVersion = req.headers[config.version.header];
	}

	tokenMng.getRefreshTokenInfo(refreshToken, function (err, tokenSet) {
		const userAgent = String(req.headers['user-agent']);

		if (err) {
			const errInvalidToken = {
				err: 'invalid_token',
				des: 'Invalid token'
			};
			res.send(401, errInvalidToken);
			return next();
		}
		if (new Date().getTime() > tokenSet.expiresAtTimestamp) {
			const errExpiredToken = {
				err: 'expired_token',
				des: 'Expired token'
			};
			res.send(401, errExpiredToken);
			return next();
		}

		daoMng.getFromId(tokenSet.userId, function (err, foundUser) {
			if (err) {
				const errInvalidToken = {
					err: 'invalid_token',
					des: 'Invalid token'
				};
				res.send(401, errInvalidToken);
				return next();
			}

			if (!foundUser) {
				log.error({
					err: 'invalid_refresh_token',
					des: `invalid_refresh_token '${refreshToken}' contains unknown user '${tokenSet.userId}'`
				});
				res.send(401, {err: 'invalid_refresh_token', des: 'unknown user inside token'});
				return next();
			}

			async.series([
				function (done) {
					//Add 'realms' & 'capabilities'
					daoMng.getRealms(function (err, realms) {
						if (err) {
							log.error({ err, des: 'error obtaining user realms' });
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
				sessionRequest(data.deviceId, tokenSet.userId, 'POST', userAgent, function (err) {
					if (err) {
						log.error({ err });
					}
					tokenMng.createAccessToken(tokenSet.userId, data, function (err, newToken) {
						if (err) {
							log.error({ err });
						}
						const body = {
							accessToken: newToken,
							expiresIn: config.accessToken.expiration
						};
						res.send(200, body);
						return next();
					});
				});
			});

		});

	});
};
