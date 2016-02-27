const world = require('../support/world');
const assert = require('assert');

module.exports = function () {
	this.Given(/^the response headers contains the (.*) with (.*)$/, function (ALLOWEDHEADER, HEADERVALUE, callback) {
		assert.equal(world.getResponse().headers[ALLOWEDHEADER], HEADERVALUE);
		callback();
	});
};
