'use strict';
const world = require('../support/world');
const request = require('request');
const assert = require('assert');
const config = require('../../config.json');
const nock = require('nock');

module.exports = function () {
	this.When(/^the client app requests a magic link for a valid user$/, function (callback) {
		nock(config.externalServices.notifications.base)
			.filteringRequestBody(function(body) {
				world.magicLinkEmail = JSON.parse(body);
				return body;
			})
			.post(config.externalServices.notifications.pathEmail)
			.reply(200, {});

		const options = {
			url: `http://localhost:${config.public_port}/auth/login/email`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: world.versionHeader
			},
			method: 'POST',
			json: true,
			body: {
				email: world.getUser().username
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
