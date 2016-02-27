'use strict';

var redisMng = require('../src/managers/redis');
var assert = require('assert');
var async = require('async');

describe('redis', function () {

	this.timeout(4000);

	beforeEach(redisMng.connect);

	var baseKey = 'key';
	var baseValue = 'value';

	it('insert', function (done) {
		redisMng.insertKeyValue(baseKey, baseValue, 3, function (err) {
			assert.equal(err, null);
			done();
		});
	});

	it('insert - disconnected', function (done) {
		redisMng.disconnect(function () {
			redisMng.insertKeyValue(baseKey, baseValue, 3, function (err) {
				assert.deepEqual(err, {err: 'redis_not_connected'});
				done();
			});
		});
	});

	it('set', function (done) {
		redisMng.setKeyValue(baseKey, baseValue, function (err) {
			assert.equal(err, null);
			redisMng.getKeyValue(baseKey, function (err, value) {
				assert.equal(err, null);
				assert.equal(value, baseValue);
				done();
			});
		});
	});

	it('set - disconnected', function (done) {
		redisMng.disconnect(function () {
			redisMng.setKeyValue(baseKey, 'value', function (err) {
				assert.deepEqual(err, {err: 'redis_not_connected'});
				done();
			});
		});
	});

	it('get', function (done) {
		redisMng.getKeyValue(baseKey, function (err, value) {
			assert.equal(err, null);
			assert.equal(value, baseValue);
			done();
		});
	});

	it('get - disconnected', function (done) {
		redisMng.disconnect(function () {
			redisMng.getKeyValue(baseKey, function (err) {
				assert.deepEqual(err, {err: 'redis_not_connected'});
				done();
			});
		});
	});

	it('delete', function (done) {
		redisMng.deleteKeyValue(baseKey, function (err, deleted) {
			assert.equal(err, null);
			assert.equal(deleted, true);
			redisMng.getKeyValue(baseKey, function (err, value) {
				assert.equal(err, null);
				assert.equal(value, null);
				done();
			});
		});
	});

	it('delete - disconnected', function (done) {
		redisMng.disconnect(function () {
			redisMng.deleteKeyValue(baseKey, function (err) {
				assert.deepEqual(err, {err: 'redis_not_connected'});
				done();
			});
		});
	});

	it('expire', function (done) {
		async.series([
			//createKey
			function (done) {
				redisMng.insertKeyValue(baseKey, baseValue, 1, function (err) {
					assert.equal(err, null);
					done();
				});
			},
			// checkExpire
			function (done) {
				setTimeout(function () {
					redisMng.getKeyValue(baseKey, function (err, value) {
						assert.equal(err, null);
						assert.equal(value, null);
						done();
					});
				}, 1500);
			}
		], done);
	});

	it('update', function (done) {
		var val = 'new value';
		async.series([
			// createKey
			function (done) {
				redisMng.insertKeyValue(baseKey, baseValue, 2, function (err) {
					assert.equal(err, null);
					done();
				});
			},
			// updateKey
			function (done) {
				setTimeout(function () {
					redisMng.updateKeyValue(baseKey, val, function (err) {
						assert.equal(err, null);
						redisMng.getKeyValue(baseKey, function (err, value) {
							assert.equal(err, null);
							assert.equal(value, val);
							done();
						});
					});
				}, 1000);
			},
			// checkExpire
			function (done) {
				setTimeout(function () {
					redisMng.getKeyValue(baseKey, function (err, value) {
						assert.equal(err, null);
						assert.equal(value, null);
						done();
					});
				}, 1500);
			}
		], done);
	});

	it('update - disconnected', function (done) {
		var val = 'new value';
		async.series([
			// createKey
			function (done) {
				redisMng.insertKeyValue(baseKey, baseValue, 3, function (err) {
					assert.equal(err, null);
					done();
				});
			},
			// updateKey
			function (done) {
				redisMng.disconnect(function () {
					redisMng.updateKeyValue(baseKey, val, function (err) {
						assert.deepEqual(err, {err: 'redis_not_connected'});
						done();
					});
				});
			}
		], done);
	});

	it('delete all', function (done) {
		async.series([
			// createKey
			function (done) {
				redisMng.insertKeyValue(baseKey, baseValue, 10, function (err) {
					assert.equal(err, null);
					done();
				});
			},
			// deleteAllKeys
			function (done) {
				redisMng.deleteAllKeys(function (err) {
					assert.equal(err, null);
					done();
				});
			},
			// checkDelete
			function (done) {
				redisMng.getKeyValue(baseKey, function (err, value) {
					assert.equal(err, null);
					assert.equal(value, null);
					done();
				});
			}
		], done);
	});

	it('delete all -- disconnected', function (done) {
		async.series([
			// createKey
			function (done) {
				redisMng.insertKeyValue(baseKey, baseValue, 10, function (err) {
					assert.equal(err, null);
					done();
				});
			},
			// deleteAllKeys
			function (done) {
				redisMng.disconnect(function () {
					redisMng.deleteAllKeys(function (err) {
						assert.deepEqual(err, {err: 'redis_not_connected'});
						done();
					});
				});
			}
		], done);
	});

})
;
