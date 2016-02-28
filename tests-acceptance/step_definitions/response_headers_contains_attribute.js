const world = require('../support/world');
const assert = require('assert');

module.exports = function () {
	this.Then(/^the response headers contains attribute "([^"]*)"$/, function (attribute, callback) {
		const headers = world.getResponse().headers;
		if (headers[attribute.toLowerCase()]) {
			return callback();
		}
		return callback('Fail');
	});

	this.Then(/^the response headers contains attribute "([^"]*)" which contains the custom headers$/, function (attribute, callback) {
		const headers = world.getResponse().headers;

		this.accessControlAllow.headers.forEach(function (header) {
			assert.notEqual(headers[attribute.toLowerCase()].indexOf(header), -1);
		});
		return callback();
	});

	this.Then(/^the response headers does not contain attribute "([^"]*)"$/, function (attribute, callback) {
		const headers = world.getResponse().headers;
		if (headers[attribute.toLowerCase()]) {
			return callback('Fail');
		}

		return callback();
	});
};
