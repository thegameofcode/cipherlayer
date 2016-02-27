var world = require('../support/world');
var request = require('request');
var assert = require('assert');
var async = require('async');
var config = require('../../config.json');

var dao = require('../../src/managers/dao.js');
var _ = require("lodash");
var nock = require('nock');

var cryptoMng = require('../../src/managers/crypto')(config.password);

module.exports = function () {
	this.Given(/^a user with role (.*) and a valid access token$/, function (role, callback) {

		async.series([

			// User post
			function (done) {
				world.getUser().id = 'a1b2c3d4e5f6';
				world.getUser().username = 'valid_user' + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : '');
				world.getUser().password = 'valid_password';

				switch (role) {
					case 'admin':
						world.getUser().roles = ['admin'];
						break;

					default:
						world.getUser().roles = ['user'];
						break;
				}

				var userToCreate = _.clone(world.getUser());
				cryptoMng.encrypt(userToCreate.password, function (encryptedPwd) {
					userToCreate.password = encryptedPwd;
					dao.addUser()(userToCreate, function (err, createdUser) {
						assert.equal(err, null);
						assert.notEqual(createdUser, undefined);
						done();
					});
				});
			},

			//User login
			function (done) {
				var options = {
					url: 'http://localhost:' + config.public_port + '/auth/login',
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						'Authorization': 'basic ' + new Buffer(config.management.clientId + ':' + config.management.clientSecret).toString('base64')
					},
					method: 'POST',
					body: JSON.stringify(world.getUser())
				};
				options.headers[config.version.header] = world.versionHeader;

				nock('http://localhost:' + config.private_port)
					.post('/api/me/session')
					.reply(204);

				request(options, function (err, res, body) {
					assert.equal(err, null);
					world.getResponse().statusCode = res.statusCode;
					body = JSON.parse(body);
					world.getResponse().body = body;
					world.getTokens().accessToken = body.accessToken;
					world.getTokens().refreshToken = body.refreshToken;
					world.getTokens().expiresIn = body.expiresIn;
					done();
				});
			}
		], function (err) {
			assert.equal(err, null);
			callback();
		});
	});
};
