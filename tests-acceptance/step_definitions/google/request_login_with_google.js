const world = require('../../support/world');
const request = require('request');
const config = require('../../../config.json');

var myStepDefinitionsWrapper = function () {
	this.When(/^a user request login with Google account$/, function (callback) {

		var options = {
			url: 'http://localhost:' + config.public_port + '/auth/google',
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: 'GET',
			followRedirect: false
		};
		options.headers[config.version.header] = world.versionHeader;

		request(options, function (err, res, body) {
			world.getResponse().err = err;
			world.getResponse().statusCode = res.statusCode;
			if (body) {
				world.getResponse().body = JSON.parse(body);
			}
			callback();
		});
	});
};
module.exports = myStepDefinitionsWrapper;
