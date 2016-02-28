'use strict';

const log = require('../logger/service');
const request = require('request');
const async = require('async');
const countries = require('countries-info');

const daoMng = require('../managers/dao');
const userMng = require('../managers/user')();
const tokenMng = require('../managers/token');
const fileStoreMng = require('../managers/file_store');
const config = require('../../config.json');

const forcedotcomStrategy = require('passport-forcedotcom').Strategy;

function createSalesforceStrategy() {

	const salesforceSettings = {
		clientID: config.salesforce.clientId,
		clientSecret: config.salesforce.clientSecret,
		scope: config.salesforce.scope,
		callbackURL: config.salesforce.callbackURL
	};
	if (config.salesforce.authUrl) {
		salesforceSettings.authorizationURL = config.salesforce.authUrl;
	}
	if (config.salesforce.tokenUrl) {
		salesforceSettings.tokenURL = config.salesforce.tokenUrl;
	}

	return new forcedotcomStrategy(salesforceSettings, prepareSession);
}

function prepareSession(accessToken, refreshToken, profile, done) {
	log.info(`user ${profile.id} logged in using salesforce`);
	async.series([
			function uploadAvatar(done) {
				if (!profile._raw || !profile._raw.photos || !profile._raw.photos.picture || !config.aws || !config.aws.buckets || !config.aws.buckets.avatars) {
					return done();
				}

				if (config.salesforce.replaceDefaultAvatar && profile._raw.photos.picture.indexOf(config.salesforce.replaceDefaultAvatar.defaultAvatar) > -1) {
					profile.avatar = config.salesforce.replaceDefaultAvatar.replacementAvatar;
					return done();
				}
				const avatarPath = `${profile._raw.photos.picture}?oauth_token=${accessToken.params.access_token}`;
				const idPos = profile.id.lastIndexOf('/') ? profile.id.lastIndexOf('/') + 1 : 0;
				const name = `${profile.id.substring(idPos)}.jpg`;

				fileStoreMng.uploadAvatarToAWS(avatarPath, name, function (err, avatarUrl) {
					if (err) {
						log.error({ err }, 'Error uploading a profile picture to AWS');
					} else {
						profile.avatar = avatarUrl;
					}
					return done();
				});
			},
			function returnSessionData(done) {
				const data = {
					accessToken,
					refreshToken,
					profile,
					expiry: new Date().getTime() + config.salesforce.expiration * 60 * 1000
				};
				return done(data);
			}
		], function (data) {
			return done(null, data);
		}
	);

}

function salesforceDenyPermisionFilter(req, res, next) {
	const errorCode = req.query.error;

	const errorDescription = req.query.error_description;
	if (!errorCode || !errorDescription) {
		return next();
	}
	res.send(401, {err: 'access_denied', des: 'end-user denied authorization'});
	return next(true); // TODO: return error
}

function salesforceCallback(req, res, next) {
	const sfData = req.user;
	const profile = sfData.profile;

	daoMng.getFromUsername(profile._raw.email, function (err, foundUser) {
		if (err) {

			if (err.message === daoMng.ERROR_USER_NOT_FOUND) {
				const tokenData = {
					accessToken: sfData.accessToken,
					refreshToken: sfData.refreshToken
				};

				tokenMng.createAccessToken(profile.id, tokenData, function (err, token) {
					if (err) {
						log.error({ err }, 'error creating salesforce access token');
						return next(err);
					}

					countries.countryFromPhone(profile._raw.mobile_phone, function (err, country) {
						if (err) {
							log.error({ err }, 'error getting salesforce country from phone');
							return next(err);
						}

						const officeLocation = `${profile._raw.addr_street || ''} ${profile._raw.addr_city || ''} ${profile._raw.addr_country || ''}`.trim();
						const returnProfile = {
							name: profile._raw.first_name,
							lastname: profile._raw.last_name,
							email: profile._raw.email,
							sf: token,
							officeLocation
						};

						if (profile.avatar) {
							returnProfile.avatar = profile.avatar;
						}

						if (country) {
							returnProfile.country = country['ISO3166-1-Alpha-2'];
							returnProfile.phone = profile._raw.mobile_phone.replace(`+${country.Dial}`, '').trim();
						} else {
							log.info({profile_raw: profile._raw}, 'no country on salesforce phone');
						}

						getUserOptionalInfo(sfData, profile._raw.user_id, function (err, profileDetail) {
							if (err) {
								log.error({ err }, 'error getting salesforce additional info');
								return next(err);
							}

							if (profileDetail.title) {
								returnProfile.position = profileDetail.title;
							}

							if (profileDetail.companyName) {
								returnProfile.company = profileDetail.companyName;
							}

							res.send(203, returnProfile);
							return next();
						});
					});
				});
			} else {
				res.send(500, {err: 'internal_error', des: 'There was an internal error matching salesforce profile'});
				return next(true); // TODO: return error
			}
		} else {

			const platform = {
				platform: 'sf',
				accessToken: sfData.accessToken,
				refreshToken: sfData.refreshToken,
				expiry: new Date().getTime() + sfData.expiresIn * 1000
			};

			userMng.setPlatformData(foundUser._id, 'sf', platform, function (err) {
				if (err) {
					log.error({ err }, `error updating sf tokens into user ${foundUser._id}`);
				}
				const data = {};
				if (foundUser.roles) {
					data.roles = foundUser.roles;
				}

				if (config.version) {
					data.deviceVersion = req.headers[config.version.header];
				}

				log.info({device_version: data.deviceVersion}, `device version on SF login for profile ${foundUser._id}`);

				async.series([
					function (done) {
						//Add "realms" & "capabilities"
						daoMng.getRealms(function (err, realms) {
							if (err) {
								log.error({ err , des: 'error obtaining user realms' });
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
					tokenMng.createBothTokens(foundUser._id, data, function (err, tokens) {
						if (err) {
							res.send(409, {err: err.message});
							return next(err);

						}
						tokens.expiresIn = config.accessToken.expiration * 60;
						res.send(200, tokens);
						return next(err);

					});
				});
			});
		}
		return next();
	});
}

function getUserOptionalInfo(sfData, userId, cbk) {

	const options = {
		url: `${sfData.accessToken.params.instance_url}/services/data/v26.0/chatter/users/${userId}`,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			Authorization: `Bearer ${sfData.accessToken.params.access_token}`
		},
		method: 'GET'
	};
	request(options, function (error, res_private, body) {
		if (error) {
			return cbk(error, null);
		}

		return cbk(null, JSON.parse(body));
	});
}

function authSfBridge(passport) {
	return function (req, res, next) {
		const end = res.end;
		res.end = function () {
			end.call(this);
			return next();
		};

		passport.authenticate('forcedotcom')(req, res);
	};
}

function renewSFAccessTokenIfNecessary(user, platform, cbk) {
	const maxTimeTillRenewal = (new Date().getTime() + config.salesforce.renewWhenLessThan * 60 * 1000);
	if (platform.expiry > maxTimeTillRenewal) {
		return cbk(null, platform.accessToken.params.access_token);
	}
	const optionsForSFRenew = {
		url: `${config.salesforce.tokenUrl}?grant_type=refresh_token&client_id=${config.salesforce.clientId}` +
		`&client_secret=${config.salesforce.clientSecret}&refresh_token=${platform.refreshToken}`,
		method: 'POST'
	};

	request(optionsForSFRenew, function (err, res, rawBody) {
		if (err) {
			return cbk(err);
		}
		const body = JSON.parse(rawBody);
		const newAccessToken = body.access_token;

		const newSFplatformItem = {
			platform: 'sf',
			accessToken: {
				params: {
					id: user.userId,
					instance_url: platform.accessToken.params.instance_url,
					access_token: body.access_token
				}
			},
			refreshToken: platform.refreshToken,
			expiry: new Date().getTime() + config.salesforce.expiration * 60 * 1000
		};
		daoMng.updateArrayItem(user._id, 'platforms', 'platform', newSFplatformItem, function (err) {
			if (err) {
				return cbk(err);
			}
			return cbk(null, newAccessToken);
		});
	});
}

function addRoutes(server, passport) {
	if (!config.salesforce) {
		return;
	}

	log.info('Adding Salesforce routes');
	const salesforceStrategy = createSalesforceStrategy();
	passport.use(salesforceStrategy);
	server.get('/auth/sf', authSfBridge(passport));
	server.get('/auth/sf/callback', salesforceDenyPermisionFilter, passport.authenticate('forcedotcom', {
		failureRedirect: '/auth/error',
		session: false
	}), salesforceCallback);
}

module.exports = {
	addRoutes,
	prepareSession,
	renewSFAccessTokenIfNecessary
};
