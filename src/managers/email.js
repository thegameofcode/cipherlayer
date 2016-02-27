'use strict';

var request = require('request');
var ciphertoken = require('ciphertoken');
var crypto = require('crypto');
var redisMng = require('./redis');

var config = require('../../config.json');
var log = require('../logger/service');

var _settings = {};

function sendEmailVerification(email, subject, html, cbk) {
	var notifServiceURL = _settings.externalServices.notifications.base;
	var emailOptions = {
		to: email,
		subject,
		html,
		from: _settings.emailVerification.from
	};

	var options = {
		url: notifServiceURL + _settings.externalServices.notifications.pathEmail,
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		},
		method: 'POST',
		body: JSON.stringify(emailOptions)
	};

	request(options, function (err, res, body) {
		if (res.statusCode === 500) {
			err = body;
			return cbk(err);
		}
		return cbk();
	});
}

function emailVerification(email, bodyData, cbk) {
	if (!_settings.emailVerification) {
		return cbk(null, null);
	}

	if (!email) {
		return cbk({
			err: 'auth_proxy_error',
			des: 'empty email'
		});
	}

	var transactionId = crypto.pseudoRandomBytes(12).toString('hex');

	var redisKey = _settings.emailVerification.redis.key;
	redisKey = redisKey.replace('{username}', bodyData[config.passThroughEndpoint.email || 'email']);
	var redisExp = _settings.emailVerification.redis.expireInSec;

	redisMng.insertKeyValue(redisKey, transactionId, redisExp, function (err) {
		if (err) {
			return cbk(err);
		}
		bodyData.transactionId = transactionId;

		//Get the same expiration as the redis Key
		var tokenSettings = {
			cipherKey: _settings.accessToken.cipherKey,
			firmKey: _settings.accessToken.signKey,
			tokenExpirationMinutes: redisExp
		};

		ciphertoken.createToken(tokenSettings, bodyData[config.passThroughEndpoint.email || 'email'], null, bodyData, function (err, token) {
			if (err) {
				return cbk(err);
			}

			var link = `${_settings.public_url}/user/activate?verifyToken=${token}`;
			var emailText = (_settings.emailVerification.body).replace('{link}', link);

			var subject = _settings.emailVerification.subject;
			//Send verify email
			sendEmailVerification(email, subject, emailText, function (err) {
				if (err) {
					return cbk(err);
				}
				return cbk(null, email);
			});

		});
	});
}

function sendEmailForgotPassword(email, passwd, link, cbk) {

	var html = _settings.password.body.replace('__PASSWD__', passwd).replace('__LINK__', link);

	var body = {
		to: email,
		subject: _settings.password.subject,
		html
	};

	var options = {
		url: _settings.externalServices.notifications.base + _settings.externalServices.notifications.pathEmail,
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		},
		method: 'POST',
		body: JSON.stringify(body)
	};

	request(options, function (err, res, body) {
		if (err) {
			log.error({ err });
			return cbk({err: 'internalError', des: 'Internal server error'});
		}
		if (res.statusCode === 500) {
			var serviceError = body;
			log.error(serviceError);
			return cbk(serviceError);
		}
		cbk();
	});

}

function sendEmailMagicLink(email, link, cbk){

	var html = _settings.magicLink.body.replace('__LINK__', link);

	var body = {
			to: email,
			subject: _settings.magicLink.subject,
			html
	};

	var options = {
		url: _settings.externalServices.notifications.base + _settings.externalServices.notifications.pathEmail,
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		},
		method: 'POST',
		body: JSON.stringify(body)
	};

	request(options, function (err, res, body){
		if (err) {
			log.error({ err });
			return cbk({err: 'internalError', des: 'Internal server error'});
		}
		if (res.statusCode === 500) {
			var serviceError = body;
			log.error(serviceError);
			return cbk({
				err: 'internal_error',
				des: 'Error calling notifications service for Magic Link email'
			});
		}
		cbk();
	});
}

module.exports = function (settings) {
	var config = require('../../config.json');
	_settings = Object.assign({}, config, settings);

	return {
		emailVerification,
		sendEmailForgotPassword,
		sendEmailMagicLink
	};
};
