'use strict';

const _ = require('lodash');
const config = require('../../config.json');

module.exports = function checkAuthHeader(req, res, next) {
	const authHeader = req.header('Authorization');
	if (!authHeader) {
		const err = {err: 'invalid_authorization', des: 'required authorization header'};
		res.send(401, err);
		return next(err);
	}

	const authType = authHeader.split(' ')[0].toLowerCase();
	if (authType !== _.trim(config.authHeaderKey).toLowerCase()) {
		res.send(401, {err: 'invalid_authorization', des: 'invalid authorization type'});
		return next(true); // TODO: return error
	}

	const authValue = authHeader.split(' ')[1];
	if (!authValue) {
		res.send(401, {err: 'invalid_authorization', des: 'no authorization value'});
		return next(true); // TODO: return error
	}

	req.auth = `${authType} ${authValue}`;
	return next();
};
