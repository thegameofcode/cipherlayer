'use strict';

const config = require('../../config');

const expectedAuthorizationBasic = `basic ${new Buffer(`${config.management.clientId}:${config.management.clientSecret}`).toString('base64')}`;

module.exports = function checkAuthBasic(req, res, next) {
	if (!req.headers.authorization || req.headers.authorization !== expectedAuthorizationBasic) {
		res.send(401, 'Missing basic authorization');
		return next(new Error('Missing basic authorization'));
	}

	return next();
};
