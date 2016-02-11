var request = require('request');
var assert = require('assert');

var cipherlayer = require('../../src/cipherlayer');

var config = require('../../config.json');

module.exports = function () {
	this.Before("@serviceValidCors", function (done) {
		this.accessControlAllow = config.accessControlAllow = {
			headers: ['custom-header-1', 'custom-header-2'],
			origins: ['http://valid.origin.com']
		};

		cipherlayer.start(config.public_port, config.internal_port, function (err) {
			assert.equal(err, null);
			var options = {
				url: 'http://localhost:' + config.public_port + '/auth/user',
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Authorization': 'basic ' + new Buffer(config.management.clientId + ':' + config.management.clientSecret).toString('base64')
				},
				method: 'DELETE'
			};

			if(config.version){
				var platform = Object.keys(config.version.platforms)[0];
				var version = Object.keys(platform)[1];
				options.headers[config.version.header] = platform + '/' + version;
			}

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 204, body);
				assert.equal(body, '');
				done();
			});
		});
	});

	this.After("@serviceValidCors", function (done) {
		cipherlayer.stop(done);
	});
};
