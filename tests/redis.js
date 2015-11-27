var redisMng = require('../src/managers/redis');
var assert = require('assert');
var async = require('async');

describe('redis', function() {
    beforeEach(function (done) {
        redisMng.connect(done);
    });

    afterEach(function (done) {
        redisMng.disconnect(done);
    });

    var baseKey = 'key';
    var baseValue = 'value';

    it('insert: success', function (done) {
        redisMng.insertKeyValue(baseKey, baseValue, 3, function(err){
            assert.equal(err, null);
            done();
        });
    });

    it('insert: connection error', function(done) {
        async.series([
            disconnectRedis = function(miniDone) {
                redisMng.disconnect(miniDone);
            },
            attemptInsert = function(miniDone) {
                redisMng.insertKeyValue(baseKey, baseValue, 3, function(error) {
                    assert.notEqual(error, null);
                    assert.equal(error.err, 'redis_not_connected');
                    miniDone();
                });
            }
        ], done);
    });

    it('insert: setKey error', function(done) {
        redisMng.insertKeyValue(baseKey, null, 3, function(error) {
            assert.notEqual(error, null);
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

    it('get: connection error', function(done) {
      async.series([
        disconnectRedis = function(miniDone) {
          redisMng.disconnect(miniDone);
        },
        attemptGet = function(miniDone) {
          redisMng.getKeyValue(null, function(error, value) {
            assert.equal(error.err, 'redis_not_connected');
            assert.equal(value, undefined);
            miniDone();
          });
        }
      ], done);
    });

    it('delete: success', function (done) {
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

    it('delete: connection error', function(done) {
        async.series([
            disconnectRedis = function(miniDone) {
                redisMng.disconnect(miniDone);
            },
            attemptDelete = function(miniDone) {
                redisMng.deleteKeyValue(baseKey, function(error, deleted) {
                    assert.notEqual(error, null);
                    assert.equal(error.err, 'redis_not_connected');
                    assert.equal(deleted, undefined);
                    miniDone();
                });
            }
        ], done);
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

    it('update: success', function (done) {
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
                        redisMng.updateKeyValue(baseKey, val, function (err) {
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

    it('update: connection error', function(done) {
        async.series([
            disconnectRedis = function(miniDone) {
                redisMng.disconnect(miniDone);
            },
            attemptUpdate = function(miniDone) {
                redisMng.updateKeyValue(baseKey, baseValue, function(error, value) {
                    assert.notEqual(error, null);
                    assert.equal(error.err, 'redis_not_connected');
                    assert.equal(value, undefined);
                    miniDone();
                });
            }
        ], done);
    });

    it('delete all: success', function (done) {
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

    it('delete all: connection error', function(done) {
        async.series([
            disconnectRedis = function(miniDone) {
                redisMng.disconnect(miniDone);
            },
            attemptDeleteAll = function(miniDone) {
                redisMng.deleteAllKeys(function(error) {
                    assert.notEqual(error, null);
                    assert.equal(error.err, 'redis_not_connected');
                    miniDone();
                });
            }
        ], done);
    });
});
