const world = require('../../support/world');
const request = require('request');
const config = require('../../../config.json');

module.exports = function () {
	this.When(/^the client app receives the Google in callback response$/, function (callback) {
		const options = {
			url: `http://localhost:${config.public_port}/auth/google/callback`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: world.versionHeader
			},
			method: 'GET',
			followRedirect: false
		};

		request(options, function (err, res, body) {
			world.getResponse().err = err;
			world.getResponse().statusCode = res.statusCode;
			if (body) {
				world.getResponse().body = JSON.parse(body);
			}
			return callback();
		});
	});
};
