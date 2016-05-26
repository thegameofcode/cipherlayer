'use strict';
const world = require('../support/world');
const request = require('request');
const assert = require('assert');
const config = require('../../config');

module.exports = function () {
	this.When(/^the client app requests a magic link for an invalid user$/, function (callback) {
		const options = {
			url: `http://localhost:${config.public_port}/auth/login/email`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: world.versionHeader
			},
			method: 'POST',
			json: true,
			body: {
				email: 'invalid@email.com'
			}
		};

		request(options, function (err, res, body) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			world.getResponse().body = body;
			return callback();
		});
	});
};
