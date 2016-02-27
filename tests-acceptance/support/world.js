const phoneMng = require("../../src/managers/phone");
const redisMng = require("../../src/managers/redis");
const nock = require("nock");
const config = require('../../config.json');

var user = {};

var versionHeader = 'test/1';

function getUser() {
	return user;
}

function resetUser() {
	user = {};
}

function createPin(userId, phone, cbk) {

	var notifServiceURL = config.externalServices.notifications;

	nock(notifServiceURL)
		.post('/notification/sms')
		.reply(204);

	phoneMng.createPIN(userId, phone, function (err, pin) {
		cbk(err, pin);
	});
}

function getPinNumber(userId, phone, cbk) {
	var redisKey = config.phoneVerification.redis.key;
	redisKey = redisKey.replace('{userId}', userId).replace('{phone}', phone);

	redisMng.getKeyValue(redisKey + '.pin', function (err, redisPhonePin) {
		cbk(err, redisPhonePin);
	});
}

// RESPONSE
var response = {};

function getResponse() {
	return response;
}

// TOKENS
var tokens = {};

function getTokens() {
	return tokens;
}

module.exports = {
	versionHeader: versionHeader,

	getUser: getUser,
	resetUser: resetUser,
	getResponse: getResponse,
	getTokens: getTokens,
	createPin: createPin,
	getPinNumber: getPinNumber
};
