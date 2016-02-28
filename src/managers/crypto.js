'use strict';

const crypto = require('crypto');
const _ = require('lodash');
const RandExp = require('randexp');

const defaultSettings = {
	algorithm: 'aes-256-ctr',
	encryptPassword: 'password'
};

let _settings = {};

function encrypt(text, cbk) {
	if (!text) {
		return cbk();
	}
	const cipher = crypto.createCipher(_settings.algorithm, _settings.encryptPassword);
	let crypted = cipher.update(text, 'utf8', 'hex');
	crypted += cipher.final('hex');
	return cbk(crypted);
}

function verify(original, encrypted, cbk) {
	encrypt(original, function (crypted) {
		if (encrypted === crypted) {
			return cbk();
		}

		return cbk(new Error('Invalid password'));
	});
}

function randomPassword(passwordRegex) {
	return new RandExp(passwordRegex).gen();
}

module.exports = function (settings) {
	_settings = _.extend({}, defaultSettings, settings);

	return {
		encrypt,
		verify,
		randomPassword
	};
};
