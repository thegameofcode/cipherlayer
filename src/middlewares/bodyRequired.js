'use strict';

const BODY_REQUIRED_ERROR = {
	err: 'invalid_body',
	des: 'The call to this url must have body.'
};

module.exports = function requireBody(req, res, next) {
	if (!req.body) {
		res.send(400, BODY_REQUIRED_ERROR);
		return next(BODY_REQUIRED_ERROR);
	}

	return next();
};
