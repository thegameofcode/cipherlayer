'use strict';

const request = require('request');
const ciphertoken = require('ciphertoken');
const crypto = require('crypto');

const redisMng = require('./redis');
const log = require('../logger/service');

let _settings = {};

function sendEmailVerification(email, subject, html, cbk) {
	const notifServiceURL = _settings.externalServices.notifications.base;
	const emailOptions = {
		to: email,
		subject,
		html,
		from: _settings.emailVerification.from || _settings.defaultEmailSender
	};

	const options = {
		url: notifServiceURL + _settings.externalServices.notifications.pathEmail,
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		},
		method: 'POST',
		body: JSON.stringify(emailOptions)
	};

	request(options, function (err, res, body) {
		if (res.statusCode === 500) {
			return cbk(body);
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

	const transactionId = crypto.pseudoRandomBytes(12).toString('hex');

	const redisKey = _settings.emailVerification.redis.key.replace('{username}', bodyData[_settings.passThroughEndpoint.email || 'email']);
	const redisExp = _settings.emailVerification.redis.expireInSec;

	redisMng.insertKeyValue(redisKey, transactionId, redisExp, function (err) {
		if (err) {
			return cbk(err);
		}
		bodyData.transactionId = transactionId;

		// Get the same expiration as the redis Key
		const tokenSettings = {
			cipherKey: _settings.accessToken.cipherKey,
			firmKey: _settings.accessToken.signKey,
			tokenExpirationMinutes: redisExp
		};

		ciphertoken.createToken(tokenSettings, bodyData[_settings.passThroughEndpoint.email || 'email'], null, bodyData, function (err, token) {
			if (err) {
				return cbk(err);
			}

			const link = `${_settings.public_url}/user/activate?verifyToken=${token}`;
			const emailText = (_settings.emailVerification.body).replace('{link}', link);

			const subject = _settings.emailVerification.subject;
			// Send verify email
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

	const html = _settings.password.body.replace('__PASSWD__', passwd).replace('__LINK__', link);

	const body = {
		to: email,
		subject: _settings.password.subject,
		html,
		from: _settings.password.from || _settings.defaultEmailSender
	};

	const options = {
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
			const serviceError = body;
			log.error(serviceError);
			return cbk(serviceError);
		}
		cbk();
	});

}

function sendEmailMagicLink(email, link, cbk){

	const html = _settings.magicLink.body.replace('__LINK__', link);

	const body = {
		to: email,
		subject: _settings.magicLink.subject,
		html,
		from: _settings.magicLink.from || _settings.defaultEmailSender
	};

	const options = {
		url: _settings.externalServices.notifications.base + _settings.externalServices.notifications.pathEmail,
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		},
		method: 'POST',
		body: JSON.stringify(body)
	};

	request(options, function (err, res, resBody){
		if (err) {
			log.error({ err });
			return cbk({err: 'internalError', des: 'Internal server error'});
		}
		if (res.statusCode === 500) {
			log.error(resBody);
			return cbk({
				err: 'internal_error',
				des: 'Error calling notifications service for Magic Link email'
			});
		}
		return cbk();
	});
}

module.exports = function (settings) {
	const config = require('../../config');
	_settings = Object.assign({}, config, settings);

	return {
		emailVerification,
		sendEmailForgotPassword,
		sendEmailMagicLink
	};
};
