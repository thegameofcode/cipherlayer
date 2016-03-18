const assert = require('assert');
const responseError = require('../src/util/response_errors');


describe('response error', function () {

	it('respond with 500 if no code provided', function (done) {
		const baseError = {des:'error'};
		const response = {
			send : (code, err) => {
				assert.equal(code, 500);
				assert.equal(err, baseError);
				done();
			}
		};
		responseError(baseError, response, () => {});
	});

	it('respond with custom code if code provided', function (done) {
		const baseError = {code:400, des:'error'};
		const response = {
			send : (code, err) => {
				assert.equal(code, 400);
				delete baseError.code;
				assert.equal(err, baseError);
				done();
			}
		};
		responseError(baseError, response, () => {});
	});

	it('respond with 500 error on unexpected error', function (done) {
		const baseError = 'string error';
		const response = {
			send : (code, err) => {
				assert.equal(code, 500);
				assert.deepEqual(err, {des:'string error'});
				done();
			}
		};
		responseError(baseError, response, () => {});
	});

});
