var log = require('../logger/service.js');
var request = require('request');
var async = require('async');
var countries = require('countries-info');

var daoMng = require('../managers/dao');
var userMng = require('../managers/user')();
var tokenMng = require('../managers/token');
var fileStoreMng = require('../managers/file_store');
var config = require(process.cwd() + '/config.json');

var forcedotcomStrategy = require('passport-forcedotcom').Strategy;

function createSalesforceStrategy() {

	var salesforceSettings = {
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
	log.info('user ' + profile.id + ' logged in using salesforce');
	async.series(
		[
			function uploadAvatar(done) {
				if (!profile._raw || !profile._raw.photos || !profile._raw.photos.picture || !config.aws || !config.aws.buckets || !config.aws.buckets.avatars) {
					return done();
				}

				if (config.salesforce.replaceDefaultAvatar && profile._raw.photos.picture.indexOf(config.salesforce.replaceDefaultAvatar.defaultAvatar) > -1) {
					profile.avatar = config.salesforce.replaceDefaultAvatar.replacementAvatar;
					done();
				} else {
					var oauthToken = "?oauth_token=" + accessToken.params.access_token;

					var avatarPath = profile._raw.photos.picture + oauthToken;
					var idPos = profile.id.lastIndexOf('/') ? profile.id.lastIndexOf('/') + 1 : 0;
					var name = profile.id.substring(idPos) + '.jpg';

					fileStoreMng.uploadAvatarToAWS(avatarPath, name, function (err, avatarUrl) {
						if (err) {
							log.error({err: err}, 'Error uploading a profile picture to AWS');
						} else {
							profile.avatar = avatarUrl;
						}
						done();
					});
				}
			},
			function returnSessionData(done) {
				var data = {
					accessToken: accessToken,
					refreshToken: refreshToken,
					profile: profile,
					expiry: new Date().getTime() + config.salesforce.expiration * 60 * 1000
				};
				done(data);
			}
		], function (data) {
			done(null, data);
		}
	);

}

function salesforceDenyPermisionFilter(req, res, next) {
	var errorCode = req.query.error;

	var errorDescription = req.query.error_description;
	if (!errorCode || !errorDescription) {
		return next();
	} else {
		res.send(401, {err: 'access_denied', des: 'end-user denied authorization'});
		next(false);
	}
}

function salesforceCallback(req, res, next) {
	var sfData = req.user;
	var profile = sfData.profile;

	daoMng.getFromUsername(profile._raw.email, function (err, foundUser) {
		if (err) {

			if (err.message == daoMng.ERROR_USER_NOT_FOUND) {
				var tokenData = {
					accessToken: sfData.accessToken,
					refreshToken: sfData.refreshToken
				};

				tokenMng.createAccessToken(profile.id, tokenData, function (err, token) {
					countries.countryFromPhone(profile._raw.mobile_phone, function (err, country) {
						var returnProfile = {
							name: profile._raw.first_name,
							lastname: profile._raw.last_name,
							email: profile._raw.email,
							sf: token,
							officeLocation: ((profile._raw.addr_street || '') + ' ' + (profile._raw.addr_city || '') + ' ' + (profile._raw.addr_country || '')).trim()
						};

						if (profile.avatar) {
							returnProfile.avatar = profile.avatar;
						}

						if (err === null && country) {
							returnProfile.country = country['ISO3166-1-Alpha-2'];
							returnProfile.phone = profile._raw.mobile_phone.replace('+' + country.Dial, '').trim();
						}

						getUserOptionalInfo(sfData, profile._raw.user_id, function (err, profileDetail) {
							if (profileDetail.title) {
								returnProfile.position = profileDetail.title;
							}

							if (profileDetail.companyName) {
								returnProfile.company = profileDetail.companyName;
							}

							res.send(203, returnProfile);
							next(false);
						});
					});
				});
			} else {
				res.send(500, {err: 'internal_error', des: 'There was an internal error matching salesforce profile'});
				next(false);
			}
		} else {

			var platform = {
				platform: 'sf',
				accessToken: sfData.accessToken,
				refreshToken: sfData.refreshToken,
				expiry: new Date().getTime() + sfData.expiresIn * 1000
			};

			//TODO check if setPlatformData and createBothTokens call can be made in parallel
			userMng.setPlatformData(foundUser._id, 'sf', platform, function (err) {
				if (err) {
					log.error({err: err}, 'error updating sf tokens into user ' + foundUser._id + '');
				}
				var data = {};
				if (foundUser.roles) {
					data.roles = foundUser.roles;
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
					tokenMng.createBothTokens(foundUser._id, data, function (err, tokens) {
						if (err) {
							res.send(409, {err: err.message});
						} else {
							tokens.expiresIn = config.accessToken.expiration * 60;
							res.send(200, tokens);
						}
						next(false);
					});
				});
			});
		}
		next(false);
	});
}

function getUserOptionalInfo(sfData, userId, cbk) {
	var SERVICE_CHATTER_URL = "/services/data/v26.0/chatter/users/" + userId;

	var options = {
		url: sfData.accessToken.params.instance_url + SERVICE_CHATTER_URL,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Authorization': 'Bearer ' + sfData.accessToken.params.access_token
		},
		method: 'GET'
	};
	request(options, function (error, res_private, body) {
		if (error) {
			cbk(error, null);
		}
		cbk(null, JSON.parse(body));
	});
}

function authSfBridge(passport) {
	return function (req, res, next) {
		var end = res.end;
		res.end = function () {
			end.call(this);
			next();
		};

		passport.authenticate('forcedotcom')(req, res);
	};
}

function renewSFAccessTokenIfNecessary(user, platform, cbk) {
	var maxTimeTillRenewal = (new Date().getTime() + config.salesforce.renewWhenLessThan * 60 * 1000);
	if (platform.expiry > maxTimeTillRenewal) {
		return cbk(null, platform.accessToken.params.access_token);
	}
	var optionsForSFRenew = {
		url: config.salesforce.tokenUrl + '?grant_type=refresh_token' + '&' +
		'client_id=' + config.salesforce.clientId + '&' +
		'client_secret=' + config.salesforce.clientSecret + '&' +
		'refresh_token=' + platform.refreshToken,
		method: 'POST'
	};

	request(optionsForSFRenew, function (err, res, body) {
		if (err) {
			return cbk(err);
		}
		body = JSON.parse(body);
		var newAccessToken = body.access_token;

		var newSFplatformItem = {
			"platform": "sf",
			"accessToken": {
				"params": {
					"id": user.userId,
					"instance_url": platform.accessToken.params.instance_url,
					"access_token": body.access_token
				}
			},
			"refreshToken": platform.refreshToken,
			"expiry": new Date().getTime() + config.salesforce.expiration * 60 * 1000
		};
		daoMng.updateArrayItem(user._id, 'platforms', 'platform', newSFplatformItem, function (err) {
			if (err) {
				return cbk(err);
			} else {
				return cbk(null, newAccessToken);
			}
		});
	});
}

function addRoutes(server, passport) {
	if (!config.salesforce) {
		return;
	}

	log.info('Adding Salesforce routes');
	var salesforceStrategy = createSalesforceStrategy();
	passport.use(salesforceStrategy);
	server.get('/auth/sf', authSfBridge(passport));
	server.get('/auth/sf/callback', salesforceDenyPermisionFilter, passport.authenticate('forcedotcom', {
		failureRedirect: '/auth/error',
		session: false
	}), salesforceCallback);
}

module.exports = {
	addRoutes: addRoutes,
	prepareSession: prepareSession,
	renewSFAccessTokenIfNecessary: renewSFAccessTokenIfNecessary
};
