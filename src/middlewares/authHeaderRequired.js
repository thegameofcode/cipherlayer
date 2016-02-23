var config = require(process.cwd() + '/config.json');

function checkAuthHeader(req, res, next) {
	req.auth = req.header('Authorization');
	if (!req.auth || req.auth.length <= config.authHeaderKey.length) {
		res.send(401, {err: 'invalid_authorization', des: 'invalid authorization header'});
		return next(false);
	}
	next();
}

module.exports = checkAuthHeader;
