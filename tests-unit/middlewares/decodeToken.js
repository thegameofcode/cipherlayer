'use strict';

const should = require('chai').should();
const ciphertoken = require('ciphertoken');
const config = require('../../config.json');
const decodeToken = require('../../src/middlewares/decodeToken');

var accessTokenSettings = {
	cipherKey: config.accessToken.cipherKey,
	firmKey: config.accessToken.signKey,
	tokenExpirationMinutes: config.accessToken.expiration * 60
};

describe('middleware', function () {
	describe('decodeToken', function () {
		it('OK - lowercase authorization header', function (done) {
			var userId = 'A1B2C3D4';
			var data = {data: 'some data'};
			ciphertoken.createToken(accessTokenSettings, userId, null, data, function (err, accessToken) {
				should.not.exist(err);
				should.exist(accessToken);

				var req = {
					auth: config.authHeaderKey.toLowerCase() + accessToken
				};
				var res = {
					send: function (status) {
						should.not.exist(status);
					}
				};
				var next = function (value) {
					should.not.exist(value);
					req.should.have.property('tokenInfo');
					req.tokenInfo.should.have.property('userId').to.be.equal(userId);
					done();
				};

				decodeToken(req, res, next);
			});
		});

		it('OK - uppercase authorization header', function (done) {
			var userId = 'A1B2C3D4';
			var data = {data: 'some data'};
			ciphertoken.createToken(accessTokenSettings, userId, null, data, function (err, accessToken) {
				should.not.exist(err);
				should.exist(accessToken);

				var req = {
					auth: config.authHeaderKey.toUpperCase() + accessToken
				};
				var res = {
					send: function (status) {
						should.not.exist(status);
					}
				};
				var next = function (value) {
					should.not.exist(value);
					req.should.have.property('tokenInfo');
					req.tokenInfo.should.have.property('userId').to.be.equal(userId);
					done();
				};

				decodeToken(req, res, next);
			});
		});

		it('401 - access token required', function (done) {
			var sendOk = false;
			var req = {};
			var res = {
				send: function (status, body) {
					status.should.be.equal(401);
					body.should.be.deep.equal({err: 'invalid_access_token', des: 'access token required'});
					sendOk = true;
				}
			};
			var next = function (value) {
				value.should.be.equal(false);
				sendOk.should.be.equal(true);
				done();
			};

			decodeToken(req, res, next);
		});

		it('401 - unable to read token info', function (done) {
			var sendOk = false;
			var req = {
				auth: config.authHeaderKey + 'INVALID TOKEN'
			};
			var res = {
				send: function (status, body) {
					status.should.be.equal(401);
					body.should.be.deep.equal({err: 'invalid_access_token', des: 'unable to read token info'});
					sendOk = true;
				}
			};
			var next = function (value) {
				value.should.be.equal(false);
				sendOk.should.be.equal(true);
				done();
			};

			decodeToken(req, res, next);
		});
	});
});
