var world = require('../support/world');

module.exports = function(){
    this.Given(/^a user of client app with valid credentials$/, function (callback) {
        world.getUser().username = 'valid_user';
        world.getUser().password = 'valid_password';
        callback();
    });
};