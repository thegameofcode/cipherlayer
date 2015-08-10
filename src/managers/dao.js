var clone = require('clone');
var assert = require('assert');
var async = require('async');
var extend = require('util')._extend;
var escapeRegexp = require('escape-regexp');
var config = require(process.cwd() + '/config.json');
var mongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

var ERROR_USER_NOT_FOUND = 'user_not_found';
var ERROR_USERNAME_ALREADY_EXISTS = 'username_already_exists';

//db connection
var url = config.db.conn;
var db;
var collection;

function connect(cbk){
    mongoClient.connect(url, function(err, connectedDb){
        assert.equal(err,null, err);
        db = connectedDb;

        collection = connectedDb.collection('users');
        async.series([
            function(done){
                collection.ensureIndex('_id', done);
            },
            function(done){
                collection.ensureIndex('username', done);
            },
            function(done){
                collection.ensureIndex('password', done);
            }
        ], cbk);
    });
}

function disconnect(cbk){
    db.close(function(err){
        cbk(err);
    });
}

function _addUser(userToAdd, cbk){
    var user = clone(userToAdd);

    if(!user.id){
        return cbk({err:'invalid_id'}, null);
    }
    if(!user.username){
        return cbk({err:'invalid_username'}, null);
    }
    user.username = user.username.toLowerCase();
    if(!user.password){
        return cbk({err:'invalid_password'}, null);
    }

    var signUpDate = new Date().getTime();
    user.signUpDate = signUpDate;

    getFromUsername(user.username, function(err){
        if(err){
            if(err.message == ERROR_USER_NOT_FOUND) {
                user._id = user.id;
                delete(user.id);

                if(!user.roles || !user.roles.length){
                    user.roles = ['user'];
                }

                collection.insert(user, function(err, result){
                    if(err) {
                        return cbk(err, null);
                    }

                    cbk(null, result[0]);
                });
            } else {
                cbk(err, null);
            }
        } else {
            cbk({err:ERROR_USERNAME_ALREADY_EXISTS}, null);
        }
    });
}

function countUsers(cbk){
    collection.count(function(err, count){
        if(err){
            return cbk(err, null);
        }
        cbk(null, count);
    });
}

function getFromUsername(username, cbk){
    if(!username){
        return cbk({err:'invalid_username'}, null);
    }
    username = new RegExp(escapeRegexp(username.toLowerCase()), "i");
    collection.find({username: username}, {password:0}, function(err, users){
        if(err) {
            return cbk(err, null);
        }

        users.nextObject(function(err, user){
            if(err) {
                return cbk(err);
            }
            if(user === null){
                return cbk(new Error(ERROR_USER_NOT_FOUND), null);
            }
            return cbk(null, user);
        });
    });
}

function getFromUsernamePassword(username, password, cbk){
    username = new RegExp(escapeRegexp(username.toLowerCase()), "i");
    collection.find({username: username, password: password}, {password:0}, function(err, users){
        if(err) {
            return cbk(err, null);
        }

        users.nextObject(function(err, user){
            if(err) {
                return cbk(err);
            }
            if(user === null){
                return cbk(new Error(ERROR_USER_NOT_FOUND), null);
            }
            return cbk(null, user);
        });
    });
}

function getAllUserFields(username, cbk){
    if(!username){
        return cbk({err:'invalid_username'}, null);
    }
    username = new RegExp(escapeRegexp(username.toLowerCase()), "i");
    collection.find({username: username}, function(err, users){
        if(err) {
            return cbk(err, null);
        }

        users.nextObject(function(err, user){
            if(err) {
                return cbk(err);
            }
            if(user === null){
                return cbk(new Error(ERROR_USER_NOT_FOUND), null);
            }
            return cbk(null, user);
        });
    });
}

function deleteAllUsers(cbk){
    collection.remove({},function(err){
        cbk(err);
    });
}

function getFromId(id, cbk){
    collection.find({_id: id},{password:0}, function(err, users){
        if(err) {
            return cbk(err, null);
        }

        users.nextObject(function(err, user){
            if(err) {
                return cbk(err);
            }
            if(user === null){
                return cbk(new Error(ERROR_USER_NOT_FOUND), null);
            }
            if(user._id == id) {
                return cbk(null, user);
            }
        });
    });
}

function addToArrayFieldById(userId, fieldName, fieldValue,  cbk){
    var _id = new ObjectID(userId);
    var updatedField = {};
    updatedField[fieldName] = {
        $each: [fieldValue]
    };

    var data = {$push: updatedField};
    collection.update({_id: _id}, data, function(err, updatedProfiles){
        if(err) {
            return cbk(err, null);
        }
            cbk(null, updatedProfiles);
    });
}

function updateField(userId, fieldName, fieldValue, cbk){
    var data = {};
    data[fieldName] = fieldValue;
    collection.update({_id: userId}, {$set:data}, function(err, updatedUsers){
        if(err) {
            return cbk(err, null);
        }
        cbk(null, updatedUsers);
    });
}

function updateArrayItem(userId, arrayName, itemKey, itemValue, cbk){
    var query = { _id: userId };
    query[arrayName + '.' + itemKey] = itemValue[itemKey];

    var data = {};
    data[arrayName + '.$'] = itemValue;
    var update = {$set:data};

    //first tries to update array item if already exists
    collection.update(query, update , function(err, updatedUsers){
        if(err) {
            return cbk(err, null);
        }

        if(updatedUsers === 0){
            var update = {
                $push:{}
            };
            update.$push[arrayName] = itemValue;

            collection.update({ _id: userId }, update, function(err, updatedUsers){
                if(err){
                    return cbk(err, null);
                }
                cbk(null, updatedUsers);
            });
            return;
        }

        cbk(null, updatedUsers);
    });
}

function getStatus(cbk){
    var MONGO_ERR = {
        err: 'component_error',
        des: 'MongoDB component is not available'
    };

    if(!db || !collection) return cbk(MONGO_ERR);
    collection.count(function(err){
        if(err) return cbk(MONGO_ERR);
        cbk();
    });
}

var _settings = {};

module.exports = {
    connect : connect,
    disconnect : disconnect,
    addUser : function(settings){
        _settings = clone(config);
        _settings = extend(_settings, settings);
        return _addUser;
    },
    countUsers : countUsers,
    getFromUsername : getFromUsername,
    getFromUsernamePassword : getFromUsernamePassword,
    deleteAllUsers : deleteAllUsers,
    getFromId : getFromId,

    updateField : updateField,
    updateArrayItem : updateArrayItem,
    addToArrayFieldById:addToArrayFieldById,
    getAllUserFields:getAllUserFields,

    ERROR_USER_NOT_FOUND: ERROR_USER_NOT_FOUND,
    ERROR_USERNAME_ALREADY_EXISTS: ERROR_USERNAME_ALREADY_EXISTS,

    getStatus: getStatus
};