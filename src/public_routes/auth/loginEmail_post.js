'use strict';

var emailManager = require('../../managers/email')();
var config = require(process.cwd() + '/config.json');
var tokenManager = require('../../managers/token');
var daoManager = require('../../managers/dao');

module.exports = function (req, res, next) {

	var email = req.params.email;

	if (!email) {
		res.send(400, {
			err: 'invalid_email',
			des: 'email is required'
		});
		return next(false);
	}

	daoManager.getFromUsername(email, function (err, user) {
		tokenManager.createRefreshToken(user._id, {}, function (err, refreshToken) {
			var link = config.emailVerification.redirectProtocol + '://auth/login/refreshToken?rt=' + refreshToken;
			emailManager.sendEmailMagicLink(email, link, function () {
				res.send(204);
				next();
			});
		});
	});

};
