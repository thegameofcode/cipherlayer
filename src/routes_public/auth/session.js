'use strict';

const request = require('request');
const config = require('../../../config.json');

module.exports = function sessionRequest(deviceId, userId, method, userAgent, cbk) {
	if (deviceId) {
		const options = {
			url: `http://${config.private_host}:${config.private_port}/api/me/session`,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'x-user-id': userId,
				'user-agent': userAgent
			},
			method,
			json: true,
			body: { deviceId }
		};

		return request(options, function (err, res, body) {
			return cbk(err, body);
		});
	}

	return cbk();
};
