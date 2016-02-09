var crypto = require('crypto');
var _ = require('lodash');
var RandExp = require('randexp');

var defaultSettings = {
    algorithm : 'aes-256-ctr',
    encryptPassword: 'password'
};

var _settings = {};

function encrypt(text, cbk){
    if(!text){
        return cbk();
    }
    var cipher = crypto.createCipher(_settings.algorithm, _settings.encryptPassword);
    var crypted = cipher.update(text,'utf8','hex');
    crypted += cipher.final('hex');
    cbk(crypted);
}

function verify(original, encrypted, cbk) {
    encrypt(original, function(crypted) {
        if(encrypted === crypted) {
            return cbk(null);
        }

        return cbk(new Error('Invalid password'));
    });
}

function randomPassword(passwordRegex) {
    return new RandExp(passwordRegex).gen();
}

module.exports = function(settings) {
    _.extend(_settings, defaultSettings, settings);

    return {
        encrypt: encrypt,
        verify: verify,
        randomPassword: randomPassword
    };
};
