const assert = require('assert');
const async = require('async');
const nock = require('nock');

const redisMng = require('../src/managers/redis');

const config = require('../config.json');
var notifServiceURL = config.externalServices.notifications.base;
var notifServicePath = config.externalServices.notifications.pathEmail;

describe('email', function () {

	beforeEach(function (done) {
		async.series([
			function (done) {
				redisMng.connect(done);
			},
			function (done) {
				redisMng.deleteAllKeys(done);
			}
		], done);
	});

	it('verifyEmail', function (done) {
		const emailMng = require('../src/managers/email')({
			"useEmailVerification": true
		});

		nock(notifServiceURL)
			.post(notifServicePath)
			.reply(204);

		var email = "test@test.com";
		var bodyData = {
			key: "value",
			key2: "value2"
		};
		emailMng.emailVerification(email, bodyData, function (err, returnedEmail) {
			assert.equal(err, null);
			assert.equal(returnedEmail, email);
			done();
		});
	});

	it('verifyEmail (not email)', function (done) {
		const emailMng = require('../src/managers/email')({
			"useEmailVerification": true
		});

		var expected_error = {"err": "auth_proxy_error", "des": "empty email"};

		nock(notifServiceURL)
			.post('/notification/email')
			.reply(204);

		var email = null;
		var bodyData = {
			key: "value",
			key2: "value2"
		};
		emailMng.emailVerification(email, bodyData, function (err, returnedEmail) {
			assert.deepEqual(err, expected_error);
			assert.equal(returnedEmail, null);
			done();
		});
	});

	it('verifyEmail (useEmailVerification = false)', function (done) {
		const emailMng = require('../src/managers/email')({
			"emailVerification": false
		});

		var email = "test@test.com";
		var bodyData = {
			key: "value",
			key2: "value2"
		};
		emailMng.emailVerification(email, bodyData, function (err, returnedEmail) {
			assert.equal(err, null);
			assert.equal(returnedEmail, null);
			done();
		});
	});
});
