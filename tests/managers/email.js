'use strict';

var nock = require('nock');
var should = require('chai').should();
var emailMng = require('../../src/managers/email')();
var config = require(process.cwd() + '/config.json');

describe('managers', function () {
	describe('email', function () {
		describe('forgot password email', function () {
			it('OK', function (done) {
				var email = 'valid@email.com';
				var password = '12345678';
				var link = 'http://link';

				var html = config.password.body.replace("__PASSWD__", password).replace("__LINK__", link);

				var nockBody = {
					to: email,
					subject: config.password.subject,
					html: html
				};

				nock(config.externalServices.notifications.base)
					.log(console.log)
					.post(config.externalServices.notifications.pathEmail, nockBody)
					.reply(200, {});

				emailMng.sendEmailForgotPassword(email, password, link, function (err) {
					should.not.exist(err);
					done();
				});
			});
		});
	});
});
