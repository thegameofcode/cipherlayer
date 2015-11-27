var assert = require('assert');
var sinon = require('sinon');

var decodeToken = require('./../../src/middlewares/decodeToken');
var tokenManager = require('./../../src/managers/token');
var config = require('./../../config.json');

var INVALID_AT = 'dsoiafobadjsbahof2345245boadsbkcbiilaSDGERTFGsdfn4302984252hds';
var VALID_AT =   '0MgdHFSlMFEHJo1173u62ovnj9cra8ZfEZSHFQVjpYEOu_p87W5wooN5BiayILoaHA_0X7I1QSHYKdQrFJy27pe3-RgTvw-IBqlgLgcvq7wrWRrA7gDMeSeMsr4MHye3rhtFM33Euterc0VKuN8TjTS5vafzbDtlyCk_1oVkjT4';

var request;
var response;
var tokenMngStub;

describe('decodeToken middleware: ', function() {

  beforeEach(function(done) {
    request = {};
    request.params = {};
    request.auth = {};
    request.header = function(item) {
      return request.headers[item.toLowerCase()];
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

  it('decodes token successfully', function(done) {

    request.auth = config.authHeaderKey + VALID_AT;

    decodeToken(request, response, function(error) {
      assert.equal(error, null);
      assert.notEqual(request.tokenInfo, undefined);
      return done();
    });
  });

  it('cannot decode a badly-formatted token', function(done) {

    request.auth = config.authHeaderKey + INVALID_AT;

    decodeToken(request, response, function(error) {
      assert.equal(error, false);
      assert.equal(response.body.status, 403);
      assert.equal(response.body.message.err, 'invalid_token');
      assert.equal(response.body.message.des, 'invalid authorization header');
      return done();
    });
  });

  it('cannot decode due to token expiration', function(done) {
    request.auth = config.authHeaderKey + VALID_AT;

    tokenMngStub = sinon.stub(tokenManager, 'getAccessTokenInfo', function(accessToken, callback) {
      var error = {
        err: 'accesstoken_expired'
      };
      return callback(error);
    });

    decodeToken(request, response, function(error) {
      assert.equal(error, false);
      assert.equal(response.body.status, 401);
      assert.equal(response.body.message.err, 'expired_access_token');
      assert.equal(response.body.message.des, 'access token expired');
      tokenMngStub.restore();
      return done();
    });
  });

  it('fails to decode token', function(done) {
    request.auth = config.authHeaderKey + VALID_AT;

    tokenMngStub = sinon.stub(tokenManager, 'getAccessTokenInfo', function(accessToken, callback) {
      var error = {
        err: 'any_other_error'
      };
      return callback(error);
    });

    decodeToken(request, response, function(error) {
      assert.equal(error, false);
      assert.equal(response.body.status, 401);
      assert.equal(response.body.message.err, 'invalid_access_token');
      assert.equal(response.body.message.des, 'unable to read token info');
      tokenMngStub.restore();
      return done();
    });
  });
});