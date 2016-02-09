var world = require('../../support/world');
var request = require('request');
var assert = require('assert');
var config = require('../../../config.json');

module.exports = function () {
	this.When(/^the client app request to start Google login process$/, function (callback) {

		var options = {
			url: 'http://localhost:' + config.public_port + '/auth/google',
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: 'GET',
			followRedirect: false
		};

		request(options, function (err, res) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			callback();
		});
	});
};
