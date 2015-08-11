var log = require('../logger/service.js');
var config = require(process.cwd() + '/config.json');
var request = require('request');
var httpProxy = require('http-proxy');
var _ = require('lodash');

var proxy = httpProxy.createProxyServer({});

proxy.on('proxyReq', function() {
    log.info('> http-proxy request received');
});

proxy.on('proxyRes', function() {
    log.info('< http-proxy response received');
});

proxy.on('error', function (err, req, res) {
    log.error({err:err, des: 'there was an internal error when redirecting the call to protected service'});
    res.send(500, {err:' auth_proxy_error', des: 'there was an internal error when redirecting the call to protected service'});
});

function propagateRequest(req, res, next){
    var start = Date.now();

        var useDirectProxy = _.some(config.directProxyUrls, function(pattern) {
            return req.url.match(new RegExp(pattern, 'g'));
        });

        // if url is a direct proxy request, use http-proxy
        if (useDirectProxy) {

            proxy.web(req, res, {
                target: 'http://'+ config.private_host + ':' + config.private_port
            });
            return;

        } else {

            // This are the normal requests
            req.options.headers['user-agent'] = req.headers['user-agent'];
            
            request(req.options, function(err, private_res, body) {
                var timing = Date.now() - start;
                if(err) {
                    log.error({err:err,res:private_res,body:body});
                    res.send(500, {err:' auth_proxy_error', des: 'there was an internal error when redirecting the call to protected service'});
                } else {
                    try{
                        body = JSON.parse(body);
                        log.info('<= ' + private_res.statusCode + ' json body' + ' ' + timing + 'ms');
                    } catch(ex) {
                        log.info('<= ' + private_res.statusCode + ' no json body' + ' ' + timing + 'ms');
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
}

module.exports = propagateRequest;
