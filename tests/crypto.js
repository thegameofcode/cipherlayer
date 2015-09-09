var assert = require('assert');
var crypto = require('crypto');

describe('crypto', function() {

    var cryptoSettings = {
        algorithm : 'aes-256-ctr',
        password : 'mycomms'
    };

    var cipher = crypto.createCipher(cryptoSettings.algorithm, cryptoSettings.password);
    var decipher = crypto.createDecipher(cryptoSettings.algorithm, cryptoSettings.password);

    it('encrypt', function (done) {
        var cryptoMng = require('../src/managers/crypto')(cryptoSettings);
        var value = 'Hello world';
        cryptoMng.encrypt(value, function(cryptedResult){
            var expectedValue = cipher.update(value,'utf8','hex');
            expectedValue += cipher.final('hex');
            assert.equal(cryptedResult, expectedValue);
            done();
        });
    });

    it('decrypt', function (done) {
        var cryptoMng = require('../src/managers/crypto')(cryptoSettings);
        var value = 'd43daa54527261b3ba7f';
        cryptoMng.decrypt(value, function(decryptedResult){
            var expectedValue = decipher.update(value,'hex','utf8');
            expectedValue += decipher.final('utf8');

            assert.equal(decryptedResult, expectedValue);
            done();
        });
    });


    it('encrypt & decript', function (done) {
        var cryptoMng = require('../src/managers/crypto')(cryptoSettings);
        var value = 'a1b2c3d4e5f6';
        cryptoMng.encrypt(value, function(cryptedResult){
            cryptoMng.decrypt(cryptedResult, function(decryptedResult){
                assert.equal(decryptedResult, value);
                done();
            });
        });
    });

    it('encrypt & decript (default settings)', function (done) {
        var cryptoMng = require('../src/managers/crypto')(cryptoSettings);
        var value = '1a2b3c4d5e6f';
        cryptoMng.encrypt(value, function(cryptedResult){
            cryptoMng.decrypt(cryptedResult, function(decryptedResult){
                assert.equal(decryptedResult, value);
                done();
            });
        });
    });
});
