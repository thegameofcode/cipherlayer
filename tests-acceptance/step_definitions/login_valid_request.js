const world = require('../support/world');
const request = require('request');
const assert = require('assert');
const config = require('../../config.json');

module.exports = function () {
	this.When(/^the user requests log in the protected application with valid credentials$/, function (callback) {

		var options = {
			url: 'http://localhost:' + config.public_port + '/auth/login',
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: 'POST',
			body: JSON.stringify(world.getUser())
		};
		options.headers[config.version.header] = world.versionHeader;

		request(options, function (err, res, body) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			world.getResponse().body = JSON.parse(body);
			callback();
		});
	});
};
