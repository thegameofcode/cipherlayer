'use strict';

const log = require('../logger/service');
const _ = require('lodash');
const phoneMng = require('../managers/phone');
const isValidJSON = require('../managers/json_validator');
const config = require('../../config.json');

const errInvalidFields = {
	err: 'auth_proxy_error',
	des: 'Invalid JSON fields'
};

let _settings = {};

function pinValidation(req, res, next) {
	if (!_settings.phoneVerification || !_settings.phoneVerification.pinValidationEndpoints) {
		return next();
	}

	const endPoints = _settings.phoneVerification.pinValidationEndpoints;

	const path = String(req.url);
	const body = _.clone(req.body);
	let requiresPinValidation = false;
	let validBodySchema = false;
	let pinValidationConfig = {};

	// TODO: replace with map() or some()
	for (let i = 0; i < endPoints.length; i++) {
		const exp = endPoints[i].path;

		const check = exp.replace(/\*/g, '.*');

		const match = path.match(check);
		requiresPinValidation = (match !== null && path === match[0] && req.method.toUpperCase() === endPoints[i].method.toUpperCase());
		if (requiresPinValidation) {
			const fieldsSchema = {
				id: '/MePhones',
				type: 'object',
				properties: {},
				additionalProperties: true
			};

			fieldsSchema.properties[endPoints[i].fields.countryISO] = { type: 'string', required: true };
			fieldsSchema.properties[endPoints[i].fields.phoneNumber] = { type: 'string', required: true };

			if (isValidJSON(body, fieldsSchema)) {
				validBodySchema = true;
				pinValidationConfig = endPoints[i];
				break;
			}
		}
	}

	if (!requiresPinValidation) {
		return next();
	}
	const user = req.user;
	if (!user) {
		const err = {err: 'invalid_headers', des: 'no user in headers'};
		res.send(401, err);
		return next(err);
	}

	if (!validBodySchema) {
		log.warn('Invalid body params when checking for pin validation');
		res.send(400, errInvalidFields);
		return next(errInvalidFields);
	}

	const phone = body[pinValidationConfig.fields.phoneNumber];
	const countryISO = body[pinValidationConfig.fields.countryISO];

	const pin = req.headers ? req.headers['x-otp-pin'] : null;
	log.info({pinValidation: { user: user.id, pin }});
	phoneMng(_settings).verifyPhone(user.id, phone, countryISO, pin, function (err) {
		if (err) {
			log.error({ err }, 'Error validating phone');

			if (!err.code) {
				res.send(500, err);
				return next(err);
			}

			const errCode = err.code;
			delete(err.code);
			res.send(errCode, err);
			return next(err);
		}

		return next();
	});
}

module.exports = function (settings) {
	_settings = _.extend({}, config, settings);

	return pinValidation;
};
