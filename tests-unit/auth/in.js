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

describe('/in', function () {
	beforeEach(dao.deleteAllUsers);

	it('GET 302', function (done) {
		const options = _.clone(OPTIONS);
		options.url = `http://localhost:${config.public_port}/auth/in`;

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 302, body);
			return done();
		});
	});

	describe('/callback', function () {
		it('302 invalid data', function (done) {
			const options = _.clone(OPTIONS);
			options.url = `http://localhost:${config.public_port}/auth/in/callback`;

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 302, body);
				return done();
			});
		});
	});
});

