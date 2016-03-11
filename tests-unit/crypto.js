'use strict';

const assert = require('assert');
const crypto = require('crypto');
const config = require('../config');

const defaultSettings = {
	algorithm: config.password.algorithm || 'aes-256-ctr',
	encryptPassword: config.password.encryptPassword || 'password'
};

describe('crypto', function () {

	const cipher = crypto.createCipher(defaultSettings.algorithm, defaultSettings.encryptPassword);

	it('encrypt', function (done) {

		const cryptoMng = require('../src/managers/crypto')(config.password);
		const value = 'Hello world';
		cryptoMng.encrypt(value, function (cryptedResult) {
			let expectedValue = cipher.update(value, 'utf8', 'hex');
			expectedValue += cipher.final('hex');
			assert.equal(cryptedResult, expectedValue);
			return done();
		});
	});

	it('creates a valid random password', function () {

		const crypto = require('../src/managers/crypto');
		const cryptoMng = crypto(config.password);

		const newRandomPassword = cryptoMng.randomPassword(config.password.regexValidation);
		const testRe = new RegExp(config.password.regexValidation);

		assert.ok(newRandomPassword.match(testRe), 'Random password does not match with config regexp');

	});

});
