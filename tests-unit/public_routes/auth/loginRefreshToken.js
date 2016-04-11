'use strict';

const should = require('chai').should();
const mockery = require('mockery');
const sinon = require('sinon');
const config = require('../../../config');

describe('public routes', function () {
	describe('/auth', function () {
		describe('/login', function () {
			describe('/refreshToken', function () {
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

				it('302 - valid redirection', function (done) {
					const expectedRefreshToken = 'VALID_REFRESH_TOKEN';
					const tokenManagerStub = {
						getRefreshTokenInfo(refreshToken, cbk) {
							should.exist(refreshToken);
							refreshToken.should.equal(expectedRefreshToken);
							cbk(null, {});
						}
					};
					mockery.registerMock('../../managers/token', tokenManagerStub);

					const req = {
						params: {
							rt: expectedRefreshToken
						}
					};
					const res = {
						send(status, body) {
							sinon.assert.notCalled(nextSpy);
							sinon.assert.calledOnce(sendSpy);
							should.exist(status);
							status.should.equal(302);

							should.not.exist(body);
						},
						header(headerName, headerValue) {
							should.exist(headerName);
							headerName.toLowerCase().should.equal('location');
							should.exist(headerValue);
							headerValue.should.equal(`${config.magicLink.scheme}://user/refreshToken/${expectedRefreshToken}`);
						}
					};
					const sendSpy = sinon.spy(res, 'send');
					const headerSpy = sinon.spy(res, 'header');

					const next = {
						next(status) {
							sinon.assert.calledOnce(sendSpy);
							sinon.assert.calledOnce(nextSpy);
							sinon.assert.calledOnce(headerSpy);
							should.not.exist(status);
							return done();
						}
					};
					const nextSpy = sinon.spy(next, 'next');


					const loginRefreshToken_get = require('../../../src/routes_public/auth/loginRefreshToken_get');
					loginRefreshToken_get(req, res, next.next);
				});

				it('400 - invalid refresh token', function (done) {
					const expectedRefreshToken = 'INVALID_REFRESH_TOKEN';
					const tokenManagerStub = {
						getRefreshTokenInfo(refreshToken, cbk) {
							should.exist(refreshToken);
							refreshToken.should.equal(expectedRefreshToken);
							cbk({err: 'internal_error'});
						}
					};
					mockery.registerMock('../../managers/token', tokenManagerStub);

					const req = {
						params: {
							rt: expectedRefreshToken
						}
					};
					const res = {
						send(status, body) {
							sinon.assert.notCalled(nextSpy);
							sinon.assert.calledOnce(sendSpy);
							should.exist(status);
							status.should.equal(400);
							should.exist(body);
							body.should.deep.equal({
								err: 'invalid_request',
								des: 'invalid refresh token'
							});
						}
					};
					const sendSpy = sinon.spy(res, 'send');

					const next = {
						next(status) {
							sinon.assert.calledOnce(sendSpy);
							sinon.assert.calledOnce(nextSpy);
							should.not.exist(status);
							return done();
						}
					};
					let nextSpy = sinon.spy(next, 'next');

					const loginRefreshToken_get = require('../../../src/routes_public/auth/loginRefreshToken_get');
					loginRefreshToken_get(req, res, next.next);
				});

				it('400 - no refresh token', function (done) {
					const req = {
						params: {}
					};
					const res = {
						send(status, body) {
							sinon.assert.notCalled(nextSpy);
							sinon.assert.calledOnce(sendSpy);
							should.exist(status);
							status.should.equal(400);
							should.exist(body);
							body.should.deep.equal({
								err: 'invalid_request',
								des: 'refresh token required'
							});
						}
					};
					const sendSpy = sinon.spy(res, 'send');

					const next = {
						next(status) {
							sinon.assert.calledOnce(sendSpy);
							sinon.assert.calledOnce(nextSpy);
							should.not.exist(status);
							return done();
						}
					};
					const nextSpy = sinon.spy(next, 'next');

					const loginRefreshToken_get = require('../../../src/routes_public/auth/loginRefreshToken_get');
					loginRefreshToken_get(req, res, next.next);
				});
			});
		});
	});
});
