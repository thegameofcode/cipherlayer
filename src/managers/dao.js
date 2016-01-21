var clone = require('clone');
var assert = require('assert');
var async = require('async');
var extend = require('util')._extend;
var escapeRegexp = require('escape-regexp');
var config = require(process.cwd() + '/config.json');
var mongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

var redisMng = require('./redis.js');

var ERROR_USER_NOT_FOUND = 'user_not_found';
var ERROR_USERNAME_ALREADY_EXISTS = 'username_already_exists';

//db connection
var url = config.db.conn;
var db;
var usersCollection;
var realmsCollection;

var localStoredRealms;

function connect(cbk){
    mongoClient.connect(url, function(err, connectedDb){
        assert.equal(err,null, err);
        db = connectedDb;

        async.parallel([
            function(done){
                usersCollection = connectedDb.collection('users');
                async.series([
                    function(done){
                        usersCollection.ensureIndex('_id', done);
                    },
                    function(done){
                        usersCollection.ensureIndex('username', done);
                    },
                    function(done){
                        usersCollection.ensureIndex('password', done);
                    }
                ], done);
            },
            function(done){
                realmsCollection = connectedDb.collection('realms');
                async.series([
                    function(done){
                        realmsCollection.ensureIndex('_id', done);
                    },
                    function(done){
                        realmsCollection.ensureIndex('name', done);
                    },
                    function(done){
                        realmsCollection.ensureIndex('allowedDomains', done);
                    }
                ], done);
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

                usersCollection.insert(user, function(err, result){
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
    usersCollection.count(function(err, count){
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
    username = new RegExp("^"+escapeRegexp(username.toLowerCase())+"$", "i");
    usersCollection.find({username: username}, {password:0}, function(err, users){
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
    username = new RegExp("^"+escapeRegexp(username.toLowerCase())+"$", "i");
    usersCollection.find({username: username, password: password}, {password:0}, function(err, users){
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
    username = new RegExp("^"+escapeRegexp(username.toLowerCase())+"$", "i");
    usersCollection.find({username: username}, function(err, users){
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
    usersCollection.remove({},function(err){
        cbk(err);
    });
}

function getFromId(id, cbk){
    usersCollection.find({_id: id},{password:0}, function(err, users){
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
    usersCollection.update({_id: _id}, data, function(err, updatedProfiles){
        if(err) {
            return cbk(err, null);
        }
            cbk(null, updatedProfiles);
    });
}

function updateField(userId, fieldName, fieldValue, cbk){
    var data = {};
    data[fieldName] = fieldValue;
    usersCollection.update({_id: userId}, {$set:data}, function(err, updatedUsers){
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
    usersCollection.update(query, update , function(err, updatedUsers){
        if(err) {
            return cbk(err, null);
        }

        if(updatedUsers === 0){
            var update = {
                $push:{}
            };
            update.$push[arrayName] = itemValue;

            usersCollection.update({ _id: userId }, update, function(err, updatedUsers){
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

function getRealms(cbk){
    var redisKey = 'getRealmsFromMemory';

    redisMng.getKeyValue(redisKey, function(err, value){
        if(value && localStoredRealms) {
            return cbk(err, localStoredRealms);
        }

        realmsCollection.find({},{_id:0}).toArray(function(err, realms){
            if(err){
                return cbk(null, localStoredRealms);
            }

            var expiresIn = 60*60; //secs
            redisMng.insertKeyValue(redisKey, new Date().getTime(), expiresIn, function(){
                localStoredRealms = realms;
                return cbk(null, realms);
            });
        });
    });
}

function getStatus(cbk){
    var MONGO_ERR = {
        err: 'component_error',
        des: 'MongoDB component is not available'
    };

    if(!db || !usersCollection) return cbk(MONGO_ERR);
    usersCollection.count(function(err){
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

    getRealms: getRealms,

    getStatus: getStatus
};
