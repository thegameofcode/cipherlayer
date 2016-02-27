'use strict';

const config = require('../../../config.json');
const tokenMng = require('../../managers/token');
const userMng = require('../../managers/user');

module.exports = function (req, res, next) {
	userMng().createUser(req.body, req.headers['x-otp-pin'], function (error, tokens) {
		if (error) {
			if (!error.code) {
				res.send(500, error);
				return next(false);
			}
			var errCode = error.code;
			res.send(errCode, {err: error.err, des: error.des});
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
};
