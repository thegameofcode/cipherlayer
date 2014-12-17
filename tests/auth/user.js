var assert = require('assert');
var request = require('request');
var fs = require('fs');

var config = JSON.parse(fs.readFileSync('config.json','utf8'));
var dao = require('../../dao.js');


module.exports = {
    describe: function(){
        describe('/user', function(){

            beforeEach(function(done){
                dao.deleteAllUsers(function(err){
                    assert.equal(err,null);
                    done();
                });
            });

            it('POST 201 created', function(done){
                var options = {
                    url: 'http://localhost:' + config.public_port + '/auth/user',
                    headers: HEADERS_WITH_AUTHORIZATION_BASIC,
                    method:'POST',
                    body : JSON.stringify({username: username, password: password, phone: phone})
                };

                request(options, function(err, res, body){
                    assert.equal(err, null);
                    assert.equal(res.statusCode, 201, body);
                    body = JSON.parse(body);
                    assert.equal(body.username, username);
                    assert.equal(body.password, undefined);
                    done();
                });
            });

            it('401 Not authorized when trying to POST to /auth/user without basic authorization', function(done){
                var options = {
                    url: 'http://localhost:' + config.public_port + '/auth/user',
                    headers: HEADERS_WITHOUT_AUTHORIZATION_BASIC,
                    method:'POST',
                    body : JSON.stringify({username: username, password: password})
                };

                request(options, function(err, res){
                    assert.equal(err, null);
                    assert.equal(res.statusCode, 401);
                    done();
                });
            });

            it('POST 409 already exists', function(done){
                dao.addUser(USER, function(err,createdUser){
                    assert.equal(err, null);
                    assert.notEqual(createdUser, null);

                    var options = {
                        url: 'http://localhost:' + config.public_port + '/auth/user',
                        headers: HEADERS_WITH_AUTHORIZATION_BASIC,
                        method:'POST',
                        body : JSON.stringify({username: USER.username, password: USER.password})
                    };

                    request(options, function(err, res, body){
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 409);
                        body = JSON.parse(body);
                        assert.equal(body.err, 'username_already_exists');
                        done();
                    });
                });
            });

            it('401 Not authorized when trying to POST an existing user without basic auth', function(done){
                dao.addUser(USER, function(err,createdUser){
                    assert.equal(err,null);
                    assert.notEqual(createdUser, null);

                    var options = {
                        url: 'http://localhost:' + config.public_port + '/auth/user',
                        headers: HEADERS_WITHOUT_AUTHORIZATION_BASIC,
                        method:'POST',
                        body : JSON.stringify({username: USER.username, password: USER.password})
                    };

                    request(options, function(err, res){
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 401);
                        done();
                    });
                });
            });

            it('DELETE 204', function (done){
                dao.addUser(USER, function(err, createdUser){
                    assert.equal(err, null);
                    assert.notEqual(createdUser, null);

                    var options = {
                        url: 'http://localhost:' + config.public_port + '/auth/user',
                        headers: HEADERS_WITH_AUTHORIZATION_BASIC,
                        method:'DELETE'
                    };

                    request(options, function(err, res, body){
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 204);
                        assert.equal(body, '');

                        dao.countUsers(function(err, count){
                            assert.equal(err, null);
                            assert.equal(count, 0);
                            done();
                        });
                    });
                });
            });

            it('401 Not authorized when trying to delete without basic authorization', function(done) {
                dao.addUser(USER, function(err, createdUser){
                    assert.equal(err, null);
                    assert.notEqual(createdUser, null);

                    var options = {
                        url: 'http://localhost:' + config.public_port + '/auth/user',
                        headers: HEADERS_WITHOUT_AUTHORIZATION_BASIC,
                        method:'DELETE'
                    };

                    request(options, function(err, res){
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 401);

                        dao.countUsers(function(err, count){
                            assert.equal(err, null);
                            assert.equal(count, 1);
                        });
                    });

                    options.headers = HEADERS_WITH_AUTHORIZATION_BASIC;
                    request(options, function(err, res){
                        assert.equal(err, null);
                        dao.countUsers(function(err, count){
                            assert.equal(err, null);
                            assert.equal(count, 0);
                            done();
                        });
                    });
                });
            });
        });
    }

    // TODO: if config.management does not exist or is incorrect POST and DELETE to /auth/user must return 404
    // for this test config should be edited, doing so a white box unit test or either change way of loading config file
};


var username = 'validuser';
var password = 'validpassword';
var phone = '111111111';

var USER = {
    id: 'a1b2c3d4e5f6',
    username: username,
    password: password,
    phone: phone
};

var HEADERS_WITHOUT_AUTHORIZATION_BASIC = {
    'Content-Type': 'application/json; charset=utf-8'
};

var HEADERS_WITH_AUTHORIZATION_BASIC = {
    'Content-Type': 'application/json; charset=utf-8',
    'Authorization basic': new Buffer(config.management.clientId + ':' + config.management.clientSecret).toString('base64')
};
