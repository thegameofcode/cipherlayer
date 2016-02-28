var assert = require('assert');
var request = require('request');
var config = require('../../config.json');
var dao = require('../../src/managers/dao.js');
var _ = require('lodash');

var versionHeader = 'test/1';

describe('/google', function () {
	beforeEach(function (done) {
		OPTIONS.headers[config.version.header] = versionHeader;
		dao.deleteAllUsers(function (err) {
			assert.equal(err, null);
			done();
		});
	});

	it('GET 302', function (done) {
		var options = _.clone(OPTIONS);
		options.url = 'http://localhost:' + config.public_port + '/auth/google';

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 302, body);
			done();
		});
	});

	describe('/callback', function () {
		it('302 invalid data', function (done) {
			var options = _.clone(OPTIONS);
			options.url = 'http://localhost:' + config.public_port + '/auth/google/callback';

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 302, body);
				done();
			});
		});
	});
});

var OPTIONS = {
	headers: {
		'Content-Type': 'application/json; charset=utf-8'
	},
	method: 'GET',
	followRedirect: false
};
