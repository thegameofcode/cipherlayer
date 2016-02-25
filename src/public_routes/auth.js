'use strict';

var checkAuthBasic = require('../middlewares/checkAuthBasic');
var login_post = require('./auth/login_post');
var user_post = require('./auth/user_post');
var user_del = require('./auth/user_del');
var renew_post = require('./auth/renew_post');
var logout_post = require('./auth/logout_post');
var loginEmail_post = require('./auth/loginEmail_post');
var loginRefreshToken_get = require('./auth/loginRefreshToken_get');

var authHeaderRequired = require('../middlewares/authHeaderRequired');
var decodeAccessToken = require('../middlewares/decodeToken');

module.exports = function addRoutes(service) {
	service.post('/auth/login', login_post);
	service.post('/auth/login/email', loginEmail_post);
	service.get('/auth/login/refreshToken', loginRefreshToken_get);

	service.post('/auth/renew', renew_post);
	service.post('/auth/logout', authHeaderRequired, decodeAccessToken, logout_post);

	service.post('/auth/user', checkAuthBasic, user_post);
	service.del('/auth/user', checkAuthBasic, user_del);
};
