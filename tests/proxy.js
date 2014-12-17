var assert = require('assert');
var spawn = require('child_process').spawn;
var net = require('net');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));
var async = require('async');
var nock = require('nock');
var request = require('request');
var cipherlayer = require('../cipherlayer');
var clone = require('clone');
var dao = require('../dao.js');

var describeProtectedCallsStandard = require('./proxy/protectedCallsStandard.js');
var describeProtectedCallsPassThrough = require('./proxy/protectedCallsPassThrough.js');


var accessTokenSettings = {
    cipherKey: config.accessToken.cipherKey,
    firmKey: config.accessToken.signKey,
    tokenExpirationMinutes: config.accessToken.expiration * 60
};

var refreshTokenSettings = {
    cipherKey: config.refreshToken.cipherKey,
    firmKey: config.refreshToken.signKey,
    tokenExpirationMinutes: config.refreshToken.expiration * 1000
};

describe('proxy', function(){
    it('launches', function(done){
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
        beforeEach(function (done) {
            cipherlayer.start(config.public_port, config.private_port, function (err) {
                assert.equal(err, null);
                dao.deleteAllUsers(function (err) {
                    assert.equal(err, null);
                    done();
                });
            });
        });

        afterEach(function (done) {
            cipherlayer.stop(done);
        });

        describe('standard', function () {
            describeProtectedCallsStandard.itUnauthorized();
            describeProtectedCallsStandard.itWithoutPlatforms(accessTokenSettings);
            describeProtectedCallsStandard.itWithSalesforce(accessTokenSettings);
            describeProtectedCallsStandard.itBodyResponseIsNotAJson(accessTokenSettings);
        });

        describe('pass through', function () {
            describeProtectedCallsPassThrough.itCreated(accessTokenSettings, refreshTokenSettings);
            describeProtectedCallsPassThrough.itPlatformInfo(accessTokenSettings, refreshTokenSettings);
            describeProtectedCallsPassThrough.itAlreadyExists(accessTokenSettings, refreshTokenSettings);
            describeProtectedCallsPassThrough.itNotSecurityToken();
        });
    });
});
