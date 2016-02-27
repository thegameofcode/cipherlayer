'use strict';

const bunyan = require('bunyan');
const fs = require('fs');

const LOG_FILE = 'cipherlayer-service.log';
const LOG_PATH = `${__dirname}/../../logs`;

if (!fs.existsSync(LOG_PATH)) {
	fs.mkdirSync(LOG_PATH);
}

module.exports = bunyan.createLogger({
	name: 'cipherlayer-service',
	streams: [{
		type: 'rotating-file',
		path: `${LOG_PATH}/${LOG_FILE}`,
		period: '1d',
		count: 30
	}]
});
