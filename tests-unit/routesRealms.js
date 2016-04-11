const assert = require('assert');
const request = require('request');
const async = require('async');
const _ = require('lodash');

const config = require('../config');
const daoMng = require('../src/managers/dao');

describe('realms', function () {

	const baseRealms = [
		{
			name: 'default',
			allowedDomains: [
				'*@a.com',
				'*@b.com'
			],
			capabilities: {
				news: true,
				chat: true,
				call: true
			}
		},
		{
			name: 'test',
			allowedDomains: [
				'*@a.com'
			],
			capabilities: {
				test: true
			}
		},
		{
			name: 'valid',
			allowedDomains: [
				'valid@a.com'
			],
			capabilities: {
				valid: true
			}
		}
	];

	beforeEach(function (done) {
		daoMng.resetRealmsVariables();
		async.parallel([
			daoMng.deleteAllRealms,
			function (finish) {
				async.eachSeries(_.cloneDeep(baseRealms), daoMng.addRealm, finish);
			}
		], done);
	});

	afterEach(daoMng.deleteAllRealms);

	it('Get all realms', function (done) {
		if (!config.internal_port) {
			return done();
		}

		const options = {
			url: `http://localhost:${config.internal_port}/realms`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: 'GET',
			json: true
		};

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 200, body);
			assert.deepEqual(body.realms, baseRealms);
			return done();
		});
	});

	it('No realms', function (done) {
		if (!config.internal_port) {
			return done();
		}

		daoMng.deleteAllRealms(function (err) {
			assert.equal(err, null);

			const options = {
				url: `http://localhost:${config.internal_port}/realms`,
				headers: {
					'Content-Type': 'application/json; charset=utf-8'
				},
				method: 'GET'
			};

			request(options, function (err, res, rawBody) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 200, rawBody);
				const body = JSON.parse(rawBody);
				assert.deepEqual(body.realms, []);
				return done();
			});
		});
	});

});
