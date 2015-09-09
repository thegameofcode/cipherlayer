'use strict';

var bunyan = require('bunyan');
var fs = require('fs');

module.exports = function(){

	var dir = process.cwd() + '/logs';
	if (!fs.existsSync(dir)){
		fs.mkdirSync(dir);
	}

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
