'use strict';

const request = require('request');
const _ = require('lodash');
const countries = require('countries-info');
const redisMng = require('./redis');

let _settings = {};

function createPIN(redisKeyId, phone, cbk) {
	const redisKey = _settings.phoneVerification.redis.key.replace('{userId}', redisKeyId).replace('{phone}', phone);
	const expires = _settings.phoneVerification.redis.expireInSec;
	const pinAttempts = _settings.phoneVerification.attempts;

	let pin = '';

	// TODO: replace with map()
	for (let i = 0; i < _settings.phoneVerification.pinSize; i++) {
		pin += Math.floor(Math.random() * 9).toString();
	}

	redisMng.insertKeyValue(`${redisKey}.pin`, pin, expires, function (err, pin) {
		if (err) {
			return cbk(err);
		}
		redisMng.insertKeyValue(`${redisKey}.attempts`, pinAttempts, expires, function (err) {
			if (err) {
				return cbk(err);
			}
			sendPIN(phone, pin, function (pinErr) {
				cbk(pinErr, pin);
			});
		});
	});
}

function sendPIN(phone, pin, cbk) {
	const sms = {
		phone,
		text: `MyComms pin code: ${pin}`
	};

	request({
		url: `${_settings.externalServices.notifications.base}/notification/sms`,
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		},
		method: 'POST',
		body: JSON.stringify(sms)
	}, cbk);
}

function verifyPhone(redisKeyId, phone, country, pin, cbk) {
	if (!_settings.phoneVerification) {
		return cbk(null, true);
	}

	if (!phone || !country) {
		return cbk({
			err: 'auth_proxy_error',
			des: 'empty phone or country',
			code: 400
		});
	}
	countries.countryFromIso(country, function (err, returnedCountry) {
		if (err) {
			return cbk(err);
		}
		const formattedPhone = `+${returnedCountry.Dial}${phone}`;

		if (!formattedPhone) {
			return cbk({
				err: 'auth_proxy_error',
				des: 'empty phone',
				code: 400
			});
		}

		if (!pin) {
			createPIN(redisKeyId, formattedPhone, function (err) {
				if (err) {
					err.code = 500;
					return cbk(err);
				}
				return cbk({
					err: 'auth_proxy_verified_error',
					des: 'User phone not verified',
					code: 403
				});
			});
		} else {
			const redisKey = _settings.phoneVerification.redis.key.replace('{userId}', redisKeyId).replace('{phone}', formattedPhone);

			redisMng.getKeyValue(`${redisKey}.pin`, function (err, redisPhonePin) {
				if (err) return cbk(err);

				if (!redisPhonePin) {
					createPIN(redisKeyId, formattedPhone, function (err) {
						if (err) {
							return cbk(err);
						}
						return cbk({
							err: 'verify_phone_error',
							des: 'Expired PIN or incorrect phone number.',
							code: 401
						}, false);
					});
				} else {
					redisMng.getKeyValue(`${redisKey}.attempts`, function (err, redisPinAttempts) {
						if (err) return cbk(err);
						if (!redisPinAttempts || redisPinAttempts === '0') {
							createPIN(redisKeyId, formattedPhone, function (err) {
								if (err) {
									return cbk(err);
								}
								return cbk({
									err: 'verify_phone_error',
									des: 'PIN used has expired.',
									code: 401
								}, false);
							});
						} else {
							if (pin === redisPhonePin) {
								return cbk(null, true);
							}
							// Last attempt
							if (redisPinAttempts === '1') {
								createPIN(redisKeyId, formattedPhone, function (err) {
									if (err) {
										return cbk(err);
									}
									return cbk({
										err: 'verify_phone_error',
										des: 'PIN used has expired.',
										code: 401
									}, false);
								});
							} else {
								redisMng.updateKeyValue(`${redisKey}.attempts`, redisPinAttempts - 1, function (err) {
									if (err) return cbk(err);
									return cbk({
										err: 'verify_phone_error',
										des: 'PIN used is not valid.',
										code: 401
									}, false);
								});
							}
						}
					});
				}
			});
		}
	});
}

module.exports = function (settings) {
	const config = require('../../config.json');
	_settings = _.assign({}, config, settings);

	return {
		createPIN,
		verifyPhone
	};
};
