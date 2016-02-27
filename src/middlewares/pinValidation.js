var log = require('../logger/service.js');
var _ = require('lodash');
var phoneMng = require('../managers/phone');
var isValidJSON = require('../managers/json_validator');
var config = require('../../config.json');

var errInvalidFields = {
	err: 'auth_proxy_error',
	des: 'Invalid JSON fields'
};

var defaultSettings = config;
var _settings = {};

function pinValidation(req, res, next) {
	if (!_settings.phoneVerification || !_settings.phoneVerification.pinValidationEndpoints) {
		return next();
	}

	var endPoints = _settings.phoneVerification.pinValidationEndpoints;

	var path = String(req.url);
	var body = _.clone(req.body);
	var requiresPinValidation = false;
	var validBodySchema = false;
	var pinValidationConfig = {};

	for (var i = 0; i < endPoints.length; i++) {
		var exp = endPoints[i].path;

		var check = exp.replace(/\*/g, '.*');

		var match = path.match(check);
		requiresPinValidation = (match !== null && path === match[0] && req.method.toUpperCase() === endPoints[i].method.toUpperCase());
		if (requiresPinValidation) {
			var fieldsSchema = {
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
	var user = req.user;
	if (!user) {
		res.send(401, {err: 'invalid_headers', des: 'no user in headers'});
		return next(false);
	}

	if (!validBodySchema) {
		log.warn('Invalid body params when checking for pin validation');
		res.send(400, errInvalidFields);
		return next(false);
	}

	var phone = body[pinValidationConfig.fields.phoneNumber];
	var countryISO = body[pinValidationConfig.fields.countryISO];

	var pin = req.headers ? req.headers['x-otp-pin'] : null;
	log.info({pinValidation: { user: user.id, pin }});
	phoneMng(_settings).verifyPhone(user.id, phone, countryISO, pin, function (err) {
		if (err) {
			log.error({ err }, 'Error validating phone');

			if (!err.code) {
				res.send(500, err);
				return next(false);
			}

			var errCode = err.code;
			delete(err.code);
			res.send(errCode, err);
			return next(false);
		}

		return next();
	});
}

module.exports = function (settings) {
	_.extend(_settings, defaultSettings, settings);

	return pinValidation;
};
