'use strict';

var config = require('../../config.json');

module.exports = function checkAuthBasic(req, res, next) {
	var expectedAuthorizationBasic = `basic ${new Buffer(`${config.management.clientId}:${config.management.clientSecret}`).toString('base64')}`;
	if (req.headers.authorization !== expectedAuthorizationBasic) {
		res.send(401, 'Missing basic authorization');
		return next(false);
	}

	return next();
};
