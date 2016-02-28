const request = require('request');
const assert = require('assert');
const world = require('../support/world');
const nock = require('nock');
const config = require('../../config.json');

module.exports = function () {
	this.When(/^the client makes a pass through (.*) with the following (.*) in the body$/, function (METHOD, PUBLIC_PAYLOAD, callback) {

		const options = {
			url: `http://localhost:${config.public_port}${config.passThroughEndpoint.path}`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: world.versionHeader
			},
			method: METHOD,
			body: PUBLIC_PAYLOAD
		};

		nock(config.externalServices.notifications.base)
			.post('/notification/sms')
			.reply(200, {});

		request(options, function (err, res, body) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			world.getResponse().body = JSON.parse(body);
			return callback();
		});
	});
};
