'use strict';

const assert = require('assert');
const request = require('request');
const ciphertoken = require('ciphertoken');
const config = require('../../config.json');
const dao = require('../../src/managers/dao');
const nock = require('nock');
const _ = require('lodash');
const crypto = require('../../src/managers/crypto');
const cryptoMng = crypto(config.password);

const versionHeader = 'test/1';

const accessTokenSettings = require('../token_settings').accessTokenSettings;
const refreshTokenSettings = require('../token_settings').refreshTokenSettings;

describe('/login', function () {
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
	it('POST 200', function (done) {
		const user = _.clone(baseUser);
		const options = {
			url: `http://localhost:${config.public_port}/auth/login`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: versionHeader
			},
			method: 'POST',
			body: JSON.stringify(user)
		};

		nock(`http://localhost:${config.private_port}`)
			.post('/api/me/session')
			.reply(204);

		request(options, function (err, res, rawBody) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 200, rawBody);
			const body = JSON.parse(rawBody);
			assert.notEqual(body.accessToken, undefined);
			assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
			ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function (err, accessTokenInfo) {
				assert.equal(err, null);
				assert.equal(accessTokenInfo.userId, user.id);
				assert.equal(accessTokenInfo.data.deviceId, user.deviceId);
				assert.notEqual(body.refreshToken, undefined);
				ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function (err, refreshTokenInfo) {
					assert.equal(err, null);
					assert.equal(refreshTokenInfo.userId, user.id);
					assert.equal(accessTokenInfo.data.deviceId, user.deviceId);
					return done();
				});
			});
		});
	});
	it('POST 409 invalid credentials', function (done) {
		const user = _.clone(baseUser);
		user.password = 'invalidpassword';
		const options = {
			url: `http://localhost:${config.public_port}/auth/login`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: versionHeader
			},
			method: 'POST',
			body: JSON.stringify(user)
		};

		request(options, function (err, res, rawBody) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 409);
			const body = JSON.parse(rawBody);
			assert.notEqual(body.err, 'invalid_credentials');
			return done();
		});
	});

	it('POST 409 username substring', function (done) {
		const user = _.clone(baseUser);
		const username = user.username;
		user.username = username.slice(0, username.length / 2);
		const options = {
			url: `http://localhost:${config.public_port}/auth/login`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: versionHeader
			},
			method: 'POST',
			body: JSON.stringify(user)
		};

		request(options, function (err, res, rawBody) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 409);
			const body = JSON.parse(rawBody);
			assert.notEqual(body.err, 'invalid_credentials');
			return done();
		});
	});
});


