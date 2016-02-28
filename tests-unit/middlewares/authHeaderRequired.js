'use strict';

const _ = require('lodash');
const should = require('chai').should();
const config = require('../../config.json');
const authHeaderRequired = require('../../src/middlewares/authHeaderRequired');

describe('middleware', function () {
	describe('authHeaderRequired', function () {
		it('OK - lowercase authorization header', function (done) {
			var accessToken = 'A1B2C3D4E5F6G7H8I9J0K';

			var req = {
				header: function (header) {
					if (header.toLowerCase() === 'authorization') {
						return config.authHeaderKey.toLowerCase() + accessToken;
					}
				}
			};
			var res = {
				send: function (status) {
					should.not.exist(status);
				}
			};
			var next = function (value) {
				should.not.exist(value);
				req.should.have.property('auth').to.equal(config.authHeaderKey.toLowerCase() + accessToken);
				return done();
			};

			authHeaderRequired(req, res, next);
		});

		it('OK - uppercase authorization header', function (done) {
			var accessToken = 'A1B2C3D4E5F6G7H8I9J0K';

			var req = {
				header: function (header) {
					if (header.toLowerCase() === 'authorization') {
						return config.authHeaderKey.toUpperCase() + accessToken;
					}
				}
			};
			var res = {
				send: function (status) {
					should.not.exist(status);
				}
			};
			var next = function (value) {
				should.not.exist(value);
				req.should.have.property('auth').to.equal(config.authHeaderKey.toLowerCase() + accessToken);
				return done();
			};

			authHeaderRequired(req, res, next);
		});

		it('401 - no authorization header', function (done) {
			var req = {
				header: function () {
					return null;
				}
			};
			var res = {
				send: function (status, body) {
					status.should.equal(401);
					body.should.deep.equal({
						err: 'invalid_authorization',
						des: 'required authorization header'
					});
				}
			};
			var next = function (err) {
				should.exist(err);
				should.equal(err.err, 'invalid_authorization');
				should.not.exist(req.auth);
				return done();
			};

			authHeaderRequired(req, res, next);
		});

		it('401 - invalid authorization type', function (done) {
			var accessToken = 'A1B2C3D4E5F6G7H8I9J0K';
			var randomHeaderType = _.repeat('*', _.trim(config.authHeaderKey).length);

			var req = {
				header: function (header) {
					if (header.toLowerCase() === 'authorization') {
						return randomHeaderType + ' ' + accessToken;
					}
				}
			};
			var res = {
				send: function (status, body) {
					status.should.equal(401);
					body.should.deep.equal({
						err: 'invalid_authorization',
						des: 'invalid authorization type'
					});
				}
			};
			var next = function (err) {
				should.exist(err);
				should.not.exist(req.auth);
				return done();
			};

			authHeaderRequired(req, res, next);
		});

		it('401 - no authorization value', function (done) {
			var req = {
				header: function (header) {
					if (header.toLowerCase() === 'authorization') {
						return _.trim(config.authHeaderKey);
					}
				}
			};
			var res = {
				send: function (status, body) {
					status.should.equal(401);
					body.should.deep.equal({
						err: 'invalid_authorization',
						des: 'no authorization value'
					});
				}
			};
			var next = function (value) {
				should.exist(value);
				should.not.exist(req.auth);
				return done();
			};

			authHeaderRequired(req, res, next);
		});

	});
});
