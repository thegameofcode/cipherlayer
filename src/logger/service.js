'use strict';

var bunyan = require('bunyan');

module.exports = function () {
	var log = bunyan.createLogger({
		name: 'cipherlayer-service',
		streams: [{
			type: 'rotating-file',
			path: process.cwd() + '/logs/cipherlayer-service.log',
			period: '1d',
			count: 30
		}]
	});
	return log;
}();
