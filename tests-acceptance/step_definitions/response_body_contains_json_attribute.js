const world = require('../support/world');

module.exports = function () {
	this.Then(/^the response body contains json attribute "(.*)"$/, function (attribute, callback) {
		const body = world.getResponse().body;
		if (body.hasOwnProperty(attribute)) {
			return callback();
		}
		return callback('Fail');
	});
};
