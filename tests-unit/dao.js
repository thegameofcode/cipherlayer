var assert = require('assert');
var _ = require('lodash');
var config = require('../config.json');
var dao = require('../src/managers/dao.js');
var sinon = require('sinon');

var mongoClient = require('mongodb').MongoClient;

describe('user dao', function () {

	var baseUser = {
		id: 'a1b2c3d4e5f6',
		username: 'user1' + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : ''),
		password: 'pass1'
	};

	var fakeCollection = {};
	var fakeDb = {};
	var fakeFind = {};
	var noop = () => {};

	beforeEach(function (done) {
		fakeCollection = {
			remove: noop,
			count: noop,
			find: noop,
			insert: noop,
			update: noop,
			ensureIndex: noop,
			toArray: noop
		};

		fakeDb = {
			collection: noop,
			close: noop
		};

		fakeFind = {
			nextObject: noop
		};

		sinon.stub(fakeCollection, 'remove').yields();
		sinon.stub(fakeCollection, 'ensureIndex').yields();
		sinon.stub(fakeDb, 'collection').returns(fakeCollection);
		sinon.stub(mongoClient, 'connect').yields(null, fakeDb);

		dao.resetRealmsVariables();

		dao.connect(function (err) {
			assert.equal(err, null);
			done();
		});
	});

	afterEach(function (done) {
		sinon.stub(fakeDb, 'close').yields(null);

		dao.resetRealmsVariables();

		dao.disconnect(function (err) {
			assert.equal(err, null);

			mongoClient.connect.restore();
			done();
		});
	});

	it('count', function (done) {
		sinon.stub(fakeCollection, 'count').yields(null, 0);

		dao.countUsers(function (err, count) {
			assert.equal(err, null);
			assert.equal(count, 0);
			done();
		});
	});

	it('add', function (done) {
		var fakeUser = _.assign({_id: baseUser.id}, baseUser);
		sinon.stub(fakeCollection, 'find').yields(null, fakeFind);
		sinon.stub(fakeFind, 'nextObject').onCall(0).yields(null, null);
		sinon.stub(fakeCollection, 'insert').onCall(0).yields(null, [fakeUser]);
		sinon.stub(fakeCollection, 'count').onCall(0).yields(null, 1);

		var expectedUser = _.assign({}, baseUser);
		dao.addUser()(expectedUser, function (err, createdUser) {
			assert.equal(err, null);
			assert.equal(createdUser._id, expectedUser.id);
			assert.equal(createdUser.username, expectedUser.username);
			assert.equal(createdUser.password, expectedUser.password);
			done();
		});
	});

	it('getFromUsername', function (done) {
		var fakeUser = _.assign({_id: baseUser.id}, baseUser);
		delete(fakeUser.password);
		sinon.stub(fakeCollection, 'find').yields(null, fakeFind);
		sinon.stub(fakeFind, 'nextObject').yields(null, fakeUser);

		var expectedUser = _.assign({}, baseUser);
		dao.getFromUsername(expectedUser.username, function (err, foundUser) {
			assert.equal(err, null);
			assert.equal(foundUser.username, expectedUser.username);
			assert.equal(foundUser.password, undefined);
			done();
		});
	});

	it('getFromUsername - invalid username', function (done) {
		dao.getFromUsername(null, function (err) {
			assert.deepEqual(err, {err: 'invalid_username'});
			done();
		});
	});

	it('getFromUsername - error 1', function (done) {
		sinon.stub(fakeCollection, 'find').yields({err: 'generic_error'}, null);

		dao.getFromUsername('username', function (err) {
			assert.deepEqual(err, {err: 'generic_error'});
			done();
		});
	});

	it('getFromUsername - error 2', function (done) {
		sinon.stub(fakeCollection, 'find').yields(null, fakeFind);
		sinon.stub(fakeFind, 'nextObject').yields({err: 'generic_error'}, null);

		var expectedUser = _.assign({}, baseUser);
		dao.getFromUsername(expectedUser.username, function (err) {
			assert.deepEqual(err, {err: 'generic_error'});
			done();
		});
	});

	it('getFromUsernamePassword', function (done) {
		var fakeUser = _.assign({_id: baseUser.id}, baseUser);
		delete(fakeUser.password);
		sinon.stub(fakeCollection, 'find').yields(null, fakeFind);
		sinon.stub(fakeFind, 'nextObject').yields(null, fakeUser);

		var expectedUser = _.assign({}, baseUser);
		dao.getFromUsernamePassword(expectedUser.username, expectedUser.password, function (err, foundUser) {
			assert.equal(err, null);
			assert.equal(foundUser.username, expectedUser.username);
			assert.equal(foundUser.password, undefined);
			done();
		});
	});

	it('getFromId', function (done) {
		var fakeUser = _.assign({_id: baseUser.id}, baseUser);
		delete(fakeUser.password);
		sinon.stub(fakeCollection, 'find').yields(null, fakeFind);
		sinon.stub(fakeFind, 'nextObject').yields(null, fakeUser);

		var expectedUser = _.assign({}, baseUser);
		dao.getFromId(expectedUser.id, function (err, foundUser) {
			assert.equal(err, null);
			assert.equal(foundUser.username, expectedUser.username);
			assert.equal(foundUser.password, undefined);
			done();
		});
	});

	it('already exists', function (done) {
		var fakeUser = _.assign({_id: baseUser.id}, baseUser);
		sinon.stub(fakeCollection, 'find').yields(null, fakeFind);
		sinon.stub(fakeFind, 'nextObject').yields(null, fakeUser);

		var expectedUser = _.assign({}, baseUser);
		dao.addUser()(expectedUser, function (err, createdUser) {
			assert.equal(err.err, 'username_already_exists');
			assert.equal(createdUser, null);
			done();
		});
	});

	it('already exists (capitalized username)', function (done) {
		var fakeUser = _.assign({_id: baseUser.id}, baseUser);
		sinon.stub(fakeCollection, 'find').yields(null, fakeFind);
		sinon.stub(fakeFind, 'nextObject').yields(null, fakeUser);

		var expectedUser = _.assign({}, baseUser);
		expectedUser.username = 'UsEr1' + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*', '') : '');
		dao.addUser()(expectedUser, function (err, createdUser) {
			assert.equal(err.err, 'username_already_exists');
			assert.equal(createdUser, null);
			done();
		});
	});

	it('delete all', function (done) {
		sinon.stub(fakeCollection, 'count').yields(null, 0);

		dao.deleteAllUsers(function (err) {
			assert.equal(err, null);
			dao.countUsers(function (err, count) {
				assert.equal(err, null);
				assert.equal(count, 0);
				done();
			});
		});
	});

	it('updateField', function (done) {
		var expectedUser = _.assign({}, baseUser);
		var expectedField = 'field1';
		var expectedValue = 'value1';

		fakeCollection.update = function (query, update, cbk) {
			assert.equal(query._id, expectedUser.id);
			assert.equal(update.$set[expectedField], expectedValue);
			cbk(null, 1);
		};

		dao.updateField(expectedUser.id, expectedField, expectedValue, function (err, updates) {
			assert.equal(err, null);
			assert.equal(updates, 1);
			done();
		});
	});

	it('getRealms', function (done) {
		var fakeRealm = {
			"name": "default",
			"allowedDomains": [
				"*@vodafone.com",
				"*@igzinc.com"
			],
			"capabilities": {
				"news": true,
				"chat": true,
				"call": true
			}
		};
		sinon.stub(fakeCollection, 'find').returns(fakeCollection);
		sinon.stub(fakeCollection, 'toArray').onCall(0).yields(null, [fakeRealm]);

		var expectedRealm = _.assign({}, fakeRealm);
		dao.getRealms(function (err, realms) {
			assert.equal(err, null);
			assert.equal(realms.length, 1);
			assert.deepEqual(realms[0], expectedRealm);

			dao.getRealms(function (err, realms) {
				assert.equal(err, null);
				assert.equal(realms.length, 1);
				assert.deepEqual(realms[0], expectedRealm);
				done();
			});
		});
	});

	describe.skip('updateArrayItem', function () {
		it('Creates array if not exists', function (done) {
			var expectedUser = _.assign({}, baseUser);
			var expectedField = 'fieldsArray';
			var expectedKey = 'field1';
			var expectedValue = {field1: 'value1', field2: 'value2'};

			var callNumber = 0;
			fakeCollection.update = function (query, update, upsert, cbk) {
				callNumber++;
				switch (callNumber) {
					case 1:
						cbk({code: 16836});
						break;
					case 2:
						assert.deepEqual(query, {_id: expectedUser.id});
						assert.deepEqual(update, {
							"$addToSet": {
								"fieldsArray": {
									"field1": "value1",
									"field2": "value2"
								}
							}
						});
						cbk = upsert;
						cbk(null, 1);
						break;
				}
			};

			dao.updateArrayItem(expectedUser.id, expectedField, expectedKey, expectedValue, function (err, updates) {
				assert.equal(err, null);
				assert.equal(updates, 1, 'incorrect number of objects updated');
				done();
			});
		});

		it('Adds items to array', function (done) {
			var expectedUser = _.assign({}, baseUser);
			var expectedField = 'fieldsArray';
			var expectedKey = 'field1';
			var expectedValue = {field1: 'value1', field2: 'value2'};
			expectedUser[expectedField] = [];

			fakeCollection.update = function (query, update, upsert, cbk) {
				assert.deepEqual(query, {_id: expectedUser.id, 'fieldsArray.field1': 'value1'});
				assert.deepEqual(update, {$set: {'fieldsArray.$': expectedValue}});
				assert.deepEqual(upsert, {upsert: true});
				cbk(null, 1);
			};

			dao.updateArrayItem(expectedUser.id, expectedField, expectedKey, expectedValue, function (err, updates) {
				assert.equal(err, null);
				assert.equal(updates, 1, 'incorrect number of objects updated');
				done();
			});
		});

		it('Updates item in array', function (done) {
			var expectedUser = _.assign({}, baseUser);
			var expectedField = 'fieldsArray';
			var expectedKey = 'key';
			var expectedValue1 = {key: 'value1', field2: 'value1'};
			var expectedValue2 = {key: 'value2', field2: 'value2'};
			expectedUser[expectedField] = [expectedValue1, expectedValue2];
			var expectedNewValue = {key: 'value2', field2: 'newvalue2'};

			fakeCollection.update = function (query, update, upsert, cbk) {
				assert.deepEqual(query, {_id: expectedUser.id, 'fieldsArray.key': 'value2'});
				assert.deepEqual(update, {$set: {'fieldsArray.$': expectedNewValue}});
				assert.deepEqual(upsert, {upsert: true});
				cbk(null, 1);
			};

			dao.updateArrayItem(expectedUser.id, expectedField, expectedKey, expectedNewValue, function (err, updates) {
				assert.equal(err, null);
				assert.equal(updates, 1, 'incorrect number of objects updated');
				done();
			});
		});
	});

});
