'use strict';

const async = require('async');
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;

const log = require('../logger/service');
const tokenMng = require('../managers/token');
const daoMng = require('../managers/dao');
const config = require('../../config.json');

function createLinkedInStrategy() {

	return new LinkedInStrategy({
		clientID: config.linkedin.consumerKey,
		clientSecret: config.linkedin.consumerSecret,
		callbackURL: config.linkedin.callbackURL,
		scope: config.linkedin.scope,
		passReqToCallback: true
	}, function (req, accessToken, refreshToken, profile, done) {
		return done(null, {
			accessToken,
			refreshToken,
			profile
		});
	});
}

function linkedInCallback(req, res, next) {
	const data = req.user;
	const profile = data.profile;
	daoMng.getFromUsername(profile._json.emailAddress, function (err, foundUser) {
		if (err) {
			if (err.message === daoMng.ERROR_USER_NOT_FOUND) {
				const inData = {
					accessToken: data.accessToken,
					refreshToken: data.refreshToken
				};
				tokenMng.createAccessToken(profile.id, inData, function (err, token) {
					if (err) {
						log.error({ err }, 'error creating linkedin profile token');
						return next(err);
					}
					const returnProfile = {
						name: profile._json.formattedName,
						email: profile._json.emailAddress,
						in: token
					};

					res.send(203, returnProfile);
					return next();
				});
			} else {
				res.send(500, {err: 'internal_error', des: 'There was an internal error matching linkedin profile'});
				return next(err);
			}
		}

		let tokenData = {};
		if (foundUser.roles) {
			tokenData = { roles: foundUser.roles };
		}

		async.series([
			function (done) {
				//Add "realms" & "capabilities"
				daoMng.getRealms(function (err, realms) {
					if (err) {
						log.error({err, des: 'error obtaining user realms'});
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

							if (!tokenData.realms) {
								tokenData.realms = [];
							}
							tokenData.realms.push(realm.name);

							async.each(Object.keys(realm.capabilities), function (capName, added) {
								if (!tokenData.capabilities) {
									tokenData.capabilities = {};
								}

								tokenData.capabilities[capName] = realm.capabilities[capName];
								added();
							}, more);
						}, next);
					}, done);
				});
			}
		], function () {
			tokenMng.createBothTokens(foundUser.username, tokenData, function (err, tokens) {
				if (err) {
					res.send(409, {err: err.message});
					return next(err);

				}
				tokens.expiresIn = config.accessToken.expiration * 60;
				res.send(200, tokens);
				return next();
			});
		});
	});
}

function addUserPlatform(req, res, next) {
	const data = req.user;
	const profile = data.profile;

	daoMng.getFromUsername(profile._json.emailAddress, function (err, foundUser) {
		if (err) {
			if (err.message === daoMng.ERROR_USER_NOT_FOUND) {
				res.send(500, {err: 'internal_error', des: 'User not found'});
				return next(err);
			}
			res.send(500, {err: 'internal_error', des: 'There was an internal error matching linkedin profile'});
			return next(true); // TODO: return error
		}

		const updatedPlatforms = [];
		const platforms = profile.platforms;
		let platformExists = false;

		if (foundUser.platforms && foundUser.platforms.length > 0) {
			platforms.forEach(function (platform) {
				if (platform.platform === 'in') {
					platform.accessToken = data.accessToken;
					platform.refreshToken = data.refreshToken;
					platform.expiry = config.accessToken.expiration * 60;
					platformExists = true;
				}
				updatedPlatforms.push(platform);
			});
		}

		if (!platformExists) {
			const linkedInPlatform = {
				platform: 'in',
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
				expiry: config.accessToken.expiration * 60
			};
			updatedPlatforms.push(linkedInPlatform);
		}

		daoMng.updateFieldById(foundUser.id.toString(), {platforms: updatedPlatforms}, function (err, updatedUsers) {
			if (err) {
				res.send(500, {err: 'internal_error', des: 'Error updating the user'});
				return next(err);
			}

			if (updatedUsers !== 1) {
				res.send(500, {err: 'internal_error', des: 'Error updating the user'});
				return next(true); // TODO: return error
			}

			res.send(204);
			return next();
		});
	});
}

function addRoutes(server, passport) {
	if (!config.linkedin) {
		return;
	}

	log.info('Adding LinkedIn routes');
	const linkedInStrategy = createLinkedInStrategy();
	passport.use(linkedInStrategy);
	server.get('/auth/in', passport.authenticate('linkedin', {state: new Date().getTime()}));
	server.post('/auth/in', addUserPlatform);
	server.get('/auth/in/callback', passport.authenticate('linkedin', {
		failureRedirect: '/auth/error',
		session: false
	}), linkedInCallback);
}

module.exports = {
	addRoutes
};
