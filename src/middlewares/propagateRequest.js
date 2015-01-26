var debug = require('debug')('cipherlayer:service');
var request = require('request');

function propagateRequest(req, res, next){
    var start = Date.now();

    request(req.options, function(err, private_res, body) {
        var timing = Date.now() - start;
        if(err) {
            debug('<= ' + private_res.statusCode + ' ' + err + ' ' + timing + 'ms');
            res.send(500, {err:' auth_proxy_error', des: 'there was an internal error when redirecting the call to protected service'});
        } else {
            try{
                body = JSON.parse(body);
                debug('<= ' + private_res.statusCode + ' json body' + ' ' + timing + 'ms');
            } catch(ex) {
                debug('<= ' + private_res.statusCode + ' no json body' + ' ' + timing + 'ms');
            }
            if(private_res.statusCode === 302){
                res.header('Location', private_res.headers.location);
                res.send(302);
            } else {
                res.send(Number(private_res.statusCode), body);
            }
        }

        return next();
    });
}

module.exports = propagateRequest;
