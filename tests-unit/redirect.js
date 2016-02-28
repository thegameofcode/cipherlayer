var assert = require('assert');
var nock = require('nock');
var request = require('request');
var ciphertoken = require('ciphertoken');
var dao = require('../src/managers/dao.js');
var config = require('../config.json');

var accessTokenSettings = {
	cipherKey: config.accessToken.cipherKey,
	firmKey: config.accessToken.signKey,
	tokenExpirationMinutes: config.accessToken.expiration * 60
};

var versionHeader = 'test/1';

describe('redirect', function () {

	beforeEach(dao.deleteAllUsers);

	it('OK', function (done) {

		var redirectURL = 'http://www.google.es';

		var expectedUser = {
			id: 'a1b2c3d4e5f6',
			username: 'user1' + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''),
			password: 'pass1'
		};
		dao.addUser()(expectedUser, function (err, createdUser) {
			assert.equal(err, null);
			assert.notEqual(createdUser, null);

			ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {

				var options = {
					url: 'http://localhost:' + config.public_port + '/whatever',
					method: 'POST',
					followRedirect: false,
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'Authorization': 'bearer ' + loginToken
					}
				};
				options.headers[config.version.header] = versionHeader;

				nock('http://' + config.private_host + ':' + config.private_port)
					.post('/whatever')
					.reply(302, 'Redirecting', {
						'Location': redirectURL
					});

				request(options, function (err, res, body) {
					assert.equal(err, null, body);
					assert.equal(res.statusCode, 302, body);
					assert.equal(res.headers.location, redirectURL, 'Bad redirect URL');
					done();
				});
			});

		});

	});
});
