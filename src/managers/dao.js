'use strict';

const assert = require('assert');
const async = require('async');
const escapeRegexp = require('escape-regexp');
const config = require('../../config.json');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
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

				return usersCollection.insert(user, function (err, result) {
					if (err) {
						return cbk(err, null);
					}

					return cbk(null, result[0]);
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

	usersCollection.find({username: targetEmail}, {password: 0}).toArray(function (error, foundUsers) {

		if (error) {
			return callback({
				statusCode: 500,
				body: {
					err: 'InternalError',
					des: 'User lookup failed'
				}
			});
		}

		if (_.isEmpty(foundUsers)) {
			return callback(null, {available: true});
		}

		return callback(null, {available: false});
	});
}

function getFromUsername(username, cbk) {
	if (!username) {
		return cbk({err: 'invalid_username'});
	}
	const usernameRe = makeRegEx(username);
	usersCollection.find({ username: usernameRe }, {password: 0}, function (err, users) {
		if (err) {
			return cbk(err);
		}

		users.nextObject(function (err, user) {
			if (err) {
				return cbk(err);
			}
			if (!user) {
				return cbk(new Error(ERROR_USER_NOT_FOUND));
			}
			return cbk(null, user);
		});
	});
}

function getFromUsernamePassword(username, password, cbk) {
	const usernameRE = makeRegEx(username);

	usersCollection.find({ username: usernameRE, password }, {password: 0}, function (err, users) {
		if (err) {
			return cbk(err, null);
		}

		users.nextObject(function (nextErr, user) {
			if (nextErr) {
				return cbk(nextErr);
			}
			if (!user) {
				return cbk(new Error(ERROR_USER_NOT_FOUND), null);
			}
			return cbk(null, user);
		});
	});
}

function getAllUserFields(username, cbk) {
	if (!username) {
		return cbk({err: 'invalid_username'}, null);
	}
	const usernameRE = makeRegEx(username);
	usersCollection.find({ username: usernameRE }, function (err, users) {
		if (err) {
			return cbk(err, null);
		}

		users.nextObject(function (nextErr, user) {
			if (nextErr) {
				return cbk(nextErr);
			}
			if (!user) {
				return cbk(new Error(ERROR_USER_NOT_FOUND), null);
			}
			return cbk(null, user);
		});
	});
}

function deleteAllUsers(cbk) {
	usersCollection.remove({}, function (err) {
		return cbk(err);
	});
}

function getFromId(id, cbk) {
	usersCollection.find({_id: id}, {password: 0}, function (err, users) {
		if (err) {
			return cbk(err, null);
		}

		users.nextObject(function (err, user) {
			if (err) {
				return cbk(err);
			}
			if (!user) {
				return cbk(new Error(ERROR_USER_NOT_FOUND), null);
			}
			if (user._id === id) {
				return cbk(null, user);
			}
		});
	});
}

function addToArrayFieldById(userId, fieldName, fieldValue, cbk) {
	const _id = new ObjectID(userId);

	const data = {
		$push: {
			[fieldName]: {
				$each: [fieldValue]
			}
		}
	};
	usersCollection.update({ _id }, data, function (err, updatedProfiles) {
		if (err) {
			return cbk(err, null);
		}
		return cbk(null, updatedProfiles);
	});
}

function updateField(userId, fieldName, fieldValue, cbk) {
	const data = {
		$set: {
			[fieldName]: fieldValue
		}
	};

	usersCollection.update({_id: userId}, data, function (err, updatedUsers) {
		if (err) {
			return cbk(err, null);
		}
		return cbk(null, updatedUsers);
	});
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
	usersCollection.update(query, update, function (err, updatedUsers) {
		if (err) {
			return cbk(err, null);
		}

		if (updatedUsers === 0) {
			const update = {
				$push: {
					[arrayName]: itemValue
				}
			};

			usersCollection.update({_id: userId}, update, function (err, updatedUsers) {
				if (err) {
					return cbk(err, null);
				}
				return cbk(null, updatedUsers);
			});
			return;
		}

		return cbk(null, updatedUsers);
	});
}

function addRealm(realmToAdd, cbk) {
	realmsCollection.insert(realmToAdd, function (err, result) {
		if (err) {
			return cbk(err, null);
		}

		return cbk(null, result[0]);
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
	realmsCollection.remove({}, function (err) {
		return cbk(err);
	});
}

function getStatus(cbk) {
	if (!db || !usersCollection) {
		return cbk(MONGO_ERR);
	}
	usersCollection.count(function (err) {
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
	updateArrayItem,
	addToArrayFieldById,
	getAllUserFields,

	ERROR_USER_NOT_FOUND,
	ERROR_USERNAME_ALREADY_EXISTS,

	addRealm,
	getRealms,
	resetRealmsVariables,
	deleteAllRealms,
	findByEmail,
	getStatus
};
