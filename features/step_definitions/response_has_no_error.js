var world = require('../support/world');
var assert = require('assert');

var myStepDefinitionsWrapper = function () {
	this.Then(/^the response has no error$/, function (callback) {
		assert.equal(world.getResponse().err, null);
		callback();
	});
};
module.exports = myStepDefinitionsWrapper;
