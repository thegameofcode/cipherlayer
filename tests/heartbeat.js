var assert = require('assert');
var request = require('request');
var config = require('../config.json');
var cipherlayer = require('../src/cipherlayer');

var userDao = require('../src/managers/dao');
var redisMng = require('../src/managers/redis');

describe('Heartbeat (Server status)', function() {

    beforeEach(function (done) {
        cipherlayer.start(config.public_port, config.internal_port, done);
    });

    afterEach(function(done){
        cipherlayer.stop(done);
    });

    it('OK', function(done){
        var options = {
            url: 'http://localhost:' + config.public_port + '/heartbeat',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method: 'GET'
        };

        request(options, function (err, res, body) {
            assert.equal(err, null);
            assert.equal(res.statusCode, 204, body);
            done();
        });
    });

    it('DAO error', function(done){
        userDao.disconnect( function(err){
            assert.equal(err, null);
            var options = {
                url: 'http://localhost:' + config.public_port + '/heartbeat',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method: 'GET'
            };

            var expectedResult = {
                "err":"component_error",
                "des":"MongoDB component is not available"
            };

            request(options, function (err, res, body) {
                assert.equal(err, null);
                assert.equal(res.statusCode, 500);
                body = JSON.parse(body);
                assert.deepEqual(body, expectedResult);
                done();
            });
        });
    });

    it('Redis error', function(done){
        redisMng.disconnect( function(err){
            assert.equal(err, null);
            var options = {
                url: 'http://localhost:' + config.public_port + '/heartbeat',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method: 'GET'
            };

            var expectedResult = {
                "err":"component_error",
                "des":"Redis component is not available"
            };

            request(options, function (err, res, body) {
                assert.equal(err, null);
                assert.equal(res.statusCode, 500);
                body = JSON.parse(body);
                assert.deepEqual(body, expectedResult);
                done();
            });
        });
    });
});

