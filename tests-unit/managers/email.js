'use strict';

const nock = require('nock');
const should = require('chai').should();
const emailMng = require('../../src/managers/email')();
const config = require('../../config');

describe('managers', function () {
	describe('email', function () {
		describe('forgot password email', function () {
			it('OK', function (done) {
				const email = 'valid@email.com';
				const password = '12345678';
				const link = 'http://link';

				const html = config.password.body.replace('__PASSWD__', password).replace('__LINK__', link);

				const nockBody = {
					to: email,
					subject: config.password.subject,
					html
				};

				nock(config.externalServices.notifications.base)
					.post(config.externalServices.notifications.pathEmail, nockBody)
					.reply(200, {});

				emailMng.sendEmailForgotPassword(email, password, link, function (err) {
					should.not.exist(err);
					return done();
				});
			});
		});

		describe('magic link', function () {
			it('OK', function (done) {
				const expectedEmail = 'user@email.com';
				const expectedLink = 'http://magic_link';

				const html = config.magicLink.body.replace('__LINK__', expectedLink);

				const nockBody = {
					to: expectedEmail,
					subject: config.magicLink.subject,
					html
				};

				const nockedEndpoint = nock(config.externalServices.notifications.base)
					.post(config.externalServices.notifications.pathEmail, nockBody)
					.reply(200, {});

				emailMng.sendEmailMagicLink(expectedEmail, expectedLink, function (err) {
					should.not.exist(err);
					nockedEndpoint.isDone().should.equal(true);
					return done();
				});
			});

			it('FAIL - notifications service failed', function (done) {
				const expectedEmail = 'user@email.com';
				const expectedLink = 'http://magic_link';

				const html = config.magicLink.body.replace('__LINK__', expectedLink);

				const nockBody = {
					to: expectedEmail,
					subject: config.magicLink.subject,
					html
				};

				const nockedEndpoint = nock(config.externalServices.notifications.base)
					.post(config.externalServices.notifications.pathEmail, nockBody)
					.reply(500, {});

				emailMng.sendEmailMagicLink(expectedEmail, expectedLink, function (err) {
					should.exist(err);
					err.should.deep.equal({
						err: 'internal_error',
						des: 'Error calling notifications service for Magic Link email'
					});
					nockedEndpoint.isDone().should.equal(true);
					return done();
				});
			});
		});
	});
});
