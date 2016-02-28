'use strict';

const should = require('chai').should();
const config = require('../../config.json');
const cryptoManager = require('../../src/managers/crypto')();

describe('managers', function () {
	describe('crypto', function () {
		describe('random password generation', function () {
			it('OK', function (done) {
				const newPassword = cryptoManager.randomPassword(config.password.generatedRegex);
				const match = newPassword.match(config.password.regexValidation);
				should.exist(match);
				return done();
			});
		});
	});
});
