var redisMng = require('../managers/redis');
var assert = require('assert');
var async = require('async');

describe('Redis', function() {
    beforeEach(function (done) {
        redisMng.connect(done);
    });

    afterEach(function (done) {
        redisMng.disconnect(done);
    });

    var baseKey = 'key';
    var baseValue = 'value';

    it('insert', function (done) {
        redisMng.insertKeyValue(baseKey, baseValue, 3, function(err){
            assert.equal(err, null);
            done();
        });
    });

    it('get', function (done) {
        redisMng.getKeyValue(baseKey, function(err, value){
            assert.equal(err, null);
            assert.equal(value, baseValue);
            done();
        });
    });

    it('delete', function (done) {
        redisMng.deleteKeyValue(baseKey, function(err, deleted){
            assert.equal(err, null);
            assert.equal(deleted, true);
            redisMng.getKeyValue(baseKey, function(err, value){
                assert.equal(err, null);
                assert.equal(value, null);
                done();
            });
        });
    });

    it('expire', function (done) {
        this.timeout(4000);
        async.series([
            createKey = function(done){
                redisMng.insertKeyValue(baseKey, baseValue, 2, function(err){
                    assert.equal(err, null);
                    done();
                });
            },
            checkExpire = function(done){
                setTimeout(
                    function () {
                        redisMng.getKeyValue(baseKey, function (err, value) {
                            assert.equal(err, null);
                            assert.equal(value, null);
                            done();
                        });
                    }, 2500
                );
            }
        ], done);
    });

    it('update', function (done) {
        this.timeout(4000);
        var val = 'new value';
        async.series([
            createKey = function(done){
                redisMng.insertKeyValue(baseKey, baseValue, 3, function(err){
                    assert.equal(err, null);
                    done();
                });
            },
            updateKey = function(done){
                setTimeout(
                    function () {
                        redisMng.updateKeyValue(baseKey, val, function (err, value) {
                            assert.equal(err, null);
                            redisMng.getKeyValue(baseKey, function (err, value) {
                                assert.equal(err, null);
                                assert.equal(value, val);
                                done();
                            });
                        });
                    } , 2000
                );
            },
            checkExpire = function(done){
                setTimeout(
                    function () {
                        redisMng.getKeyValue(baseKey, function (err, value) {
                            assert.equal(err, null);
                            assert.equal(value, null);
                            done();
                        });
                    }, 1500
                );
            }
        ], done);
    });

    it('delete all', function (done) {
        async.series([
            createKey = function(done){
                redisMng.insertKeyValue(baseKey, baseValue, 10, function(err){
                    assert.equal(err, null);
                    done();
                });
            },
            deleteAllKeys = function(done){
                redisMng.deleteAllKeys(function (err) {
                    assert.equal(err, null);
                    done();
                });
            },
            checkDelete = function(done){
                redisMng.getKeyValue(baseKey, function (err, value) {
                    assert.equal(err, null);
                    assert.equal(value, null);
                    done();
                });
            }

        ], done);
    });
});
