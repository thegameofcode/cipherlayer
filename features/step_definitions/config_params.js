var config = require('../../config.json');

module.exports = function () {
	this.Given(/^config has no param emailverification$/, function (callback) {
		delete config.emailVerification;
		callback();
	});
};
