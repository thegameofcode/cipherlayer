const world = require('../support/world');
const request = require('request');
const assert = require('assert');
const config = require('../../config');

module.exports = function () {
	this.When(/^the user requests log in the protected application with valid credentials$/, function (callback) {

		const options = {
			url: `http://localhost:${config.public_port}/auth/login`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: world.versionHeader
			},
			method: 'POST',
			body: JSON.stringify(world.getUser())
		};

		request(options, function (err, res, body) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			world.getResponse().body = JSON.parse(body);
			return callback();
		});
	});
};
