var assert = require('assert');
var spawn = require('child_process').spawn;
var net = require('net');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));
var async = require('async');
var nock = require('nock');
var request = require('request');
var cipherlayer = require('../cipherlayer');

var ciphertoken = require('ciphertoken');
var cToken = ciphertoken.create(config.accessToken.cipherKey, config.accessToken.signKey, {
    accessTokenExpirationMinutes: config.accessToken.expiration
});

describe('proxy', function(){

    it('launchs', function(done){
        var cipherlayer;
        async.series([
            function(done){
                cipherlayer = spawn('node', ['main']);
                cipherlayer.stdout.on('data', function(data){
                    if(String(data).indexOf('listening on port') > -1){
                        done();
                    }
                });
            },
            function(done){
                var client = net.connect({port:config.public_port}, function(){
                    client.destroy();
                    cipherlayer.kill('SIGTERM');
                    done();
                });
            }
        ],function(){
            done();
        });
    });

    describe('protected calls', function(){
        beforeEach(function(done){
            cipherlayer.setCryptoKeys(config.accessToken.cipherKey, config.accessToken.signKey, config.accessToken.expiration);
            cipherlayer.start(config.public_port, config.private_port, done);
        });

        afterEach(function(done){
            cipherlayer.stop(done);
        });

        describe('standard', function(){
            it('401 Unauthorized', function(done){
                var expectedBody = {field1:'value1', field2:'value2'};

                var options = {
                    url: 'http://localhost:' + config.public_port + '/api/standard',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    method: 'POST',
                    body: JSON.stringify(expectedBody)
                };

                request(options, function(err,res,body) {
                    assert.equal(err,null);
                    assert.equal(res.statusCode, 401);
                    done();
                });
            });
        });


        it('pass through', function(done){
            var expectedUserId = 'a1b2c3d4e5f6';

            nock('http://localhost:'+config.private_port)
                .post('/api/profile', {email:"valid@my-comms.com"})
                .reply(201, {id:expectedUserId});

            var options = {
                url: 'http://localhost:' + config.public_port + '/api/profile',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method: 'POST',
                body: JSON.stringify({email:"valid@my-comms.com", password:"12345678"})
            };

            request(options, function(err,res,body) {
                assert.equal(err,null);
                assert.equal(res.statusCode, 201);
                body = JSON.parse(body);

                assert.notEqual(body.accessToken,undefined);
                var accessTokenInfo = cToken.getAccessTokenSet(body.accessToken);
                assert.equal(accessTokenInfo.err,null);
                assert.equal(accessTokenInfo.consummerId,expectedUserId);

                assert.notEqual(body.refreshToken,undefined);
                var refreshTokenInfo = cToken.getAccessTokenSet(body.refreshToken);
                assert.equal(refreshTokenInfo.err,null);
                assert.equal(refreshTokenInfo.consummerId,expectedUserId);

                assert.equal(body.expiresIn, config.accessToken.expiration*60);
                done();
            });
        });
    });

});
