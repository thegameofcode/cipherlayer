const assert = require('assert');
const request = require('request');
const _ = require('lodash');
const ciphertoken = require('ciphertoken');

const dao = require('../../src/managers/dao');
const config = require('../../config');

const crypto = require('../../src/managers/crypto');
const cryptoMng = crypto(config.password);

const versionHeader = 'test/1';

const USER = {
	id: 'a1b2c3d4e5f6',
	username: `validUser${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
	password: 'validPassword123',
	deviceId: 1234567890
};

const OPTIONS_FOR_RENEW = {
	url: `http://localhost:${config.public_port}/auth/renew`,
	headers: {
		[config.version.header]: versionHeader
	},
	method: 'POST',
	json: true
};

describe('/renew', function () {

	beforeEach(function (done) {
		dao.deleteAllUsers(function (err) {
			assert.equal(err, null);
			const userToCreate = _.cloneDeep(USER);
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

	it('POST - 200', function (done) {
		const options = {
			url: `http://localhost:${config.public_port}/auth/login`,
			headers: {
				[config.version.header]: versionHeader
			},
			method: 'POST',
			json: true,
			body: _.cloneDeep(USER)
		};

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 200);
			assert.notEqual(body, null);
			const refreshToken = body.refreshToken;

			const options = _.cloneDeep(OPTIONS_FOR_RENEW);
			options.body = { refreshToken };

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 200, body);
				assert.notEqual(body.accessToken, null);
				return done();
			});
		});
	});

	it('POST - 401 invalid token', function (done) {
		const invalidToken = 'not a valid token :( sorry';
		const options = _.cloneDeep(OPTIONS_FOR_RENEW);
		options.body = {refreshToken: invalidToken};

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 401);

			assert.equal(body.err, 'invalid_token');
			assert.equal(body.des, 'Invalid token');
			return done();
		});
	});

	it('POST - 401 expired token', function (done) {
		const refreshTokenSettings = {
			cipherKey: config.refreshToken.cipherKey,
			firmKey: config.refreshToken.signKey,
			tokenExpirationMinutes: 0
		};
		ciphertoken.createToken(refreshTokenSettings, 'id123', null, {}, function (err, token) {
			assert.equal(err, null);

			const options = _.cloneDeep(OPTIONS_FOR_RENEW);
			options.body = {refreshToken: token};

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 401, body);

				assert.equal(body.err, 'expired_token');
				assert.equal(body.des, 'Expired token');
				return done();
			});
		});
	});

	it('Complete process', function (done) {
		const options = {
			url: `http://localhost:${config.public_port}/auth/login`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: versionHeader
			},
			method: 'POST',
			body: {username: USER.username, password: USER.password, deviceId: USER.deviceId},
			json: true
		};

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 200, body);

			const options = _.cloneDeep(OPTIONS_FOR_RENEW);
			options.body = {refreshToken: body.refreshToken};

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 200, body);

				assert.notEqual(body.accessToken, null);
				return done();
			});
		});
	});
});
