"use strict";

var log = require('../logger/service.js');
var config = require(process.cwd() + '/config.json');
var request = require('request');
var httpProxy = require('http-proxy');
var _ = require('lodash');

var proxy = httpProxy.createProxyServer({});

proxy.on('proxyReq', function () {
	log.info('> http-proxy request received');
});

proxy.on('proxyRes', function () {
	log.info('< http-proxy response received');
});

proxy.on('error', function (err, req, res) {
	log.error({err: err, des: 'there was an internal error when redirecting the call to protected service'});
	res.send(500, {
		err: ' auth_proxy_error',
		des: 'there was an internal error when redirecting the call to protected service'
	});
});

function propagateRequest(req, res, next) {
	var start = Date.now();

	var useDirectProxy = _.some(config.directProxyUrls, function (pattern) {
		return req.url.match(new RegExp(pattern, 'g'));
	});

	// if url is a direct proxy request, use http-proxy
	if (useDirectProxy) {

		// add user id to proxy request headers
		req.headers['x-user-id'] = req.options.headers['x-user-id'];

		proxy.web(req, res, {
			target: 'http://' + config.private_host + ':' + config.private_port
		});
		return;

	}

	// This are the normal requests
	req.options.headers['user-agent'] = req.headers['user-agent'];
	request(req.options, function (err, private_res, body) {
		var end = Date.now();
		if (err) {
			log.error({err: err, res: private_res, body: body});
			res.send(500, {
				err: ' auth_proxy_error',
				des: 'there was an internal error when redirecting the call to protected service'
			});
			return next();
		}

		try {
			body = JSON.parse(body);
		} catch (ex) {
			log.error({err: 'json_parse_error', des: 'error parsing body from response'});
		}

		log.info({
			request: {
				url: req.options.url,
				method: req.options.method,
				headers: req.options.headers,
				time: start
			},
			response: {
				statusCode: private_res.statusCode,
				hasBody: (_.size(private_res.body) > 0),
				time: end
			},
			user: req.user
		}, 'proxy call');

		transferAllowedHeaders(config.allowedHeaders, private_res, res);

		if (private_res.statusCode === 302) {
			res.header('Location', private_res.headers.location);
			res.send(302);
		} else {
			res.send(Number(private_res.statusCode), body);
		}

		return next();
	});
}

function transferAllowedHeaders(headers, srcRes, dstRes) {
	_.map(headers, function (header) {
		if (srcRes.headers[header]) {
			dstRes.header(header, srcRes.headers[header]);
		}
	});
}

module.exports = propagateRequest;
