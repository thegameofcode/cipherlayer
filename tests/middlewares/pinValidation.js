var assert = require('assert');
var pinValidation = require('./../../src/middlewares/pinValidation');

var request;
var response;

//TODO: cover remaining cases when refactoring phoneManager's module.exports as object instead of as function

describe('pinValidation middleware: ', function() {

  beforeEach(function(done) {

    request = {
      headers: {}
    };
    response = {};
    response.body = {};
    response.send = function(status, message) {
      response.body.status = status;
      response.body.message = message;
      return;
    };

    return done();
  });

  it('skips pin validation', function(done) {

    var settings = {
      phoneVerification: null
    };

    pinValidation(settings)(request, response, function(error) {
      assert.equal(error, undefined);
      assert.deepEqual(response.body, {});
      return done();
    });
  });

  it('does not require pin validation', function(done) {
    request.url = '/api/me/bla';
    request.body = { country: 'ES', phone: '666666666' };
    request.method = 'POST';
    request.user = { id: 'mc_1a2b3c4d5e6f' };

    pinValidation({})(request, response, function(error) {
      assert.equal(error, undefined);
      assert.deepEqual(response.body, {});
      return done();
    });
  });

  it('yields error due to missing user in request', function(done) {

    request.url = '/api/me/phones';
    request.headers['x-otp-pin'] = '7722';
    request.body = { country: 'ES', phone: '666666666' };
    request.method = 'POST';

    pinValidation({})(request, response, function(error) {
      assert.equal(error, false);
      assert.equal(response.body.status, 401);
      assert.equal(response.body.message.err, 'invalid_headers');
      assert.equal(response.body.message.des, 'no user in headers');
      return done();
    });
  });
});