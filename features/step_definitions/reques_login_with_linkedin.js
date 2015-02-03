var world = require('../support/world');
var request = require('request');
var assert = require('assert');
var fs = require('fs');
var config = require('../../config.json');

var myStepDefinitionsWrapper = function () {
    this.When(/^a user request login with linkedIn account$/, function (callback) {

        var options = {
            url: 'http://localhost:'+config.public_port+'/auth/in',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method:'GET',
            followRedirect: false
        };

        request(options, function(err,res,body){
            world.getResponse().err = err;
            world.getResponse().statusCode = res.statusCode;
            if(body){
                world.getResponse().body = JSON.parse(body);
            }
            callback();
        });
    });
};
module.exports = myStepDefinitionsWrapper;