var assert = require('assert');
var request = require('request');
var nock = require('nock');
var clone = require('clone');

var config = require('../../config.json');
var dao = require('../../src/managers/dao.js');

var OPTIONS = {
    url: 'http://localhost:' + config.public_port + '/auth/login/facebook',
    headers: {
        'Content-Type': 'application/json; charset=utf-8'
    },
    method: 'POST',
    followRedirect: false
};
var FB_PROFILE = {
    name: "Test User",
    email: "test@example.com",
    id: "FB1234"
};

module.exports = {
    describe: function() {
        describe.only('/facebook_token', function() {

            beforeEach(function(done) {
                dao.deleteAllUsers(function(err){
                    assert.equal(err, null);
                    done();
                });
            });

            it('exchanges facebook token for an existing cipherlayer user', function(done) {
                nockFBGraphCall(FB_PROFILE, '1234', config.facebook.requestFields);

                var options = clone(OPTIONS);
                options.url ='http://localhost:' + config.public_port + '/auth/login/facebook';

                // TODO: create the user here

                request(options, function(err, res, body) {
                    console.log('REQUEST DONE', err, res, body);
                    done();
                });
            });

            it('exchanges facebook token for new user', function(done) {
                nockFBGraphCall(FB_PROFILE, '1234', config.facebook.requestFields);
                nockPrivateCall(config, 'user1234');

                var options = clone(OPTIONS);
                options.url ='http://localhost:' + config.public_port + '/auth/login/facebook';
                request(options, function(err, res, body) {
                    console.log('REQUEST new DONE', err, res, body);
                    done();
                });

            });

        });
    }
};


function nockFBGraphCall(profile, access_token, fields) {
    fields = encodeURIComponent(fields);
    nock('https://graph.facebook.com')
      .get('/v2.5/me?access_token=' + access_token + '&fields=' + fields + '&format=json&method=get&pretty=0&suppress_http_code=1')
      .reply(200, profile);
}

function nockPrivateCall(config, userId) {
    nock('http://' + config.private_host + ':' + config.private_port)
      .post(config.passThroughEndpoint.path)
      .reply(201, {id: userId});
}

