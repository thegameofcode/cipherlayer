'use strict';

const assert = require('assert');
const request = require('request');

const config = require('../config.json');
const userDao = require('../src/managers/dao');

const baseUser = {
	id: 'a1b2c3d4e5f6',
	username: 'user@example.com',
	password: 'pass1'
};

describe('Check Email Available endpoint', function () {

	beforeEach(userDao.deleteAllUsers);

	it('should indicate that requested email is available', function (done) {

		const requestOptions = {
			url: `http://localhost:${config.public_port}/user/email/available`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: 'POST',
			json: true,
			body: {
				email: baseUser.username
			}
		};

		request(requestOptions, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 200);
			assert.equal(body.available, true);
			return done();
		});
	});

	it('should indicate that requested email is unavailable', function (done) {
		const requestOptions = {
			url: `http://localhost:${config.public_port}/user/email/available`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: 'POST',
			json: true,
			body: {
				email: baseUser.username
			}
		};

		userDao.addUser(baseUser, function (error) {

			assert.equal(error, null);

			request(requestOptions, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 200);
				assert.equal(body.available, false);
				return done();
			});
		});
	});

	it('should return a BadRequestError on missing email component', function (done) {
		const requestOptions = {
			url: `http://localhost:${config.public_port}/user/email/available`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			method: 'POST',
			json: true,
			body: {}
		};

		request(requestOptions, function (err, res) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 400);
			assert.equal(res.body.err, 'BadRequestError');
			assert.equal(res.body.des, 'Missing email in request body');
			return done();
		});
	});
});
