const request = require('request');
const assert = require('assert');
const world = require('../support/world');
const config = require('../../config');

module.exports = function () {
	this.When(/^the client makes a pass through (.*) with the following (.*) in the body with a pin header$/, function (METHOD, PUBLIC_PAYLOAD, callback) {

		const payload = JSON.parse(PUBLIC_PAYLOAD);

		world.getPinNumber(payload.email, `+34${payload.phone}`, function (err, pin) {
			const options = {
				url: `http://localhost:${config.public_port}${config.passThroughEndpoint.path}`,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'x-otp-pin': pin,
					[config.version.header]: world.versionHeader
				},
				method: METHOD,
				body: PUBLIC_PAYLOAD
			};

			request(options, function (err, res, body) {
				assert.equal(err, null);
				world.getResponse().statusCode = res.statusCode;
				world.getResponse().body = JSON.parse(body);
				return callback();
			});
		});

	});
};
