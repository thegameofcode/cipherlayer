const assert = require('assert');
const nock = require('nock');
const request = require('request');
const ciphertoken = require('ciphertoken');
const dao = require('../src/managers/dao');
const config = require('../config.json');

const accessTokenSettings = {
	cipherKey: config.accessToken.cipherKey,
	firmKey: config.accessToken.signKey,
	tokenExpirationMinutes: config.accessToken.expiration * 60
};

const versionHeader = 'test/1';

describe('redirect', function () {

	beforeEach(dao.deleteAllUsers);

	it('OK', function (done) {

		const redirectURL = 'http://www.google.es';

		const expectedUser = {
			id: 'a1b2c3d4e5f6',
			username: `user1${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
			password: 'pass1'
		};
		dao.addUser(expectedUser, function (err, createdUser) {
			assert.equal(err, null);
			assert.notEqual(createdUser, null);

			ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {

				const options = {
					url: `http://localhost:${config.public_port}/whatever`,
					method: 'POST',
					followRedirect: false,
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						Authorization: `bearer ${loginToken}`,
						[config.version.header]: versionHeader
					}
				};

				nock(`http://${config.private_host}:${config.private_port}`)
					.post('/whatever')
					.reply(302, 'Redirecting', { Location: redirectURL });

				request(options, function (err, res, body) {
					assert.equal(err, null, body);
					assert.equal(res.statusCode, 302, body);
					assert.equal(res.headers.location, redirectURL, 'Bad redirect URL');
					return done();
				});
			});

		});

	});
});
