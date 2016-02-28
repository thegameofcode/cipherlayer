const assert = require('assert');
const request = require('request');
const nock = require('nock');
const _ = require('lodash');

const config = require('../../config.json');
const userDao = require('../../src/managers/dao');

const versionHeader = 'test/1';

const OPTIONS = {
	url: `http://localhost:${config.public_port}/auth/login/facebook`,
	headers: {
		'Content-Type': 'application/json; charset=utf-8',
		[config.version.header]: versionHeader
	},
	json: true,
	body: {
		accessToken: 'abcd1234'
	},
	method: 'POST',
	followRedirect: false
};

const baseUser = {
	id: 'a1b2c3d4e5f6',
	email: 'test@a.com',
	password: 'pass1'
};

const FB_PROFILE = {
	name: "Test User",
	email: "test@a.com",
	id: "fba1b2c3d4e5f6"
};

describe('/facebook_token', function () {

	beforeEach(function (done) {
		userDao.deleteAllUsers(function (err) {
			assert.equal(err, null);
			return done();
		});
	});

	it('exchanges facebook token for an existing cipherlayer user', function (done) {
		nockFBGraphCall(FB_PROFILE, OPTIONS.body.accessToken, config.facebook.requestFields);

		var options = _.cloneDeep(OPTIONS);
		options.url = `http://localhost:${config.public_port}/auth/login/facebook`;

		var existingUser = _.cloneDeep(baseUser);
		existingUser.username = existingUser.email;
		delete existingUser.email;

		userDao.addUser(existingUser, function (error) {
			assert.equal(error, null);

			request(options, function (err, res, body) {
				assert.ok(body.accessToken);
				assert.ok(body.refreshToken);
				assert.ok(body.expiresIn);

				userDao.getFromUsername(baseUser.email, function (error, user) {
					assert.ok(user);
					assert.equal(user.username, existingUser.username);
					assert.ok(user.platforms);
					var fbPlatform = user.platforms[0];
					assert.equal(fbPlatform.platform, 'fb');
					assert.equal(fbPlatform.accessToken, OPTIONS.body.accessToken);
					return done();
				});
			});
		});
	});

	it('exchanges facebook token for new user', function (done) {
		nockFBGraphCall(FB_PROFILE, OPTIONS.body.accessToken, config.facebook.requestFields);
		nockPrivateCall(config, baseUser.id);

		var options = _.cloneDeep(OPTIONS);
		options.url = `http://localhost:${config.public_port}/auth/login/facebook`;

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.ok(body.accessToken);
			assert.ok(body.refreshToken);
			assert.ok(body.expiresIn);

			userDao.getFromUsername(baseUser.email, function (err, foundUser) {
				assert.equal(err, null);
				assert.ok(foundUser);
				assert.equal(foundUser.username, baseUser.email);
				assert.ok(foundUser.platforms);
				var fbPlatform = foundUser.platforms[0];
				assert.equal(fbPlatform.platform, 'fb');
				assert.equal(fbPlatform.accessToken, OPTIONS.body.accessToken);
				return done();
			});
		});
	});

	it('creates a user with a facebook domain email when username field is missing', function (done) {

		var noEmailUser = _.cloneDeep(baseUser);
		delete noEmailUser.email;

		var madeUpEmailFbProfile = _.cloneDeep(FB_PROFILE);
		delete madeUpEmailFbProfile.email;

		var userEmail = 'fb' + noEmailUser.id + '@facebook.com';

		nockFBGraphCall(madeUpEmailFbProfile, OPTIONS.body.accessToken, config.facebook.requestFields);
		nockPrivateCall(config, noEmailUser.id);

		var options = _.clone(OPTIONS);
		options.url = `http://localhost:${config.public_port}/auth/login/facebook`;

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.ok(body.accessToken);
			assert.ok(body.refreshToken);
			assert.ok(body.expiresIn);

			userDao.getFromUsername(userEmail, function (err, foundUser) {
				assert.equal(err, null);
				assert.ok(foundUser);
				assert.equal(foundUser.username, userEmail);
				assert.ok(foundUser.platforms);
				var fbPlatform = foundUser.platforms[0];
				assert.equal(fbPlatform.platform, 'fb');
				assert.equal(fbPlatform.accessToken, OPTIONS.body.accessToken);
				return done();
			});
		});
	});
});

function nockFBGraphCall (profile, access_token, fields) {
	nock('https://graph.facebook.com')
		.get(`/v2.5/me?fields=${encodeURIComponent(fields)}&format=json&method=get&pretty=0&suppress_http_code=1&access_token=${access_token}`)
		.reply(200, profile);
}

function nockPrivateCall (config, userId) {
	nock(`http://${config.private_host}:${config.private_port}`)
		.post(config.passThroughEndpoint.path)
		.reply(201, {id: userId});
}
