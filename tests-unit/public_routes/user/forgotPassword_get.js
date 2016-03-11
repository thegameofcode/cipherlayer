'use strict';

const config = require('../../../config');
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
				const expectedEmail = 'valid@email.com';
				const expectedUserId = 'USER_ID';
				const expectedPassword = 'EXPECTED PASSWORD';
				const expectedEncryptedPassword = 'EXPECTED ENCRYPTED PASSWORD';
				const expectedAccessToken = 'ACCESS_TOKEN';
				const expectedRefreshToken = 'REFRESH_TOKEN';

				const cryptoManagerStub = function () {
					return {
						randomPassword(generationRegex) {
							should.exist(generationRegex);
							generationRegex.should.equal(config.password.generatedRegex);
							return expectedPassword;
						},
						encrypt(password, cbk) {
							password.should.equal(expectedPassword);
							cbk(expectedEncryptedPassword);
						}
					};
				};
				mockery.registerMock('../../managers/crypto', cryptoManagerStub);

				const daoManagerStub = {
					getAllUserFields(email, cbk) {
						email.should.equal(expectedEmail);
						return cbk(null, {
							_id: expectedUserId,
							password: 'PREVIOUS PASSWORD'
						});
					},
					updateField(userId, fieldName, fieldValue, cbk) {
						userId.should.equal(expectedUserId);
						fieldName.should.equal('password');
						fieldValue.should.deep.equal(['PREVIOUS PASSWORD', expectedEncryptedPassword]);
						return cbk();
					},
					getRealms(cbk) {
						return cbk(null, []);
					}
				};
				mockery.registerMock('../../managers/dao', daoManagerStub);

				const tokenManagerStub = {
					createBothTokens(userId, data, cbk) {
						cbk(null, {
							accessToken: expectedAccessToken,
							refreshToken: expectedRefreshToken
						});
					}
				};
				mockery.registerMock('../../managers/token', tokenManagerStub);

				const emailManagerStub = function () {
					return {
						sendEmailForgotPassword(email, password, link, cbk) {
							should.exist(email);
							email.should.equal(expectedEmail);
							should.exist(password);
							password.should.equal(expectedPassword);
							should.exist(link);
							should.exist(config.emailVerification.redirectProtocol);
							link.should.equal(`${config.emailVerification.redirectProtocol}://user/refreshToken/${expectedRefreshToken}`);
							cbk();
						}
					};
				};
				mockery.registerMock('../../managers/email', emailManagerStub);

				const req = {
					params: {
						email: expectedEmail
					}
				};
				const res = {
					send(status) {
						should.exist(status);
						status.should.be.equal(204);
					}
				};
				const next = function (status) {
					should.not.exist(status);
					return done();
				};

				const forgotPassword_get = require('../../../src/routes_public/user/forgotPassword_get');
				forgotPassword_get(req, res, next);
			});

		});
	});
});
