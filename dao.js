var async = require('async');

var users = [];

var ERROR_USER_NOT_FOUND = 'user_not_found';
var ERROR_USERNAME_ALREADY_EXISTS = 'username_already_exists';

function addUser(username, password, cbk){
    getFromUsername(username, function(err,foundUser){
        if(err){
            if(err.message == ERROR_USER_NOT_FOUND) {
                var user = {
                    username: username,
                    password: password
                };
                users.push(user);
                cbk(null, user);
            } else {
                cbk(err,null);
            }
        } else {
            cbk(new Error(ERROR_USERNAME_ALREADY_EXISTS), null);
        }
    });
}

function countUsers(cbk){
    cbk(null, users.length);
}

function getFromUsername(username, cbk){
    var foundUser = null;
    async.each(users, function(user,done){
        if(user.username == username){
            foundUser = user;
            done('found');
        }
    },function(err){
        if(err === 'found'){
            cbk(null, foundUser);
        } else {
            cbk(new Error(ERROR_USER_NOT_FOUND), null);
        }
    });
}

function getFromUsernamePassword(username, password, cbk){
    getFromUsername(username, function(err, foundUser){
        if(err) {
            cbk(err, null);
        } else if(foundUser.password != password) {
            cbk(new Error(ERROR_USER_NOT_FOUND), null);
        } else {
            cbk(null, foundUser);
        }
    });
}

function deleteAllUsers(cbk){
    users = [];
    cbk();
}

module.exports = {
    addUser : addUser,
    countUsers : countUsers,
    getFromUsernamePassword : getFromUsernamePassword,
    deleteAllUsers : deleteAllUsers
};