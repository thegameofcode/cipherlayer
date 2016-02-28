'use strict';

const emailManager = require('../../managers/email')();
const config = require('../../../config.json');
const tokenManager = require('../../managers/token');
const daoManager = require('../../managers/dao');

module.exports = function (req, res, next) {

	const email = req.params.email;

	if (!email) {
		res.send(400, {
			err: 'invalid_email',
			des: 'email is required'
		});
		return next();
	}

	daoManager.getFromUsername(email, function (err, user) {
		tokenManager.createRefreshToken(user._id, {}, function (err, refreshToken) {
			const link = `${config.public_url}/auth/login/refreshToken?rt=${refreshToken}`;
			emailManager.sendEmailMagicLink(email, link, function () {
				res.send(204);
				return next();
			});
		});
	});

};
