var debug = require('debug')('cipherlayer:middleware:pinValidation');
var clone = require('clone');
var request = require('request');
var _ = require('lodash');

var countries = require('countries-info');
var phoneMng = require('../managers/phone');
var jsonUtil = require('../managers/json_validator');
var config = require('../../config.json');

var errInvalidFields = {
    err: 'auth_proxy_error',
    des: 'Invalid JSON fields'
};

var defaultSettings = config;
var _settings = {};

function pinValidation(req, res, next) {
    var path = String(req.url);
    var body = clone(req.body);
    var endPoints = _settings.pinValidationEndpoints;
    var requiresPinValidation = false;
    var validBodySchema = false;
    var pinValidationConfig = {};

    for(var i = 0; i < endPoints.length; i++){
        var exp = endPoints[i].path;

        var check = exp.replace(/\*/g,'.*');

        var match = path.match(check);
        requiresPinValidation = (match !== null && path == match[0] && req.method.toUpperCase() === endPoints[i].method.toUpperCase());
        debug('match \''+ path +'\' with \'' + exp + '\' : ' + requiresPinValidation);
        if(requiresPinValidation){
            var fieldsSchema = {
                "id": "/MePhones",
                "type": "object",
                "properties": {},
                "additionalProperties": true
            };

            fieldsSchema.properties[endPoints[i].fields.countryISO] = { "type": "string", "required": true };
            fieldsSchema.properties[endPoints[i].fields.phoneNumber] = { "type": "string", "required": true };

            if(jsonUtil.isValidJSON(body, fieldsSchema)) {
                validBodySchema = true;
                pinValidationConfig = endPoints[i];
                break;
            }
        }
    }

    if(!requiresPinValidation){
        return next();
    } else {
        debug('Requires pin validation path \''+path+'\'');
        if(!validBodySchema){
            debug('Invalid body params');
            res.send(400, errInvalidFields);
            return next(false);
        }

        var phone = body[pinValidationConfig.fields.phoneNumber];
        var countryISO = body[pinValidationConfig.fields.countryISO];

        countries.countryFromIso(countryISO, function (err, returnedCountry) {
            if (err) {
                res.send(400, err);
                return next(false);
            }
            phone = '+' + returnedCountry.Dial + phone;

            var user = req.user;
            if(!user){
                res.send(401, {err:'invalid_headers', des:'no user in headers'});
                return next(false);
            }

            var pin = req.headers ? req.headers['x-otp-pin'] : null;
            debug('user try pin number', pin);
            phoneMng.verifyPhone(user.id, phone, pin, function (err, verified) {
                if (err) {
                    if (!err.code ) {
                        res.send(500, err);
                    } else {
                        var errCode = err.code;
                        delete(err.code);
                        res.send(errCode, err);
                    }
                    return next(false);
                } else {
                    return next();
                }
            });
        });
    }
}

module.exports = function(settings){
    _.extend(_settings, defaultSettings, settings);

    return pinValidation;
};
