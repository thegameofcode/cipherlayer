'use strict';

var sessionRequest = require('./session');
var log = require('../../logger/service.js');

module.exports = function (req, res, next) {
	var authHeader = req.header('Authorization');
	if (!authHeader) {
		log.error({err: 'invalid_access_token', des: 'no authorization header'});
		res.send(401, {err: 'invalid_access_token', des: 'unable to read token info'});
		return next(false);
	}

	const tokenInfo = req.tokenInfo;

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
};
