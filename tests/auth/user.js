var assert = require('assert');
var request = require('request');
var ciphertoken = require('ciphertoken');
var async = require('async');
var crypto = require('crypto');
var nock = require('nock');
var _ = require('lodash');

var config = require('../../config.json');
var dao = require('../../src/managers/dao.js');

var redisMng = require('../../src/managers/redis');

var versionHeader;

module.exports = {
	describe: function () {
		describe('/user', function () {

			beforeEach(function (done) {
				if(config.version){
					var platform = Object.keys(config.version.platforms)[0];
					var version = Object.keys(platform)[1];
					versionHeader = platform + '/' + version;
				}

				dao.deleteAllUsers(function (err) {
					assert.equal(err, null);
					done();
				});
			});

			it('POST 201 created', function (done) {
				var options = {
					url: 'http://' + config.private_host + ':' + config.public_port + '/auth/user',
					headers: HEADERS_WITH_AUTHORIZATION_BASIC,
					method: 'POST',
					body: JSON.stringify({username: username, password: password, phone: phone})
				};
				options.headers[config.version.header] = versionHeader;

				request(options, function (err, res, body) {
					assert.equal(err, null);
					assert.equal(res.statusCode, 201, body);
					body = JSON.parse(body);
					assert.equal(body.username, username);
					assert.equal(body.password, undefined);
					done();
				});
			});

			it('401 Not authorized when trying to POST to /auth/user without basic authorization', function (done) {
				var options = {
					url: 'http://' + config.private_host + ':' + config.public_port + '/auth/user',
					headers: HEADERS_WITHOUT_AUTHORIZATION_BASIC,
					method: 'POST',
					body: JSON.stringify({username: username, password: password})
				};
				options.headers[config.version.header] = versionHeader;

				request(options, function (err, res) {
					assert.equal(err, null);
					assert.equal(res.statusCode, 401);
					done();
				});
			});

			it('POST 409 already exists', function (done) {
				dao.addUser()(USER, function (err, createdUser) {
					assert.equal(err, null);
					assert.notEqual(createdUser, null);

					var options = {
						url: 'http://' + config.private_host + ':' + config.public_port + '/auth/user',
						headers: HEADERS_WITH_AUTHORIZATION_BASIC,
						method: 'POST',
						body: JSON.stringify({username: USER.username, password: USER.password})
					};
					options.headers[config.version.header] = versionHeader;

					request(options, function (err, res, body) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 409);
						body = JSON.parse(body);
						assert.equal(body.err, 'username_already_exists');
						done();
					});
				});
			});

			it('401 Not authorized when trying to POST an existing user without basic auth', function (done) {
				dao.addUser()(USER, function (err, createdUser) {
					assert.equal(err, null);
					assert.notEqual(createdUser, null);

					var options = {
						url: 'http://' + config.private_host + ':' + config.public_port + '/auth/user',
						headers: HEADERS_WITHOUT_AUTHORIZATION_BASIC,
						method: 'POST',
						body: JSON.stringify({username: USER.username, password: USER.password})
					};

					request(options, function (err, res) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 401);
						done();
					});
				});
			});

			it('DELETE 204', function (done) {
				dao.addUser()(USER, function (err, createdUser) {
					assert.equal(err, null);
					assert.notEqual(createdUser, null);

					var options = {
						url: 'http://' + config.private_host + ':' + config.public_port + '/auth/user',
						headers: HEADERS_WITH_AUTHORIZATION_BASIC,
						method: 'DELETE'
					};

					request(options, function (err, res, body) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 204);
						assert.equal(body, '');

						dao.countUsers(function (err, count) {
							assert.equal(err, null);
							assert.equal(count, 0);
							done();
						});
					});
				});
			});

			it('401 Not authorized when trying to delete without basic authorization', function (done) {
				dao.addUser()(USER, function (err, createdUser) {
					assert.equal(err, null);
					assert.notEqual(createdUser, null);

					var options = {
						url: 'http://' + config.private_host + ':' + config.public_port + '/auth/user',
						headers: HEADERS_WITHOUT_AUTHORIZATION_BASIC,
						method: 'DELETE'
					};

					request(options, function (err, res) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 401);

						dao.countUsers(function (err, count) {
							assert.equal(err, null);
							assert.equal(count, 1);
						});

						options.headers = HEADERS_WITH_AUTHORIZATION_BASIC;
						request(options, function (err) {
							assert.equal(err, null);
							dao.countUsers(function (err, count) {
								assert.equal(err, null);
								assert.equal(count, 0);
								done();
							});
						});
					});
				});
			});

			var tokenSettings = {
				cipherKey: config.accessToken.cipherKey,
				firmKey: config.accessToken.signKey,
				tokenExpirationMinutes: config.accessToken.expiration * 60
			};

			describe('/user/activate', function () {

				beforeEach(function (done) {
					async.series([
						function (done) {
							redisMng.connect(done);
						},
						function (done) {
							redisMng.deleteAllKeys(done);
						}
					], done);
				});

				it('Create OK (iOS device) ', function (done) {
					var transactionId = crypto.pseudoRandomBytes(12).toString('hex');

					var bodyData = {
						firstName: 'Firstname',
						lastName: 'Lastname',
						password: password,
						country: 'US',
						phone: phone,
						email: username,
						transactionId: transactionId
					};

					var redisKey = config.emailVerification.redis.key;
					redisKey = redisKey.replace('{username}', bodyData.email);
					var redisExp = config.emailVerification.redis.expireInSec;

					redisMng.insertKeyValue(redisKey, transactionId, redisExp, function (err) {
						assert.equal(err, null);

						ciphertoken.createToken(tokenSettings, username, null, bodyData, function (err, token) {
							assert.equal(err, null);

							var options = {
								url: 'http://' + config.private_host + ':' + config.public_port + '/user/activate?verifyToken=' + token,
								method: 'GET',
								headers: {},
								followRedirect: false
							};
							options.headers['user-agent'] = "Apple-iPhone5C2/1001.525";

							nock('http://' + config.private_host + ':' + config.private_port)
								.post(config.passThroughEndpoint.path)
								.reply(201, {id: USER.id});

							request(options, function (err, res, body) {
								assert.equal(err, null);
								assert.equal(res.statusCode, 302, body);
								assert.notEqual(res.headers.location.indexOf(config.emailVerification.scheme + '://user/refreshToken/'), -1);
								done();
							});
						});

					});
				});

				it('Create OK (Android device) ', function (done) {
					var transactionId = crypto.pseudoRandomBytes(12).toString('hex');

					var bodyData = {
						firstName: 'Firstname',
						lastName: 'Lastname',
						password: password,
						country: 'US',
						phone: phone,
						email: username,
						transactionId: transactionId
					};

					var redisKey = config.emailVerification.redis.key;
					redisKey = redisKey.replace('{username}', bodyData.email);
					var redisExp = config.emailVerification.redis.expireInSec;

					redisMng.insertKeyValue(redisKey, transactionId, redisExp, function (err) {
						assert.equal(err, null);

						ciphertoken.createToken(tokenSettings, username, null, bodyData, function (err, token) {
							assert.equal(err, null);

							var options = {
								url: 'http://' + config.private_host + ':' + config.public_port + '/user/activate?verifyToken=' + token,
								method: 'GET',
								headers: {},
								followRedirect: false
							};
							options.headers['user-agent'] = "Mozilla/5.0 (Linux; U; Android 2.2; nb-no; HTC Desire Build/FRF91)";

							nock('http://' + config.private_host + ':' + config.private_port)
								.post(config.passThroughEndpoint.path)
								.reply(201, {id: USER.id});

							request(options, function (err, res, body) {
								assert.equal(err, null);
								assert.equal(res.statusCode, 302, body);
								assert.notEqual(res.headers.location.indexOf('intent://user/refreshToken/'), -1);
								done();
							});
						});

					});
				});

				it('Create OK (not an iOS or Android device) without redirect option ', function (done) {
					var transactionId = crypto.pseudoRandomBytes(12).toString('hex');
					var thisConfig = _.clone(config);
					thisConfig.emailVerification.redirectUrl = null;

					var bodyData = {
						firstName: 'Firstname',
						lastName: 'Lastname',
						password: password,
						country: 'US',
						phone: phone,
						email: username,
						transactionId: transactionId
					};

					var redisKey = thisConfig.emailVerification.redis.key;
					redisKey = redisKey.replace('{username}', bodyData.email);
					var redisExp = thisConfig.emailVerification.redis.expireInSec;

					redisMng.insertKeyValue(redisKey, transactionId, redisExp, function (err) {
						assert.equal(err, null);

						ciphertoken.createToken(tokenSettings, username, null, bodyData, function (err, token) {
							assert.equal(err, null);

							var options = {
								url: 'http://' + thisConfig.private_host + ':' + thisConfig.public_port + '/user/activate?verifyToken=' + token,
								method: 'GET',
								headers: {},
								followRedirect: false
							};
							options.headers['user-agent'] = "Mozilla/5.0";

							nock('http://' + thisConfig.private_host + ':' + thisConfig.private_port)
								.post(thisConfig.passThroughEndpoint.path)
								.reply(201, {id: USER.id});

							request(options, function (err, res, body) {
								assert.equal(err, null);
								assert.equal(res.statusCode, 200, body);
								body = JSON.parse(body);
								assert.deepEqual(body, {msg: thisConfig.emailVerification.nonCompatibleEmailMsg});
								done();
							});
						});

					});
				});

				it('Create OK (not an iOS or Android device) with redirect option', function (done) {
					var transactionId = crypto.pseudoRandomBytes(12).toString('hex');
					var thisConfig = _.clone(config);
					thisConfig.emailVerification.redirectUrl = 'http://www.google.com';

					var bodyData = {
						firstName: 'Firstname',
						lastName: 'Lastname',
						password: password,
						country: 'US',
						phone: phone,
						email: username,
						transactionId: transactionId
					};

					var redisKey = thisConfig.emailVerification.redis.key;
					redisKey = redisKey.replace('{username}', bodyData.email);
					var redisExp = thisConfig.emailVerification.redis.expireInSec;

					redisMng.insertKeyValue(redisKey, transactionId, redisExp, function (err) {
						assert.equal(err, null);

						ciphertoken.createToken(tokenSettings, username, null, bodyData, function (err, token) {
							assert.equal(err, null);

							var options = {
								url: 'http://' + thisConfig.private_host + ':' + thisConfig.public_port + '/user/activate?verifyToken=' + token,
								method: 'GET',
								headers: {},
								followRedirect: false
							};
							options.headers['user-agent'] = "Mozilla/5.0";

							nock('http://' + thisConfig.private_host + ':' + thisConfig.private_port)
								.post(thisConfig.passThroughEndpoint.path)
								.reply(201, {id: USER.id});

							request(options, function (err, res, body) {
								assert.equal(err, null);
								assert.equal(res.statusCode, 301, body);
								assert.equal(res.headers.location, thisConfig.emailVerification.redirectUrl);
								done();
							});
						});

					});
				});

				it('No verify token param', function (done) {
					var expectedResponseBody = {
						err: 'auth_proxy_error',
						des: 'empty param verifyToken'
					};

					var options = {
						url: 'http://' + config.private_host + ':' + config.public_port + '/user/activate',
						method: 'GET'
					};

					request(options, function (err, res, body) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 400, body);
						body = JSON.parse(body);
						assert.deepEqual(body, expectedResponseBody);
						done();
					});
				});

			});

		});
	}

	// TODO: if config.management does not exist or is incorrect POST and DELETE to /auth/user must return 404
	// for this test config should be edited, doing so a white box unit test or either change way of loading config file
};

var username = 'validuser' + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : '');
var password = 'validpassword';
var phone = '111111111';

var USER = {
	id: 'a1b2c3d4e5f6',
	username: username,
	password: password,
	phone: phone
};

var HEADERS_WITHOUT_AUTHORIZATION_BASIC = {
	'Content-Type': 'application/json; charset=utf-8'
};

var HEADERS_WITH_AUTHORIZATION_BASIC = {
	'Content-Type': 'application/json; charset=utf-8',
	'Authorization': 'basic ' + new Buffer(config.management.clientId + ':' + config.management.clientSecret).toString('base64')
};
