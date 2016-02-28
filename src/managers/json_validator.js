'use strict';

const Validator = require('jsonschema').Validator;

module.exports = function (json, schema) {
	if (!json || Object.keys(json).length === 0) {
		return false;
	}

	if (!schema) {
		return true;
	}

	const result = (new Validator()).validate(json, schema);
	if (result.errors.length > 0) {
		return false;
	}
	return true;
};
