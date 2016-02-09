var world = require('../support/world');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var nock = require('nock');
var request = require('request');
var assert = require('assert');

var NOTIFICATION_SERVICE_URL = config.externalServices.notifications.base;
var NOTIFICATION_EMAIL_SERVICE_PATH = config.externalServices.notifications.pathEmail;

var myStepDefinitionsWrapper = function () {
	this.When(/^the client makes a (.*) request to (.*)$/, function (METHOD, PATH, callback) {

		var path = PATH.replace(":email", world.getUser().username.toUpperCase()); //Upper to check the lower email validation
		var options = {
			url: 'http://localhost:' + config.public_port + path,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Origin': 'http://localhost:' + config.public_port,
				'Referer': 'http://localhost:' + config.public_port
			},
			method: METHOD
		};
		options.headers[config.version.header] = "test/1";

		nock(NOTIFICATION_SERVICE_URL)
			.post(NOTIFICATION_EMAIL_SERVICE_PATH)
			.reply(204);

		request(options, function (err, res) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			world.getResponse().headers = res.headers;
			callback();
		});
	});

	this.When(/^the client makes a request with valid origin and headers "(.*)"$/, function (customHeaders, callback) {
		var options = {
			url: 'http://localhost:' + config.public_port + '/testCors',
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Origin': this.accessControlAllow.origins[0],
				'Referer': this.accessControlAllow.origins[0]
			},
			method: 'OPTIONS'
		};
		options.headers[config.version.header] = "test/1";

		customHeaders.split(',').forEach(function (customHeader) {
			options.headers[customHeader] = customHeader;
		});

		request(options, function (err, res) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			world.getResponse().headers = res.headers;

			callback();
		});
	});

	this.When(/^the client makes a request with invalid origin$/, function (callback) {
		var options = {
			url: 'http://localhost:' + config.public_port + '/testCors',
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Origin': 'http://invalid.origin.com',
				'Referer': 'http://invalid.origin.com'
			},
			method: 'OPTIONS'
		};
		options.headers[config.version.header] = "test/1";

		request(options, function (err, res) {
			assert.equal(err, null);
			world.getResponse().statusCode = res.statusCode;
			world.getResponse().headers = res.headers;
			callback();
		});
	});
};
module.exports = myStepDefinitionsWrapper;
