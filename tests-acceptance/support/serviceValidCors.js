const request = require('request');
const assert = require('assert');

const cipherlayer = require('../../src/cipherlayer');

const world = require('./world');

const config = require('../../config');

module.exports = function () {
	this.Before('@serviceValidCors', function (scenario, done) {
		config.accessControlAllow = {
			headers: ['custom-header-1', 'custom-header-2'],
			origins: ['http://valid.origin.com']
		};
		this.accessControlAllow = config.accessControlAllow;

		cipherlayer.start(config.public_port, config.internal_port, function (err) {
			assert.equal(err, null);
			const options = {
				url: `http://localhost:${config.internal_port}/auth/user`,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					Authorization: `basic ${new Buffer(`${config.management.clientId}:${config.management.clientSecret}`).toString('base64')}`,
					[config.version.header]: world.versionHeader
				},
				method: 'DELETE'
			};

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 204, body);
				assert.equal(body, '');
				return done();
			});
		});
	});

	this.After('@serviceValidCors', function (scenario, done) {
		cipherlayer.stop(done);
	});
};
