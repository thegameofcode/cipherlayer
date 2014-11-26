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
    collection.find({username: username}, function(err, users){
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
                found = true;
                cbk(null, user);
            }
        });
    });
}

function getFromUsernamePassword(username, password, cbk){
    getFromUsername(username, function(err, foundUser){
        if(err) {
            cbk(err, null);
        } else if(foundUser.password != password) {
            cbk(new Error(ERROR_USER_NOT_FOUND), null);
        } else {
            delete(foundUser.password);
            cbk(null, foundUser);
        }
    });
}

function deleteAllUsers(cbk){
    collection.remove({},function(err,numberRemoved){
        cbk();
    });
}

module.exports = {
    connect : connect,
    disconnect : disconnect,

    addUser : addUser,
    countUsers : countUsers,
    getFromUsername : getFromUsername,
    getFromUsernamePassword : getFromUsernamePassword,
    deleteAllUsers : deleteAllUsers,

    ERROR_USER_NOT_FOUND: ERROR_USER_NOT_FOUND,
    ERROR_USERNAME_ALREADY_EXISTS: ERROR_USERNAME_ALREADY_EXISTS
};