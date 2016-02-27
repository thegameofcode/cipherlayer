'use strict';

const config = require('../../../config.json');
const userMng = require('../../managers/user');

module.exports = function validateOldPassword(req, res, next) {
	var err;
	if (!config.password.validateOldPassword) {
		return next();
	}

	if (!req.body.oldPassword) {
		err = {
			err: 'missing_password',
			des: 'Missing old password validation'
		};
		res.send(400, err);
		return next(false);
	}

	userMng().validateOldPassword(req.user.username, req.body.oldPassword, function (err) {
		if (err) {
			res.send(401, err);
			return next(false);
		}
		return next();
	});
};
