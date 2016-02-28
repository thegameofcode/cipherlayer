'use strict';

const assert = require('assert');
const request = require('request');
const config = require('../../config.json');
const dao = require('../../src/managers/dao');
const _ = require('lodash');

const versionHeader = 'test/1';

const OPTIONS = {
	headers: {
		'Content-Type': 'application/json; charset=utf-8',
		[config.version.header]: versionHeader
	},
	method: 'GET',
	followRedirect: false
};

describe('/google', function () {
	beforeEach(function (done) {
		dao.deleteAllUsers(function (err) {
			assert.equal(err, null);
			return done();
		});
	});

	it('GET 302', function (done) {
		const options = _.clone(OPTIONS);
		options.url = `http://localhost:${config.public_port}/auth/google`;

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 302, body);
			return done();
		});
	});

	describe('/callback', function () {
		it('302 invalid data', function (done) {
			const options = _.clone(OPTIONS);
			options.url = `http://localhost:${config.public_port}/auth/google/callback`;

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 302, body);
				return done();
			});
		});
	});
});

