const assert = require('assert');
const request = require('request');
const config = require('../config.json');

const userDao = require('../src/managers/dao');
const redisMng = require('../src/managers/redis');

describe('Heartbeat (Server status)', function () {

	it('OK', function (done) {
		var options = {
			url: `http://localhost:${config.public_port}/heartbeat`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: 'GET'
		};

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 204, body);
			return done();
		});
	});

	it('DAO error', function (done) {
		userDao.disconnect(function (err) {
			assert.equal(err, null);
			var options = {
				url: `http://localhost:${config.public_port}/heartbeat`,
				headers: {
					'Content-Type': 'application/json; charset=utf-8'
				},
				method: 'GET'
			};

			var expectedResult = {
				"err": "component_error",
				"des": "MongoDB component is not available"
			};

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 500);
				body = JSON.parse(body);
				assert.deepEqual(body, expectedResult);
				return done();
			});
		});
	});

	it('Redis error', function (done) {
		redisMng.disconnect(function (err) {
			assert.equal(err, null);
			var options = {
				url: `http://localhost:${config.public_port}/heartbeat`,
				headers: {
					'Content-Type': 'application/json; charset=utf-8'
				},
				method: 'GET'
			};

			var expectedResult = {
				"err": "component_error",
				"des": "Redis component is not available"
			};

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 500);
				body = JSON.parse(body);
				assert.deepEqual(body, expectedResult);
				return done();
			});
		});
	});
});

