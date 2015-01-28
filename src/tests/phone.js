var assert = require('assert');
var async = require('async');

var dao = require('../dao');
var phoneMng = require('../managers/phone');
var redisMng = require('../managers/redis');
var cipherlayer = require('../cipherlayer');

var nock = require('nock');

var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));

describe('Phone', function() {
    var baseUser = {
        id : 'a1b2c3d4e5f6',
        username : 'validuser',
        password : 'validpassword'
    };

    var notifServiceURL = config.services.notifications;

    beforeEach(function(done){
        async.parallel([
            function(done){
                cipherlayer.start(config.public_port, config.private_port, done);
            },
            function(done){
                async.series([
                    function(done){
                        redisMng.connect(done);
                    },
                    function(done){
                        redisMng.deleteAllKeys(done);
                    }
                ],done);
            }
        ], done);
    });

    afterEach(function(done){
        async.parallel([
            function(done){
                cipherlayer.stop(done);
            },
            function(done){
                redisMng.disconnect(done);
            }
        ],done);
    });

    it('Create pin', function(done){
        nock(notifServiceURL)
            .post('/notification/sms')
            .reply(204);

        var basePhone = '111111111';

        phoneMng.createPIN(baseUser.username, basePhone, function(err, createdPin){
            assert.equal(err,null);
            assert.notEqual(createdPin, null);
            done();
        });
    });

    describe('Verify phone', function() {
        it('valid PIN', function (done) {
            nock(notifServiceURL)
                .post('/notification/sms')
                .reply(204);

            var basePhone = '222222222';

            phoneMng.createPIN(baseUser.username, basePhone, function (err, createdPIN) {
                assert.equal(err, null);

                phoneMng.verifyPhone(baseUser.username, basePhone, createdPIN, function (err, verified) {
                    assert.equal(err, null);
                    assert.equal(verified, true);
                    done();
                });
            });
        });

        it('invalid PIN', function (done) {
            nock(notifServiceURL)
                .post('/notification/sms')
                .reply(204);

            var basePhone = '333333333';

            phoneMng.createPIN(baseUser.username, basePhone, function (err, createdPIN) {
                assert.equal(err, null);

                phoneMng.verifyPhone(baseUser.username, basePhone, 'zzzzz', function (err, verified) {
                    assert.notEqual(err, null);
                    assert.equal(err.err, 'verify_phone_error');
                    assert.equal(verified, false);
                    done();
                });
            });
        });

        it('invalid phone', function (done) {
            nock(notifServiceURL)
                .post('/notification/sms')
                .reply(204);

            var basePhone = '444444444';

            phoneMng.createPIN(baseUser.username, basePhone, function (err, createdPIN) {
                assert.equal(err, null);

                nock(notifServiceURL)
                    .post('/notification/sms')
                    .reply(204);

                phoneMng.verifyPhone(baseUser.username, '6666666', createdPIN, function (err, verified) {
                    assert.notEqual(err, null);
                    assert.equal(err.err, 'verify_phone_error');
                    assert.equal(verified, false);
                    done();
                });
            });
        });

        it('3 invalid PIN attempts', function (done) {
            nock(notifServiceURL)
                .post('/notification/sms')
                .reply(204);

            var basePhone = '555555555';

            phoneMng.createPIN(baseUser.username, basePhone, function (err, createdPIN) {
                assert.equal(err, null);

                //1st attempt
                phoneMng.verifyPhone(baseUser.username, basePhone, '11111', function (err, verified) {
                    assert.notEqual(err, null);
                    assert.equal(err.err, 'verify_phone_error');
                    assert.equal(verified, false);

                    //2nd attempt
                    phoneMng.verifyPhone(baseUser.username, basePhone, '22222', function (err, verified) {
                        assert.notEqual(err, null);
                        assert.equal(err.err, 'verify_phone_error');
                        assert.equal(verified, false);

                        //3rd attempt
                        nock(notifServiceURL)
                            .post('/notification/sms')
                            .reply(204);

                        phoneMng.verifyPhone(baseUser.username, basePhone, '33333', function (err, verified) {
                            assert.notEqual(err, null);
                            assert.equal(err.err, 'verify_phone_error');
                            assert.equal(verified, false);

                            //4th attempt, expired PIN
                            phoneMng.verifyPhone(baseUser.username, basePhone, createdPIN, function (err, verified) {
                                assert.notEqual(err, null);
                                assert.equal(err.err, 'verify_phone_error');
                                assert.equal(verified, false);

                                var redisKey = config.redisKeys.user_phone_verify.key;
                                redisKey = redisKey.replace('{userId}',baseUser.username).replace('{phone}',basePhone);

                                //5th attempt, new correct PIN
                                redisMng.getKeyValue(redisKey + '.pin', function(err, redisPhonePin) {
                                    assert.equal(err, null);
                                    assert.notEqual(createdPIN, redisPhonePin);

                                    phoneMng.verifyPhone(baseUser.username, basePhone, redisPhonePin, function (err, verified) {
                                        assert.equal(err, null);
                                        assert.equal(verified, true);
                                        done();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
