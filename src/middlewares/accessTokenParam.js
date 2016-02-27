var config = require(process.cwd() + '/config.json');

function checkAccessTokenParam(req, res, next) {
	var paramAT = req.params.at;

	if (paramAT) {
		req.headers.authorization = config.authHeaderKey.trim() + ' ' + paramAT;
	}

	next();
}

module.exports = checkAccessTokenParam;
