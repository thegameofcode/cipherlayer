'use strict';

var bunyan = require('bunyan');

module.exports = function () {
	var log = bunyan.createLogger({
		name: 'cipherlayer-todo',
		streams: [{
			type: 'rotating-file',
			path: process.cwd() + '/logs/cipherlayer-todo.log',
			period: '1d',
			count: 30
		}]
	});
	return log;
}();
