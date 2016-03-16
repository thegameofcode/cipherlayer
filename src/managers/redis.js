'use strict';

const redis = require('redis');
const config = require('../../config.json');

const REDIS_HOST = config.redis.host || 'localhost';
const REDIS_PORT = config.redis.port || 6379;

let redisClient;
let isConnected;

function connect(cbk) {
	redisClient = redis.createClient(REDIS_PORT, REDIS_HOST, {});
	redisClient.on('connect', function (err) {
		if (err) {
			return cbk(err);
		}
		isConnected = true;
		return cbk(null, true);
	});
}

function disconnect(cbk) {
	if (!isConnected) {
		return cbk();
	}

	redisClient.end(false);
	isConnected = false;
	return cbk(null, false);
}

function insertKeyValue(key, value, expSeconds, cbk) {
	if (!isConnected || !redisClient) {
		return cbk({err: 'redis_not_connected'});
	}

	setKeyValue(key, value, function (err) {
		if (err) {
			return cbk(err);
		}

		getKeyValue(key, function (getErr, resValue) {
			if (getErr) {
				return cbk(getErr);
			}
			if (expSeconds) {
				redisClient.expire(key, expSeconds);
			}
			return cbk(null, resValue);
		});
	});
}

function updateKeyValue(key, value, cbk) {
	if (!isConnected || !redisClient) {
		return cbk({err: 'redis_not_connected'});
	}

	redisClient.ttl(key, function (err, expSeconds) {
		if (err) {
			return cbk(err);
		}

		insertKeyValue(key, value, expSeconds, cbk);
	});
}

function setKeyValue(key, value, cbk) {
	if (!isConnected || !redisClient) {
		return cbk({err: 'redis_not_connected'});
	}

	redisClient.set(key, value, function (err) {
		return cbk(err);
	});
}
function getKeyValue(key, cbk) {
	if (!isConnected || !redisClient) {
		return cbk({err: 'redis_not_connected'});
	}

	redisClient.get(key, function (err, value) {
		return cbk(err, value);
	});
}

function deleteKeyValue(key, cbk) {
	if (!isConnected || !redisClient) {
		return cbk({err: 'redis_not_connected'});
	}

	redisClient.del(key, function (err, deleted) {
		return cbk(err, (deleted === 1));
	});
}

function deleteAllKeys(cbk) {
	if (!isConnected || !redisClient) {
		return cbk({err: 'redis_not_connected'});
	}

	redisClient.flushall(cbk);
}

function getStatus(cbk) {
	if (!redisClient || !isConnected) {
		return cbk({
			err: 'component_error',
			des: 'Redis component is not available'
		});
	}

	return cbk();
}

module.exports = {
	connect,
	disconnect,
	insertKeyValue,
	updateKeyValue,
	getKeyValue,
	setKeyValue,
	deleteKeyValue,
	deleteAllKeys,
	getStatus
};
