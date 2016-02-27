'use strict';

var checkAuthBasic = require('../middlewares/checkAuthBasic');

var realms_get = require('./realms/realms_get');
var user_post = require('./auth/user_post');
var user_del = require('./auth/user_del');

module.exports = function addRoutes(server) {
	server.get('/realms', realms_get);
	server.post('/auth/user', checkAuthBasic, user_post);
	server.del('/auth/user', checkAuthBasic, user_del);
};
