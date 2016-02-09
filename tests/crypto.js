var assert = require('assert');
var crypto = require('crypto');
var config = require('../config.json');

var defaultSettings = {
    algorithm : config.password.algorithm || 'aes-256-ctr',
    encryptPassword: config.password.encryptPassword || 'password'
};

describe('crypto', function() {

    var cipher = crypto.createCipher(defaultSettings.algorithm, defaultSettings.encryptPassword);

    it('encrypt', function (done) {

        var cryptoMng = require('../src/managers/crypto')(config.password);
        var value = 'Hello world';
        cryptoMng.encrypt(value, function(cryptedResult){
            var expectedValue = cipher.update(value,'utf8','hex');
            expectedValue += cipher.final('hex');
            assert.equal(cryptedResult, expectedValue);
            done();
        });
    });

    it('creates a valid random password', function() {

        var crypto = require('../src/managers/crypto');
        var cryptoMng = crypto(config.password);

      var newRandomPassword = cryptoMng.randomPassword(config.password.regexValidation);
        var testRe = new RegExp(config.password.regexValidation);

        assert.ok(newRandomPassword.match(testRe), 'Random password does not match with config regexp');

    });

});
