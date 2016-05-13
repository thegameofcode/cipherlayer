'use strict';

const assert = require('assert');
const sinon = require('sinon');
const mockery = require('mockery');
const cloneDeep = require('lodash/cloneDeep');
const config = require('../config');

const getActivateUserInstance = (configStub, usrMngStub) => {

	mockery.enable({
		useCleanCache: true,
		warnOnReplace: false,
		warnOnUnregistered: false
	});
	mockery.registerMock('../../../config', configStub);
	mockery.registerMock('../../managers/user', usrMngStub);

	return require('../src/routes_public/user/activateUser_get');
};

describe('Redirect on error', function() {

	beforeEach(function (done) {
		mockery.enable({
			useCleanCache: true,
			warnOnReplace: false,
			warnOnUnregistered: false
		});
		return done();
	});

	afterEach(function (done) {
		mockery.disable();
		return done();
	});

	it('redirect on unknown error when config enabled', function(done) {

		const testConfig = cloneDeep(config);
		testConfig.redirectOnError = { enabled: true };

		const tokenSpy = sinon.spy((token, cbk) => {
			return cbk(new Error('Unknown error'));
		});
		const usrMngStub = () => {
			return {
				createUserByToken: tokenSpy
			};
		};

		const requestStub = {
			params: {}
		};

		const res = {};
		const responseStub = {
			header: () => {},
			redirect: sinon.spy((statusCode, url, next) => next()),
			send: data => {
				res.body = data;
				return responseStub;
			}
		};

		const activateEndpoint = getActivateUserInstance(testConfig, usrMngStub);

		activateEndpoint(requestStub, responseStub, error => {
			assert.equal(error, null);
			assert(responseStub.redirect.calledWith(302, '/error'));
			done();
		});

	});

	it('redirect default url if no specific is present', function(done) {

		const testConfig = cloneDeep(config);
		testConfig.redirectOnError = {
			enabled: true,
			default_url: '/default/error_url.html'
		};
		const tokenSpy = sinon.spy((token, cbk) => {
			return cbk(new Error('Unknown error'));
		});
		const usrMngStub = () => {
			return {
				createUserByToken: tokenSpy
			};
		};

		const requestStub = {
			params: {}
		};

		const res = {};
		const responseStub = {
			header: () => {},
			redirect: sinon.spy((statusCode, url, next) => next()),
			send: data => {
				res.body = data;
				return responseStub;
			}
		};

		const activateEndpoint = getActivateUserInstance(testConfig, usrMngStub);

		activateEndpoint(requestStub, responseStub, error => {
			assert.equal(error, null);
			assert(responseStub.redirect.calledWith(302, '/default/error_url.html'));
			done();
		});

	});

	it('redirect to specific error html', function(done) {

		const testConfig = cloneDeep(config);
		testConfig.redirectOnError = {
			enabled: true,
			default_url: '/default/error_url.html',
			user_creation_failed: '/specific/error_url.html'
		};
		const tokenSpy = sinon.spy((token, cbk) => {
			return cbk({
				err: 'user_creation_failed',
				des: 'Error on user creation'
			});
		});
		const usrMngStub = () => {
			return {
				createUserByToken: tokenSpy
			};
		};

		const requestStub = {
			params: {}
		};

		const res = {};
		const responseStub = {
			header: () => {},
			redirect: sinon.spy((statusCode, url, next) => next()),
			send: data => {
				res.body = data;
				return responseStub;
			}
		};

		const activateEndpoint = getActivateUserInstance(testConfig, usrMngStub);

		activateEndpoint(requestStub, responseStub, error => {
			assert.equal(error, null);
			assert(responseStub.redirect.calledWith(302, '/specific/error_url.html'));
			done();
		});

	});
});
