var clone = require('clone');
var mongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

var ERROR_USER_NOT_FOUND = 'user_not_found';
var ERROR_USERNAME_ALREADY_EXISTS = 'username_already_exists';

//db connection
var url = config.db.conn;
var db;
var collection;

function connect(cbk){
    mongoClient.connect(url, function(err, connectedDb){
        assert.equal(err,null);
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

function addUser(userToAdd, cbk){
    userToAdd = clone(userToAdd);

    getFromUsername(userToAdd.username, function(err,foundUser){
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
                cbk(err,null);
            }
        } else {
            cbk(new Error(ERROR_USERNAME_ALREADY_EXISTS), null);
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
    collection.find({username: username}, {password:0}, function(err, users){
        if(err) {
            return cbk(err, null);
        }

        users.nextObject(function(err, user){
            if(err) {
                return cbk(err);
            }
            if(user == null){
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
            if(user == null){
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
            if(user == null){
                return cbk(new Error(ERROR_USER_NOT_FOUND), null);
            }
            if(user._id == id) {
                return cbk(null, user);
            }
        });
    });

}

function updateById(userId, data, cbk){
    if(util.isValidObjectID(userId)) {
        var _id = new ObjectID(userId);
        collection.update({_id: _id}, data, function(err, updatedUsers){
            if(err) {
                return cbk(err, null);
            }
            cbk(null, updatedUsers);
        });
    } else {
        cbk({err:'not_valid_profile'},null);
    }
}

module.exports = {
    connect : connect,
    disconnect : disconnect,

    addUser : addUser,
    countUsers : countUsers,
    getFromUsername : getFromUsername,
    getFromUsernamePassword : getFromUsernamePassword,
    deleteAllUsers : deleteAllUsers,
    getFromId : getFromId,

    updateById : updateById,

    ERROR_USER_NOT_FOUND: ERROR_USER_NOT_FOUND,
    ERROR_USERNAME_ALREADY_EXISTS: ERROR_USERNAME_ALREADY_EXISTS
};