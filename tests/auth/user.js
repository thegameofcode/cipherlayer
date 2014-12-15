var assert = require('assert');
var request = require('request');
var fs = require('fs');

var config = JSON.parse(fs.readFileSync('config.json','utf8'));
var dao = require('../../dao.js');

module.exports = {
    describe: function(){
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

            it('POST 409 already exists', function(done){
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
    }
};