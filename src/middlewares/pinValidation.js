var debug = require('debug')('cipherlayer:middleware:pinValidation');
var clone = require('clone');
var request = require('request');
var extend = require('util')._extend;

var countries = require('countries-info');
var phoneMng = require('../managers/phone');
var jsonUtil = require('../managers/json_validator');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));

var errInvalidFields = {
    err: 'auth_proxy_error',
    des: 'Invalid JSON fields'
};

var errPhoneNotVerified = {
    err: 'auth_proxy_error',
    des: 'User phone not verified'
};

var defaultSettings = config;

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

    if(requiresPinValidation){
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
            if (!pin) {
                debug('no pin number');
                phoneMng.createPIN(user.id, phone, function (err, createdPin) {
                    if (err) {
                        res.send(500, err);
                        return next(false);
                    } else {
                        res.send(403, errPhoneNotVerified);
                        return next(false);
                    }
                });
            } else {
                debug('user try pin number', pin);
                phoneMng.verifyPhone(user.id, phone, pin, function (err, verified) {
                    if (err) {
                        if (err.err != 'verify_phone_error') {
                            res.send(500, err);
                        } else {
                            res.send(401, err);
                        }
                        return next(false);
                    } else {
                        return next();
                    }
                });
            }
        });
    } else {
        return next();
    }
}

var _settings = {};
module.exports = function(settings){
    _settings = clone(defaultSettings);
    _settings = extend(_settings, settings);

    return pinValidation;
};
