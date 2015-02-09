var assert = require('assert');
var userManager = require('../src/managers/user')();
var userDao = require('../src/dao');

var config = require('../config.json');

describe('User Manager', function(){
    beforeEach(function(done){
        userDao.connect(function(err){
            assert.equal(err,null);
            userDao.deleteAllUsers(done);
        });
    });

    afterEach(function(done){
        userDao.disconnect(function(err){
            assert.equal(err,null);
            done();
        });
    });

    it('Update Platform Data', function(done){
        var expectedPlatformData = {
            platform: 'sf',
            accessToken: 'a1b2c3...d4e5f6',
            refreshToken: 'a1b2c3...d4e5f6',
            expiresIn: 0
        };

        var expectedUser = {
            id:'a1b2c3d4e5f6',
            username: 'username' + (config.allowedDomains[0] ? config.allowedDomains[0] : ''),
            password: '12345678'
        };

        userDao.addUser()(expectedUser, function(err, createdUser){
            assert.equal(err, null);
            assert.notEqual(createdUser, null);
            userManager.setPlatformData(expectedUser.id, 'sf', expectedPlatformData, function(err){
                assert.equal(err, null);
                userDao.getFromId(expectedUser.id, function(err, foundUser){
                    assert.equal(err, null);
                    assert.notEqual(foundUser, null);
                    assert.notEqual(foundUser.platforms, null, 'must create an array of platforms');
                    assert.equal(foundUser.platforms.length, 1, 'invalid number of platforms');
                    assert.deepEqual(foundUser.platforms[0], expectedPlatformData, 'invalid platform data');
                    done();
                });
            });
        });
    });
});