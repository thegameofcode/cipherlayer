const request = require('request');
const assert = require('assert');
const ciphertoken = require('ciphertoken');
const nock = require('nock');

const dao = require('../../src/managers/dao');
const config = require('../../config.json');

var versionHeader = 'test/1';
const accessTokenSettings = require('../token_settings').accessTokenSettings;

describe('Protected calls standard', () => {

	beforeEach(function (done) {
		dao.deleteAllUsers(function (err) {
			assert.equal(err, null);
			done();
		});
	});

	it('401 Unauthorized', function (done) {
		var expectedBody = {field1: 'value1', field2: 'value2'};

		var options = {
			url: 'http://localhost:' + config.public_port + '/api/standard',
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: 'POST',
			body: JSON.stringify(expectedBody)
		};
		options.headers[config.version.header] = versionHeader;

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 401);
			assert.notEqual(body, undefined);
			done();
		});
	});

	it('200 without platforms', function (done) {
		var user = {
			id: 'a1b2c3d4e5f6',
			username: "valid" + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''),
			password: "12345678"
		};

		dao.addUser()(user, function (err, createdUser) {
			assert.equal(err, null);

			ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {
				var expectedBody = {field1: 'value1', field2: 'value2'};

				nock('http://' + config.private_host + ':' + config.private_port, {
					reqheaders: {
						'x-user-id': createdUser._id,
						'content-type': 'application/json; charset=utf-8'
					}
				})
					.post('/api/standard', expectedBody)
					.reply(200, {field3: 'value3'});

				var options = {
					url: 'http://localhost:' + config.public_port + '/api/standard',
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'Authorization': 'bearer ' + loginToken
					},
					method: 'POST',
					body: JSON.stringify(expectedBody)
				};
				options.headers[config.version.header] = versionHeader;

				request(options, function (err, res, body) {
					assert.equal(err, null);
					assert.equal(res.statusCode, 200, body);
					assert.notEqual(body, undefined);
					done();
				});
			});
		});
	});

	it('body response is not a json', function (done) {
		var user = {
			id: 'a1b2c3d4e5f6',
			username: "valid" + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''),
			password: "12345678"
		};

		dao.addUser()(user, function (err, createdUser) {
			assert.equal(err, null);

			ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {
				var expectedBody = {field1: 'value1', field2: 'value2'};

				nock('http://' + config.private_host + ':' + config.private_port, {
					reqheaders: {
						'x-user-id': createdUser._id,
						'content-type': 'application/json; charset=utf-8'
					}
				})
					.post('/api/standard', expectedBody)
					.reply(200, 'not a json');

				var options = {
					url: 'http://localhost:' + config.public_port + '/api/standard',
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'Authorization': 'bearer ' + loginToken
					},
					method: 'POST',
					body: JSON.stringify(expectedBody)
				};
				options.headers[config.version.header] = versionHeader;

				request(options, function (err, res, body) {
					assert.equal(err, null);
					assert.equal(res.statusCode, 200, body);
					assert.notEqual(body, undefined);
					done();
				});
			});
		});
	});

});
