'use strict';

var assert = require('assert');
var clone = require('clone');
var request = require('request');
var config = require('../../config.json');
var dao = require('../../src/managers/dao.js');
var should = require('chai').should();
var nock = require('nock');

var cryptoMng = require('../../src/managers/crypto')({password: 'password'});

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
					var userToCreate = clone(baseUser);
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
					var user = clone(baseUser);
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
						}
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
		});
	}
};
