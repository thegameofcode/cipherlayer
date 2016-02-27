'use strict';

var restify = require('restify');
var _ = require('lodash');

var log = require('./logger/service.js');
var bodyParserWrapper = require('./middlewares/bodyParserWrapper');

var routes = require('./internal_routes/routes');

module.exports = function () {
	var service = {};

	var server;
	service.start = function (internalPort, done) {
		if (!internalPort) {
			log.info('INTERNAL SERVICE not started because there is no internal_port in config');
			return done();
		}

		log.info('INTERNAL SERVICE starting on PORT ' + internalPort);

		server = restify.createServer({
			name: 'cipherlayer-internal-server',
			log: log
		});

		server.on('after', function (req, res) {
			var logInfo = {
				request: {
					method: req.method,
					headers: req.headers,
					url: req.url,
					path: req._url.pathname,
					query: req._url.query,
					params: req.params,
					time: req._time
				},
				response: {
					statusCode: res.statusCode,
					hasBody: res.hasBody,
					bodySize: _.size(res.body),
					time: Date.now()
				},
				user: req.user,
				tokenInfo: req.tokenInfo
			};
			delete(logInfo.request.params.password);

			req.log.info(logInfo, "response");
		});

		server.use(restify.queryParser());
		server.use(bodyParserWrapper(restify.bodyParser({maxBodySize: 1024 * 1024 * 3})));

		routes(server);

		server.listen(internalPort, function () {
			log.info('INTERNAL SERVICE listening on PORT ' + internalPort);
			done();
		});
	};

	service.stop = function (done) {
		if (!server) {
			return done();
		}
		server.close(function () {
			done();
		});
	};

	return service;
}();
