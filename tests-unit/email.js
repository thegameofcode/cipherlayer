const assert = require('assert');
const async = require('async');
const nock = require('nock');

const redisMng = require('../src/managers/redis');

const config = require('../config.json');
const notifServiceURL = config.externalServices.notifications.base;
const notifServicePath = config.externalServices.notifications.pathEmail;

describe('email', function () {

	beforeEach(function (done) {
		async.series([
			redisMng.connect,
			redisMng.deleteAllKeys
		], done);
	});

	it('verifyEmail', function (done) {
		const emailMng = require('../src/managers/email')({
			useEmailVerification: true
		});

		nock(notifServiceURL)
			.post(notifServicePath)
			.reply(204);

		const email = 'test@test.com';
		const bodyData = {
			key: 'value',
			key2: 'value2'
		};
		emailMng.emailVerification(email, bodyData, function (err, returnedEmail) {
			assert.equal(err, null);
			assert.equal(returnedEmail, email);
			return done();
		});
	});

	it('verifyEmail (not email)', function (done) {
		const emailMng = require('../src/managers/email')({
			useEmailVerification: true
		});

		const expected_error = { err: 'auth_proxy_error', des: 'empty email' };

		nock(notifServiceURL)
			.post('/notification/email')
			.reply(204);

		const email = null;
		const bodyData = {
			key: 'value',
			key2: 'value2'
		};
		emailMng.emailVerification(email, bodyData, function (err, returnedEmail) {
			assert.deepEqual(err, expected_error);
			assert.equal(returnedEmail, null);
			return done();
		});
	});

	it('verifyEmail (useEmailVerification = false)', function (done) {
		const emailMng = require('../src/managers/email')({
			emailVerification: false
		});

		const email = 'test@test.com';
		const bodyData = {
			key: 'value',
			key2: 'value2'
		};
		emailMng.emailVerification(email, bodyData, function (err, returnedEmail) {
			assert.equal(err, null);
			assert.equal(returnedEmail, null);
			return done();
		});
	});
});
