var redis = require('redis');

var redisClient;

function connect(cbk){
    redisClient = redis.createClient(6379, '127.0.0.1', {});
    redisClient.on('connect', function (err) {
        if(err) return cbk(err);
        cbk(null,true);
    });
}

function disconnect(cbk){
    redisClient.end();
    cbk(null,true);
}

function insertKeyValue(key, value, expSeconds, cbk){
    if(!redisClient){
        return cbk({err:'redis_not_connected'});
    };

    redisClient.set(key,value, function(err) {
        if (err) {
            return cbk(err);
        } else {
            redisClient.get(key, function(err, value) {
                if (err) {
                    return cbk(err);
                } else {
                    redisClient.expire(key, expSeconds);
                    return cbk(null,value);
                }
            });
        }
    });
}

function updateKeyValue(key, value, cbk){
    if(!redisClient){
        return cbk({err:'redis_not_connected'});
    };

    redisClient.ttl(key, function(err, expSeconds){
        if (err) return cbk(err);
        insertKeyValue(key, value, expSeconds, cbk);
    });
}

function getKeyValue(key, cbk){
    if(!redisClient){
        return cbk({err:'redis_not_connected'});
    };

    redisClient.get(key, function (err, value) {
        return cbk(err, value);
    });
}

function deleteKeyValue(key, cbk){
    if(!redisClient){
        return cbk({err:'redis_not_connected'});
    };

    redisClient.del(key, function (err, deleted) {
        return cbk(err, (deleted == 1));
    });
}

function deleteAllKeys(cbk){
    if(!redisClient){
        return cbk({err:'redis_not_connected'});
    };

    redisClient.flushall(cbk);
}

module.exports = {
    connect: connect,
    disconnect: disconnect,
    insertKeyValue: insertKeyValue,
    updateKeyValue: updateKeyValue,
    getKeyValue: getKeyValue,
    deleteKeyValue: deleteKeyValue,
    deleteAllKeys: deleteAllKeys
};