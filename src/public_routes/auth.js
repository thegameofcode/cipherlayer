'use strict';

var checkAuthBasic = require('../middlewares/checkAuthBasic');
var login_post = require('./auth/login_post');
var user_post = require('./auth/user_post');
var user_del = require('./auth/user_del');
var renew_post = require('./auth/renew_post');
var logout_post = require('./auth/logout_post');

module.exports = function addRoutes(service) {
	service.post('/auth/login', login_post);
	service.post('/auth/renew', renew_post);
	service.post('/auth/logout', logout_post);

	service.post('/auth/user', checkAuthBasic, user_post);
	service.del('/auth/user', checkAuthBasic, user_del);
};
