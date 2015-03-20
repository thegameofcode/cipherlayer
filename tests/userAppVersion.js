var assert = require('assert');
var async = require('async');

var userAppVersion = require('../src/middlewares/userAppVersion.js');
var userDao = require('../src/managers/dao');

var config = require('../config.json');

describe('middleware userAppVersion', function(){
    var settings = {
        "version" : {
            "header" : "x-mycomms-version",
            "platforms" : {
                "test" : {
                    "link" : "http://testLink",
                    "1" : true
                }
            },
            "installPath" : "/install"
        }
    };

    var baseUser = {
        id:'a1b2c3d4e5f6',
        username: 'username' + (config.allowedDomains[0] ? config.allowedDomains[0] : ''),
        password: '12345678'
    };

    beforeEach(function(done){
        async.series([
            function(done){
                userDao.connect(function(){
                    userDao.deleteAllUsers( done );
                });
            }
        ], done);
    });

    afterEach(function(done){
        async.series([
            function(done){
                userDao.disconnect(done);
            }
        ], done);
    });

    it('update (user has no appVersion)', function(done){
        userDao.addUser()(baseUser, function(err, createdUser) {
            var req = {
                headers: {},
                url: "/api/me",
                method: "GET",
                user: createdUser
            };

            req.headers[config.version.header] = 'version 1.0.0';

            var res = {};
            var next = function(canContinue) {
                if (canContinue === undefined || canContinue === true){
                    userDao.getFromId(createdUser._id, function(err, foundUser){
                        assert.equal(err, null);
                        assert.equal(foundUser.appVersion, 'version 1.0.0');
                        done();
                    });
                }
            };

            userAppVersion(settings)(req, res, next);
        });
    });

    it('update (different appVersion)', function(done){
        baseUser.appVersion = 'version 1.0.0';
        userDao.addUser()(baseUser, function(err, createdUser) {
            var req = {
                headers: {},
                url: "/api/me",
                method: "GET",
                user: createdUser
            };

            req.headers[config.version.header] = 'version 2.0.0';

            var res = {};
            var next = function(canContinue) {
                if (canContinue === undefined || canContinue === true){
                    userDao.getFromId(createdUser._id, function(err, foundUser){
                        assert.equal(err, null);
                        assert.equal(foundUser.appVersion, 'version 2.0.0');
                        done();
                    });
                }
            };

            userAppVersion(settings)(req, res, next);
        });
    });

    it('continue (same appVersion)', function(done){
        baseUser.appVersion = 'version 1.0.0';
        userDao.addUser()(baseUser, function(err, createdUser) {
            var req = {
                headers: {},
                url: "/api/me",
                method: "GET",
                user: createdUser
            };

            req.headers[config.version.header] = 'version 1.0.0';

            var res = {};
            var next = function(canContinue) {
                if (canContinue === undefined || canContinue === true){
                    userDao.getFromId(createdUser._id, function(err, foundUser){
                        assert.equal(err, null);
                        assert.equal(foundUser.appVersion, 'version 1.0.0');
                        done();
                    });
                }
            };

            userAppVersion(settings)(req, res, next);
        });
    });

    it('continue (no version header)', function(done){
        var req = {
            headers: {},
            url: "/api/me",
            method: "GET",
            user: baseUser
        };

        var res = {};
        var next = function(canContinue) {
            if (canContinue === undefined || canContinue === true){
                done();
            }
        };

        userAppVersion(settings)(req, res, next);
    });
});