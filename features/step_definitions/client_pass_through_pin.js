var request = require('request');
var assert = require('assert');
var world = require('../support/world');
var nock = require('nock');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

var myStepDefinitionsWrapper = function () {
    this.When(/^the client makes a pass through (.*) with the following (.*) in the body with a pin header$/, function (METHOD, PUBLIC_PAYLOAD,callback) {

        var payload = JSON.parse(PUBLIC_PAYLOAD);

        world.getPinNumber(payload.email, '+34'+payload.phone, function(err, pin){

            console.log('PINNNNN NUMBERRRRR ', pin);
            var options = {
                url: 'http://localhost:' + config.public_port + config.passThroughEndpoint.path,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'x-otp-pin': pin
                },
                method: METHOD,
                body: PUBLIC_PAYLOAD
            };
            options.headers[config.version.header] = "test/1";

            nock('http://localhost:' + config.private_port)
                .post(config.passThroughEndpoint.path)
                .reply(201, {id: 1234567890});

            request(options, function(err,res,body) {
                assert.equal(err,null);
                world.getResponse().statusCode = res.statusCode;
                world.getResponse().body = JSON.parse(body);
                callback();
            });

        });


    });
};
module.exports = myStepDefinitionsWrapper;