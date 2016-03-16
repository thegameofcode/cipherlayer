'use strict';

const config = require('../../config.json');

const authHeaderRequired = require('../middlewares/authHeaderRequired');
const decodeAccessToken = require('../middlewares/decodeToken');

const login_post = require('./auth/login_post');
const renew_post = require('./auth/renew_post');
const logout_post = require('./auth/logout_post');
const loginEmail_post = require('./auth/loginEmail_post');
const loginRefreshToken_get = require('./auth/loginRefreshToken_get');

const heartbeat_get = require('./heartbeat/heartbeat_get');

const authloginFacebook_post = require('./auth/loginFacebook_post');

const checkAccessTokenParam = require('../middlewares/accessTokenParam');
const checkAuthHeader = require('../middlewares/authHeaderRequired');
const decodeToken = require('../middlewares/decodeToken');
const findUser = require('../middlewares/findUser');
const bodyRequired = require('../middlewares/bodyRequired');

const forgotPassword_get = require('./user/forgotPassword_get');
const activateUser_get = require('./user/activateUser_get');
const activateUser_post = require('./user/activateUser_get');
const checkEmailAvailability_post = require('./user/checkEmailAvailability_post');
const createUser_post = require('./user/createUser_post');

const validateOldPassword = require('./user/validateOldPassword_put');
const setPassword = require('./user/setPassword_put');
const addUserRealm = require('./user/addUserRealm_post');
const removeUserRealm = require('./user/removeUserRealm_del');

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
	server.post('/user/me/realms', checkAccessTokenParam, checkAuthHeader, decodeToken, bodyRequired, findUser, addUserRealm);
	server.del('/user/me/realms', checkAccessTokenParam, checkAuthHeader, decodeToken, bodyRequired, findUser, removeUserRealm);
};
