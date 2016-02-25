'use strict';

var tokenManager = require('../../managers/token');
var config = require(process.cwd() + '/config.json');

module.exports = function (req, res, next) {

	var refreshToken = req.params.rt;

	if (!refreshToken) {
		res.send(400, {
			err: 'invalid_request',
			des: 'refresh token required'
		});
		return next(false);
	}

	tokenManager.getRefreshTokenInfo(refreshToken, function (err) {
		if (err) {
			res.send(400, {
				err: 'invalid_request',
				des: 'invalid refresh token'
			});
			return next(false);
		}
		res.header('Location', config.magicLink.scheme + '://user/refreshToken/' + refreshToken);
		res.send(302);

		next();
	});
};
