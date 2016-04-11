'use strict';

const assert = require('assert');
const _ = require('lodash');
const request = require('request');
const config = require('../../config');
const dao = require('../../src/managers/dao');
const should = require('chai').should();
const nock = require('nock');

const crypto = require('../../src/managers/crypto');
const cryptoMng = crypto(config.password);

const versionHeader = 'test/1';

const accessTokenSettings = require('../token_settings').accessTokenSettings;

describe('/logout', function () {
	const baseUser = {
		id: 'a1b2c3d4e5f6',
		username: `validuser${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
		password: 'validpassword',
		deviceId: '1234567890'
	};

	beforeEach(function (done) {
		dao.deleteAllUsers(function (err) {
			assert.equal(err, null);
			const userToCreate = _.clone(baseUser);
			cryptoMng.encrypt(userToCreate.password, function (encryptedPwd) {
				userToCreate.password = encryptedPwd;
				dao.addUser(userToCreate, function (err, createdUser) {
					assert.equal(err, null);
					assert.notEqual(createdUser, undefined);
					return done();
				});
			});
		});
	});

	function doLogin () {
		return new Promise(function (ok) {
			const user = _.clone(baseUser);
			const options = {
				url: `http://localhost:${config.public_port}/auth/login`,
				headers: {
					[config.version.header]: versionHeader
				},
				method: 'POST',
				body: user,
				json: true
			};

			request(options, function (err, res, body) {
				should.not.exist(err);
				res.statusCode.should.equal(200);
				body.should.have.property('accessToken');
				body.expiresIn.should.equal(accessTokenSettings.tokenExpirationMinutes);
				ok(body.accessToken);
			});
		});
	}

	it('POST 204', function (done) {
		doLogin().then(function (accessToken) {
			const options = {
				url: `http://localhost:${config.public_port}/auth/logout`,
				method: 'POST',
				headers: {
					Authorization: `bearer ${accessToken}`,
					[config.version.header]: versionHeader
				},
				json: true
			};

			nock(`http://${config.private_host}:${config.private_port}`).delete('/api/me/session').reply(200);

			request(options, function (err, res, body) {
				should.not.exist(err);
				res.statusCode.should.equal(204, body);
				return done();
			});
		});
	});

	it('POST 500 no sesion service', function (done) {
		doLogin().then(function (accessToken) {
			const options = {
				url: `http://localhost:${config.public_port}/auth/logout`,
				method: 'POST',
				headers: {
					Authorization: `bearer ${accessToken}`,
					[config.version.header]: versionHeader
				},
				json: true
			};

			request(options, function (err, res, body) {
				should.not.exist(err);
				res.statusCode.should.equal(500);
				body.should.have.property('err').to.be.equal('internal_session_error');
				body.should.have.property('des').to.be.equal('unable to close session');
				return done();
			});
		});
	});

	it('POST 401 invalid access token', function (done) {
		const options = {
			url: `http://localhost:${config.public_port}/auth/logout`,
			method: 'POST',
			headers: {
				Authorization: 'bearer INVALID_TOKEN',
				[config.version.header]: versionHeader
			},
			json: true
		};

		request(options, function (err, res, body) {
			should.not.exist(err);
			res.statusCode.should.equal(401);
			body.should.have.property('err').to.be.equal('invalid_access_token');
			body.should.have.property('des').to.be.equal('unable to read token info');
			return done();
		});
	});

	it('POST 401 no authorization header', function (done) {
		const options = {
			url: `http://localhost:${config.public_port}/auth/logout`,
			method: 'POST',
			headers: {
				[config.version.header]: versionHeader
			},
			json: true
		};

		request(options, function (err, res, body) {
			should.not.exist(err);
			res.statusCode.should.equal(401);
			body.should.have.property('err').to.be.equal('invalid_authorization');
			body.should.have.property('des').to.be.equal('required authorization header');
			return done();
		});
	});

	it('POST 401 invalid authorization header identifier', function (done) {
		const options = {
			url: `http://localhost:${config.public_port}/auth/logout`,
			method: 'POST',
			headers: {
				Authorization: 'wrong bearer TOKEN',
				[config.version.header]: versionHeader
			},
			json: true
		};

		request(options, function (err, res, body) {
			should.not.exist(err);
			res.statusCode.should.equal(401);
			body.should.have.property('err').to.be.equal('invalid_authorization');
			body.should.have.property('des').to.be.equal('invalid authorization type');
			return done();
		});
	});
});
