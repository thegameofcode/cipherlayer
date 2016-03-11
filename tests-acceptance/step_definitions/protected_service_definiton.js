const world = require('../support/world');
const nock = require('nock');
const config = require('../../config');

module.exports = function(){
	this.Given(/^a protected service replies to a public GET request with (.*) to (.*) with status (.*) and a body (.*)$/, function (REQUEST_PAYLOAD, PATH, STATUS, RESPONSE_PAYLOAD, callback){
		nock(`http://localhost:${config.private_port}`, {
			reqheaders: {
				'Content-Type': 'application/json; charset=utf-8'
			}
		}).get(PATH).reply(Number(STATUS), JSON.parse(RESPONSE_PAYLOAD));

		callback();
	});

    this.Given(/^a protected service replies to a GET request with (.*) to (.*) with status (.*) and a responseBody (.*)$/, function (REQUEST_PAYLOAD, PATH, STATUS, RESPONSE_PAYLOAD, callback){
        nock(`http://localhost:${config.private_port}`, {
            reqheaders: {
                'Content-Type': 'application/json; charset=utf-8',
                'x-user-id' : world.getUser().id
            }
        }).get(PATH).reply(Number(STATUS), JSON.parse(RESPONSE_PAYLOAD));

        return callback();
    });

    this.Given(/^a protected service replies to a GET request with (.*) to (.*) with status (.*) and a body (.*) and header (.*) and value (.*)$/, function (REQUEST_PAYLOAD, PATH, STATUS, RESPONSE_PAYLOAD, ALLOWED_HEADER, HEADER_VALUE, callback){
		const headers = {};
        headers[ALLOWED_HEADER] = HEADER_VALUE;
        nock(`http://localhost:${config.private_port}`, {
            reqheaders: {
                'Content-Type': 'application/json; charset=utf-8',
                'x-user-id' : world.getUser().id
            }
        }).get(PATH).reply(Number(STATUS), JSON.parse(RESPONSE_PAYLOAD), headers);

        return callback();
    });

    this.Given(/^a protected service replies to a POST request with (.*) to (.*) with status (.*) and a responseBody (.*)$/, function (REQUEST_PAYLOAD, PATH, STATUS, RESPONSE_PAYLOAD, callback){
        nock(`http://localhost:${config.private_port}`)
            .post(PATH, JSON.parse(REQUEST_PAYLOAD))
            .reply(Number(STATUS), JSON.parse(RESPONSE_PAYLOAD));

        return callback();
    });


    this.Given(/^a protected service replies to a PUT request with (.*) to (.*) with status (.*) and a responseBody (.*)$/, function (REQUEST_PAYLOAD, PATH, STATUS, RESPONSE_PAYLOAD, callback){
        nock(`http://localhost:${config.private_port}`)
            .put(PATH, JSON.parse(REQUEST_PAYLOAD))
            .reply(Number(STATUS), JSON.parse(RESPONSE_PAYLOAD));

        return callback();
    });
};
