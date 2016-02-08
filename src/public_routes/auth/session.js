'use strict';

var request = require("request");
var config = require(process.cwd() + '/config.json');

module.exports = function sessionRequest(deviceId, userId, method, userAgent, cbk) {
	if (deviceId) {
		var options = {
			url: 'http://' + config.private_host + ':' + config.private_port + '/api/me/session',
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'x-user-id': userId,
				'user-agent': userAgent
			},
			method: method,
			json: true,
			body: {"deviceId": deviceId}
		};

		request(options, function (err, res, body) {
			cbk(err, body);
		});

	} else {
		cbk();
	}
};
