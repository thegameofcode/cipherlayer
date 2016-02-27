var config = require('../../config.json');
var log = require('../logger/service.js');
var tokenMng = require('../managers/token');

function decodeToken(req, res, next) {
	if (!req.auth) {
		const err = { err: 'invalid_access_token', des: 'access token required' };
		log.error({ err });
		res.send(401, err);
		return next(false);
	}

	var accessToken = req.auth.substring(config.authHeaderKey.length);
	req.accessToken = accessToken;

	tokenMng.getAccessTokenInfo(accessToken, function (err, tokenInfo) {
		if (err) {
			log.error({err: 'invalid_access_token', des: accessToken});
			res.send(401, {err: 'invalid_access_token', des: 'unable to read token info'});
			return next(false);
		}
		req.tokenInfo = tokenInfo;
		return next();
	});
}

module.exports = decodeToken;
