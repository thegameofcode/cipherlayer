var debug = require('debug')('cipherlayer:service');

function printTraces (req, res, next){
    var url = req.options.url;
    debug('=> ' + req.method + ' ' + url);
    next();
}

module.exports = printTraces;
