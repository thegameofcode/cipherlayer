'use strict';

var config = require('../../../config.json');
var tokenMng = require('../../managers/token');
var sessionRequest = require('./session');
var log = require('../../logger/service.js');

function authLogout(req, res, next) {
	var authHeader = req.header('Authorization');
	var accessToken = authHeader.substring(config.authHeaderKey.length);

	try {
		tokenMng.getAccessTokenInfo(accessToken, function (err, tokenInfo) {
			if (err) {
				log.error({err: 'invalid_access_token', des: accessToken});
				res.send(401, {err: 'invalid_access_token', des: 'unable to read token info'});
				return next(false);
			} else {
				var userAgent = String(req.headers['user-agent']);
				var userId = tokenInfo.userId;
				var deviceId = tokenInfo.data.deviceId;

				sessionRequest(deviceId, userId, 'DELETE', userAgent, function (err, result) {
					if (err) {
						log.error({err: err, result: result}, 'RemoveDeviceResponse');
						res.send(500, {err: 'internal_session_error', des: 'unable to close session'});
						return next(false);
					}
					res.send(204);
					return next();
				});
			}
		});
	} catch (ex) {
		res.send(403, {
			err: "invalid_token",
			des: "invalid authorization header"
		});
		next(false);
	}

}

module.exports = function (service) {
	service.post('/auth/logout', authLogout);
};
