'use strict';

const should = require('chai').should();
const mockery = require('mockery');
const sinon = require('sinon');
const config = require('../../../config');

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

				it('204 - send valid email with a magic link', function (done) {
					const expectedEmail = 'user@email.com';
					const expectedRefreshToken = 'REFRESH_TOKEN';
					const expectedLink = `${config.public_url}/auth/login/refreshToken?rt=${expectedRefreshToken}`;
					const expectedUserId = 'USER_ID';

					const daoManagerStub = {
						getFromUsername(email, cbk) {
							should.exist(email);
							email.should.equal(expectedEmail);
							cbk(null, {
								_id: expectedUserId
							});
						}
					};
					mockery.registerMock('../../managers/dao', daoManagerStub);

					const tokenManagerStub = {
						createRefreshToken(userId, data, cbk) {
							should.exist(userId);
							userId.should.equal(expectedUserId);
							cbk(null, expectedRefreshToken);
						}
					};
					mockery.registerMock('../../managers/token', tokenManagerStub);

					const emailManagerInstanceStub = {
						sendEmailMagicLink(email, link, cbk) {
							should.exist(email);
							email.should.equal(expectedEmail);

							should.exist(link);
							link.should.equal(expectedLink);

							cbk();
						}
					};
					const emailManagerStub = function () {
						return emailManagerInstanceStub;
					};
					mockery.registerMock('../../managers/email', emailManagerStub);
					const emailManagerSendEmailMagicLinkSpy = sinon.spy(emailManagerInstanceStub, 'sendEmailMagicLink');

					const req = {
						params: {
							email: expectedEmail
						}
					};
					const res = {
						send(status) {
							should.exist(status);
							status.should.equal(204);
							sinon.assert.calledOnce(emailManagerSendEmailMagicLinkSpy);
						}
					};
					const responseSendSpy = sinon.spy(res, 'send');
					const next = function () {
						sinon.assert.calledOnce(responseSendSpy);
						return done();
					};

					const loginEmail_post = require('../../../src/routes_public/auth/loginEmail_post');
					loginEmail_post(req, res, next);
				});

				it('400 - no email on body', function (done) {
					const req = {
						params: {}
					};
					const res = {
						send(status, body) {
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
					const responseSendSpy = sinon.spy(res, 'send');

					const next = {
						next(status) {
							sinon.assert.calledOnce(nextSpy);
							sinon.assert.calledOnce(responseSendSpy);

							should.not.exist(status);
							return done();
						}
					};
					const nextSpy = sinon.spy(next, 'next');

					const loginEmail_post = require('../../../src/routes_public/auth/loginEmail_post');
					loginEmail_post(req, res, next.next);
				});
			});
		});
	});
});
