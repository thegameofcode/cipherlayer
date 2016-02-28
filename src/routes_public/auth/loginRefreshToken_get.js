'use strict';

const tokenManager = require('../../managers/token');
const config = require('../../../config.json');

module.exports = function (req, res, next) {

	const refreshToken = req.params.rt;

	if (!refreshToken) {
		res.send(400, {
			err: 'invalid_request',
			des: 'refresh token required'
		});
		return next();
	}

	tokenManager.getRefreshTokenInfo(refreshToken, function (err) {
		if (err) {
			res.send(400, {
				err: 'invalid_request',
				des: 'invalid refresh token'
			});
			return next();
		}
		res.header('Location', `${config.magicLink.scheme}://user/refreshToken/${refreshToken}`);
		res.send(302);

		return next();
	});
};
