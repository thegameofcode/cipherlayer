'use strict';

var daoMng = require('../managers/dao');
var config = require(process.cwd() + '/config.json');
var tokenMng = require('../managers/token');
var userMng = require('../managers/user');

var checkAccessTokenParam = require('../middlewares/accessTokenParam');
var checkAuthHeader = require('../middlewares/authHeaderRequired');
var decodeToken = require('../middlewares/decodeToken');
var findUser = require('../middlewares/findUser');
var _ = require('lodash');

var forgotPassword_get = require('./user/forgotPassword_get');
var activateUser_get = require('./user/activateUser_get');
var activateUser_post = require('./user/activateUser_get');

function createUserEndpoint(req, res, next) {
	userMng().createUser(req.body, req.headers['x-otp-pin'], function (error, tokens) {
		if (error) {
			if (!error.code) {
				res.send(500, error);
				return next(false);
			}
			var errCode = error.code;
			res.send(errCode, {err: error.err, des: error.des});
			return next(false);
		}

		tokenMng.getRefreshTokenInfo(tokens.refreshToken, function (err, tokenSet) {
			if (err) {
				res.send(500, {err: 'internal_error', des: 'error creating user tokens'});
				return next(false);
			}

			var userId = tokenSet.userId;
			var tokenData = tokenSet.data;

			if (config.version) {
				tokenData.deviceVersion = req.headers[config.version.header];
			}

			tokenMng.createBothTokens(userId, tokenData, function (err, tokens) {
				res.send(201, tokens);
				return next();
			});
		});

	});
}

function requireBody(req, res, next) {
	var err;
	if (!req.body) {
		err = {
			err: 'invalid_body',
			des: 'The call to this url must have body.'
		};
		res.send(400, err);
		return next(false);
	}

	return next();
}

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

function checkEmailAvailable(req, res, next) {
	var email = req.body.email;

	if (_.isEmpty(email)) {
		res.send(400, {
			err: 'BadRequestError',
			des: 'Missing email in request body'
		});
		return next(false);
	}

	daoMng.findByEmail(email, function (error, output) {
		if (error) {
			res.send(error.statusCode, error.body);
			return next(false);
		}

		res.send(200, output);
		return next();
	});
}

function addRoutes(service) {
	service.get('/user/:email/password', forgotPassword_get);

	service.post(config.passThroughEndpoint.path, createUserEndpoint);
	service.get('/user/activate', activateUser_get);
	service.post('/user/activate', activateUser_post);
	service.post('/user/email/available', checkEmailAvailable);
	service.put('/user/me/password', checkAccessTokenParam, checkAuthHeader, decodeToken, requireBody, findUser, validateOldPassword, setPassword);
}

module.exports = addRoutes;
