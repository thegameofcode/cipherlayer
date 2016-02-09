var assert = require('assert');
var request = require('request');
var nock = require('nock');
var clone = require('clone');

var config = require('../../config.json');
var userDao = require('../../src/managers/dao.js');

var OPTIONS = {
    url: 'http://localhost:' + config.public_port + '/auth/login/facebook',
    headers: {
        'Content-Type': 'application/json; charset=utf-8'
    },
    json: true,
    body: {
        accessToken: 'abcd1234'
    },
    method: 'POST',
    followRedirect: false
};

var baseUser = {
    id: 'a1b2c3d4e5f6',
    email: 'test@a.com',
    password: 'pass1'
};

var FB_PROFILE = {
    name: "Test User",
    email: "test@a.com",
    id: "fba1b2c3d4e5f6"
};

module.exports = {
    describe: function() {
        describe('/facebook_token', function() {

            beforeEach(function(done) {
                userDao.deleteAllUsers(function(err){
                    assert.equal(err, null);
                    done();
                });
            });

            it('exchanges facebook token for an existing cipherlayer user', function(done) {
                nockFBGraphCall(FB_PROFILE, OPTIONS.body.accessToken, config.facebook.requestFields);

                var options = clone(OPTIONS);
                options.url ='http://localhost:' + config.public_port + '/auth/login/facebook';
                options.headers[config.version.header] = "test/1";

                var existingUser = clone(baseUser);
                existingUser.username = existingUser.email;
                delete existingUser.email;

                userDao.addUser()(existingUser, function(error) {
                    assert.equal(error, null);

                    request(options, function (err, res, body) {
                        assert.ok(body.accessToken);
                        assert.ok(body.refreshToken);
                        assert.ok(body.expiresIn);

                        userDao.getFromUsername(baseUser.email, function(error, user) {
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

            it('exchanges facebook token for new user', function(done) {
                nockFBGraphCall(FB_PROFILE, OPTIONS.body.accessToken, config.facebook.requestFields);
                nockPrivateCall(config, baseUser.id);

                var options = clone(OPTIONS);
                options.url ='http://localhost:' + config.public_port + '/auth/login/facebook';
                options.headers[config.version.header] = "test/1";

                request(options, function(err, res, body) {
                    assert.equal(err, null);
                    assert.ok(body.accessToken);
                    assert.ok(body.refreshToken);
                    assert.ok(body.expiresIn);

                    userDao.getFromUsername(baseUser.email, function(err, foundUser) {
                        assert.equal(err, null);
                        assert.ok(foundUser);
                        assert.equal(foundUser.username, baseUser.email);
                        assert.ok(foundUser.platforms);
                        var fbPlatform = foundUser.platforms[0];
                        assert.equal(fbPlatform.platform, 'fb');
                        assert.equal(fbPlatform.accessToken, OPTIONS.body.accessToken);
                        done();
                    });
                });
            });

            it('creates a user with a facebook domain email when username field is missing', function(done) {

                var noEmailUser = clone(baseUser);
                delete noEmailUser.email;

                var madeUpEmailFbProfile = clone(FB_PROFILE);
                delete madeUpEmailFbProfile.email;

                var userEmail = 'fb' + noEmailUser.id + '@facebook.com';

                nockFBGraphCall(madeUpEmailFbProfile, OPTIONS.body.accessToken, config.facebook.requestFields);
                nockPrivateCall(config, noEmailUser.id);

                var options = clone(OPTIONS);
                options.url ='http://localhost:' + config.public_port + '/auth/login/facebook';
                options.headers[config.version.header] = "test/1";

                request(options, function(err, res, body) {
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
                        done();
                    });
                });
            });
        });
    }
};


function nockFBGraphCall(profile, access_token, fields) {
    fields = encodeURIComponent(fields);
    nock('https://graph.facebook.com')
      .get('/v2.5/me?fields=' + fields + '&format=json&method=get&pretty=0&suppress_http_code=1' + '&access_token=' + access_token)
      .reply(200, profile);
}

function nockPrivateCall(config, userId) {
    nock('http://' + config.private_host + ':' + config.private_port)
      .post(config.passThroughEndpoint.path)
      .reply(201, {id: userId});
}

