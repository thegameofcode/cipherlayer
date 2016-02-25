'use strict';
var world = require('../support/world');
var request = require('request');
var assert = require('assert');
var config = require('../../config.json');

module.exports = function () {
	this.When(/^the app requests a magic link for a valid user$/, function (callback) {
		var options = {
			url: 'http://localhost:' + config.public_port + '/auth/login/email',
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: 'POST',
			json: true,
			body: {
				email: world.getUser().username
			}
		};

		options.headers[config.version.header] = world.versionHeader;

		request(options, function (err, res, body) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			world.getResponse().body = body;
			callback();
		});
	});
};
