'use strict';

var should = require('chai').should();
var mockery = require('mockery');
var sinon = require('sinon');
var config = require(process.cwd() + '/config.json');

describe('public routes', function () {
	describe('/auth', function () {
		describe('/login', function () {
			describe('/email', function () {
				beforeEach(function () {
					mockery.enable({
						warnOnReplace: false,
						warnOnUnregistered: false,
						useCleanCache: true
					});
				});

				afterEach(function () {
					mockery.deregisterAll();
					mockery.disable();
				});

				it.skip('204 - send valid email with a magic link', function (done) {
					var expectedEmail = 'user@email.com';
					var expectedRefreshToken = 'REFRESH_TOKEN';
					var expectedLink = config.emailVerification.redirectProtocol + '://auth/login/refreshToken?rt=' + expectedRefreshToken;
					var expectedUserId = 'USER_ID';

					var daoManagerStub = {
						getFromUsername: function (email, cbk) {
							should.exist(email);
							email.should.equal(expectedEmail);
							cbk(null, {
								_id: expectedUserId
							});
						}
					};
					mockery.registerMock('../../managers/dao', daoManagerStub);

					var tokenManagerStub = {
						createRefreshToken: function (userId, data, cbk) {
							should.exist(userId);
							userId.should.equal(expectedUserId);
							cbk(null, expectedRefreshToken);
						}
					};
					mockery.registerMock('../../managers/token', tokenManagerStub);

					var emailManagerInstanceStub = {
						sendEmailMagicLink: function (email, link, cbk) {
							should.exist(email);
							email.should.equal(expectedEmail);

							should.exist(link);
							link.should.equal(expectedLink);

							cbk();
						}
					};
					var emailManagerStub = function () {
						return emailManagerInstanceStub;
					};
					mockery.registerMock('../../managers/email', emailManagerStub);
					var emailManagerSendEmailMagicLinkSpy = sinon.spy(emailManagerInstanceStub, 'sendEmailMagicLink');

					var req = {
						params: {
							email: expectedEmail
						}
					};
					var res = {
						send: function (status) {
							should.exist(status);
							status.should.equal(204);
							sinon.assert.calledOnce(emailManagerSendEmailMagicLinkSpy);
						}
					};
					var responseSendSpy = sinon.spy(res, 'send');
					var next = function () {
						sinon.assert.calledOnce(responseSendSpy);
						done();
					};

					var loginEmail_post = require('../../../src/public_routes/auth/loginEmail_post.js');
					loginEmail_post(req, res, next);
				});

				it('400 - no email on body', function (done) {
					var req = {
						params: {}
					};
					var res = {
						send: function (status, body) {
							sinon.assert.calledOnce(responseSendSpy);
							sinon.assert.notCalled(nextSpy);

							should.exist(status);
							status.should.equal(400);
							should.exist(body);
							body.should.deep.equal({
								err: 'invalid_email',
								des: 'email is required'
							});

						}
					};
					var responseSendSpy = sinon.spy(res, 'send');

					var next = {
						next: function (status) {
							sinon.assert.calledOnce(nextSpy);
							sinon.assert.calledOnce(responseSendSpy);

							should.exist(status);
							status.should.equal(false);
							done();
						}
					};
					var nextSpy = sinon.spy(next, 'next');

					var loginEmail_post = require('../../../src/public_routes/auth/loginEmail_post.js');
					loginEmail_post(req, res, next.next);
				});
			});
		});
	});
});
