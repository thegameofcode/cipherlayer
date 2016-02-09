'use strict';

var assert = require('assert');
var _ = require('lodash');
var request = require('request');
var config = require('../../config.json');
var dao = require('../../src/managers/dao.js');
var should = require('chai').should();
var nock = require('nock');

var crypto = require('../../src/managers/crypto');
var cryptoMng = crypto(config.password);

module.exports = {
	describe: function (accessTokenSettings) {
		describe('/logout', function () {
			var baseUser = {
				id: 'a1b2c3d4e5f6',
				username: 'validuser' + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''),
				password: 'validpassword',
				deviceId: '1234567890'
			};

			beforeEach(function (done) {
				dao.deleteAllUsers(function (err) {
					assert.equal(err, null);
					var userToCreate = _.clone(baseUser);
					cryptoMng.encrypt(userToCreate.password, function (encryptedPwd) {
						userToCreate.password = encryptedPwd;
						dao.addUser()(userToCreate, function (err, createdUser) {
							assert.equal(err, null);
							assert.notEqual(createdUser, undefined);
							done();
						});
					});
				});
			});

			function doLogin() {
				return new Promise(function (ok) {
					var user = _.clone(baseUser);
					var options = {
						url: 'http://localhost:' + config.public_port + '/auth/login',
						headers: {},
						method: 'POST',
						body: user,
						json: true
					};
					options.headers[config.version.header] = "test/1";

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
					var options = {
						url: 'http://localhost:' + config.public_port + '/auth/logout',
						method: 'POST',
						headers: {
							'Authorization': 'bearer ' + accessToken
						},
						json: true
					};
					options.headers[config.version.header] = "test/1";

					nock('http://' + config.private_host + ':' + config.private_port).delete('/api/me/session').reply(200);

					request(options, function (err, res, body) {
						should.not.exist(err);
						res.statusCode.should.equal(204, body);
						done();
					});
				});
			});

			it('POST 500 no sesion service', function (done) {
				doLogin().then(function (accessToken) {
					var options = {
						url: 'http://localhost:' + config.public_port + '/auth/logout',
						method: 'POST',
						headers: {
							'Authorization': 'bearer ' + accessToken
						},
						json: true
					};
					options.headers[config.version.header] = "test/1";

					request(options, function (err, res, body) {
						should.not.exist(err);
						res.statusCode.should.equal(500);
						body.should.have.property('err').to.be.equal('internal_session_error');
						body.should.have.property('des').to.be.equal('unable to close session');
						done();
					});
				});
			});

			it('POST 401 invalid access token', function (done) {
				var options = {
					url: 'http://localhost:' + config.public_port + '/auth/logout',
					method: 'POST',
					headers: {
						'Authorization': 'bearer INVALID_TOKEN'
					},
					json: true
				};
				options.headers[config.version.header] = "test/1";

				request(options, function (err, res, body) {
					should.not.exist(err);
					res.statusCode.should.equal(401);
					body.should.have.property('err').to.be.equal('invalid_access_token');
					body.should.have.property('des').to.be.equal('unable to read token info');
					done();
				});
			});

			it('POST 401 no authorization header', function (done) {
				var options = {
					url: 'http://localhost:' + config.public_port + '/auth/logout',
					method: 'POST',
					headers: {},
					json: true
				};
				options.headers[config.version.header] = "test/1";

				request(options, function (err, res, body) {
					should.not.exist(err);
					res.statusCode.should.equal(401);
					body.should.have.property('err').to.be.equal('invalid_access_token');
					body.should.have.property('des').to.be.equal('unable to read token info');
					done();
				});
			});

			it('POST 401 invalid authorization header identifier', function (done) {
				var options = {
					url: 'http://localhost:' + config.public_port + '/auth/logout',
					method: 'POST',
					headers: {
						'Authorization': 'wrong bearer TOKEN'
					},
					json: true
				};
				options.headers[config.version.header] = "test/1";

				request(options, function (err, res, body) {
					should.not.exist(err);
					res.statusCode.should.equal(401);
					body.should.have.property('err').to.be.equal('invalid_access_token');
					body.should.have.property('des').to.be.equal('unable to read token info');
					done();
				});
			});
		});
	}
};
