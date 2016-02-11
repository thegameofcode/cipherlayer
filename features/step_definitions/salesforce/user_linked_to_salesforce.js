var world = require('../../support/world');
var request = require('request');
var assert = require('assert');
var config = require('../../../config.json');

module.exports = function () {
	this.Given(/^a user with valid credentials in SalesForce linked to SalesForce$/, function (callback) {
		world.getUser().id = 'a1b2c3d4e5f6';
		world.getUser().username = 'name.lastname' + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : '');
		world.getUser().password = 'valid_password';
		world.getUser().platforms = [{
			platform: 'sf',
			accessToken: 'a1b2c3...d4e5f6',
			refreshToken: 'a1b2c3...d4e5f6',
			expiry: new Date().getTime() + 60 * 1000
		}];

		var options = {
			url: 'http://localhost:' + config.public_port + '/auth/user',
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Authorization': 'basic ' + new Buffer(config.management.clientId + ':' + config.management.clientSecret).toString('base64')
			},
			method: 'POST',
			body: JSON.stringify(world.getUser())
		};

		if(config.version){
			var platform = Object.keys(config.version.platforms)[0];
			var version = Object.keys(platform)[1];
			options.headers[config.version.header] = platform + '/' + version;
		}

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 201, body);
			callback();
		});
	});
};
