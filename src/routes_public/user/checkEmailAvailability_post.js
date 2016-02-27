'use strict';

var daoMng = require('../../managers/dao');

var _ = require('lodash');

module.exports = function (req, res, next) {
	var email = req.body.email;

	if (_.isEmpty(email)) {
		res.send(400, {
			err: 'BadRequestError',
			des: 'Missing email in request body'
		});
		return next(false);
	}

	daoMng.findByEmail(email, function (error, output) {
		if (error) {
			res.send(error.statusCode, error.body);
			return next(false);
		}

		res.send(200, output);
		return next();
	});
};
