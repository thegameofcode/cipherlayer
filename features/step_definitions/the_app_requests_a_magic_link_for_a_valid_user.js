'use strict';
var world = require('../support/world');
var request = require('request');
var assert = require('assert');
var config = require('../../config.json');
var nock = require('nock');

module.exports = function () {
	this.When(/^the client app requests a magic link for a valid user$/, function (callback) {
		nock(config.externalServices.notifications.base)
			.filteringRequestBody(function(body) {
				world.magicLinkEmail = JSON.parse(body);
				return body;
			})
			.post(config.externalServices.notifications.pathEmail)
			.reply(200, {});

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
