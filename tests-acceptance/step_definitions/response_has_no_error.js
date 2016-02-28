const world = require('../support/world');
const assert = require('assert');

module.exports = function () {
	this.Then(/^the response has no error$/, function (callback) {
		assert.equal(world.getResponse().err, null);
		return callback();
	});
};
