var log = require('../logger/service.js');

var cipherlayer = require('../cipherlayer');

function getStatus(req, res, next){
    cipherlayer.getStatus( function(err){
        if (err) {
            res.send(500, err);
            return next();
        }
        res.send(204);
        return next();
    });
}

function addRoutes(service) {
    service.get('/heartbeat', getStatus);

    log.info('Heartbeat route added');
}

module.exports = addRoutes;