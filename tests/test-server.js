var cipherlayer = require('../cipherlayer.js');
var clone=require('clone');
var assert = require('assert');
var net = require('net');
var request = require('request');
var dao = require('../dao.js');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));
var nock = require('nock');
var ciphertoken = require('ciphertoken');
var countrycodes = require('../countrycodes');

var accessTokenSettings = {
    cipherKey: config.accessToken.cipherKey,
    firmKey: config.accessToken.signKey,
    tokenExpirationMinutes: config.accessToken.expiration
};

var refreshTokenSettings = {
    cipherKey: config.refreshToken.cipherKey,
    firmKey: config.refreshToken.signKey,
    tokenExpirationMinutes: config.refreshToken.expiration
};

describe('server control ', function(){

    it('start', function(done){
        cipherlayer.start(config.public_port, config.private_port, function(err) {
            assert.equal(err,null);
            var client = net.connect({port:config.public_port}, function(){
                client.destroy();
                done();
            });
        });
    });

    it('stop', function(done){
        cipherlayer.stop(function () {
            var free = true;
            var tester = net.createServer();
            tester.once('error', function(err){
                if(err.code === 'EADDRINUSE'){
                    free = false;
                }
            });

            tester.once('listening', function(){
                tester.close(function(){
                    if(free) done();
                });
            });

            tester.listen(config.public_port);
        });
    });
});

describe('/auth', function(){

    beforeEach(function(done){
        cipherlayer.start(config.public_port, config.private_port, done);
    });

    afterEach(function(done){
        cipherlayer.stop(done);
    });

    describe('/login',function(){
        var baseUser = {
            id : 'a1b2c3d4e5f6',
            username : 'validuser',
            password : 'validpassword'
        };

        beforeEach(function(done){
            dao.deleteAllUsers(function(err){
                assert.equal(err,null);
                var userToCreate = clone(baseUser);

                dao.addUser(userToCreate,function(err,createdUser){
                    assert.equal(err, null);
                    assert.notEqual(createdUser, undefined);
                    done();
                });
            });
        });

        it('POST 200', function(done){
            var user = clone(baseUser);

            var options = {
                url: 'http://localhost:'+config.public_port+'/auth/login',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method:'POST',
                body : JSON.stringify(user)
            };

            request(options,function(err,res,body){
                assert.equal(err,null);
                assert.equal(res.statusCode, 200);
                body = JSON.parse(body);

                assert.notEqual(body.accessToken,undefined);
                assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
                ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function(err, accessTokenInfo){
                    assert.equal(err,null);
                    assert.equal(accessTokenInfo.userId,user.id);

                    assert.notEqual(body.refreshToken,undefined);
                    ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function(err, refreshTokenInfo){
                        assert.equal(err,null);
                        assert.equal(refreshTokenInfo.userId,user.id);
                        done();
                    });
                });
            });
        });

        it('POST 409 invalid_credentials', function(done){
            var user = clone(baseUser);
            user.password = 'invalidpassword';

            var options = {
                url: 'http://localhost:'+config.public_port+'/auth/login',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method:'POST',
                body : JSON.stringify(user)
            };

            request(options,function(err,res,body){
                assert.equal(err,null);
                assert.equal(res.statusCode, 409);
                body = JSON.parse(body);
                assert.notEqual(body.err,'invalid_credentials');
                done();
            });
        });
    });

    describe('/user', function(){
        var username = 'validuser';
        var password = 'validpassword';

        beforeEach(function(done){
            dao.deleteAllUsers(function(err){
                assert.equal(err,null);
                done();
            });
        });

        it('POST 201 created', function(done){
            var options = {
                url: 'http://localhost:'+config.public_port+'/auth/user',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method:'POST',
                body : JSON.stringify({username:username,password:password})
            };

            request(options, function(err,res,body){
                assert.equal(err,null);
                assert.equal(res.statusCode, 201);
                body = JSON.parse(body);
                assert.equal(body.username, username);
                assert.equal(body.password, undefined);
                done();
            });
        });

        it('POST 409 already_exists', function(done){
            var user = {
                username :username,
                password: password
            };
            dao.addUser(user, function(err,createdUser){
                assert.equal(err,null);
                assert.notEqual(createdUser, null);

                var options = {
                    url: 'http://localhost:'+config.public_port+'/auth/user',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method:'POST',
                    body : JSON.stringify({username:username,password:password})
                };

                request(options, function(err,res,body){
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 409);
                    body = JSON.parse(body);
                    assert.equal(body.err,'username_already_exists');
                    done();
                });
            });
        });

        it('DELETE 204', function(done){
            var user = {
                username :username,
                password: password
            };

            dao.addUser(user, function(err,createdUser){
                assert.equal(err,null);
                assert.notEqual(createdUser,null);

                var options = {
                    url: 'http://localhost:'+config.public_port+'/auth/user',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method:'DELETE'
                };

                request(options, function(err,res,body){
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 204);
                    assert.equal(body,'');

                    dao.countUsers(function(err,count){
                        assert.equal(err,null);
                        assert.equal(count,0);
                        done();
                    });
                });
            });
        });
    });

    describe('/sf', function(){
        beforeEach(function(done){
            dao.deleteAllUsers(function(err){
                assert.equal(err,null);
                done();
            });
        });

        it('GET 302', function(done){
            var options = {
                url: 'http://localhost:'+config.public_port+'/auth/sf',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method:'GET',
                followRedirect: false
            };

            request(options, function(err,res,body){
                assert.equal(err,null);
                assert.equal(res.statusCode, 302);
                done();
            });
        });

        describe('/callback', function(){
            it('302 invalid data', function(done){

                var options = {
                    url: 'http://localhost:'+config.public_port+'/auth/sf/callback',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method:'GET',
                    followRedirect: false
                };

                request(options, function(err,res,body){
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 302);
                    done();
                });
            });
        });

        it('203 not exists', function(done){
            nock('https://test.salesforce.com')
                .filteringPath(function(path){
                    if(path.indexOf('/services/oauth2/authorize') > -1){
                        return '/services/oauth2/authorize';
                    } else {
                        return path;
                    }
                })
                .get('/services/oauth2/authorize')
                .reply(302, {accessToken:'sf1234'})
                .post('/services/oauth2/token')
                .reply(200,{
                    access_token:'a1b2c3d4e5f6',
                    refresh_token:'f6e5d4c3d2a1',
                    instance_url:'https://cs15.salesforce.com',
                    id:'https://test.salesforce.com/id/00De00000004cdeEAA/005e0000001uNIyAAM'
                });

            var sfProfile = {
                "id": "https://test.salesforce.com/id/00De00000004cdeEAA/005e0000001uNIyAAM",
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
                "urls": {
                    "enterprise": "https://cs15.salesforce.com/services/Soap/c/{version}/00De00000004cde",
                    "metadata": "https://cs15.salesforce.com/services/Soap/m/{version}/00De00000004cde",
                    "partner": "https://cs15.salesforce.com/services/Soap/u/{version}/00De00000004cde",
                    "rest": "https://cs15.salesforce.com/services/data/v{version}/",
                    "sobjects": "https://cs15.salesforce.com/services/data/v{version}/sobjects/",
                    "search": "https://cs15.salesforce.com/services/data/v{version}/search/",
                    "query": "https://cs15.salesforce.com/services/data/v{version}/query/",
                    "recent": "https://cs15.salesforce.com/services/data/v{version}/recent/",
                    "profile": "https://cs15.salesforce.com/005e0000001uNIyAAM",
                    "feeds": "https://cs15.salesforce.com/services/data/v{version}/chatter/feeds",
                    "groups": "https://cs15.salesforce.com/services/data/v{version}/chatter/groups",
                    "users": "https://cs15.salesforce.com/services/data/v{version}/chatter/users",
                    "feed_items": "https://cs15.salesforce.com/services/data/v{version}/chatter/feed-items",
                    "custom_domain": "https://sso-vge--tata.cs15.my.salesforce.com"
                },
                "active": true,
                "user_type": "STANDARD",
                "language": "en_US",
                "locale": "en_GB",
                "utcOffset": 0,
                "last_modified_date": "2014-10-02T15:20:43.000+0000",
                "is_app_installed": true,
                "_photo": null
            };

            nock('https://cs15.salesforce.com')
                .get('/id/00De00000004cdeEAA/005e0000001uNIyAAM')
                .reply(200,sfProfile);

            var options = {
                url: 'http://localhost:'+config.public_port+'/auth/sf/callback?code=a1b2c3d4e5f6',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method:'GET',
                followAllRedirects: true
            };

            request(options, function(err,res,body){
                assert.equal(err,null);
                assert.equal(res.statusCode, 203, body);
                body = JSON.parse(body);
                assert.equal(body.name, 'Name Lastname');
                assert.equal(body.email, 'name.lastname@email.com');
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

        it('200 OK', function(done){
            var user = {
                id: 'a1b2c3d4e5f6',
                username: 'name.lastname@email.com',
                password: '12345678'
            };

            dao.addUser(user, function(err, createdUser){
                assert.equal(err,null);
                assert.notEqual(createdUser, undefined);

                nock('https://test.salesforce.com')
                    .filteringPath(function(path){
                        if(path.indexOf('/services/oauth2/authorize') > -1){
                            return '/services/oauth2/authorize';
                        } else {
                            return path;
                        }
                    })
                    .get('/services/oauth2/authorize')
                    .reply(302, {accessToken:'sf1234'})
                    .post('/services/oauth2/token')
                    .reply(200,{
                        access_token:'a1b2c3d4e5f6',
                        refresh_token:'f6e5d4c3d2a1',
                        instance_url:'https://cs15.salesforce.com',
                        id:'https://test.salesforce.com/id/00De00000004cdeEAA/005e0000001uNIyAAM'
                    });

                var sfProfile = {
                    "id": "https://test.salesforce.com/id/00De00000004cdeEAA/005e0000001uNIyAAM",
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
                    "urls": {
                        "enterprise": "https://cs15.salesforce.com/services/Soap/c/{version}/00De00000004cde",
                        "metadata": "https://cs15.salesforce.com/services/Soap/m/{version}/00De00000004cde",
                        "partner": "https://cs15.salesforce.com/services/Soap/u/{version}/00De00000004cde",
                        "rest": "https://cs15.salesforce.com/services/data/v{version}/",
                        "sobjects": "https://cs15.salesforce.com/services/data/v{version}/sobjects/",
                        "search": "https://cs15.salesforce.com/services/data/v{version}/search/",
                        "query": "https://cs15.salesforce.com/services/data/v{version}/query/",
                        "recent": "https://cs15.salesforce.com/services/data/v{version}/recent/",
                        "profile": "https://cs15.salesforce.com/005e0000001uNIyAAM",
                        "feeds": "https://cs15.salesforce.com/services/data/v{version}/chatter/feeds",
                        "groups": "https://cs15.salesforce.com/services/data/v{version}/chatter/groups",
                        "users": "https://cs15.salesforce.com/services/data/v{version}/chatter/users",
                        "feed_items": "https://cs15.salesforce.com/services/data/v{version}/chatter/feed-items",
                        "custom_domain": "https://sso-vge--tata.cs15.my.salesforce.com"
                    },
                    "active": true,
                    "user_type": "STANDARD",
                    "language": "en_US",
                    "locale": "en_GB",
                    "utcOffset": 0,
                    "last_modified_date": "2014-10-02T15:20:43.000+0000",
                    "is_app_installed": true,
                    "_photo": null
                };

                nock('https://cs15.salesforce.com')
                    .get('/id/00De00000004cdeEAA/005e0000001uNIyAAM')
                    .reply(200,sfProfile);

                var options = {
                    url: 'http://localhost:'+config.public_port+'/auth/sf/callback?code=a1b2c3d4e5f6',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method:'GET',
                    followAllRedirects: true
                };

                request(options, function(err,res,body){
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 200, body);
                    body = JSON.parse(body);
                    assert.notEqual(body.refreshToken, undefined);
                    assert.notEqual(body.expiresIn, undefined);

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
});
