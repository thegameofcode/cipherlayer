const world = require('../support/world');

module.exports = function () {
	this.Then(/^the response body contains json attribute "(.*)"$/, function (attribute, callback) {
		var body = world.getResponse().body;
		if (body.hasOwnProperty(attribute)) {
			callback();
		} else {
			callback.fail();
		}
	});
};
