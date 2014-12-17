var assert = require('assert');
var fs = require('fs');
var request = require('request');
var ciphertoken = require('ciphertoken');
var nock = require('nock');
var clone = require('clone');

var config = JSON.parse(fs.readFileSync('config.json','utf8'));
var dao = require('../../dao.js');

var URLS = {
    "profile": "https://cs15.salesforce.com/005e0000001uNIyAAM",
    "users": "https://cs15.salesforce.com/services/data/v{version}/chatter/users"
};

module.exports = {
    describe: function(accessTokenSettings, refreshTokenSettings){
        describe('/sf', function(){
            beforeEach(function(done){
                dao.deleteAllUsers(function(err){
                    assert.equal(err, null);
                    done();
                });
            });

            it('GET 302', function(done){
                request(OPTIONS, function(err, res, body){
                    assert.equal(err, null);
                    assert.equal(res.statusCode, 302);
                    done();
                });
            });

            describe('/callback', function(){
                it('302 invalid data', function(done){
                    var options = clone(OPTIONS);
                    options.url ='http://localhost:' + config.public_port + '/auth/sf/callback';

                    request(options, function(err,res,body){
                        assert.equal(err,null);
                        assert.equal(res.statusCode, 302);
                        done();
                    });
                });
            });

            it('203 not exists (no avatar)', function(done){
                nockSFLoginCall();
                nockSFGetProfileCall(SF_PROFILE);

                var options = clone(OPTIONS);
                options.url ='http://localhost:' + config.public_port + '/auth/sf/callback?code=a1b2c3d4e5f6';

                request(options, function(err,res,body){
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 203, body);
                    body = JSON.parse(body);

                    assert.equal(body.name, 'Name');
                    assert.equal(body.lastname, 'Lastname');
                    assert.equal(body.email, 'name.lastname@email.com');
                    assert.equal(body.avatar, null);
                    assert.equal(body.phone, '000000000');
                    assert.equal(body.country, 'ES');
                    assert.notEqual(body.sf, undefined);

                    ciphertoken.getTokenSet(accessTokenSettings, body.sf, function(err, sfTokenInfo){
                        assert.equal(err,null);
                        assert.equal(sfTokenInfo.userId,'00De00000004cdeEAA/005e0000001uNIyAAM');
                        assert.notEqual(sfTokenInfo.data.accessToken, undefined);
                        assert.notEqual(sfTokenInfo.data.refreshToken, undefined);
                        done();
                    });
                });
            });

            describe('Valid avatar', function(){
                var configAWSParam = false;

                it('Get AWS configuration', function (done) {
                    var msg = 'You must configure your AWS service in the config file, '
                        + '\r\notherwise you must skip the next test, which use AWS';

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
                    done();
                });

                it('203 not exists (valid avatar)', function(done){
                    if(!configAWSParam) return done();

                    nockSFLoginCall();

                    var sfProfile = clone(SF_PROFILE);
                    sfProfile.photos.picture = "https://es.gravatar.com/userimage/75402146/7781b7690113cedf43ba98c75b08cea0.jpeg";
                    sfProfile.photos.thumbnail = "https://es.gravatar.com/userimage/75402146/7781b7690113cedf43ba98c75b08cea0.jpeg";
                    nockSFGetProfileCall(sfProfile);

                    var options = clone(OPTIONS);
                    options.url = 'http://localhost:' + config.public_port + '/auth/sf/callback?code=a1b2c3d4e5f6';

                    request(options, function(err,res,body){
                        assert.equal(err,null);
                        assert.equal(res.statusCode, 203, body);
                        body = JSON.parse(body);

                        assert.equal(body.name, 'Name');
                        assert.equal(body.lastname, 'Lastname');
                        assert.equal(body.email, 'name.lastname@email.com');
                        assert.notEqual(body.avatar, undefined);
                        assert.notEqual(body.avatar, null);
                        assert.equal(body.phone, '000000000');
                        assert.equal(body.country, 'ES');
                        assert.notEqual(body.sf, undefined);
                        done();
                    });
                });
            });

            it('200 OK', function(done){
                var user = {
                    id: 'a1b2c3d4e5f6',
                    username: 'name.lastname@email.com',
                    password: '12345678'
                };

                dao.addUser(user, function(err, createdUser){
                    assert.equal(err,null);
                    assert.notEqual(createdUser, undefined);

                    nockSFLoginCall();
                    nockSFGetProfileCall(SF_PROFILE);

                    var options = clone(OPTIONS);
                    options.url = 'http://localhost:' + config.public_port + '/auth/sf/callback?code=a1b2c3d4e5f6';
                    options.followAllRedirects = true;

                    request(options, function(err,res,body){
                        assert.equal(err,null);
                        assert.equal(res.statusCode, 200, body);
                        body = JSON.parse(body);
                        assert.notEqual(body.refreshToken, undefined);
                        assert.notEqual(body.expiresIn, undefined);

                        dao.getFromId(createdUser._id, function(err, foundUser){
                            assert.equal(err,null);
                            assert.notEqual(foundUser.platforms, undefined, 'stored user must contain a platforms array');
                            assert.equal(foundUser.platforms.length, 1, 'stored user must contain 1 platform');
                            assert.equal(foundUser.platforms[0].accessToken.params.access_token, 'a1b2c3d4e5f6', 'invalid access token stored');

                            ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function(err, tokenInfo){
                                assert.equal(err,null);
                                assert.equal(tokenInfo.userId, createdUser._id, 'bad accessToken userId');

                                ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function(err, tokenInfo){
                                    assert.equal(err,null);
                                    assert.equal(tokenInfo.userId, createdUser._id, 'bad refreshToken userId');
                                    done();
                                });
                            });
                        });

                    });
                });
            });

            it('401 deny permissions to SF', function(done){
                var options = clone(OPTIONS);
                options.url = 'http://localhost:'+config.public_port+'/auth/sf/callback?error=access_denied&error_description=end-user+denied+authorization';

                request(options, function(err,res,body){
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 401, body);
                    body = JSON.parse(body);
                    assert.deepEqual(body, {"err":"access_denied","des":"end-user denied authorization"});
                    done();
                });
            });
        });
    }
};


var SF_PROFILE = {
    "id": "https://login.salesforce.com/id/00De00000004cdeEAA/005e0000001uNIyAAM",
    "asserted_user": true,
    "user_id": "005e0000001uNIyAAM",
    "organization_id": "00De00000004cdeEAA",
    "username": "name.lastname@email.com",
    "nick_name": "nick",
    "display_name": "Name Lastname",
    "email": "name.lastname@email.com",
    "email_verified": true,
    "first_name": "Name",
    "last_name": "Lastname",
    "timezone": "Europe/London",
    "photos": {
        "picture": "https://c.cs15.content.force.com/profilephoto/005/F",
        "thumbnail": "https://c.cs15.content.force.com/profilephoto/005/T"
    },
    "addr_street": null,
    "addr_city": null,
    "addr_state": null,
    "addr_country": null,
    "addr_zip": null,
    "mobile_phone": "+34000000000",
    "mobile_phone_verified": true,
    "status": {
        "created_date": null,
        "body": null
    },
    "urls": URLS,
    "active": true,
    "user_type": "STANDARD",
    "language": "en_US",
    "locale": "en_GB",
    "utcOffset": 0,
    "last_modified_date": "2014-10-02T15:20:43.000+0000",
    "is_app_installed": true,
    "_photo": null
};

var OPTIONS = {
    url: 'http://localhost:' + config.public_port + '/auth/sf',
    headers: {
        'Content-Type': 'application/json; charset=utf-8'
    },
    method: 'GET',
    followRedirect: false
};


function nockSFLoginCall() {
    nock('https://login.salesforce.com')
        .filteringPath(function (path) {
            if (path.indexOf('/services/oauth2/authorize') > -1) {
                return '/services/oauth2/authorize';
            } else {
                return path;
            }
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

function nockSFGetProfileCall(profile){
    nock('https://cs15.salesforce.com')
        .get('/id/00De00000004cdeEAA/005e0000001uNIyAAM')
        .reply(200, profile);
}
