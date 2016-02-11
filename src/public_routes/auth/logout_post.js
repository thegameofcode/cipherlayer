'use strict';

var config = require(process.cwd() + '/config.json');
var tokenMng = require('../../managers/token');
var sessionRequest = require('./session');
var log = require('../../logger/service.js');

module.exports = function (req, res, next) {
	var authHeader = req.header('Authorization');
	if (!authHeader) {
		log.error({err: 'invalid_access_token', des: 'no authorization header'});
		res.send(401, {err: 'invalid_access_token', des: 'unable to read token info'});
		return next(false);
	}

	if (authHeader.indexOf(config.authHeaderKey) !== 0) {
		log.error({err: 'invalid_access_token', des: 'invalid header identifier'});
		res.send(401, {err: 'invalid_access_token', des: 'unable to read token info'});
		return next(false);
	}
	var accessToken = authHeader.substring(config.authHeaderKey.length);

	tokenMng.getAccessTokenInfo(accessToken, function (err, tokenInfo) {
		if (err) {
			log.error({err: 'invalid_access_token', des: err});
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
};
