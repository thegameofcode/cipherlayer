var world = require('../../support/world');
var request = require('request');
var assert = require('assert');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

module.exports = function(){
    this.When(/^the client app request to start SalesForce login process$/, function (callback) {

        var options = {
            url: 'http://localhost:'+config.public_port+'/auth/sf',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method:'GET',
            followRedirect : false
        };

        request(options, function(err,res,body) {
            assert.equal(err,null);
            world.getResponse().statusCode = res.statusCode;
            callback();
        });
    });
};
