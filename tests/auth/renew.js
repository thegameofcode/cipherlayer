var assert = require('assert');
var fs = require('fs');
var request = require('request');
var clone = require('clone');
var ciphertoken = require('ciphertoken');

var dao = require('../../dao.js');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));


module.exports = {
    describe: function(){
        describe('/renew', function(){

            beforeEach(function (done){
                dao.deleteAllUsers(function (err){
                    assert.equal(err, null);
                    dao.addUser(USER, function (err, createdUser) {
                        assert.equal(err, null);
                        assert.notEqual(createdUser, undefined);
                        done();
                    });
                });
            });

            it('POST - 200', function(done){
                getAccessToken(USER, function (err, token){
                    assert.equal(err, null);
                    assert.notEqual(token, null);

                    var options = clone(OPTIONS_FOR_RENEW);
                    options.body = JSON.stringify({refreshToken: token});

                    request(options, function (err, res, body){
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 200, body);
                        body = JSON.parse(body);
                        assert.notEqual(body.accessToken, null);
                        assert.equal(body.expiresIn, config.accessToken.expiration);
                        done();
                    });
                });
            });

            it('POST - 401 invalid token', function(done){
                var invalidToken = 'not a valid token :( sorry';
                var options = clone(OPTIONS_FOR_RENEW);
                options.body = JSON.stringify({refreshToken: invalidToken});

                request(options, function (err, res, body){
                    assert.equal(err, null);
                    assert.equal(res.statusCode, 401, body);

                    body = JSON.parse(body);
                    assert.equal(body.err, 'invalid_token');
                    assert.equal(body.des, 'Invalid token');
                    done();
                });
            });

            it('POST - 401 expired token', function(done){
                var accessTokenSettings = {
                    cipherKey: config.accessToken.cipherKey,
                    firmKey: config.accessToken.signKey,
                    tokenExpirationMinutes: -1
                };
                ciphertoken.createToken(accessTokenSettings, 'id123', null, {}, function(err, token){
                    assert.equal(err, null);

                    var options = clone(OPTIONS_FOR_RENEW);
                    options.body = JSON.stringify({refreshToken: token});

                    request(options, function(err, res, body){
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 401, body);

                        body = JSON.parse(body);
                        assert.equal(body.err, 'expired_token');
                        assert.equal(body.des, 'Expired token');
                        done();
                    });
                });
            });
        });
    }
};

function getAccessToken(user, cbk){
    var options = clone(OPTIONS_FOR_LOGIN);
    options.body = JSON.stringify(user);

    request(options, function (err, res, body) {
        if (err){
            return cbk(err);
        }
        body = JSON.parse(body);
        var token = body.accessToken;
        cbk(null, token);
    });
}


var USER = {
    id: 'a1b2c3d4e5f6',
    username: 'validUser',
    password: 'validPassword123'
};

var OPTIONS_FOR_RENEW = {
    url: 'http://localhost:' + config.public_port + '/auth/renew',
    headers: {
        'Content-Type': 'application/json; charset=utf-8'
    },
    method: 'POST'
};

var OPTIONS_FOR_LOGIN = clone(OPTIONS_FOR_RENEW);
OPTIONS_FOR_LOGIN.url = 'http://localhost:' + config.public_port + '/auth/login';
