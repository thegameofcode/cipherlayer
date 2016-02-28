'use strict';

var assert = require('assert');
var jsonValidator = require('../src/managers/json_validator');

describe('jsonValidator', function () {
	it('no json', function (done) {
		var result = jsonValidator.isValidJSON(null, null);
		assert.equal(result, false);
		done();
	});

	it('no schema', function (done) {
		var result = jsonValidator.isValidJSON({isJson: true}, null);
		assert.equal(result, true);
		done();
	});

	it('valid json', function (done) {
		var result = jsonValidator.isValidJSON({isNumber: 1, isString: 'string'}, {
			"id": "/Profile",
			"type": "object",
			"properties": {
				"isNumber": {"type": "number", "required": true},
				"isString": {"type": "string", "required": true}
			},
			"additionalProperties": true
		});
		assert.equal(result, true);
		done();
	});
});
