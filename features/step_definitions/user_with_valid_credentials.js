var world = require('../support/world');
var request = require('request');
var assert = require('assert');
var config = require('../../config.json');

module.exports = function () {
	this.Given(/^a user with valid credentials$/, function (callback) {
		world.getUser().username = 'valid_user' + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : '');
		world.getUser().password = 'valid_password';

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
