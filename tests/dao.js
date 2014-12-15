var dao = require('../dao.js');
var assert = require('assert');
var clone = require('clone');

describe('user dao', function(){

    var baseUser = {
        id:'a1b2c3d4e5f6',
        username:'user1',
        password:'pass1'
    };

    beforeEach(function(done){
        dao.connect(function(err){
            assert.equal(err,null);
            dao.deleteAllUsers(done);
        });
    });

    afterEach(function(done){
        dao.disconnect(function(err){
            assert.equal(err,null);
            done();
        });
    });

    it('count', function(done){
        dao.countUsers(function(err,count){
            assert.equal(err, null);
            assert.equal(count, 0);
            done();
        });
    });

    it('add', function(done){
        var expectedUser = clone(baseUser);

        dao.addUser(expectedUser, function(err,createdUser){
            assert.equal(err,null);
            assert.equal(createdUser._id,expectedUser.id);
            assert.equal(createdUser.username,expectedUser.username);
            assert.equal(createdUser.password,expectedUser.password);
            dao.countUsers(function(err,count){
                assert.equal(err, null);
                assert.equal(count, 1);
                done();
            });
        });
    });

    it('getFromUsername', function(done){
        var expectedUser = clone(baseUser);
        dao.addUser(expectedUser,function(err,createdUser){
            assert.equal(err,null);
            assert.notEqual(createdUser,null);
            dao.getFromUsername(expectedUser.username, function(err, foundUser){
                assert.equal(err,null);
                assert.equal(foundUser.username,expectedUser.username);
                done();
            });
        });
    });

    it('getFromUsernamePassword', function(done){
        var expectedUser = clone(baseUser);
        dao.addUser(expectedUser, function(err,createdUser){
            assert.equal(err,null);
            assert.notEqual(createdUser,null);
            dao.getFromUsernamePassword(expectedUser.username, expectedUser.password, function(err, foundUser){
                assert.equal(err,null);
                assert.equal(foundUser.username,expectedUser.username);
                assert.equal(foundUser.password,undefined);
                done();
            });
        });
    });

    it('getFromId', function(done){
        var expectedUser = clone(baseUser);
        dao.addUser(expectedUser, function(err,createdUser){
            assert.equal(err,null);
            assert.notEqual(createdUser,null);
            dao.getFromId(createdUser._id, function(err, foundUser){
                assert.equal(err,null);
                assert.equal(foundUser.username,expectedUser.username);
                assert.equal(foundUser.password,undefined);
                done();
            });
        });
    });

    it('already exists', function(done){
        var expectedUser = clone(baseUser);
        dao.addUser(expectedUser,function(err,createdUser){
            assert.equal(err,null);
            assert.equal(createdUser.username,expectedUser.username);
            assert.equal(createdUser.password,expectedUser.password);
            dao.addUser(expectedUser,function(err,createdUser){
                assert.equal(err.message,'username_already_exists');
                assert.equal(createdUser,null);
                done();
            });
        });

    });

    it('delete all', function(done){
        dao.deleteAllUsers(function(err){
            assert.equal(err,null);
            dao.countUsers(function(err,count){
                assert.equal(err, null);
                assert.equal(count, 0);
                done();
            });
        }) ;
    });
});