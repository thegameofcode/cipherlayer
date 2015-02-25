var redis = require('redis');
var config = require('../../config.json');

var redisClient;

var isConnected;

function connect(cbk){
    redisClient = redis.createClient(6379, config.redis.host, {});
    redisClient.on('connect', function (err) {
        if(err) return cbk(err);
        isConnected = true;
        cbk(null, true);
    });
}

function disconnect(cbk){
    redisClient.end();
    isConnected = false;
    cbk(null, false);
}

function insertKeyValue(key, value, expSeconds, cbk){
    if(!redisClient){
        return cbk({err:'redis_not_connected'});
    }

    redisClient.set(key, value, function(err) {
        if (err) {
            return cbk(err);
        } else {
            redisClient.get(key, function(err, value) {
                if (err) {
                    return cbk(err);
                } else {
                    if(expSeconds){
                        redisClient.expire(key, expSeconds);
                    }
                    return cbk(null,value);
                }
            });
        }
    });
}

function updateKeyValue(key, value, cbk){
    if(!redisClient){
        return cbk({err:'redis_not_connected'});
    }

    redisClient.ttl(key, function(err, expSeconds){
        if (err) return cbk(err);
        insertKeyValue(key, value, expSeconds, cbk);
    });
}

function getKeyValue(key, cbk){
    if(!redisClient){
        return cbk({err:'redis_not_connected'});
    }

    redisClient.get(key, function (err, value) {
        return cbk(err, value);
    });
}

function deleteKeyValue(key, cbk){
    if(!redisClient){
        return cbk({err:'redis_not_connected'});
    }

    redisClient.del(key, function (err, deleted) {
        return cbk(err, (deleted == 1));
    });
}

function deleteAllKeys(cbk){
    if(!redisClient){
        return cbk({err:'redis_not_connected'});
    }

    redisClient.flushall(cbk);
}

function getStatus(cbk){
    var REDIS_ERR = {
        err: 'component_error',
        des: 'Redis component is not available'
    };

    if(!redisClient || !isConnected) return cbk(REDIS_ERR);
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