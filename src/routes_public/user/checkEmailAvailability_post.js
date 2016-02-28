'use strict';

const daoMng = require('../../managers/dao');

const _ = require('lodash');

module.exports = function (req, res, next) {
	const email = req.body.email;

	if (_.isEmpty(email)) {
		res.send(400, {
			err: 'BadRequestError',
			des: 'Missing email in request body'
		});
		return next();
	}

	daoMng.findByEmail(email, function (error, output) {
		if (error) {
			res.send(error.statusCode, error.body);
			return next();
		}

		res.send(200, output);
		return next();
	});
};
