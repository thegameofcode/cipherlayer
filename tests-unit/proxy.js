var spawn = require('child_process').spawn;
var net = require('net');
var async = require('async');

var TEST_PUBLIC_PORT = 4599;
var TEST_INTERNAL_PORT = 4598;

describe('proxy', function () {

	this.timeout(5000);

	it('launches', function (done) {
		var cipherlayer;
		async.series([
			function (next) {

				cipherlayer = spawn('node', ['main'], {
					env: {
						PORT: TEST_PUBLIC_PORT,
						INTERNAL_PORT: TEST_INTERNAL_PORT
					}
				});
				cipherlayer.stdout.pipe(process.stdout);
				cipherlayer.stderr.pipe(process.stderr);
				cipherlayer.stdout.on('data', function (data) {
					if (String(data).indexOf('listening on port') > -1) {
						return next();
					}
				});
			},
			function (next) {
				var client = net.connect({port: TEST_PUBLIC_PORT}, function () {
					client.destroy();
					cipherlayer.kill('SIGTERM');
					return next();
				});
			}
		], done);
	});

});
