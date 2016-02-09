var Validator = require('jsonschema').Validator;

module.exports = {
	isValidJSON: function (json, schema) {
		if (!json || Object.keys(json).length === 0) {
			return false;
		}

		if (!schema) {
			return true;
		}

		var result = (new Validator()).validate(json, schema);
		if (result.errors.length > 0) {
			return false;
		}
		return true;
	}
};