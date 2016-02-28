'use strict';

const assert = require('assert');
const isValidJSON = require('../src/managers/json_validator');

describe('jsonValidator', function () {
	it('no json', function (done) {
		const result = isValidJSON(null, null);
		assert.equal(result, false);
		return done();
	});

	it('no schema', function (done) {
		const result = isValidJSON({isJson: true}, null);
		assert.equal(result, true);
		return done();
	});

	it('valid json', function (done) {
		const result = isValidJSON({isNumber: 1, isString: 'string'}, {
			id: '/Profile',
			type: 'object',
			properties: {
				isNumber: {type: 'number', required: true},
				isString: {type: 'string', required: true}
			},
			additionalProperties: true
		});
		assert.equal(result, true);
		return done();
	});
});
