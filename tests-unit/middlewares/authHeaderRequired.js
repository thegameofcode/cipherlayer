'use strict';

const _ = require('lodash');
const should = require('chai').should();
const config = require('../../config');
const authHeaderRequired = require('../../src/middlewares/authHeaderRequired');

describe('middleware', function () {
	describe('authHeaderRequired', function () {
		it('OK - lowercase authorization header', function (done) {
			const accessToken = 'A1B2C3D4E5F6G7H8I9J0K';

			const req = {
				header(header) {
					if (header.toLowerCase() === 'authorization') {
						return config.authHeaderKey.toLowerCase() + accessToken;
					}
				}
			};
			const res = {
				send: status => should.not.exist(status)
			};
			const next = function (value) {
				should.not.exist(value);
				req.should.have.property('auth').to.equal(config.authHeaderKey.toLowerCase() + accessToken);
				return done();
			};

			authHeaderRequired(req, res, next);
		});

		it('OK - uppercase authorization header', function (done) {
			const accessToken = 'A1B2C3D4E5F6G7H8I9J0K';

			const req = {
				header(header) {
					if (header.toLowerCase() === 'authorization') {
						return config.authHeaderKey.toUpperCase() + accessToken;
					}
				}
			};
			const res = {
				send: status => should.not.exist(status)
			};
			const next = function (value) {
				should.not.exist(value);
				req.should.have.property('auth').to.equal(config.authHeaderKey.toLowerCase() + accessToken);
				return done();
			};

			authHeaderRequired(req, res, next);
		});

		it('401 - no authorization header', function (done) {
			const req = {
				header() {
					return null;
				}
			};
			const res = {
				send(status, body) {
					status.should.equal(401);
					body.should.deep.equal({
						err: 'invalid_authorization',
						des: 'required authorization header'
					});
				}
			};
			const next = function (err) {
				should.exist(err);
				should.equal(err.err, 'invalid_authorization');
				should.not.exist(req.auth);
				return done();
			};

			authHeaderRequired(req, res, next);
		});

		it('401 - invalid authorization type', function (done) {
			const accessToken = 'A1B2C3D4E5F6G7H8I9J0K';
			const randomHeaderType = _.repeat('*', _.trim(config.authHeaderKey).length);

			const req = {
				header(header) {
					if (header.toLowerCase() === 'authorization') {
						return `${randomHeaderType} ${accessToken}`;
					}
				}
			};
			const res = {
				send(status, body) {
					status.should.equal(401);
					body.should.deep.equal({
						err: 'invalid_authorization',
						des: 'invalid authorization type'
					});
				}
			};
			const next = function (err) {
				should.exist(err);
				should.not.exist(req.auth);
				return done();
			};

			authHeaderRequired(req, res, next);
		});

		it('401 - no authorization value', function (done) {
			const req = {
				header(header) {
					if (header.toLowerCase() === 'authorization') {
						return _.trim(config.authHeaderKey);
					}
				}
			};
			const res = {
				send(status, body) {
					status.should.equal(401);
					body.should.deep.equal({
						err: 'invalid_authorization',
						des: 'no authorization value'
					});
				}
			};
			const next = function (value) {
				should.exist(value);
				should.not.exist(req.auth);
				return done();
			};

			authHeaderRequired(req, res, next);
		});

	});
});
