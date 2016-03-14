const world = require('../../support/world');
const request = require('request');
const assert = require('assert');
const config = require('../../../config');

module.exports = function () {
	this.When(/^the client app request to start SalesForce login process$/, function (callback) {

		const options = {
			url: `http://localhost:${config.public_port}/auth/sf`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				[config.version.header]: world.versionHeader
			},
			method: 'GET',
			followRedirect: false
		};

		request(options, function (err, res) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			return callback();
		});
	});
};
