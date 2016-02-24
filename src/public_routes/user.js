'use strict';

var config = require(process.cwd() + '/config.json');
var userMng = require('../managers/user');

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

function validateOldPassword(req, res, next) {
	var err;
	if (!config.password.validateOldPassword) {
		return next();
	}

	if (!req.body.oldPassword) {
		err = {
			err: 'missing_password',
			des: 'Missing old password validation'
		};
		res.send(400, err);
		return next(false);
	}

	userMng().validateOldPassword(req.user.username, req.body.oldPassword, function (err) {
		if (err) {
			res.send(401, err);
			return next(false);
		}
		return next();
	});
}

function setPassword(req, res, next) {
	userMng().setPassword(req.user._id, req.body, function (err) {
		if (err) {
			if (!err.code) {
				res.send(500, err);
				return next(false);
			}

			var errCode = err.code;
			delete(err.code);
			res.send(errCode, err);
			return next(false);
		}

		res.send(204);
		return next();
	});
}

function addRoutes(service) {
	service.get('/user/:email/password', forgotPassword_get);
	service.post(config.passThroughEndpoint.path, createUser_post);
	service.get('/user/activate', activateUser_get);
	service.post('/user/activate', activateUser_post);
	service.post('/user/email/available', checkEmailAvailability_post);
	service.put('/user/me/password', checkAccessTokenParam, checkAuthHeader, decodeToken, bodyRequired, findUser, validateOldPassword, setPassword);
}

module.exports = addRoutes;
