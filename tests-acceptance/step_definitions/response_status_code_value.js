const world = require('../support/world');
const assert = require('assert');

module.exports = function () {
	this.Then(/^the response status code is (\d+)$/, function (statusCode, callback) {
		assert.equal(world.getResponse().statusCode, statusCode);
		return callback();
	});
};
