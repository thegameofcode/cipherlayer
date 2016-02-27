var config = require('../../config.json');

function checkAccessTokenParam(req, res, next) {
	var paramAT = req.params.at;

	if (paramAT) {
		req.headers.authorization = `${config.authHeaderKey.trim()} ${paramAT}`;
	}

	return next();
}

module.exports = checkAccessTokenParam;
