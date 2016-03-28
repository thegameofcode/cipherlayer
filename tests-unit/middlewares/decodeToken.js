'use strict';

const assert = require('assert');
const should = require('chai').should();
const ciphertoken = require('ciphertoken');
const config = require('../../config');
const decodeToken = require('../../src/middlewares/decodeToken');

const accessTokenSettings = {
	cipherKey: config.accessToken.cipherKey,
	firmKey: config.accessToken.signKey,
	tokenExpirationMinutes: config.accessToken.expiration * 60
};

describe('middleware', function () {
	describe('decodeToken', function () {
		it('OK - lowercase authorization header', function (done) {
			const userId = 'A1B2C3D4';
			const data = {data: 'some data'};
			ciphertoken.createToken(accessTokenSettings, userId, null, data, function (err, accessToken) {
				should.not.exist(err);
				should.exist(accessToken);

				const req = {
					auth: config.authHeaderKey.toLowerCase() + accessToken
				};
				const res = {
					send: status => should.not.exist(status)
				};
				const next = function (value) {
					should.not.exist(value);
					req.should.have.property('tokenInfo');
					req.tokenInfo.should.have.property('userId').to.be.equal(userId);
					return done();
				};

				decodeToken(req, res, next);
			});
		});

		it('OK - uppercase authorization header', function (done) {
			const userId = 'A1B2C3D4';
			const data = {data: 'some data'};
			ciphertoken.createToken(accessTokenSettings, userId, null, data, function (err, accessToken) {
				should.not.exist(err);
				should.exist(accessToken);

				const req = {
					auth: config.authHeaderKey.toUpperCase() + accessToken
				};
				const res = {
					send: status => should.not.exist(status)
				};
				const next = function (value) {
					should.not.exist(value);
					req.should.have.property('tokenInfo');
					req.tokenInfo.should.have.property('userId').to.be.equal(userId);
					return done();
				};

				decodeToken(req, res, next);
			});
		});

		it('401 - access token required', function (done) {
			let sendOk = false;
			const req = {};
			const res = {
				send: (status, body) => {
					status.should.be.equal(401);
					body.should.be.deep.equal({err: 'invalid_access_token', des: 'access token required'});
					sendOk = true;
				}
			};
			const next = function (err) {
				should.exist(err);
				assert.equal(err.err, 'invalid_access_token');
				sendOk.should.be.equal(true);
				return done();
			};

			decodeToken(req, res, next);
		});

		it('401 - unable to read token info', function (done) {
			let sendOk = false;
			const req = {
				auth: `${config.authHeaderKey}INVALID TOKEN`
			};
			const res = {
				send: (status, body) => {
					status.should.be.equal(401);
					body.should.be.deep.equal({err: 'invalid_access_token', des: 'unable to read token info'});
					sendOk = true;
				}
			};
			const next = function (err) {
				should.exist(err);
				assert.equal(err.err, 'Bad token');
				sendOk.should.be.equal(true);
				return done();
			};

			decodeToken(req, res, next);
		});
	});
});
