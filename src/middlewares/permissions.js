'use strict';

const _ = require('lodash');
const config = require('../../config');

module.exports = function checkPermissions(req, res, next) {
	if (!config.endpoints) {
		return next();
	}

	const roles = req.tokenInfo.data.roles || ['user'];
	const path = req._url.pathname;
	const method = req.method;

	let hasPermissions = false;

	//TODO: replace with map() or some()
	for (let i = 0; i < config.endpoints.length; i++) {
		const matchPath = path.match(new RegExp(config.endpoints[i].path, 'g'));
		const matchMethod = _.includes(config.endpoints[i].methods, method);

		if (matchPath && matchMethod) {

			// TODO; replace with map() or some()
			for (let j = 0; j < roles.length; j++) {
				const matchRole = _.includes(config.endpoints[i].roles, roles[j]);
				if (matchRole) {
					hasPermissions = true;
					break;
				}
			}
			break;
		}
	}

	if (!hasPermissions) {
		res.send(401, {err: 'unauthorized'});
		return next({err: 'unauthorized'});
	}
	return next();
};
