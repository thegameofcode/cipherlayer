'use strict';

var config = require(process.cwd() + '/config.json');
var userMng = require('../../managers/user');

module.exports = function (req, res, next) {
	if (!req.params) {
		res.send(400, {
			err: 'invalid_url_params',
			des: 'The call to this url must have params.'
		});
		return next();
	}

	userMng().createUserByToken(req.params.verifyToken, function (err, tokens) {
		if (err) {
			if (!err.code) {
				res.send(500, err);
			} else {
				var errCode = err.code;
				delete(err.code);
				res.send(errCode, err);
			}
			return next(false);
		} else {

			if (req.method === 'POST') {
				res.send(200, tokens);
				return next();
			}

			var compatibleDevices = config.emailVerification.compatibleEmailDevices;
			var userAgent = String(req.headers['user-agent']);

			for (var i = 0; i < compatibleDevices.length; i++) {
				var exp = compatibleDevices[i];
				var check = exp.replace(/\*/g, '.*');
				var match = userAgent.match(check);
				var isCompatible = (match !== null && userAgent === match[0]);
				if (isCompatible) {
					match = userAgent.match(/.*Android.*/i);
					var isAndroid = (match !== null && userAgent === match[0]);
					var location = config.emailVerification.scheme + '://user/refreshToken/' + tokens.refreshToken;

					if (isAndroid) {
						location = 'intent://user/refreshToken/' + tokens.refreshToken + '/#Intent;scheme=' + config.emailVerification.scheme + ';end';
					}
					res.header('Location', location);
					res.send(302);
					return next(false);
				}
			}

			if (config.emailVerification.redirectUrl) {
				var refreshToken = config.emailVerification.redirectRefreshToken ? '?refreshToken=' + tokens.refreshToken : '';
				res.setHeader('Location', config.emailVerification.redirectUrl + refreshToken);
				res.send(301);
				return next();
			}

			res.send(200, {msg: config.emailVerification.nonCompatibleEmailMsg});
			return next();
		}
	});
};
