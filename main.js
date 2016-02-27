var cipherLayer = require('./src/cipherlayer');
var fs = require('fs');
var config = require(process.cwd() + '/config.json');

var PUBLIC_PORT = process.env.PORT || config.public_port;
var INTERNAL_PORT = process.env.INTERNAL_PORT || config.internal_port;

console.log('starting cipherlayer proxy');

cipherLayer.start(PUBLIC_PORT, INTERNAL_PORT, function (err) {
	if (err) {
		console.error('error on launch: ' + err);
	} else {
		console.log('listening on port ' + PUBLIC_PORT);
	}

	fs.watchFile('config.json', function () {
		console.log('config file updated. exiting');
		process.exit(1);
	});
});
