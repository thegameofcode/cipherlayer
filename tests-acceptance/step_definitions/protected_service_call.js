const world = require('../support/world');
const request = require('request');
const assert = require('assert');
const config = require('../../config.json');

module.exports = function () {
	this.When(/^the application makes a (.*) without credentials (.*) to a protected (.*)$/, function (METHOD, PAYLOAD, PATH, callback) {
		const options = {
			url: `http://localhost:${config.public_port}${PATH}`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: METHOD
		};

		if (METHOD === 'POST' || METHOD === 'PUT') {
			options.body = PAYLOAD;
		}

		request(options, function (err, res, body) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			if (body) {
				world.getResponse().body = JSON.parse(body);
			} else {
				world.getResponse().body = null;
			}

			world.getResponse().headers = res.headers;
			return callback();
		});
	});
};
