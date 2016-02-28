'use strict';

const nock = require('nock');

const phoneMng = require('../../src/managers/phone');
const redisMng = require('../../src/managers/redis');
const config = require('../../config.json');

const versionHeader = 'test/1';

let response = {}; // eslint-disable-line prefer-const
let user = {}; // eslint-disable-line prefer-const
let tokens = {}; // eslint-disable-line prefer-const

function getUser() {
	return user;
}

function resetUser() {
	user = {};
}

// RESPONSE
function getResponse() {
	return response;
}

// TOKENS
function getTokens() {
	return tokens;
}

function createPin(userId, phone, cbk) {

	nock(config.externalServices.notifications)
		.post('/notification/sms')
		.reply(204);

	phoneMng.createPIN(userId, phone, cbk);
}

function getPinNumber(userId, phone, cbk) {
	const redisKey = config.phoneVerification.redis.key.replace('{userId}', userId).replace('{phone}', phone);

	redisMng.getKeyValue(`${redisKey}.pin`, cbk);
}

module.exports = {
	versionHeader,
	getUser,
	resetUser,
	getResponse,
	getTokens,
	createPin,
	getPinNumber
};
