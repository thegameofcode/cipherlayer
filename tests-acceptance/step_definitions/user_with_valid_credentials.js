const world = require('../support/world');
const request = require('request');
const assert = require('assert');
const config = require('../../config');

module.exports = function () {
	this.Given(/^a user with valid credentials$/, function (callback) {
		world.getUser().username = `valid_user${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`;
		world.getUser().password = 'valid_password';

		const options = {
			url: `http://localhost:${config.internal_port}/auth/user`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				Authorization: `basic ${new Buffer(`${config.management.clientId}:${config.management.clientSecret}`).toString('base64')}`,
				[config.version.header]: world.versionHeader
			},
			method: 'POST',
			body: JSON.stringify(world.getUser())
		};

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 201, body);
			return callback();
		});
	});
};
