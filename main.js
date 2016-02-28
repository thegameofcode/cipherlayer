'use strict';

/* eslint-disable no-console, no-process-env */
const fs = require('fs');
const cipherLayer = require('./src/cipherlayer');
const config = require('./config.json');

const PUBLIC_PORT = process.env.PORT || config.public_port;
const INTERNAL_PORT = process.env.INTERNAL_PORT || config.internal_port;

console.log('starting cipherlayer proxy');

cipherLayer.start(PUBLIC_PORT, INTERNAL_PORT, function (err) {
	if (err) {
		console.error(`error on launch: ${err}`);
	} else {
		console.log(`listening on port ${PUBLIC_PORT}`);
	}

	fs.watchFile('config.json', function () {
		console.log('config file updated. exiting');
		process.exit(1);
	});
});
