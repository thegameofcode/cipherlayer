'use strict';

const redisMng = require('../src/managers/redis');
const assert = require('assert');
const async = require('async');

describe('redis', function () {

	this.timeout(4000);

	beforeEach(redisMng.connect);

	const baseKey = 'key';
	const baseValue = 'value';

	it('insert', function (done) {
		redisMng.insertKeyValue(baseKey, baseValue, 3, function (err) {
			assert.equal(err, null);
			return done();
		});
	});

	it('insert - disconnected', function (done) {
		redisMng.disconnect(function () {
			redisMng.insertKeyValue(baseKey, baseValue, 3, function (err) {
				assert.deepEqual(err, {err: 'redis_not_connected'});
				return done();
			});
		});
	});

	it('set', function (done) {
		redisMng.setKeyValue(baseKey, baseValue, function (err) {
			assert.equal(err, null);
			redisMng.getKeyValue(baseKey, function (err, value) {
				assert.equal(err, null);
				assert.equal(value, baseValue);
				return done();
			});
		});
	});

	it('set - disconnected', function (done) {
		redisMng.disconnect(function () {
			redisMng.setKeyValue(baseKey, 'value', function (err) {
				assert.deepEqual(err, {err: 'redis_not_connected'});
				return done();
			});
		});
	});

	it('get', function (done) {
		redisMng.getKeyValue(baseKey, function (err, value) {
			assert.equal(err, null);
			assert.equal(value, baseValue);
			return done();
		});
	});

	it('get - disconnected', function (done) {
		redisMng.disconnect(function () {
			redisMng.getKeyValue(baseKey, function (err) {
				assert.deepEqual(err, {err: 'redis_not_connected'});
				return done();
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
				return done();
			});
		});
	});

	it('delete - disconnected', function (done) {
		redisMng.disconnect(function () {
			redisMng.deleteKeyValue(baseKey, function (err) {
				assert.deepEqual(err, {err: 'redis_not_connected'});
				return done();
			});
		});
	});

	it('expire', function (done) {
		async.series([
			//createKey
			function (done) {
				redisMng.insertKeyValue(baseKey, baseValue, 1, function (err) {
					assert.equal(err, null);
					return done();
				});
			},
			// checkExpire
			function (done) {
				setTimeout(function () {
					redisMng.getKeyValue(baseKey, function (err, value) {
						assert.equal(err, null);
						assert.equal(value, null);
						return done();
					});
				}, 1500);
			}
		], done);
	});

	it('update', function (done) {
		const val = 'new value';
		async.series([
			// createKey
			function (done) {
				redisMng.insertKeyValue(baseKey, baseValue, 2, function (err) {
					assert.equal(err, null);
					return done();
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
							return done();
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
						return done();
					});
				}, 1500);
			}
		], done);
	});

	it('update - disconnected', function (done) {
		const val = 'new value';
		async.series([
			// createKey
			function (done) {
				redisMng.insertKeyValue(baseKey, baseValue, 3, function (err) {
					assert.equal(err, null);
					return done();
				});
			},
			// updateKey
			function (done) {
				redisMng.disconnect(function () {
					redisMng.updateKeyValue(baseKey, val, function (err) {
						assert.deepEqual(err, {err: 'redis_not_connected'});
						return done();
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
					return done();
				});
			},
			// deleteAllKeys
			function (done) {
				redisMng.deleteAllKeys(function (err) {
					assert.equal(err, null);
					return done();
				});
			},
			// checkDelete
			function (done) {
				redisMng.getKeyValue(baseKey, function (err, value) {
					assert.equal(err, null);
					assert.equal(value, null);
					return done();
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
					return done();
				});
			},
			// deleteAllKeys
			function (done) {
				redisMng.disconnect(function () {
					redisMng.deleteAllKeys(function (err) {
						assert.deepEqual(err, {err: 'redis_not_connected'});
						return done();
					});
				});
			}
		], done);
	});

});
