'use strict';

var should = require('chai').should();
var config = require(process.cwd() + '/config.json');
var cryptoManager = require('../../src/managers/crypto')();

describe('managers', function () {
	describe('crypto', function () {
		describe('random password generation', function () {
			it('OK', function (done) {
				var newPassword = cryptoManager.randomPassword(config.password.generatedRegex);
				var match = newPassword.match(config.password.regexValidation);
				should.exist(match);
				done();
			});
		});
	});
});
