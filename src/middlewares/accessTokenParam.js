'use strict';

const config = require('../../config.json');

module.exports = function checkAccessTokenParam(req, res, next) {
	const paramAT = req.params.at;

	if (paramAT) {
		req.headers.authorization = `${config.authHeaderKey.trim()} ${paramAT}`;
	}

	return next();
};
