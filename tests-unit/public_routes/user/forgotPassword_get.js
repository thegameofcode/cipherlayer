'use strict';

const config = require('../../../config.json');
const should = require('chai').should();
const mockery = require('mockery');

describe('public routes', function () {
	describe('/user', function () {
		describe('/:email/password', function () {
			before(function () {
				mockery.enable({
					warnOnReplace: false,
					warnOnUnregistered: false,
					useCleanCache: true
				});
			});

			after(function () {
				mockery.deregisterAll();
				mockery.disable();
			});

			it('white box test of forgot password email creation', function (done) {
				var expectedEmail = 'valid@email.com';
				var expectedUserId = 'USER_ID';
				var expectedPassword = 'EXPECTED PASSWORD';
				var expectedEncryptedPassword = 'EXPECTED ENCRYPTED PASSWORD';
				var expectedAccessToken = 'ACCESS_TOKEN';
				var expectedRefreshToken = 'REFRESH_TOKEN';

				var cryptoManagerStub = function () {
					return {
						randomPassword: function (generationRegex) {
							should.exist(generationRegex);
							generationRegex.should.equal(config.password.generatedRegex);
							return expectedPassword;
						},
						encrypt: function (password, cbk) {
							password.should.equal(expectedPassword);
							cbk(expectedEncryptedPassword);
						}
					};
				};
				mockery.registerMock('../../managers/crypto', cryptoManagerStub);

				var daoManagerStub = {
					getAllUserFields: function (email, cbk) {
						email.should.equal(expectedEmail);
						cbk(null, {
							_id: expectedUserId,
							password: 'PREVIOUS PASSWORD'
						});
					},
					updateField: function (userId, fieldName, fieldValue, cbk) {
						userId.should.equal(expectedUserId);
						fieldName.should.equal('password');
						fieldValue.should.deep.equal(['PREVIOUS PASSWORD', expectedEncryptedPassword]);
						return cbk();
					},
					getRealms: function (cbk) {
						return cbk(null, []);
					}
				};
				mockery.registerMock('../../managers/dao', daoManagerStub);

				var tokenManagerStub = {
					createBothTokens: function (userId, data, cbk) {
						cbk(null, {
							accessToken: expectedAccessToken,
							refreshToken: expectedRefreshToken
						});
					}
				};
				mockery.registerMock('../../managers/token', tokenManagerStub);

				var emailManagerStub = function () {
					return {
						sendEmailForgotPassword: function (email, password, link, cbk) {
							should.exist(email);
							email.should.equal(expectedEmail);
							should.exist(password);
							password.should.equal(expectedPassword);
							should.exist(link);
							should.exist(config.emailVerification.redirectProtocol);
							link.should.equal(config.emailVerification.redirectProtocol + '://user/refreshToken/' + expectedRefreshToken);
							cbk();
						}
					};
				};
				mockery.registerMock('../../managers/email', emailManagerStub);

				var req = {
					params: {
						email: expectedEmail
					}
				};
				var res = {
					send: function (status) {
						should.exist(status);
						status.should.be.equal(204);
					}
				};
				var next = function (status) {
					should.not.exist(status);
					return done();
				};

				const forgotPassword_get = require('../../../src/routes_public/user/forgotPassword_get');
				forgotPassword_get(req, res, next);
			});

		});
	});
});
