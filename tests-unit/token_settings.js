'use strict';

const config = require('../config');

module.exports = {
	accessTokenSettings: {
		cipherKey: config.accessToken.cipherKey,
		firmKey: config.accessToken.signKey,
		tokenExpirationMinutes: config.accessToken.expiration
	},
	refreshTokenSettings: {
		cipherKey: config.refreshToken.cipherKey,
		firmKey: config.refreshToken.signKey,
		tokenExpirationMinutes: config.refreshToken.expiration
	}
};
