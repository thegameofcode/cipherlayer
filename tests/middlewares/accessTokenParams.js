var assert = require('assert');
var accessTokenParams = require('./../../src/middlewares/accessTokenParam');
var config = require('./../../config.json');

var AT = 'abcdef123456789';
var request;
var response;

describe('accessTokenParams middleware: ', function() {

  beforeEach(function(done) {
    request = {};
    request.params = {};
    request.headers = {};
    response = {};
    return done();
  });

  it('existing AT param', function(done) {

    request.params.at = AT;

    accessTokenParams(request, response, function() {
      assert.notEqual(request.headers.authorization, undefined);
      assert.equal(request.headers.authorization, config.authHeaderKey + AT);
      return done();
    });
  });

  it('non-existing AT param', function(done) {

    accessTokenParams(request, response, function() {
      assert.equal(request.headers.authorization, undefined);
      return done();
    });
  });
});
