'use strict';

const config = require('../../config.json');
const fs = require('fs');

function prepareOptions(req, res, next) {
	const options = {
		url: `http://${config.private_host}:${config.private_port}${req.url}`,
		headers: {
			'Content-Type': req.header('Content-Type'),
			'x-user-id': req.tokenInfo.userId,
			Host: req.headers.host,
			'X-Real-IP': req.connection.remoteAddress,
			'X-Forwarded-For': req.header('X-Forwarded-For') || req.connection.remoteAddress
		},
		method: req.method,
		followRedirect: false
	};

	if (req.tokenInfo.data) {
		if (req.tokenInfo.data.realms) {
			options.headers['x-user-realms'] = req.tokenInfo.data.realms.join(',');
		}
		if (req.tokenInfo.data.capabilities) {
			options.headers['x-user-capabilities'] = JSON.stringify(req.tokenInfo.data.capabilities);
		}
	}

	if (req.header('Content-Type') && req.header('Content-Type').indexOf('multipart/form-data') > -1) {
		const formData = Object.assign({}, req.body);
		const files = req.files;

		if(files){
			Object.keys(files).forEach( function (filekey){
				formData[filekey] = fs.createReadStream(files[filekey].path);
			});
		}
		options.formData = formData;
	} else {
		options.headers['Content-Type'] = req.header('Content-Type');
		if (req.body) {
			options.body = JSON.stringify(req.body);
		}
	}
	req.options = options;
	return next();
}

module.exports = prepareOptions;
