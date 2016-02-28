'use strict';

const sessionRequest = require('./session');
const log = require('../../logger/service');

module.exports = function (req, res, next) {
	const tokenInfo = req.tokenInfo;
	const userId = tokenInfo.userId;
	const deviceId = tokenInfo.data.deviceId;
	const userAgent = String(req.headers['user-agent']);

	sessionRequest(deviceId, userId, 'DELETE', userAgent, function (err, result) {
		if (err) {
			log.error({ err, result }, 'RemoveDeviceResponse');
			res.send(500, {err: 'internal_session_error', des: 'unable to close session'});
			return next();
		}
		res.send(204);
		return next();
	});
};
