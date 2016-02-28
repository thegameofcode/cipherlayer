const world = require('../support/world');
const assert = require('assert');

module.exports = function () {
	this.Given(/^the response body must be (.*)$/, function (PAYLOAD, callback) {
		assert.deepEqual(world.getResponse().body, JSON.parse(PAYLOAD));
		return callback();
	});
};
