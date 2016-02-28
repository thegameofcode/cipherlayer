const assert = require('assert');
const async = require('async');

const userAppVersion = require('../src/middlewares/userAppVersion');
const userDao = require('../src/managers/dao');

const config = require('../config.json');

const settings = {
	version: {
		header: config.version.header,
		platforms: {
			test: {
				link: 'http://testLink',
				1: true
			}
		},
		installPath: '/install'
	}
};

const baseUser = {
	id: 'a1b2c3d4e5f6',
	username: `username${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
	password: '12345678'
};

describe('middleware userAppVersion', function () {

	beforeEach(function (done) {
		async.series([
			userDao.connect,
			userDao.deleteAllUsers
		], done);
	});

	afterEach(userDao.disconnect);

	it('update (user has no appVersion)', function (done) {
		userDao.addUser(baseUser, function (err, createdUser) {
			const req = {
				headers: {},
				url: '/api/me',
				method: 'GET',
				user: createdUser
			};

			req.headers[config.version.header] = 'version 1.0.0';

			const res = {};
			const next = function (canContinue) {
				if (canContinue === undefined || canContinue === true) {
					userDao.getFromId(createdUser._id, function (err, foundUser) {
						assert.equal(err, null);
						assert.equal(foundUser.appVersion, 'version 1.0.0');
						return done();
					});
				}
			};

			userAppVersion(settings)(req, res, next);
		});
	});

	it('update (different appVersion)', function (done) {
		baseUser.appVersion = 'version 1.0.0';
		userDao.addUser(baseUser, function (err, createdUser) {
			const req = {
				headers: {},
				url: '/api/me',
				method: 'GET',
				user: createdUser
			};

			req.headers[config.version.header] = 'version 2.0.0';

			const res = {};
			const next = function (canContinue) {
				if (canContinue === undefined || canContinue === true) {
					userDao.getFromId(createdUser._id, function (err, foundUser) {
						assert.equal(err, null);
						assert.equal(foundUser.appVersion, 'version 2.0.0');
						return done();
					});
				}
			};

			userAppVersion(settings)(req, res, next);
		});
	});

	it('continue (same appVersion)', function (done) {
		baseUser.appVersion = 'version 1.0.0';
		userDao.addUser(baseUser, function (err, createdUser) {
			const req = {
				headers: {},
				url: '/api/me',
				method: 'GET',
				user: createdUser
			};

			req.headers[config.version.header] = 'version 1.0.0';

			const res = {};
			const next = function (canContinue) {
				if (canContinue === undefined || canContinue === true) {
					userDao.getFromId(createdUser._id, function (err, foundUser) {
						assert.equal(err, null);
						assert.equal(foundUser.appVersion, 'version 1.0.0');
						return done();
					});
				}
			};

			userAppVersion(settings)(req, res, next);
		});
	});

	it('continue (no version header)', function (done) {
		const req = {
			headers: {},
			url: '/api/me',
			method: 'GET',
			user: baseUser
		};

		const res = {};
		const next = function (canContinue) {
			if (canContinue === undefined || canContinue === true) {
				return done();
			}
		};

		userAppVersion(settings)(req, res, next);
	});
});
