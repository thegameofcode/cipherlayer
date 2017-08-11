'use strict';

const assert = require('assert');
const async = require('async');
const escapeRegexp = require('escape-regexp');
const config = require('../../config');
const MongoClient = require('mongodb').MongoClient;
const _ = require('lodash');

const TIME_TO_REFRESH = 1000 * 60 * 60;
const ERROR_USER_NOT_FOUND = 'user_not_found';
const ERROR_USERNAME_ALREADY_EXISTS = 'username_already_exists';
const MONGO_ERR = {
	err: 'component_error',
	des: 'MongoDB component is not available'
};

// db connection
const MONGODB_URI = config.db.conn;
let db;
let usersCollection;
let realmsCollection;

let localStoredRealms;
let lastTimeRefresedRealms;

const makeRegEx = str => new RegExp(`^${escapeRegexp(str.toLowerCase())}$`, 'i');

function connect(cbk) {
	MongoClient.connect(MONGODB_URI, function (err, connectedDb) {
		assert.equal(err, null, err);
		db = connectedDb;

		async.parallel([
			function (done) {
				usersCollection = connectedDb.collection('users');
				async.series([
					function (next) {
						usersCollection.ensureIndex('_id', next);
					},
					function (next) {
						usersCollection.ensureIndex('username', next);
					},
					function (next) {
						usersCollection.ensureIndex('password', next);
					}
				], done);
			},
			function (done) {
				realmsCollection = connectedDb.collection('realms');
				async.series([
					function (next) {
						realmsCollection.ensureIndex('_id', next);
					},
					function (next) {
						realmsCollection.ensureIndex('name', next);
					},
					function (next) {
						realmsCollection.ensureIndex('allowedDomains', next);
					}
				], done);
			}
		], cbk);

	});
}

function disconnect(cbk) {
	db.close(cbk);
}

function addUser(userToAdd, cbk) {
	const user = _.clone(userToAdd);

	if (!user.id) {
		return cbk({err: 'invalid_id'}, null);
	}
	if (!user.username) {
		return cbk({err: 'invalid_username'}, null);
	}
	user.username = user.username.toLowerCase();
	if (!user.password) {
		return cbk({err: 'invalid_password'}, null);
	}

	user.signUpDate = new Date().getTime();

	getFromUsername(user.username, function (err) {
		if (err) {
			if (err.message === ERROR_USER_NOT_FOUND) {
				user._id = user.id;
				delete(user.id);

				if (!user.roles || !user.roles.length) {
					user.roles = ['user'];
				}

				return usersCollection.insertOne(user, function (err, insertResult) {
					if (err) {
						return cbk(err, null);
					}

					user._id = insertResult.insertedId;

					return cbk(null, user);
				});
			}
			return cbk(err);
		}
		return cbk({err: ERROR_USERNAME_ALREADY_EXISTS});
	});
}

function countUsers(cbk) {
	usersCollection.count(function (err, count) {
		if (err) {
			return cbk(err);
		}
		return cbk(null, count);
	});
}

function findByEmail(email, callback) {

	const targetEmail = makeRegEx(email);

	usersCollection.count({username: targetEmail}, function (error, totalCount) {

		if (error) {
			return callback({
				statusCode: 500,
				body: {
					err: 'InternalError',
					des: 'User lookup failed'
				}
			});
		}

		if (totalCount) {
			return callback(null, {available: false});
		}

		return callback(null, {available: true});
	});
}

function findOneUser(criteria, options, cbk) {
	usersCollection.find(criteria, options || {}).limit(1).next(function (err, user) {
		if (err) {
			return cbk(err);
		}

		if (!user) {
			return cbk(new Error(ERROR_USER_NOT_FOUND));
		}
		return cbk(null, user);
	});
}

function updateOne(coll, criteria, update, cbk) {
	coll.updateOne(criteria, update, function (err, res) {
		if (err) {
			return cbk(err, null);
		}
		return cbk(null, res.modifiedCount);
	});
}

function getFromUsername(username, cbk) {
	if (!username) {
		return cbk({err: 'invalid_username'});
	}
	findOneUser({ username: makeRegEx(username) }, {password: 0}, cbk);
}

function getFromUsernamePassword(username, password, cbk) {
	findOneUser({ username:  makeRegEx(username), password }, {password: 0}, cbk);
}

function getAllUserFields(username, cbk) {
	if (!username) {
		return cbk({err: 'invalid_username'}, null);
	}
	findOneUser({ username: makeRegEx(username) }, {}, cbk);
}

function deleteAllUsers(cbk) {
	usersCollection.deleteMany({}, function (err) {
		return cbk(err);
	});
}

function getFromId(id, cbk) {
	findOneUser({_id: id}, {password: 0}, cbk);
}

function updateFieldWithMethod(userId, method, fieldName, fieldValue, cbk){
	updateOne(usersCollection, { _id: userId }, {
		[method]: {
			[fieldName]: fieldValue
		}
	}, cbk);
}

function removeFromArrayFieldById(userId, fieldName, fieldValue, cbk) {
	updateFieldWithMethod(userId, '$pull', fieldName, fieldValue, cbk);
}

function addToArrayFieldById(userId, fieldName, fieldValue, cbk) {
	updateOne(usersCollection, { _id: userId }, {
		$push: {
			[fieldName]: {
				$each: [fieldValue]
			}
		}
	}, cbk);
}

function updateField(userId, fieldName, fieldValue, cbk) {
	updateFieldWithMethod(userId, '$set', fieldName, fieldValue, cbk);
}

function updateArrayItem(userId, arrayName, itemKey, itemValue, cbk) {
	const query = {
		_id: userId,
		[`${arrayName}.${itemKey}`]: itemValue[itemKey]
	};

	const update = {
		$set: {
			[`${arrayName}.$`]: itemValue
		}
	};

	// first tries to update array item if already exists
	usersCollection.updateOne(query, update, function (err, updateResult) {
		if (err) {
			return cbk(err, null);
		}

		if (updateResult.modifiedCount !== 0) {
			return cbk(null, updateResult.modifiedCount);
		}
		updateOne(usersCollection, { _id: userId }, {
			$push: {
				[arrayName]: itemValue
			}
		}, cbk);
	});
}

function addRealm(realmToAdd, cbk) {
	realmsCollection.insertOne(realmToAdd, function (err, result) {
		if (err) {
			return cbk(err, null);
		}

		return cbk(null, result);
	});
}

function getRealmFromName(name, cbk) {
	if (!name) {
		return cbk({err: 'invalid_realm_name', code: 400});
	}
	const nameRe = makeRegEx(name);
	realmsCollection.find({name: nameRe}, {_id: 0}).limit(1).next(function (err, realm) {
		if (err) {
			return cbk(err);
		}

		if (!realm) {
			return cbk({err: 'realm_not_found', code: 400});
		}
		return cbk(null, realm);
	});
}

function getRealms(cbk) {
	const now = new Date().getTime();
	const timeSinceLastRefresh = now - lastTimeRefresedRealms;

	if (lastTimeRefresedRealms && timeSinceLastRefresh < TIME_TO_REFRESH) {
		return cbk(null, localStoredRealms);
	}

	realmsCollection.find({}, {_id: 0}).toArray(function (err, realms) {
		if (err) {
			return cbk(null, localStoredRealms);
		}

		lastTimeRefresedRealms = now;
		localStoredRealms = realms;
		return cbk(null, realms);
	});
}

function resetRealmsVariables() {
	localStoredRealms = null;
	lastTimeRefresedRealms = null;
}

function deleteAllRealms(cbk) {
	realmsCollection.deleteMany({}, function (err) {
		return cbk(err);
	});
}

function getStatus(cbk) {
	if (!db || !usersCollection) {
		return cbk(MONGO_ERR);
	}
	usersCollection.count({}, function (err) {
		if (err) {
			return cbk(MONGO_ERR);
		}
		return cbk();
	});
}

module.exports = {
	connect,
	disconnect,
	addUser,
	countUsers,
	getFromUsername,
	getFromUsernamePassword,
	deleteAllUsers,
	getFromId,

	updateField,
	updateFieldWithMethod,
	updateArrayItem,
	addToArrayFieldById,
	removeFromArrayFieldById,
	getAllUserFields,

	ERROR_USER_NOT_FOUND,
	ERROR_USERNAME_ALREADY_EXISTS,

	addRealm,
	getRealms,
	getRealmFromName,
	resetRealmsVariables,
	deleteAllRealms,
	findByEmail,
	getStatus
};
