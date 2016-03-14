'use strict';

const request = require('request');
const _ = require('lodash');

const log = require('../../logger/service');
const daoMng = require('../../managers/dao');
const userMng = require('../../managers/user')();
const tokenMng = require('../../managers/token');
const config = require('../../../config');
const crypto = require('../../managers/crypto');
const cryptoMng = crypto(config.password);

const defaultOptions = {
	url: 'https://graph.facebook.com/v2.5/me',
	json: true,
	method: 'GET',
	qs: {
		fields: config.facebook ? config.facebook.requestFields : null,
		format: 'json',
		method: 'get',
		pretty: 0,
		suppress_http_code: 1
	}
};

function mapFacebookData(body, fieldsMap) {
	const mappedData = {};

	if (!fieldsMap) {
		return mappedData;
	}

	_.each(_.keys(fieldsMap), function (fbKey) {
		const profileKey = fieldsMap[fbKey];
		if (fbKey === 'profile_picture') {
			mappedData[profileKey] = body.picture ? body.picture.data.url : null;
			return;
		}

		if (fbKey === 'email' && !body[fbKey]) {
			body[fbKey] = `${body.id}@facebook.com`;
		}

		if (!body[fbKey]) {
			return;
		}

		mappedData[profileKey] = body[fbKey];
	});

	return mappedData;
}

module.exports = function postAuthRegisterFacebook(req, res, next) {

	const options = _.clone(defaultOptions);
	options.qs.access_token = req.body.accessToken;

	if (!config.facebook) {
		res.send(400, {
			err: 'facebook_login_disabled',
			des: 'Facebook login is not configured'
		});
		return next();
	}

	if (!req.body && !req.body.accessToken) {
		res.send(400, {
			err: 'missing_facebook_token',
			des: 'Missing facebook access_token'
		});
		return next();
	}

	request(options, function (err, fb_res, fb_body) {

		if (err) {
			res.send(409, {err: err.message});
			return next();
		}

		if (fb_body.error) {
			res.send(409, {err: fb_body.error.type, des: fb_body.error.message});
			return next();
		}

		const fbUserProfile = mapFacebookData(fb_body, config.facebook.fieldsMap);
		const fbUserProfileUsername = fbUserProfile[config.facebook.fieldsMap.email || 'email'];

		daoMng.getFromUsername(fbUserProfileUsername, function (err, foundUser) {
			// RETURNING FACEBOOK USER

			if (!err) {
				const platform = {
					platform: 'fb',
					accessToken: req.body.accessToken
				};

				userMng.setPlatformData(foundUser._id, 'fb', platform, function (err) {
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

					tokenMng.createBothTokens(foundUser._id, data, function (err, tokens) {
						if (err) {
							res.send(409, {err: err.message});
						} else {
							tokens.expiresIn = config.accessToken.expiration * 60;
							res.send(200, tokens);
						}
						return next();
					});

				});
				return;
			}

			// NEW FACEBOOK USER

			if (err && err.message === daoMng.ERROR_USER_NOT_FOUND) {

				if (!config.facebook.registerByToken) {
					res.send(401, {
						err: 'facebook_user_not_registered',
						des: 'This user need registration before login'
					});
					return next(true); // TODO: return error
				}

				fbUserProfile.fb = {
					accessToken: req.body.accessToken
				};

				fbUserProfile.password = cryptoMng.randomPassword(config.password.regexValidation);

				userMng.createUser(fbUserProfile, null, function (err, tokens) {
					if (err) {
						if (!err.code) {
							res.send(500, err);
						} else {
							const errCode = err.code;
							delete(err.code);
							res.send(errCode, err);
						}
						return next();
					}

					tokenMng.getRefreshTokenInfo(tokens.refreshToken, function (err, tokenSet) {
						const userId = tokenSet.userId;
						const tokenData = tokenSet.data;

						if (config.version) {
							tokenData.deviceVersion = req.headers[config.version.header];
						}

						tokenMng.createBothTokens(userId, tokenData, function (err, tokens) {
							tokens.expiresIn = config.accessToken.expiration * 60;
							res.send(201, tokens);
							return next();
						});
					});

				});

				return;
			}

			if (err) {
				res.send(500, {err: 'internal_error', des: 'There was an internal error checking facebook profile'});
				return next();
			}

		});

	});
};
