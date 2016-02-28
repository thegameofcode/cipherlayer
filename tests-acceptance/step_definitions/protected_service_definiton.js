var world = require('../support/world');
var nock = require('nock');
var config = require('../../config.json');

module.exports = function(){
    this.Given(/^a protected service replies to a GET request with (.*) to (.*) with status (.*) and a responseBody (.*)$/, function (REQUEST_PAYLOAD, PATH, STATUS, RESPONSE_PAYLOAD, callback){
        nock('http://localhost:'+config.private_port, {
            reqheaders: {
                'Content-Type': 'application/json; charset=utf-8',
                'x-user-id' : world.getUser().id
            }
        }).get(PATH).reply(Number(STATUS), JSON.parse(RESPONSE_PAYLOAD));

        callback();
    });

    this.Given(/^a protected service replies to a GET request with (.*) to (.*) with status (.*) and a body (.*) and header (.*) and value (.*)$/, function (REQUEST_PAYLOAD, PATH, STATUS, RESPONSE_PAYLOAD, ALLOWED_HEADER, HEADER_VALUE, callback){
        var headers = {};
        headers[ALLOWED_HEADER] = HEADER_VALUE;
        nock('http://localhost:'+config.private_port, {
            reqheaders: {
                'Content-Type': 'application/json; charset=utf-8',
                'x-user-id' : world.getUser().id
            }
        }).get(PATH).reply(Number(STATUS), JSON.parse(RESPONSE_PAYLOAD), headers);

        callback();
    });

    this.Given(/^a protected service replies to a POST request with (.*) to (.*) with status (.*) and a responseBody (.*)$/, function (REQUEST_PAYLOAD, PATH, STATUS, RESPONSE_PAYLOAD, callback){
        nock('http://localhost:'+config.private_port)
            .post(PATH, JSON.parse(REQUEST_PAYLOAD))
            .reply(Number(STATUS), JSON.parse(RESPONSE_PAYLOAD));

        callback();
    });


    this.Given(/^a protected service replies to a PUT request with (.*) to (.*) with status (.*) and a responseBody (.*)$/, function (REQUEST_PAYLOAD, PATH, STATUS, RESPONSE_PAYLOAD, callback){
        nock('http://localhost:'+config.private_port)
            .put(PATH, JSON.parse(REQUEST_PAYLOAD))
            .reply(Number(STATUS), JSON.parse(RESPONSE_PAYLOAD));

        callback();
    });
};
