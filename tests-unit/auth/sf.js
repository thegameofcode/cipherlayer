'use strict';

const assert = require('assert');
const request = require('request');
const ciphertoken = require('ciphertoken');
const nock = require('nock');
const _ = require('lodash');

const config = require('../../config');
const dao = require('../../src/managers/dao');

const SF_PROFILE = require('../resources/sfProfileTemplate');

const accessTokenSettings = require('../token_settings').accessTokenSettings;
const refreshTokenSettings = require('../token_settings').refreshTokenSettings;

const versionHeader = 'test/1';

const OPTIONS = {
	url: `http://localhost:${config.public_port}/auth/sf`,
	headers: {
		'Content-Type': 'application/json; charset=utf-8',
		[config.version.header]: versionHeader
	},
	method: 'GET',
	followRedirect: false
};

function nockSFLoginCall () {
	nock('https://login.salesforce.com')
		.filteringPath(function (path) {
			if (path.indexOf('/services/oauth2/authorize') > -1) {
				return '/services/oauth2/authorize';
			}
			return path;
		})
		.get('/services/oauth2/authorize')
		.reply(302, {accessToken: 'sf1234'})
		.post('/services/oauth2/token')
		.reply(200, {
			access_token: 'a1b2c3d4e5f6',
			refresh_token: 'f6e5d4c3d2a1',
			instance_url: 'https://cs15.salesforce.com',
			id: 'https://test.salesforce.com/id/00De00000004cdeEAA/005e0000001uNIyAAM'
		});
}

function nockSFGetProfileCall (profile) {
	nock('https://cs15.salesforce.com')
		.get('/id/00De00000004cdeEAA/005e0000001uNIyAAM')
		.reply(200, profile);
}

function nockSFGetOptInfo () {
	nock('https://cs15.salesforce.com')
		.get('/services/data/v26.0/chatter/users/005e0000001uNIyAAM')
		.reply(200, {
			position: 'Backend Developer',
			company: 'Company'
		});
}

describe('/sf', function () {
	beforeEach(dao.deleteAllUsers);

	it('GET 302', function (done) {
		const options = _.clone(OPTIONS);

		request(options, function (err, res, body) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 302, body);
			return done();
		});
	});

	describe('/callback', function () {
		it('302 invalid data', function (done) {
			const options = _.clone(OPTIONS);
			options.url = `http://localhost:${config.public_port}/auth/sf/callback`;

			request(options, function (err, res, body) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 302, body);
				return done();
			});
		});
	});

	it('203 not exists (default avatar)', function (done) {
		nockSFLoginCall();
		nockSFGetProfileCall(SF_PROFILE);
		nockSFGetOptInfo();

		const options = _.clone(OPTIONS);
		options.url = `http://localhost:${config.public_port}/auth/sf/callback?code=a1b2c3d4e5f6`;

		request(options, function (err, res, rawBody) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 203, rawBody);
			const body = JSON.parse(rawBody);

			assert.equal(body.name, 'Name');
			assert.equal(body.lastname, 'Lastname');
			assert.equal(body.email, `name.lastname${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`);

			if (config.salesforce.replaceDefaultAvatar) {
				assert.equal(body.avatar, config.salesforce.replaceDefaultAvatar.replacementAvatar);
			}

			assert.equal(body.phone, '000000000');
			assert.equal(body.country, 'ES');
			assert.notEqual(body.sf, undefined);

			ciphertoken.getTokenSet(accessTokenSettings, body.sf, function (err, sfTokenInfo) {
				assert.equal(err, null);
				assert.equal(sfTokenInfo.userId, '00De00000004cdeEAA/005e0000001uNIyAAM');
				assert.notEqual(sfTokenInfo.data.accessToken, undefined);
				assert.notEqual(sfTokenInfo.data.refreshToken, undefined);
				return done();
			});
		});
	});

	describe('Valid avatar', function () {
		let configAWSParam = false;

		it('Get AWS configuration', function (done) {
			const msg = 'You must configure your AWS service in the config file, ' +
				'\r\notherwise you must skip the next test, which use AWS';

			assert.notEqual(config.aws, null, msg);
			assert.notEqual(config.aws, 'undefined', msg);

			assert.notEqual(config.aws.accessKeyId, null, msg);
			assert.notEqual(config.aws.accessKeyId, 'undefined', msg);

			assert.notEqual(config.aws.secretAccessKey, null, msg);
			assert.notEqual(config.aws.secretAccessKey, 'undefined', msg);

			assert.notEqual(config.aws.region, null, msg);
			assert.notEqual(config.aws.region, 'undefined', msg);

			assert.notEqual(config.aws.buckets, null, msg);
			assert.notEqual(config.aws.buckets, 'undefined', msg);

			assert.notEqual(config.aws.buckets.avatars, null, msg);
			assert.notEqual(config.aws.buckets.avatars, 'undefined', msg);

			configAWSParam = true;
			return done();
		});

		it.skip('203 not exists (valid avatar)', function (done) {
			if (!configAWSParam) {
				return done();
			}

			const sfProfile = _.clone(SF_PROFILE);
			sfProfile.photos.picture = 'https://es.gravatar.com/userimage/75402146/7781b7690113cedf43ba98c75b08cea0.jpeg';
			sfProfile.photos.thumbnail = 'https://es.gravatar.com/userimage/75402146/7781b7690113cedf43ba98c75b08cea0.jpeg';

			nockSFLoginCall();
			nockSFGetProfileCall(sfProfile);
			nockSFGetOptInfo();

			const options = _.clone(OPTIONS);
			options.url = `http://localhost:${config.public_port}/auth/sf/callback?code=a1b2c3d4e5f6`;

			request(options, function (err, res, rawBody) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 203, rawBody);
				const body = JSON.parse(rawBody);

				assert.equal(body.name, 'Name');
				assert.equal(body.lastname, 'Lastname');
				assert.equal(body.email, sfProfile.email);
				assert.notEqual(body.avatar, undefined);
				assert.notEqual(body.avatar, null);
				assert.equal(body.phone, '000000000');
				assert.equal(body.country, 'ES');
				assert.notEqual(body.sf, undefined);
				return done();
			});
		});
	});

	it('200 OK', function (done) {
		const user = {
			id: 'a1b2c3d4e5f6',
			username: `name.lastname${config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''}`,
			password: '12345678'
		};

		dao.addUser(user, function (err, createdUser) {
			assert.equal(err, null);
			assert.notEqual(createdUser, undefined);

			nockSFLoginCall();
			nockSFGetProfileCall(SF_PROFILE);

			const options = _.clone(OPTIONS);
			options.url = `http://localhost:${config.public_port}/auth/sf/callback?code=a1b2c3d4e5f6`;
			options.followAllRedirects = true;

			request(options, function (err, res, rawBody) {
				assert.equal(err, null);
				assert.equal(res.statusCode, 200, rawBody);
				const body = JSON.parse(rawBody);
				assert.notEqual(body.refreshToken, undefined);
				assert.notEqual(body.expiresIn, undefined);

				dao.getFromId(createdUser._id, function (err, foundUser) {
					assert.equal(err, null);
					assert.notEqual(foundUser.platforms, undefined, 'stored user must contain a platforms array');
					assert.equal(foundUser.platforms.length, 1, 'stored user must contain 1 platform');
					assert.equal(foundUser.platforms[0].accessToken.params.access_token, 'a1b2c3d4e5f6', 'invalid access token stored');

					ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function (err, tokenInfo) {
						assert.equal(err, null);
						assert.equal(tokenInfo.userId, createdUser._id, 'bad accessToken userId');

						ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function (err, tokenInfo) {
							assert.equal(err, null);
							assert.equal(tokenInfo.userId, createdUser._id, 'bad refreshToken userId');
							return done();
						});
					});
				});

			});
		});
	});

	it('401 deny permissions to SF', function (done) {
		const options = _.clone(OPTIONS);
		options.url = `http://localhost:${config.public_port}/auth/sf/callback?error=access_denied&error_description=end-user+denied+authorization`;

		request(options, function (err, res, rawBody) {
			assert.equal(err, null);
			assert.equal(res.statusCode, 401, rawBody);
			const body = JSON.parse(rawBody);
			assert.deepEqual(body, {err: 'access_denied', des: 'end-user denied authorization'});
			return done();
		});
	});
});
