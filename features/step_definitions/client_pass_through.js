var request = require('request');
var assert = require('assert');
var world = require('../support/world');
var nock = require('nock');
var config = require('../../config.json');

module.exports = function () {
	this.When(/^the client makes a pass through (.*) with the following (.*) in the body$/, function (METHOD, PUBLIC_PAYLOAD, callback) {

		var notifServiceURL = config.externalServices.notifications.base;

		var options = {
			url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: METHOD,
			body: PUBLIC_PAYLOAD
		};

		if(config.version){
			var platform = Object.keys(config.version.platforms)[0];
			var version = Object.keys(platform)[1];
			options.headers[config.version.header] = platform + '/' + version;
		}

		nock(notifServiceURL)
			.post('/notification/sms')
			.reply(200, {});

		request(options, function (err, res, body) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			world.getResponse().body = JSON.parse(body);
			callback();
		});
	});
};
