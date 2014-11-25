var cipherlayer = require('../cipherlayer.js');
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
    tokenExpirationMinutes: config.accessToken.expiration * 60
};

var refreshTokenSettings = {
    cipherKey: config.accessToken.cipherKey,
    firmKey: config.accessToken.signKey,
    tokenExpirationMinutes: config.accessToken.expiration * 1000
};

describe('server control ', function(){

    it('set crypto keys', function(done){
        cipherlayer.setCryptoKeys(config.accessToken.cipherKey, config.accessToken.signKey, config.accessToken.expiration);
        done();
    });

    it('clean crypto keys', function(done){
        cipherlayer.cleanCryptoKeys();
        done();
    });

    it('start', function(done){
        cipherlayer.setCryptoKeys(config.accessToken.cipherKey, config.accessToken.signKey, config.accessToken.expiration);
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

    it('fail if started without crypto keys', function(done){
        cipherlayer.start(config.public_port, config.private_port, function(err){
            assert.equal(err.message, 'started_without_crypto_keys');
            done();
        });
    });
});

describe('/auth', function(){

    beforeEach(function(done){
        cipherlayer.setCryptoKeys(config.accessToken.cipherKey, config.accessToken.signKey, config.accessToken.expiration);
        cipherlayer.start(config.public_port, config.private_port, done);
    });

    afterEach(function(done){
        cipherlayer.stop(done);
    });

    describe('/login',function(){
        beforeEach(function(done){
            dao.deleteAllUsers(function(err){
                var username = 'validuser';
                var password = 'validpassword';
                dao.addUser(null,username,password,function(err,createdUser){
                    assert.equal(err, null);
                    assert.notEqual(createdUser, undefined);
                    done();
                });
            });
        });

        it('POST 200', function(done){
            var username = 'validuser';
            var password = 'validpassword';

            var options = {
                url: 'http://localhost:'+config.public_port+'/auth/login',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method:'POST',
                body : JSON.stringify({username:username,password:password})
            };

            request(options,function(err,res,body){
                assert.equal(err,null);
                assert.equal(res.statusCode, 200);
                body = JSON.parse(body);

                assert.notEqual(body.accessToken,undefined);
                assert.equal(body.expiresIn, accessTokenSettings.tokenExpirationMinutes);
                ciphertoken.getTokenSet(accessTokenSettings, body.accessToken, function(err, accessTokenInfo){
                    assert.equal(err,null);
                    assert.equal(accessTokenInfo.userId,'validuser');

                    assert.notEqual(body.refreshToken,undefined);
                    ciphertoken.getTokenSet(refreshTokenSettings, body.refreshToken, function(err, refreshTokenInfo){
                        assert.equal(err,null);
                        assert.equal(refreshTokenInfo.userId,'validuser');
                        done();
                    });
                });
            });
        });

        it('POST 409 invalid_credentials', function(done){
            var username = 'validuser';
            var password = 'invalidpassword';

            var options = {
                url: 'http://localhost:'+config.public_port+'/auth/login',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method:'POST',
                body : JSON.stringify({username:username,password:password})
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
            dao.addUser(null,username,password, function(err,createdUser){
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
            dao.addUser(null, username,password, function(err,createdUser){
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
                "username": "luis.mesas@igz.es",
                "nick_name": "luis.mesas.garcia",
                "display_name": "Luis Mesas",
                "email": "luis.mesas@igz.es",
                "email_verified": true,
                "first_name": "Luis",
                "last_name": "Mesas",
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
                "mobile_phone": "+34696000000",
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
                assert.equal(res.statusCode, 203);
                body = JSON.parse(body);
                assert.equal(body.name, 'Luis Mesas');
                assert.equal(body.email, 'luis.mesas@igz.es');
                assert.equal(body.phone, '696000000');
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
            dao.addUser(null, 'luis.mesas@igz.es', '12345678', function(err, createdUser){
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
                    "username": "luis.mesas@igz.es",
                    "nick_name": "luis.mesas.garcia",
                    "display_name": "Luis Mesas",
                    "email": "luis.mesas@igz.es",
                    "email_verified": true,
                    "first_name": "Luis",
                    "last_name": "Mesas",
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
                    "mobile_phone": "+34696000000",
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
                    assert.equal(res.statusCode, 200);
                    body = JSON.parse(body);
                    assert.notEqual(body.accessToken, undefined);
                    assert.notEqual(body.refreshToken, undefined);
                    assert.notEqual(body.expiresIn, undefined);
                    done();
                });
            });
        });
    });
});
