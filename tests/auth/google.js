var assert = require('assert');
var request = require('request');
var config = require('../../config.json');
var dao = require('../../src/managers/dao.js');

module.exports = {
    describe: function(){
        describe('/google', function(){
            beforeEach(function(done){
                dao.deleteAllUsers(function(err){
                    assert.equal(err,null);
                    done();
                });
            });

            it('GET 302', function(done){
                var options = {
                    url: 'http://localhost:'+config.public_port+'/auth/google',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method:'GET',
                    followRedirect: false
                };

                request(options, function(err,res,body){
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 302, body);
                    done();
                });
            });

            describe('/callback', function(){
                it('302 invalid data', function(done){

                    var options = {
                        url: 'http://localhost:'+config.public_port+'/auth/google/callback',
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8'
                        },
                        method:'GET',
                        followRedirect: false
                    };

                    request(options, function(err,res,body){
                        assert.equal(err,null);
                        assert.equal(res.statusCode, 302, body);
                        done();
                    });
                });
            });
        });
    }
};
