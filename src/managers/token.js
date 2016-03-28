'use strict';

const async = require('async');
const isFunction = require('lodash/isFunction');
const ciphertoken = require('ciphertoken');
const config = require('../../config');

const accessTokenSettings = {
	cipherKey: config.accessToken.cipherKey,
	firmKey: config.accessToken.signKey,
	tokenExpirationMinutes: config.accessToken.expiration * 60
};

const refreshTokenSettings = {
	cipherKey: config.refreshToken.cipherKey,
	firmKey: config.refreshToken.signKey,
	tokenExpirationMinutes: 1440 * 1000
};

function createAccessToken(userId, dataIn, cbkIn) {
	let data = dataIn;
	let cbk = cbkIn;
	if (isFunction(dataIn)) {
		cbk = data;
		data = {};
	}

	ciphertoken.createToken(accessTokenSettings, userId, null, data, cbk);
}

function getAccessTokenInfo(accessToken, cbk) {
	ciphertoken.getTokenSet(accessTokenSettings, accessToken, cbk);
}

function getRefreshTokenInfo(refreshToken, cbk) {
	ciphertoken.getTokenSet(refreshTokenSettings, refreshToken, cbk);
}

function createRefreshToken(userId, dataIn, cbkIn) {
	let data = dataIn;
	let cbk = cbkIn;
	if (isFunction(dataIn)) {
		cbk = data;
		data = {};
	}
	ciphertoken.createToken(refreshTokenSettings, userId, null, data, cbk);
}

function createBothTokens(userId, data, cbk) {
	const tokens = {};

	async.parallel([
		function (done) {
			createAccessToken(userId, data, function (err, token) {
				tokens.accessToken = token;
				return done(err);
			});
		},
		function (done) {
			createRefreshToken(userId, data, function (err, token) {
				tokens.refreshToken = token;
				return done(err);
			});
		}
	], function (err) {
		cbk(err, tokens);
	});
}

module.exports = {
	createAccessToken,
	getAccessTokenInfo,
	createRefreshToken,
	createBothTokens,
	getRefreshTokenInfo
};
