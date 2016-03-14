'use strict';

const config = require('../../../config');
const userMng = require('../../managers/user');

module.exports = function validateOldPassword(req, res, next) {
	if (!config.password.validateOldPassword) {
		return next();
	}

	if (!req.body.oldPassword) {
		const err = {
			err: 'missing_password',
			des: 'Missing old password validation'
		};
		res.send(400, err);
		return next(err);
	}

	userMng().validateOldPassword(req.user.username, req.body.oldPassword, function (err) {
		if (err) {
			res.send(401, err);
			return next(err);
		}
		return next();
	});
};
