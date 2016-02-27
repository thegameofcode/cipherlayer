'use strict';

var should = require('chai').should();
var mockery = require('mockery');
var sinon = require('sinon');
var config = require(process.cwd() + '/config.json');

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
					var expectedRefreshToken = 'VALID_REFRESH_TOKEN';
					var tokenManagerStub = {
						getRefreshTokenInfo: function (refreshToken, cbk) {
							should.exist(refreshToken);
							refreshToken.should.equal(expectedRefreshToken);
							cbk(null, {});
						}
					};
					mockery.registerMock('../../managers/token', tokenManagerStub);

					var req = {
						params: {
							rt: expectedRefreshToken
						}
					};
					var res = {
						send: function (status, body) {
							sinon.assert.notCalled(nextSpy);
							sinon.assert.calledOnce(sendSpy);
							should.exist(status);
							status.should.equal(302);

							should.not.exist(body);
						},
						header: function (headerName, headerValue) {
							should.exist(headerName);
							headerName.toLowerCase().should.equal('location');
							should.exist(headerValue);
							headerValue.should.equal(config.magicLink.scheme + '://user/refreshToken/' + expectedRefreshToken);
						}
					};
					var sendSpy = sinon.spy(res, 'send');
					var headerSpy = sinon.spy(res, 'header');

					var next = {
						next: function (status) {
							sinon.assert.calledOnce(sendSpy);
							sinon.assert.calledOnce(nextSpy);
							sinon.assert.calledOnce(headerSpy);
							should.not.exist(status);
							done();
						}
					};
					var nextSpy = sinon.spy(next, 'next');

					var loginRefreshToken_get = require('../../../src/routes_public/auth/loginRefreshToken_get.js');
					loginRefreshToken_get(req, res, next.next);
				});

				it('400 - invalid refresh token', function (done) {
					var expectedRefreshToken = 'INVALID_REFRESH_TOKEN';
					var tokenManagerStub = {
						getRefreshTokenInfo: function (refreshToken, cbk) {
							should.exist(refreshToken);
							refreshToken.should.equal(expectedRefreshToken);
							cbk({err: 'internal_error'});
						}
					};
					mockery.registerMock('../../managers/token', tokenManagerStub);

					var req = {
						params: {
							rt: expectedRefreshToken
						}
					};
					var res = {
						send: function (status, body) {
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
					var sendSpy = sinon.spy(res, 'send');

					var next = {
						next: function (status) {
							sinon.assert.calledOnce(sendSpy);
							sinon.assert.calledOnce(nextSpy);
							should.exist(status);
							status.should.equal(false);
							done();
						}
					};
					var nextSpy = sinon.spy(next, 'next');

					var loginRefreshToken_get = require('../../../src/routes_public/auth/loginRefreshToken_get.js');
					loginRefreshToken_get(req, res, next.next);
				});

				it('400 - no refresh token', function (done) {
					var req = {
						params: {}
					};
					var res = {
						send: function (status, body) {
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
					var sendSpy = sinon.spy(res, 'send');

					var next = {
						next: function (status) {
							sinon.assert.calledOnce(sendSpy);
							sinon.assert.calledOnce(nextSpy);
							should.exist(status);
							status.should.equal(false);
							done();
						}
					};
					var nextSpy = sinon.spy(next, 'next');

					var loginRefreshToken_get = require('../../../src/routes_public/auth/loginRefreshToken_get.js');
					loginRefreshToken_get(req, res, next.next);
				});
			});
		});
	});
});
