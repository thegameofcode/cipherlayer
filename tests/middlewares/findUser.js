var assert = require('assert');
var sinon = require('sinon');

var config = require('./../../config.json');
var findUser = require('./../../src/middlewares/findUser');
var userDao = require('./../../src/managers/dao');
var log = require('./../../src/logger/service.js');

var VALID_AT =   '0MgdHFSlMFEHJo1173u62ovnj9cra8ZfEZSHFQVjpYEOu_p87W5wooN5BiayILoaHA_0X7I1QSHYKdQrFJy27pe3-RgTvw-IBqlgLgcvq7wrWRrA7gDMeSeMsr4MHye3rhtFM33Euterc0VKuN8TjTS5vafzbDtlyCk_1oVkjT4';

var request;
var response;
var findUserStub;
var loggerSpy;

var mockedUser = {
  id:'a1b2c3d4e5f6',
  username:'user1' + (config.allowedDomains[0] ? config.allowedDomains[0] : '') ,
  password:'pass1'
};

describe('findUser middleware: ', function() {

  before(function(done) {
    findUserStub = sinon.stub(userDao, 'getFromId', function(userId, callback) {

      if (userId === mockedUser.id) {
        return callback(null, mockedUser);
      }

      return callback(true);
    });

    loggerSpy = sinon.spy(log, 'error');
    return done();
  });

  after(function(done) {
    findUserStub.restore();
    loggerSpy.restore();
    return done();
  });

  beforeEach(function(done) {
    request = {
      tokenInfo: {
        data: {
          roles: []
        }
      }
    };
    request._url = {};

    response = {};
    response.body = {};
    response.send = function(status, message) {
      response.body.status = status;
      response.body.message = message;
      return;
    };

    return done();
  });

  it('finds user successfully', function(done) {

    request.tokenInfo.userId = mockedUser.id;

    findUser(request, response, function(error) {
      assert.equal(error, undefined);
      assert.deepEqual(response.body, {});
      assert.deepEqual(request.user, mockedUser);
      return done();
    });
  });

  it('cannot find user', function(done) {

    request.tokenInfo.userId = 'invalid_user_id';
    request.accessToken = VALID_AT;

    findUser(request, response, function(error) {
      assert.equal(error, false);
      assert.equal(loggerSpy.calledOnce, true);
      assert.equal(response.body.status, 401);
      assert.equal(response.body.message.err, 'invalid_access_token');
      assert.equal(response.body.message.des, 'unknown user inside token');
      return done();
    });
  });
});