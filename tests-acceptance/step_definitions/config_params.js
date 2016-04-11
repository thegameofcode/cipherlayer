'use strict';

let config = require('../../config'); // eslint-disable-line prefer-const

module.exports = function () {
	this.Given(/^config has no param emailverification$/, function (callback) {
		delete config.emailVerification;
		return callback();
	});
};
