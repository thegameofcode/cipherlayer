'use strict';

const emailManager = require('../../managers/email')();
const config = require('../../../config');
const tokenManager = require('../../managers/token');
const daoManager = require('../../managers/dao');
const logger = require('../../logger/service');

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
		if (err) {
			logger.error({err});
			res.send(400, {err: 'invalid_email', des: 'email is not valid'});
			return next(false);
		}

		tokenManager.createRefreshToken(user._id, {}, function (err, refreshToken) {
			if (err) {
				logger.error({err});
				res.send(500, {err: 'internal error', des: 'error creating magic link token'});
				return next(false);
			}

			const link = `${config.public_url}/auth/login/refreshToken?rt=${refreshToken}`;
			emailManager.sendEmailMagicLink(email, link, err => {
				if (err) {
					logger.error({err});
					res.send(500, {err: 'internal error', des: 'error sending magic link email'});
					return next(false);
				}

				res.send(204);
				return next();
			});
		});
	});

};
