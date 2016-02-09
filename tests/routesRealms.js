var assert = require('assert');
var request = require('request');
var async = require('async');
var _ = require('lodash');

var config = require('../config.json');
var cipherlayer = require('../src/cipherlayer.js');
var daoMng = require('../src/managers/dao.js');

describe('realms', function () {

    var baseRealms = [
        {
            "name" : "default",
            "allowedDomains" : [
                "*@a.com",
                "*@b.com"
            ],
            "capabilities" : {
                "news" : true,
                "chat" : true,
                "call" : true
            }
        },
        {
            "name" : "test",
            "allowedDomains" : [
                "*@a.com"
            ],
            "capabilities" : {
                "test" : true
            }
        },
        {
            "name" : "valid",
            "allowedDomains" : [
                "valid@a.com"
            ],
            "capabilities" : {
                "valid" : true
            }
        }
    ];

    beforeEach(function (done) {
        cipherlayer.start(config.public_port, config.internal_port, function(err){
			assert.equal(err, null);
            async.parallel([
                function(finish){
                    daoMng.resetRealmsVariables();
                    daoMng.deleteAllRealms(finish);
                },
                function(finish){
                    async.eachSeries(_.cloneDeep(baseRealms), function(realm, next){
                        daoMng.addRealm(realm, function(){
                            assert.equal(err,null);
                            next();
                        });
                    }, function(){
                        finish();
                    });
                }
            ], done);
        });
    });

    afterEach(function(done){
        daoMng.deleteAllRealms(function(){
            cipherlayer.stop(done);
        });
    });

    it('Get all realms', function (done) {
        if(!config.internal_port){
            return done();
        }

        var options = {
            url: 'http://localhost:' + config.internal_port + '/realms',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method: 'GET',
			json: true
        };

        request(options, function (err, res, body) {
            assert.equal(err, null);
            assert.equal(res.statusCode, 200, body);
            assert.deepEqual(body.realms, baseRealms);
            done();
        });
    });

    it('No realms', function (done) {
        if(!config.internal_port){
            return done();
        }

        daoMng.deleteAllRealms(function(err){
            assert.equal(err, null);

            var options = {
                url: 'http://localhost:' + config.internal_port + '/realms',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method: 'GET'
            };

            request(options, function (err, res, body) {
                assert.equal(err, null);
                assert.equal(res.statusCode, 200, body);
                body = JSON.parse(body);
                assert.deepEqual(body.realms, []);
                done();
            });
        });
    });

});
