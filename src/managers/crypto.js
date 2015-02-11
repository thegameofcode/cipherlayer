var crypto = require('crypto');
var _ = require('lodash');

var defaultSettings = {
    algorithm : 'aes-256-ctr',
    password : ''
};

var _settings = {};

function encrypt(text, cbk){
    if(!text){
        return cbk();
    }
    var cipher = crypto.createCipher(_settings.algorithm, _settings.password);
    var crypted = cipher.update(text,'utf8','hex');
    crypted += cipher.final('hex');
    cbk(crypted);
}

function decrypt(text, cbk){
    if(!text){
        return cbk();
    }
    var decipher = crypto.createDecipher(_settings.algorithm, _settings.password);
    var dec = decipher.update(text,'hex','utf8');
    dec += decipher.final('utf8');
    cbk(dec);
}

module.exports = function(settings) {
    _.extend(_settings, defaultSettings, settings);

    return {
        encrypt: encrypt,
        decrypt: decrypt
    };
};