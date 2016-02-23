var _ = require('lodash');
var config = require(process.cwd() + '/config.json');

function checkAuthHeader(req, res, next) {
	var authHeader = req.header('Authorization');
	if (!authHeader) {
		res.send(401, {err: 'invalid_authorization', des: 'required authorization header'});
		return next(false);
	}

	var authType = authHeader.split(' ')[0].toLowerCase();
	if (authType !== _.trim(config.authHeaderKey).toLowerCase()) {
		res.send(401, {err: 'invalid_authorization', des: 'invalid authorization type'});
		return next(false);
	}

	var authValue = authHeader.split(' ')[1];
	if (!authValue) {
		res.send(401, {err: 'invalid_authorization', des: 'no authorization value'});
		return next(false);
	}

	req.auth = authType + ' ' + authValue;
	next();
}

module.exports = checkAuthHeader;
