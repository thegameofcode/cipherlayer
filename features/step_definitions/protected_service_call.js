var world = require('../support/world');
var request = require('request');
var assert = require('assert');
var config = require('../../config.json');

module.exports = function () {
	this.When(/^the application makes a (.*) with (.*) to a protected (.*)$/, function (METHOD, PAYLOAD, PATH, callback) {
		var options = {
			url: 'http://localhost:' + config.public_port + PATH,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Authorization': 'bearer ' + world.getTokens().accessToken
			},
			method: METHOD
		};

		if (METHOD == 'POST' || METHOD == 'PUT') {
			options.body = PAYLOAD;
		}

		if(config.version){
			var platform = Object.keys(config.version.platforms)[0];
			var version = Object.keys(platform)[1];
			options.headers[config.version.header] = platform + '/' + version;
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
			callback();
		});
	});
};
