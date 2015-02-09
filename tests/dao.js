var assert = require('assert');
var clone = require('clone');
var config = require('../config.json');
var dao = require('../src/dao.js');

describe('user dao', function(){
    var baseUser = {
        id:'a1b2c3d4e5f6',
        username:'user1' + (config.allowedDomains[0] ? config.allowedDomains[0] : '') ,
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

        dao.addUser()(expectedUser, function(err,createdUser){
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
        dao.addUser()(expectedUser,function(err,createdUser){
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
        dao.addUser()(expectedUser, function(err,createdUser){
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
        dao.addUser()(expectedUser, function(err,createdUser){
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
        dao.addUser()(expectedUser,function(err,createdUser){
            assert.equal(err,null);
            assert.equal(createdUser.username,expectedUser.username);
            assert.equal(createdUser.password,expectedUser.password);
            dao.addUser()(expectedUser,function(err,createdUser){
                assert.equal(err.err,'username_already_exists');
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

    it('updateField', function(done){
        var expectedUser = clone(baseUser);
        var expectedField = 'field1';
        var expectedValue = 'value1';

        dao.deleteAllUsers(function(err) {
            assert.equal(err, null);
            dao.addUser()(expectedUser,function(err,createdUser) {
                assert.equal(err, null);
                assert.notEqual(createdUser, null);
                assert.equal(createdUser._id, expectedUser.id);
                dao.updateField(createdUser._id, expectedField, expectedValue, function(err, updates){
                    assert.equal(err, null);
                    assert.equal(updates, 1);
                    dao.getFromId(createdUser._id, function(err, foundUser){
                        assert.equal(err, null);
                        assert.notEqual(foundUser, null);
                        assert.equal(foundUser[expectedField], expectedValue);
                        done();
                    });
                });
            });
        });
    });

    describe('updateArrayItem', function(){
        it('Creates array if not exists', function(done){
            var expectedUser = clone(baseUser);
            var expectedField = 'fieldsArray';
            var expectedKey = 'field1';
            var expectedValue = { field1 : 'value1', field2: 'value2'};

            dao.deleteAllUsers(function(err) {
                assert.equal(err, null);
                dao.addUser()(expectedUser,function(err,createdUser) {
                    assert.equal(err, null);
                    assert.notEqual(createdUser, null);
                    assert.equal(createdUser._id, expectedUser.id);
                    dao.updateArrayItem(createdUser._id, expectedField, expectedKey, expectedValue, function(err, updates){
                        assert.equal(err, null);
                        assert.equal(updates, 1, 'incorrect number of objects updated');
                        dao.getFromId(createdUser._id, function(err, foundUser){
                            assert.equal(err, null);
                            assert.notEqual(foundUser, null);
                            assert.notEqual(foundUser[expectedField], null, 'attribute not added to object');
                            assert.equal(Object.prototype.toString.call(foundUser[expectedField]), '[object Array]', 'attribute must be an array' );
                            done();
                        });
                    });
                });
            });
        });

        it('Adds items to array', function(done){
            var expectedUser = clone(baseUser);
            var expectedField = 'fieldsArray';
            var expectedKey = 'field1';
            var expectedValue1 = { field1 : 'value1', field2: 'value1'};
            var expectedValue2 = { field1 : 'value2', field2: 'value2'};
            expectedUser[expectedField] = [];

            dao.deleteAllUsers(function(err) {
                assert.equal(err, null);
                dao.addUser()(expectedUser,function(err,createdUser) {
                    assert.equal(err, null);
                    assert.notEqual(createdUser, null);
                    assert.equal(createdUser._id, expectedUser.id);
                    dao.updateArrayItem(createdUser._id, expectedField, expectedKey, expectedValue1, function(err, updates){
                        assert.equal(err, null);
                        assert.equal(updates, 1, 'incorrect number of objects updated');
                        dao.updateArrayItem(createdUser._id, expectedField, expectedKey, expectedValue2, function(err, updates){
                            assert.equal(err, null);
                            assert.equal(updates, 1, 'incorrect number of objects updated');
                            dao.getFromId(createdUser._id, function(err, foundUser){
                                assert.equal(err, null);
                                assert.notEqual(foundUser, null);
                                assert.notEqual(foundUser[expectedField], null, 'array attribute not added to object');
                                assert.equal(foundUser[expectedField].length, 2, 'incorrect number of items added');
                                assert.deepEqual(foundUser[expectedField][0], expectedValue1, 'invalid item added');
                                assert.deepEqual(foundUser[expectedField][1], expectedValue2, 'invalid item added');
                                done();
                            });
                        });
                    });
                });
            });
        });

        it('Updates item in array', function(done){
            var expectedUser = clone(baseUser);
            var expectedField = 'fieldsArray';
            var expectedKey = 'field1';
            var expectedValue1 = { field1 : 'value1', field2: 'value1'};
            var expectedValue2 = { field1 : 'value2', field2: 'value2'};
            expectedUser[expectedField] = [expectedValue1,expectedValue2];
            var expectedNewValue = { field1: 'value2', field2: 'newvalue2'};

            dao.deleteAllUsers(function(err) {
                assert.equal(err, null);
                dao.addUser()(expectedUser,function(err, createdUser) {
                    assert.equal(err, null);
                    assert.notEqual(createdUser, null);
                    assert.equal(createdUser._id, expectedUser.id);
                    dao.updateArrayItem(createdUser._id, expectedField, expectedKey, expectedNewValue, function(err, updates){
                        assert.equal(err, null);
                        assert.equal(updates, 1, 'incorrect number of objects updated');
                        dao.getFromId(createdUser._id, function(err, foundUser){
                            assert.equal(err, null);
                            assert.notEqual(foundUser, null);
                            assert.notEqual(foundUser[expectedField], null, 'array attribute not added to object');
                            assert.notEqual(foundUser[expectedField], null, 'array attribute not added to object');
                            assert.deepEqual(foundUser[expectedField][1], expectedNewValue, 'invalid array item added');
                            done();
                        });
                    });
                });
            });
        });
    });

    describe('user domain', function(){
        it('domain not valid', function(done){
            var expectedUser = clone(baseUser);
            expectedUser.username = 'invalid.user@domain.com';

            var modifiedConfig = clone(config);
            modifiedConfig.allowedDomains = ["*@invalid.es"];

            dao.addUser(modifiedConfig)(expectedUser,function(err, createdUser){
                assert.notEqual(err,null);
                assert.equal(err.err, dao.ERROR_USER_DOMAIN_NOT_ALLOWED);
                done();
            });
        });

        it('not domains defined in config', function(done){
            var expectedUser = clone(baseUser);
            expectedUser.username = 'invalid.user@domain.com';

            var modifiedConfig = clone(config);
            modifiedConfig.allowedDomains = [];

            dao.addUser(modifiedConfig)(expectedUser,function(err, createdUser){
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

        it('some domains defined in config (valid)', function(done){
            var expectedUser = clone(baseUser);
            expectedUser.username = 'invalid.user@igzinc.com';

            var modifiedConfig = clone(config);
            modifiedConfig.allowedDomains = [
                "*@vodafone.com",
                "*@my-comms.com",
                "*@igzinc.com"
            ];

            dao.addUser(modifiedConfig)(expectedUser,function(err, createdUser){
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

        it('some domains defined in config (invalid)', function(done){
            var expectedUser = clone(baseUser);
            expectedUser.username = 'invalid.user@test.com';

            var modifiedConfig = clone(config);
            modifiedConfig.allowedDomains = [
                "*@vodafone.com",
                "*@my-comms.com",
                "*@igzinc.com"
            ];

            dao.addUser(modifiedConfig)(expectedUser,function(err, createdUser){
                assert.notEqual(err,null);
                assert.equal(err.err, dao.ERROR_USER_DOMAIN_NOT_ALLOWED);
                done();
            });
        });
    });

});
