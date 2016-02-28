const assert = require('assert');
const ciphertoken = require('ciphertoken');
const tokenManager = require('../src/managers/token');
const config = require('../config.json');

describe('token manager', function () {
	describe('createAccessToken', function () {
		it('userId, callback', function (done) {
			var expectedUserId = 'a1b2c3d4e5f6';
			tokenManager.createAccessToken(expectedUserId, function (err, accessToken) {
				assert.equal(err, null);
				assert.notEqual(accessToken, null);

				ciphertoken.getTokenSet(accessTokenSettings, accessToken, function (err, accessTokenInfo) {
					assert.equal(err, null);
					assert.equal(accessTokenInfo.userId, expectedUserId);
					return done();
				});
			});
		});

		it('userId, data, callback', function (done) {
			var expectedUserId = 'a1b2c3d4e5f6';
			var expectedData = {field1: 'value1'};

			tokenManager.createAccessToken(expectedUserId, expectedData, function (err, accessToken) {
				assert.equal(err, null);
				assert.notEqual(accessToken, null);

				ciphertoken.getTokenSet(accessTokenSettings, accessToken, function (err, accessTokenInfo) {
					assert.equal(err, null);
					assert.equal(accessTokenInfo.userId, expectedUserId);
					assert.deepEqual(accessTokenInfo.data, expectedData);

					return done();
				});
			});
		});
	});

	it('getAccessTokenInfo', function (done) {
		var expectedUserId = 'a1b2c3d4e5f6';
		tokenManager.createAccessToken(expectedUserId, function (err, accessToken) {
			assert.equal(err, null);
			assert.notEqual(accessToken, null);

			tokenManager.getAccessTokenInfo(accessToken, function (err, accessTokenInfo) {
				assert.equal(err, null);
				assert.equal(accessTokenInfo.userId, expectedUserId);

				return done();
			});
		});
	});

	describe('createRefreshToken', function () {
		it('userId, callback', function (done) {
			var expectedUserId = 'a1b2c3d4e5f6';
			tokenManager.createRefreshToken(expectedUserId, function (err, refreshToken) {
				assert.equal(err, null);
				assert.notEqual(refreshToken, null);

				ciphertoken.getTokenSet(refreshTokenSettings, refreshToken, function (err, refreshTokenInfo) {
					assert.equal(err, null);
					assert.equal(refreshTokenInfo.userId, expectedUserId);

					return done();
				});
			});
		});

		it('userId, data, callback', function (done) {
			var expectedUserId = 'a1b2c3d4e5f6';
			var expectedData = {field1: 'value1'};
			tokenManager.createRefreshToken(expectedUserId, expectedData, function (err, refreshToken) {
				assert.equal(err, null);
				assert.notEqual(refreshToken, null);

				ciphertoken.getTokenSet(refreshTokenSettings, refreshToken, function (err, refreshTokenInfo) {
					assert.equal(err, null);
					assert.equal(refreshTokenInfo.userId, expectedUserId);
					assert.deepEqual(refreshTokenInfo.data, expectedData);

					return done();
				});
			});
		});
	});

	describe('createBothTokens', function () {
		it('userId, callback', function (done) {
			var expectedUserId = 'a1b2c3d4e5f6';
			tokenManager.createBothTokens(expectedUserId, {}, function (err, tokens) {
				assert.equal(err, null);
				assert.notEqual(tokens, null);

				ciphertoken.getTokenSet(accessTokenSettings, tokens.accessToken, function (err, accessTokenInfo) {
					assert.equal(err, null);
					assert.equal(accessTokenInfo.userId, expectedUserId);

					ciphertoken.getTokenSet(refreshTokenSettings, tokens.refreshToken, function (err, refreshTokenInfo) {
						assert.equal(err, null);
						assert.equal(refreshTokenInfo.userId, expectedUserId);

						return done();
					});
				});
			});
		});
	});
});

var accessTokenSettings = {
	cipherKey: config.accessToken.cipherKey,
	firmKey: config.accessToken.signKey,
	tokenExpirationMinutes: config.accessToken.expiration * 60
};

var refreshTokenSettings = {
	cipherKey: config.refreshToken.cipherKey,
	firmKey: config.refreshToken.signKey,
	tokenExpirationMinutes: config.refreshToken.expiration * 1000
};
