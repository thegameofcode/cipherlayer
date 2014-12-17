var assert = require('assert');
var fs = require('fs');
var request = require('request');

var dao = require('../../dao.js');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

var USER = {
    id: 'a1b2c3d4e5f6',
    username: 'validUser',
    password: 'validPassword123'
};


module.exports = {
describe: function(){
        describe('/renew', function(){

            beforeEach(function(done){
                dao.deleteAllUsers(function(err){
                    assert.equal(err, null);
                    dao.addUser(USER, function (err, createdUser) {
                        assert.equal(err, null);
                        assert.notEqual(createdUser, undefined);
                        done();
                    });
                });
            });

            it('200 POST', function(done){
                getAccessToken(USER, function(err, token){
                    assert.equal(err, null);
                    assert.notEqual(token, null);

                    var options = {
                        url: 'http://localhost:' + config.public_port + '/auth/renew',
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8'
                        },
                        method: 'POST',
                        body: JSON.stringify({refreshToken: token})
                    };

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
        });
    }
};

function getAccessToken(user, cbk){
    var options = {
        url: 'http://localhost:' + config.public_port + '/auth/login',
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        },
        method: 'POST',
        body: JSON.stringify(user)
    };

    request(options, function (err, res, body) {
        if (err){
            return cbk(err);
        }
        body = JSON.parse(body);
        var token = body.accessToken;
        cbk(null, token);
    });
}
