'use strict';

const config = require('../../../config');
const userMng = require('../../managers/user');

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
				const errCode = err.code;
				delete(err.code);
				res.send(errCode, err);
			}
			return next();
		}

		if (req.method === 'POST') {
			res.send(200, tokens);
			return next();
		}

		const compatibleDevices = config.emailVerification.compatibleEmailDevices;
		const userAgent = String(req.headers['user-agent']);

		for (let i = 0; i < compatibleDevices.length; i++) {
			const exp = compatibleDevices[i];
			const check = exp.replace(/\*/g, '.*');
			let match = userAgent.match(check);
			const isCompatible = (match !== null && userAgent === match[0]);
			if (isCompatible) {
				match = userAgent.match(/.*Android.*/i);
				const isAndroid = (match !== null && userAgent === match[0]);
				let location = `${config.emailVerification.scheme}://user/refreshToken/${tokens.refreshToken}`;

				if (isAndroid) {
					location = `intent://user/refreshToken/${tokens.refreshToken}/#Intent;scheme=${config.emailVerification.scheme};end`;
				}
				res.header('Location', location);
				res.send(302);
				return next();
			}
		}

		if (config.emailVerification.redirectUrl) {
			const refreshToken = config.emailVerification.redirectRefreshToken ? `?refreshToken=${tokens.refreshToken}`: '';
			res.setHeader('Location', config.emailVerification.redirectUrl + refreshToken);
			res.send(301);
			return next();
		}

		res.send(200, {msg: config.emailVerification.nonCompatibleEmailMsg});
		return next();

	});
};
