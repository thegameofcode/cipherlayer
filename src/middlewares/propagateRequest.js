var config = require('../../config.json');
var debug = require('debug')('cipherlayer:service');
var request = require('request');
var httpProxy = require('http-proxy');
var _ = require('lodash');

var proxy = httpProxy.createProxyServer({});

proxy.on('proxyReq', function(proxyReq, req, res, options) {
    debug('> http-proxy request received');
});

proxy.on('proxyRes', function() {
    debug('< http-proxy response received');
});

proxy.on('error', function (err, req, res) {
    debug('http-proxy error occurred', err);
    res.send(500, {err:' auth_proxy_error', des: 'there was an internal error when redirecting the call to protected service'});
});




function propagateRequest(req, res, next){
    var start = Date.now();

        var useDirectProxy = _.some(config.directProxyUrls, function(pattern) {
            return req.url.match(new RegExp(pattern, 'g'));
        });

        // if url is a direct proxy request, use http-proxy
        if (useDirectProxy) {

            // add user id to proxy request headers
            req.headers['x-user-id'] = req.options.headers['x-user-id'];
            proxy.web(req, res, {
                target: 'http://'+ config.private_host + ':' + config.private_port
            });
            return;

        } else {

            // This are the normal requests

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
}

module.exports = propagateRequest;
