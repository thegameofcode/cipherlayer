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
					.post(config.externalServices.notifications.pathEmail, nockBody)
					.reply(200, {});

				emailMng.sendEmailForgotPassword(email, password, link, function (err) {
					should.not.exist(err);
					done();
				});
			});
		});

		describe('magic link', function () {
			it('OK', function (done) {
				var expectedEmail = 'user@email.com';
				var expectedLink = 'http://magic_link';

				var html = config.magicLink.body.replace("__LINK__", expectedLink);

				var nockBody = {
					to: expectedEmail,
					subject: config.magicLink.subject,
					html: html
				};

				var nockedEndpoint = nock(config.externalServices.notifications.base)
					.post(config.externalServices.notifications.pathEmail, nockBody)
					.reply(200, {});

				emailMng.sendEmailMagicLink(expectedEmail, expectedLink, function (err) {
					should.not.exist(err);
					nockedEndpoint.isDone().should.equal(true);
					done();
				});
			});

			it('FAIL - notifications service failed', function (done) {
				var expectedEmail = 'user@email.com';
				var expectedLink = 'http://magic_link';

				var html = config.magicLink.body.replace("__LINK__", expectedLink);

				var nockBody = {
					to: expectedEmail,
					subject: config.magicLink.subject,
					html: html
				};

				var nockedEndpoint = nock(config.externalServices.notifications.base)
					.post(config.externalServices.notifications.pathEmail, nockBody)
					.reply(500, {});

				emailMng.sendEmailMagicLink(expectedEmail, expectedLink, function (err) {
					should.exist(err);
					err.should.deep.equal({
						err: 'internal_error',
						des: 'Error calling notifications service for Magic Link email'
					});
					nockedEndpoint.isDone().should.equal(true);
					done();
				});
			});
		});
	});
});
