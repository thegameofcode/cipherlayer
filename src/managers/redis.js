var redis = require('redis');
var config = require(process.cwd() + '/config.json');

var redisClient;

var isConnected;

function connect(cbk) {
	var host = config.redis.host || "localhost";
	var port = config.redis.port || 6379;

	redisClient = redis.createClient(port, host, {});
	redisClient.on('connect', function (err) {
		if (err) return cbk(err);
		isConnected = true;
		cbk(null, true);
	});
}

function disconnect(cbk) {
	if (!isConnected) {
		return cbk();
	}

	redisClient.end();
	isConnected = false;
	cbk(null, false);
}

function insertKeyValue(key, value, expSeconds, cbk) {
	if (!isConnected || !redisClient) {
		return cbk({err: 'redis_not_connected'});
	}

	redisClient.set(key, value, function (err) {
		if (err) {
			return cbk(err);
		} else {
			redisClient.get(key, function (err, value) {
				if (err) {
					return cbk(err);
				} else {
					if (expSeconds) {
						redisClient.expire(key, expSeconds);
					}
					return cbk(null, value);
				}
			});
		}
	});
}

function updateKeyValue(key, value, cbk) {
	if (!isConnected || !redisClient) {
		return cbk({err: 'redis_not_connected'});
	}

	redisClient.ttl(key, function (err, expSeconds) {
		if (err) return cbk(err);
		insertKeyValue(key, value, expSeconds, cbk);
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
		return cbk(err, (deleted == 1));
	});
}

function deleteAllKeys(cbk) {
	if (!isConnected || !redisClient) {
		return cbk({err: 'redis_not_connected'});
	}

	redisClient.flushall(cbk);
}

function getStatus(cbk) {
	var REDIS_ERR = {
		err: 'component_error',
		des: 'Redis component is not available'
	};

	if (!redisClient || !isConnected) return cbk(REDIS_ERR);
	cbk();
}

module.exports = {
	connect: connect,
	disconnect: disconnect,
	insertKeyValue: insertKeyValue,
	updateKeyValue: updateKeyValue,
	getKeyValue: getKeyValue,
	deleteKeyValue: deleteKeyValue,
	deleteAllKeys: deleteAllKeys,

	getStatus: getStatus
};