var debug = require('debug')('cipherlayer:dao');
var clone = require('clone');
var assert = require('assert');
var extend = require('util')._extend;
var config = require('../config.json');
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
        cbk();
    });
}

function disconnect(cbk){
    db.close(function(err,result){
        cbk(err);
    });
}

function _addUser(userToAdd, cbk){
    if(!userToAdd.id){
        return cbk({err:'invalid_id'}, null);
    }
    if(!userToAdd.username){
        return cbk({err:'invalid_username'}, null);
    }
    if(!userToAdd.password){
        return cbk({err:'invalid_password'}, null);
    }

    var signUpDate = new Date().getTime();
    userToAdd.signUpDate = signUpDate;

    userToAdd = clone(userToAdd);

    getFromUsername(userToAdd.username, function(err, foundUser){
        if(err){
            if(err.message == ERROR_USER_NOT_FOUND) {
                userToAdd._id = userToAdd.id;
                delete(userToAdd.id);

                collection.insert(userToAdd, function(err, result){
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
            if(user.username == username) {
                return cbk(null, user);
            }
        });
    });
}

function getFromUsernamePassword(username, password, cbk){
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
            if(user.username == username) {
                return cbk(null, user);
            }
        });
    });
}

function getAllUserFields(username, cbk){
    if(!username){
        return cbk({err:'invalid_username'}, null);
    }

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
            if(user.username == username) {
                return cbk(null, user);
            }
        });
    });
}

function deleteAllUsers(cbk){
    collection.remove({},function(err,numberRemoved){
        cbk();
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
    collection.update(query, update, {upsert:true} , function(err, updatedUsers){
        if(err) {
            if(err.code == 16836){
                //item is not found, we add it
                var update = {
                    $addToSet:{}
                };
                update.$addToSet[arrayName] = itemValue;

                collection.update({ _id: userId }, update, function(err, updatedUsers){
                    if(err){
                        return cbk(err, null);
                    }
                    cbk(null, updatedUsers);
                });
                return;
            }

            cbk(err, null);
        } else {
            cbk(null, updatedUsers);
        }
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
    ERROR_USERNAME_ALREADY_EXISTS: ERROR_USERNAME_ALREADY_EXISTS
};