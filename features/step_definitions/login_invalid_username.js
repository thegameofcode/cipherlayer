var world = require('../support/world');
var request = require('request');
var assert = require('assert');
var config = require('../../config.json');

module.exports = function () {
	this.When(/^the client app requests log in the protected application with username substring/, function (callback) {
		var username = world.getUser().username;
		world.getUser().username = username.slice(0, username.length / 2);

		var options = {
			url: 'http://localhost:' + config.public_port + '/auth/login',
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: 'POST',
			body: JSON.stringify(world.getUser())
		};

		options.headers[config.version.header] = "test/1";

		request(options, function (err, res, body) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			world.getResponse().body = JSON.parse(body);
			callback();
		});
	});
};
