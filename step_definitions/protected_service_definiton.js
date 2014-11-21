var world = require('../support/world');
var nock = require('nock');

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

module.exports = function(){
    this.Given(/^a protected service replies to a GET request with (.*) to (.*) with status (.*) and a body (.*)$/, function (REQUEST_PAYLOAD, PATH, STATUS, RESPONSE_PAYLOAD, callback){
        nock('http://localhost:'+config.private_port, {
            reqheaders: {
                'Content-Type': 'application/json; charset=utf-8',
                'x-user-id' : world.getUser().username
            }
        }).get(PATH).reply(STATUS, JSON.parse(RESPONSE_PAYLOAD));

        callback();
    });

    this.Given(/^a protected service replies to a POST request with (.*) to (.*) with status (.*) and a body (.*)$/, function (REQUEST_PAYLOAD, PATH, STATUS, RESPONSE_PAYLOAD, callback){
        nock('http://localhost:'+config.private_port)
            .post(PATH, JSON.parse(REQUEST_PAYLOAD))
            .reply(STATUS, JSON.parse(RESPONSE_PAYLOAD));

        callback();
    });
};
