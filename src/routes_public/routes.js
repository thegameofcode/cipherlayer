'use strict';

var config = require(process.cwd() + '/config.json');

var authHeaderRequired = require('../middlewares/authHeaderRequired');
var decodeAccessToken = require('../middlewares/decodeToken');

var login_post = require('./auth/login_post');
var renew_post = require('./auth/renew_post');
var logout_post = require('./auth/logout_post');
var loginEmail_post = require('./auth/loginEmail_post');
var loginRefreshToken_get = require('./auth/loginRefreshToken_get');

var heartbeat_get = require('./heartbeat/heartbeat_get');

var authloginFacebook_post = require('./auth/loginFacebook_post');

var checkAccessTokenParam = require('../middlewares/accessTokenParam');
var checkAuthHeader = require('../middlewares/authHeaderRequired');
var decodeToken = require('../middlewares/decodeToken');
var findUser = require('../middlewares/findUser');
var bodyRequired = require('../middlewares/bodyRequired');

var forgotPassword_get = require('./user/forgotPassword_get');
var activateUser_get = require('./user/activateUser_get');
var activateUser_post = require('./user/activateUser_get');
var checkEmailAvailability_post = require('./user/checkEmailAvailability_post');
var createUser_post = require('./user/createUser_post');

var validateOldPassword = require('./user/validateOldPassword_put');
var setPassword = require('./user/setPassword_put');

module.exports = function(server){
	server.post('/auth/login', login_post);
	server.post('/auth/login/email', loginEmail_post);
	server.get('/auth/login/refreshToken', loginRefreshToken_get);
	server.post('/auth/renew', renew_post);
	server.post('/auth/logout', authHeaderRequired, decodeAccessToken, logout_post);
	server.get('/heartbeat', heartbeat_get);
	server.post('/auth/login/facebook', authloginFacebook_post);
	server.get('/user/:email/password', forgotPassword_get);
	server.post(config.passThroughEndpoint.path, createUser_post);
	server.get('/user/activate', activateUser_get);
	server.post('/user/activate', activateUser_post);
	server.post('/user/email/available', checkEmailAvailability_post);
	server.put('/user/me/password', checkAccessTokenParam, checkAuthHeader, decodeToken, bodyRequired, findUser, validateOldPassword, setPassword);
};
