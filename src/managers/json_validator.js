var debug = require('debug')('mycomms-util-json_validator');
var Validator = require('jsonschema').Validator;

function isValidJSON(json, schema) {
    if( !json || Object.keys(json).length === 0) {
        debug('Empty JSON');
        return false;
    }
    if(schema) {
        var result = (new Validator()).validate(json, schema);
        if (result.errors.length > 0) {
            debug('Invalid JSON: ', result.errors);
            return false;
        }
    }
    return true;
}

module.exports = {
    isValidJSON: isValidJSON
};